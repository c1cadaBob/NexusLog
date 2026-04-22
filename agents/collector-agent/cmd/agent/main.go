// NexusLog Collector Agent 入口
// 日志采集代理，支持插件化架构（gRPC + WASM）、
// checkpoint 断点续传（at-least-once 语义）、
// 指数退避重试和本地磁盘缓存、Kafka Producer 发送
package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/nexuslog/collector-agent/internal/checkpoint"
	"github.com/nexuslog/collector-agent/internal/collector"
	"github.com/nexuslog/collector-agent/internal/metrics"
	"github.com/nexuslog/collector-agent/internal/pipeline"
	"github.com/nexuslog/collector-agent/internal/pullapi"
	"github.com/nexuslog/collector-agent/internal/pullv2"
	"github.com/nexuslog/collector-agent/internal/retry"
	"github.com/nexuslog/collector-agent/plugins"
)

const (
	weakDefaultAgentAPIKey = "dev-agent-key"
	minAgentAPIKeyLength   = 24
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("启动 NexusLog Collector Agent...")

	configPath := getEnv("CONFIG_PATH", "./configs/agent.yaml")
	log.Printf("加载配置: %s", configPath)

	httpPort := getEnv("HTTP_PORT", "9091")
	rewriteMode := !isTruthy(getEnv("LEGACY_LOG_PIPELINE_ENABLED", "false"))
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if rewriteMode {
		log.Println("legacy log pipeline 已禁用，agent 启用 rewrite v2 + pull 兼容接口")
	}

	// 1. 初始化 checkpoint 存储（at-least-once 语义保证）
	ckpDir := getEnv("CHECKPOINT_DIR", "/var/lib/collector-agent/checkpoints")
	ckpStore, err := checkpoint.NewFileStore(ckpDir)
	if err != nil {
		log.Fatalf("初始化 checkpoint 存储失败: %v", err)
	}
	defer ckpStore.Close()
	log.Println("Checkpoint 存储已初始化")

	// 2. 初始化插件注册表（gRPC + WASM 插件系统）
	registry := plugins.NewRegistry()
	// TODO: 根据配置文件加载 gRPC/WASM 插件
	// 示例:
	//   grpcPlugin := grpcplugin.New("example-grpc", "localhost:9091")
	//   grpcPlugin.Init(map[string]string{"addr": "localhost:9091"})
	//   registry.Register(grpcPlugin)
	log.Println("插件注册表已初始化")

	activeKeyID, activeKey, nextKeyID, nextKey, err := resolveAgentAPIKeyConfig()
	if err != nil {
		log.Fatalf("初始化 Agent API Key 配置失败: %v", err)
	}

	// 3. 初始化 pull API 服务（供控制面主动拉取日志）
	pullService := pullapi.New(ckpStore)
	authConfig := pullapi.NewAuthConfig(
		activeKeyID,
		activeKey,
		nextKeyID,
		nextKey,
	)

	pullV2RecordBufferingEnabled := rewriteMode && isTruthy(getEnv("PULLV2_ENABLE_RECORD_BUFFERING", "false"))
	var pullV2Service *pullv2.Service
	var pullV2Auth pullv2.AuthConfig
	if rewriteMode {
		pullV2MaxBufferedRecords := parseEnvInt("PULLV2_MAX_BUFFERED_RECORDS", 10000)
		pullV2Service = pullv2.New(
			pullV2MaxBufferedRecords,
			pullV2CheckpointSaver{store: ckpStore},
		)
		pullV2Auth = pullv2.NewAuthConfig(
			activeKeyID,
			activeKey,
			nextKeyID,
			nextKey,
		)
		if pullV2RecordBufferingEnabled {
			log.Printf("pullv2 record buffering enabled, max_buffered_records=%d", pullV2MaxBufferedRecords)
		} else {
			log.Printf("pullv2 record buffering disabled; set PULLV2_ENABLE_RECORD_BUFFERING=true to enqueue rewrite pull batches")
		}
	}

	// 4. 初始化采集器（7.6：支持 include/exclude 采集范围）
	const defaultCollectorIncludePaths = "/var/log/*.log,/var/log/messages,/var/log/secure,/var/log/cron,/var/log/maillog,/var/log/spooler,/var/log/boot.log,/var/log/command_audit.log,/var/log/kdump.log,/var/log/*/*.log,/var/log/*/*_log"
	const defaultCollectorCriticalIncludePaths = "/var/log/messages,/var/log/secure,/var/log/cron,/var/log/maillog,/var/log/spooler"
	includePaths := parseCSV(getEnv("COLLECTOR_INCLUDE_PATHS", defaultCollectorIncludePaths))
	criticalIncludePaths := parseCSV(getEnv("COLLECTOR_CRITICAL_INCLUDE_PATHS", defaultCollectorCriticalIncludePaths))
	excludePaths := parseCSV(getEnv("COLLECTOR_EXCLUDE_PATHS", ""))
	criticalKeywords := parseCSV(getEnv("COLLECTOR_CRITICAL_KEYWORDS", "critical,fatal,panic,error,alert,security"))
	normalFlushInterval := parseDurationEnv("COLLECTOR_FLUSH_INTERVAL", 5*time.Second)
	criticalFlushInterval := parseDurationEnv("COLLECTOR_CRITICAL_FLUSH_INTERVAL", 500*time.Millisecond)
	perFileReadLimit := parseEnvInt("COLLECTOR_PER_FILE_READ_LIMIT", 200)
	enableFSNotify := isTruthy(getEnv("COLLECTOR_ENABLE_FSNOTIFY", "true"))
	eventDebounce := parseDurationEnv("COLLECTOR_EVENT_DEBOUNCE", 200*time.Millisecond)
	pathLabelRules, err := parsePathLabelRules(getEnv("COLLECTOR_PATH_LABEL_RULES", ""))
	if err != nil {
		log.Printf("解析 COLLECTOR_PATH_LABEL_RULES 失败，已忽略路径标签配置: %v", err)
		pathLabelRules = nil
	}
	syslogSourceConfigs, err := parseSyslogSourceConfigs(getEnv("COLLECTOR_SYSLOG_LISTENERS_JSON", ""))
	if err != nil {
		log.Printf("解析 COLLECTOR_SYSLOG_LISTENERS_JSON 失败，已忽略 syslog 监听配置: %v", err)
		syslogSourceConfigs = nil
	}

	sourceConfigs := make([]collector.SourceConfig, 0, 2+len(syslogSourceConfigs))
	if len(criticalIncludePaths) > 0 {
		sourceConfigs = append(sourceConfigs, collector.SourceConfig{
			Type:             collector.SourceTypeFile,
			Paths:            criticalIncludePaths,
			ExcludePaths:     excludePaths,
			PathLabelRules:   pathLabelRules,
			ScanInterval:     criticalFlushInterval,
			Priority:         collector.SourcePriorityCritical,
			CriticalKeywords: criticalKeywords,
		})
	}
	normalExcludePaths := append([]string{}, excludePaths...)
	normalExcludePaths = append(normalExcludePaths, criticalIncludePaths...)
	if len(includePaths) > 0 {
		sourceConfigs = append(sourceConfigs, collector.SourceConfig{
			Type:             collector.SourceTypeFile,
			Paths:            includePaths,
			ExcludePaths:     normalExcludePaths,
			PathLabelRules:   pathLabelRules,
			ScanInterval:     normalFlushInterval,
			Priority:         collector.SourcePriorityNormal,
			CriticalKeywords: criticalKeywords,
		})
	}
	sourceConfigs = append(sourceConfigs, syslogSourceConfigs...)
	if len(sourceConfigs) == 0 {
		sourceConfigs = append(sourceConfigs, collector.SourceConfig{
			Type:             collector.SourceTypeFile,
			Paths:            parseCSV(defaultCollectorIncludePaths),
			ExcludePaths:     excludePaths,
			PathLabelRules:   pathLabelRules,
			ScanInterval:     normalFlushInterval,
			Priority:         collector.SourcePriorityNormal,
			CriticalKeywords: criticalKeywords,
		})
	}
	coll := collector.New(collector.Config{
		Sources:          sourceConfigs,
		BatchSize:        parseEnvInt("COLLECTOR_BATCH_SIZE", 1000),
		FlushInterval:    normalFlushInterval,
		BufferSize:       parseEnvInt("COLLECTOR_BUFFER_SIZE", 10000),
		PerFileReadLimit: perFileReadLimit,
		EnableFSNotify:   &enableFSNotify,
		EventDebounce:    eventDebounce,
		CriticalKeywords: criticalKeywords,
	}, ckpStore)

	// 5. 交付路径：默认 dual，兼容 pull | kafka | dual。
	deliveryMode := normalizeDeliveryMode(getEnv("DELIVERY_MODE", "dual"))
	enablePullDelivery := deliveryMode != "kafka"
	enableKafkaPipeline := deliveryMode != "pull" && isTruthy(getEnv("ENABLE_KAFKA_PIPELINE", "true"))
	kafkaBrokers := parseCSV(getEnv("KAFKA_BROKERS", "localhost:9092"))
	if len(kafkaBrokers) == 0 {
		kafkaBrokers = []string{"localhost:9092"}
	}
	kafkaTopic := getEnv("KAFKA_TOPIC", "nexuslog.logs.raw")
	kafkaSchemaRegistryURL := firstNonEmptyString(
		getEnv("KAFKA_SCHEMA_REGISTRY_URL", ""),
		getEnv("SCHEMA_REGISTRY_URL", ""),
	)
	kafkaSchemaSubject := getEnv("KAFKA_SCHEMA_SUBJECT", kafkaTopic+"-value")
	kafkaSchemaFile := getEnv("KAFKA_SCHEMA_FILE", "")
	kafkaRequiredAcks := parseKafkaRequiredAcks(getEnv("KAFKA_REQUIRED_ACKS", "all"), -1)

	var pipe *pipeline.Pipeline
	if enableKafkaPipeline {
		producer, producerErr := pipeline.NewKafkaProducer(pipeline.KafkaConfig{
			Brokers:           kafkaBrokers,
			Topic:             kafkaTopic,
			Compression:       "snappy",
			BatchSize:         500,
			Acks:              kafkaRequiredAcks,
			SchemaRegistryURL: kafkaSchemaRegistryURL,
			SchemaSubject:     kafkaSchemaSubject,
			SchemaFile:        kafkaSchemaFile,
		})
		if producerErr != nil {
			log.Printf("Kafka Producer 初始化失败，降级为 pull-only 模式: %v", producerErr)
			enableKafkaPipeline = false
		} else {
			pipe, err = pipeline.New(pipeline.Config{
				Workers:     4,
				Topic:       kafkaTopic,
				CacheDir:    getEnv("CACHE_DIR", "/var/lib/collector-agent/cache"),
				RetryConfig: retry.DefaultConfig(),
			}, registry, producer, ckpStore)
			if err != nil {
				log.Printf("处理管道初始化失败，降级为 pull-only 模式: %v", err)
				_ = producer.Close()
				enableKafkaPipeline = false
			} else {
				log.Println("Kafka 兼容链路已启用（P1）")
			}
		}
	} else {
		log.Println("Kafka 兼容链路已禁用（ENABLE_KAFKA_PIPELINE=false）")
	}

	sourceHostname := resolveSourceHostname()
	sourceIP := resolveSourceIP()
	metaInfo := buildMetaInfo(sourceConfigs, sourceHostname, sourceIP)
	pullService.SetAgentInfo(metaInfo.AgentID, metaInfo.Version, metaInfo.Hostname, metaInfo.IP)
	if !enablePullDelivery && (!enableKafkaPipeline || pipe == nil) {
		log.Printf("delivery mode=%s 但 Kafka 链路不可用，回退为 pull-only", deliveryMode)
		enablePullDelivery = true
	}

	// 6. 启动采集器与数据分发。
	if err := coll.Start(ctx); err != nil {
		log.Fatalf("启动采集器失败: %v", err)
	}

	var pipelineInputCh chan []plugins.Record
	if enableKafkaPipeline && pipe != nil {
		pipelineInputCh = make(chan []plugins.Record, 128)
		go fanOutCollectorOutput(ctx, coll.Output(), pipelineInputCh, pullService, pullV2Service, enablePullDelivery, pullV2RecordBufferingEnabled, deliveryMode, metaInfo.AgentID, metaInfo.Hostname, metaInfo.IP)
		pipe.Start(ctx, pipelineInputCh)
		if enablePullDelivery {
			log.Println("采集分发已启动：pull + kafka-compat")
		} else {
			log.Println("采集分发已启动：kafka-only")
		}
	} else {
		go fanOutCollectorOutput(ctx, coll.Output(), nil, pullService, pullV2Service, enablePullDelivery, pullV2RecordBufferingEnabled, deliveryMode, metaInfo.AgentID, metaInfo.Hostname, metaInfo.IP)
		if enablePullDelivery {
			log.Println("采集分发已启动：pull-only")
		} else {
			log.Println("采集分发已启动：no-output")
		}
	}

	// 7. 启动系统资源指标采集器（每 30s 采集一次）
	systemMetricsInterval := parseDurationEnv("AGENT_SYSTEM_METRICS_INTERVAL", 30*time.Second)
	sysMetrics := metrics.NewCollector(systemMetricsInterval)
	sysMetrics.Start()
	defer sysMetrics.Stop()

	metricsReporter, err := metrics.NewReporter(metrics.ReporterConfig{
		Enabled:    isTruthy(getEnv("AGENT_METRICS_REPORT_ENABLED", "false")),
		BaseURL:    getEnv("CONTROL_PLANE_BASE_URL", "http://localhost:8080"),
		Path:       getEnv("AGENT_METRICS_REPORT_PATH", "/api/v1/metrics/report"),
		AgentID:    metaInfo.AgentID,
		ServerID:   firstNonEmptyString(metaInfo.Hostname, metaInfo.AgentID),
		AgentKeyID: activeKeyID,
		AgentKey:   activeKey,
		Interval:   parseDurationEnv("AGENT_METRICS_REPORT_INTERVAL", systemMetricsInterval),
		Timeout:    parseDurationEnv("AGENT_METRICS_REPORT_TIMEOUT", 10*time.Second),
	})
	if err != nil {
		log.Printf("初始化系统指标上报器失败: %v", err)
	} else if metricsReporter != nil {
		metricsReporter.Start(ctx, sysMetrics)
		log.Printf("系统指标上报已启用: endpoint=%s interval=%s", getEnv("AGENT_METRICS_REPORT_PATH", "/api/v1/metrics/report"), parseDurationEnv("AGENT_METRICS_REPORT_INTERVAL", systemMetricsInterval))
	}

	// 8. 启动健康检查与 Agent Pull API HTTP 端点
	var httpServer *http.Server
	if rewriteMode {
		httpServer = startRewriteHTTPServer(
			httpPort,
			sysMetrics,
			pullService,
			metaInfo,
			authConfig,
			pullV2Service,
			buildMetaInfoV2(metaInfo),
			pullV2Auth,
		)
	} else {
		httpServer = startHTTPServer(httpPort, pullService, metaInfo, authConfig, sysMetrics)
	}

	waitForShutdown(cancel, httpServer, pipe)
	fmt.Println("Collector Agent 已停止")
}

// fanOutCollectorOutput 将采集批次广播到 pull API 与 pipeline 输入通道。
func fanOutCollectorOutput(ctx context.Context, collectorOut <-chan []plugins.Record, pipelineIn chan<- []plugins.Record, pullService *pullapi.Service, pullV2Service *pullv2.Service, enablePullDelivery, enablePullV2RecordBuffering bool, deliveryMode, agentID, sourceHostname, sourceIP string) {
	if pipelineIn != nil {
		defer close(pipelineIn)
	}

	for {
		select {
		case <-ctx.Done():
			return
		case batch, ok := <-collectorOut:
			if !ok {
				return
			}

			batchID := fmt.Sprintf("agent-batch-%d", time.Now().UTC().UnixNano())
			if enablePullDelivery {
				pullBatch := enrichBatchForChannel(batch, agentID, sourceHostname, sourceIP, batchID, deliveryMode, "pull")
				if pullService != nil {
					pullService.AddRecords(pullBatch)
				}
				if pullV2Service != nil && enablePullV2RecordBuffering {
					appendBatchToPullV2(pullV2Service, pullBatch)
				}
			}
			if pipelineIn == nil {
				continue
			}
			select {
			case pipelineIn <- enrichBatchForChannel(batch, agentID, sourceHostname, sourceIP, batchID, deliveryMode, "kafka"):
			case <-ctx.Done():
				return
			}
		}
	}
}

type pullV2CheckpointSaver struct {
	store checkpoint.Store
}

func (s pullV2CheckpointSaver) Save(_ string, filePath string, offset int64) error {
	if s.store == nil {
		return nil
	}
	filePath = strings.TrimSpace(filePath)
	if filePath == "" {
		return nil
	}
	return s.store.Save(filePath, offset)
}

func buildMetaInfoV2(meta pullapi.MetaInfo) pullv2.MetaInfo {
	v2Meta := pullv2.BuildDefaultMeta(meta.AgentID, meta.Version)
	v2Meta.Status = "online"
	v2Meta.Hostname = strings.TrimSpace(meta.Hostname)
	v2Meta.IP = strings.TrimSpace(meta.IP)
	if len(meta.Capabilities) > 0 {
		caps := append(append([]string{}, v2Meta.Capabilities...), meta.Capabilities...)
		v2Meta.Capabilities = uniqueStrings(caps)
	}
	return v2Meta
}

func appendBatchToPullV2(svc *pullv2.Service, batch []plugins.Record) {
	if svc == nil || len(batch) == 0 {
		return
	}

	grouped := make(map[string][]pullv2.Record)
	for _, record := range batch {
		sourceKey := resolvePullV2SourceKey(record)
		grouped[sourceKey] = append(grouped[sourceKey], toPullV2Record(record))
	}

	for sourceKey, records := range grouped {
		if err := svc.Append(sourceKey, records); err != nil {
			log.Printf("pullv2 append failed [%s]: %v", sourceKey, err)
		}
	}
}

func resolvePullV2SourceKey(record plugins.Record) string {
	for _, candidate := range []string{
		strings.TrimSpace(record.Metadata["source_collect_path"]),
		strings.TrimSpace(record.Metadata["source_path"]),
		strings.TrimSpace(record.Source),
	} {
		if candidate != "" {
			return candidate
		}
	}
	return "default"
}

func toPullV2Record(record plugins.Record) pullv2.Record {
	metadata := cloneMetadata(record.Metadata)
	offset, _ := strconv.ParseInt(strings.TrimSpace(metadata["offset"]), 10, 64)
	observedAt := time.Now().UTC()
	if record.Timestamp > 0 {
		observedAt = time.Unix(0, record.Timestamp).UTC()
	}

	return pullv2.Record{
		RecordID:   firstNonEmptyString(strings.TrimSpace(metadata["event_id"]), strings.TrimSpace(metadata["record_id"])),
		FilePath:   firstNonEmptyString(strings.TrimSpace(metadata["source_collect_path"]), strings.TrimSpace(metadata["source_path"]), strings.TrimSpace(record.Source)),
		Body:       string(record.Data),
		Offset:     offset,
		ObservedAt: observedAt,
		Attributes: metadata,
	}
}

func firstNonEmptyString(candidates ...string) string {
	for _, candidate := range candidates {
		candidate = strings.TrimSpace(candidate)
		if candidate != "" {
			return candidate
		}
	}
	return ""
}

func uniqueStrings(values []string) []string {
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func normalizeDeliveryMode(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "pull":
		return "pull"
	case "kafka":
		return "kafka"
	default:
		return "dual"
	}
}

func parseKafkaRequiredAcks(raw string, fallback int) int {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "all", "-1":
		return -1
	case "leader", "1":
		return 1
	case "none", "0":
		return 0
	default:
		return fallback
	}
}

func enrichBatchForChannel(batch []plugins.Record, agentID, sourceHostname, sourceIP, batchID, deliveryMode, channel string) []plugins.Record {
	enriched := make([]plugins.Record, 0, len(batch))
	for _, record := range batch {
		cloned := plugins.Record{
			Source:    record.Source,
			Timestamp: record.Timestamp,
			Data:      append([]byte(nil), record.Data...),
			Metadata:  cloneMetadata(record.Metadata),
		}
		ensureRecordEnvelope(&cloned, agentID, sourceHostname, sourceIP, batchID, deliveryMode, channel)
		enriched = append(enriched, cloned)
	}
	return enriched
}

func cloneMetadata(source map[string]string) map[string]string {
	if len(source) == 0 {
		return make(map[string]string)
	}
	cloned := make(map[string]string, len(source))
	for key, value := range source {
		cloned[key] = value
	}
	return cloned
}

func ensureRecordEnvelope(record *plugins.Record, agentID, sourceHostname, sourceIP, batchID, deliveryMode, channel string) {
	if record == nil {
		return
	}
	if record.Metadata == nil {
		record.Metadata = make(map[string]string)
	}
	if strings.TrimSpace(record.Metadata["agent_id"]) == "" && strings.TrimSpace(agentID) != "" {
		record.Metadata["agent_id"] = strings.TrimSpace(agentID)
	}
	if strings.TrimSpace(record.Metadata["source_path"]) == "" && strings.TrimSpace(record.Source) != "" {
		record.Metadata["source_path"] = strings.TrimSpace(record.Source)
	}
	if strings.TrimSpace(record.Metadata["source_collect_path"]) == "" && strings.TrimSpace(record.Source) != "" {
		record.Metadata["source_collect_path"] = strings.TrimSpace(record.Source)
	}
	if strings.TrimSpace(record.Metadata["batch_id"]) == "" {
		record.Metadata["batch_id"] = strings.TrimSpace(batchID)
	}
	enrichDockerContainerMetadata(record)
	if strings.TrimSpace(record.Metadata["agent.hostname"]) == "" && strings.TrimSpace(sourceHostname) != "" {
		record.Metadata["agent.hostname"] = strings.TrimSpace(sourceHostname)
	}
	ensureRecordHostMetadata(record, sourceHostname, sourceIP)
	record.Metadata["delivery.mode"] = strings.TrimSpace(deliveryMode)
	record.Metadata["transport.channel"] = strings.TrimSpace(channel)
	if strings.TrimSpace(record.Metadata["schema_version"]) == "" {
		record.Metadata["schema_version"] = "log-raw/v1"
	}
	if strings.TrimSpace(record.Metadata["event_id"]) == "" {
		record.Metadata["event_id"] = buildRecordEventID(agentID, *record)
	}
	if strings.TrimSpace(record.Metadata["dedupe_key"]) == "" {
		record.Metadata["dedupe_key"] = buildRecordDedupKey(agentID, *record)
	}
}

func buildRecordEventID(agentID string, record plugins.Record) string {
	parts := []string{
		strings.TrimSpace(agentID),
		strings.TrimSpace(record.Source),
		strings.TrimSpace(record.Metadata["offset"]),
		strconv.FormatInt(record.Timestamp, 10),
		strings.TrimSpace(string(record.Data)),
	}
	hash := sha256.Sum256([]byte(strings.Join(parts, "|")))
	return hex.EncodeToString(hash[:])
}

func buildRecordDedupKey(agentID string, record plugins.Record) string {
	parts := []string{
		strings.TrimSpace(agentID),
		strings.TrimSpace(record.Source),
		strings.TrimSpace(string(record.Data)),
	}
	hash := sha256.Sum256([]byte(strings.Join(parts, "|")))
	return hex.EncodeToString(hash[:])
}

func isTruthy(raw string) bool {
	value := strings.ToLower(strings.TrimSpace(raw))
	return value == "1" || value == "true" || value == "yes" || value == "on"
}

func parseCSV(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed == "" {
			continue
		}
		result = append(result, trimmed)
	}
	return result
}

func parseDurationEnv(key string, fallback time.Duration) time.Duration {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(raw)
	if err != nil {
		return fallback
	}
	if parsed <= 0 {
		return fallback
	}
	return parsed
}

func parseEnvInt(key string, fallback int) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(raw)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

type pathLabelRuleEnv struct {
	Pattern string            `json:"pattern"`
	Labels  map[string]string `json:"labels"`
}

type syslogListenerEnv struct {
	Protocol string `json:"protocol"`
	Bind     string `json:"bind"`
}

// parsePathLabelRules 解析路径标签规则，支持 JSON 数组输入：
// [{"pattern":"/var/log/nginx/*.log","labels":{"service":"nginx"}}]
func parsePathLabelRules(raw string) ([]collector.PathLabelRule, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}

	var decoded []pathLabelRuleEnv
	if err := json.Unmarshal([]byte(raw), &decoded); err != nil {
		return nil, err
	}

	rules := make([]collector.PathLabelRule, 0, len(decoded))
	for _, item := range decoded {
		pattern := strings.TrimSpace(item.Pattern)
		if pattern == "" || len(item.Labels) == 0 {
			continue
		}

		labels := make(map[string]string, len(item.Labels))
		for key, value := range item.Labels {
			trimmedKey := strings.TrimSpace(key)
			if trimmedKey == "" {
				continue
			}
			// offset 作为系统关键字段，避免被配置覆盖。
			if trimmedKey == "offset" {
				continue
			}
			labels[trimmedKey] = strings.TrimSpace(value)
		}
		if len(labels) == 0 {
			continue
		}
		rules = append(rules, collector.PathLabelRule{
			Pattern: pattern,
			Labels:  labels,
		})
	}
	if len(rules) == 0 {
		return nil, nil
	}
	return rules, nil
}

func parseSyslogSourceConfigs(raw string) ([]collector.SourceConfig, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}

	var decoded []syslogListenerEnv
	if err := json.Unmarshal([]byte(raw), &decoded); err != nil {
		return nil, err
	}

	items := make([]collector.SourceConfig, 0, len(decoded))
	for _, item := range decoded {
		protocol := strings.ToLower(strings.TrimSpace(item.Protocol))
		if protocol == "" {
			protocol = "udp"
		}
		if protocol != "udp" && protocol != "tcp" {
			return nil, fmt.Errorf("syslog protocol must be udp or tcp")
		}
		bind := strings.TrimSpace(item.Bind)
		if bind == "" {
			bind = "0.0.0.0:5514"
		}
		items = append(items, collector.SourceConfig{
			Type:     collector.SourceTypeSyslog,
			Protocol: protocol,
			Bind:     bind,
		})
	}
	if len(items) == 0 {
		return nil, nil
	}
	return items, nil
}

// buildMetaInfo 构造 /agent/v1/meta 响应。
func buildMetaInfo(sourceConfigs []collector.SourceConfig, sourceHostname, sourceIP string) pullapi.MetaInfo {
	sourcePaths := make([]string, 0)
	capabilities := []string{
		"file_incremental",
		"pull_api",
		"ack_checkpoint",
	}
	hasSyslog := false
	for _, source := range sourceConfigs {
		switch source.Type {
		case collector.SourceTypeFile:
			sourcePaths = append(sourcePaths, source.Paths...)
		case collector.SourceTypeSyslog:
			hasSyslog = true
			sourcePaths = append(sourcePaths, fmt.Sprintf("syslog://%s/%s", strings.ToLower(strings.TrimSpace(source.Protocol)), strings.TrimSpace(source.Bind)))
		}
	}
	if hasSyslog {
		capabilities = append(capabilities, "syslog_listener")
	}
	return pullapi.MetaInfo{
		AgentID:      getEnv("AGENT_ID", "collector-agent-local"),
		Version:      getEnv("AGENT_VERSION", "0.1.2"),
		Hostname:     sourceHostname,
		IP:           sourceIP,
		Status:       "online",
		Sources:      sourcePaths,
		Capabilities: capabilities,
	}
}

// startHTTPServer 启动健康检查与 agent pull API 服务。
func startHTTPServer(port string, pullService *pullapi.Service, meta pullapi.MetaInfo, auth pullapi.AuthConfig, sysMetrics *metrics.Collector) *http.Server {
	mux := http.NewServeMux()

	mux.Handle("/agent/v1/metrics", metrics.MetricsHandler(sysMetrics))

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"healthy","service":"collector-agent","time":"%s"}`,
			time.Now().UTC().Format(time.RFC3339))
	})

	mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"ready","service":"collector-agent","time":"%s"}`,
			time.Now().UTC().Format(time.RFC3339))
	})
	pullapi.RegisterRoutes(mux, pullService, meta, auth)

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("健康检查 HTTP 服务监听端口 :%s", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("HTTP 服务启动失败: %v", err)
		}
	}()

	return server
}

func waitForShutdown(cancel context.CancelFunc, httpServer *http.Server, pipe *pipeline.Pipeline) {
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("收到关闭信号，正在停止...")

	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Printf("HTTP 服务关闭错误: %v", err)
	}

	if pipe != nil {
		pipe.Wait()
		if err := pipe.Close(); err != nil {
			log.Printf("管道关闭错误: %v", err)
		}
	}
}

func resolveSourceHostname() string {
	for _, candidate := range []string{
		strings.TrimSpace(getEnv("AGENT_SOURCE_HOSTNAME", "")),
		readTrimmedFirstLine(getEnv("AGENT_SOURCE_HOSTNAME_FILE", "/host/etc/nexuslog-host-meta/source_hostname")),
		readTrimmedFirstLine("/host/etc/hostname"),
	} {
		if candidate != "" {
			return candidate
		}
	}
	hostname, err := os.Hostname()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(hostname)
}

func readTrimmedFirstLine(path string) string {
	trimmedPath := strings.TrimSpace(path)
	if trimmedPath == "" {
		return ""
	}
	raw, err := os.ReadFile(trimmedPath)
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(string(raw), "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func ensureRecordHostMetadata(record *plugins.Record, sourceHostname, sourceIP string) {
	if record == nil {
		return
	}
	if record.Metadata == nil {
		record.Metadata = make(map[string]string)
	}

	hostName := firstNonEmptyString(
		strings.TrimSpace(record.Metadata["host.name"]),
		strings.TrimSpace(record.Metadata["host"]),
		strings.TrimSpace(record.Metadata["hostname"]),
		strings.TrimSpace(record.Metadata["syslog_hostname"]),
		strings.TrimSpace(record.Metadata["server_id"]),
		strings.TrimSpace(sourceHostname),
	)
	if hostName == "" {
		return
	}
	if strings.TrimSpace(record.Metadata["host.name"]) == "" {
		record.Metadata["host.name"] = hostName
	}
	if strings.TrimSpace(record.Metadata["host"]) == "" {
		record.Metadata["host"] = hostName
	}
	if strings.TrimSpace(record.Metadata["hostname"]) == "" && strings.TrimSpace(record.Metadata["syslog_hostname"]) != "" {
		record.Metadata["hostname"] = strings.TrimSpace(record.Metadata["syslog_hostname"])
	}

	hostIP := firstNonEmptyString(
		strings.TrimSpace(record.Metadata["host.ip"]),
		strings.TrimSpace(record.Metadata["host_ip"]),
		strings.TrimSpace(record.Metadata["server_ip"]),
		strings.TrimSpace(sourceIP),
	)
	if strings.TrimSpace(record.Metadata["host.ip"]) == "" && hostIP != "" {
		record.Metadata["host.ip"] = hostIP
	}

	agentIP := firstNonEmptyString(
		strings.TrimSpace(record.Metadata["agent.ip"]),
		strings.TrimSpace(record.Metadata["agent_ip"]),
		strings.TrimSpace(sourceIP),
	)
	if strings.TrimSpace(record.Metadata["agent.ip"]) == "" && agentIP != "" {
		record.Metadata["agent.ip"] = agentIP
	}
	if strings.TrimSpace(record.Metadata["agent_ip"]) == "" && agentIP != "" {
		record.Metadata["agent_ip"] = agentIP
	}
}

func resolveAgentAPIKeyConfig() (string, string, string, string, error) {
	activeKeyID := strings.TrimSpace(getEnv("AGENT_API_KEY_ACTIVE_ID", "active"))
	if activeKeyID == "" {
		activeKeyID = "active"
	}
	activeKey, err := validateAgentAPIKeyValue("AGENT_API_KEY_ACTIVE", getEnv("AGENT_API_KEY_ACTIVE", ""), true)
	if err != nil {
		return "", "", "", "", err
	}

	nextKeyID := strings.TrimSpace(getEnv("AGENT_API_KEY_NEXT_ID", "next"))
	if nextKeyID == "" {
		nextKeyID = "next"
	}
	nextKey, err := validateAgentAPIKeyValue("AGENT_API_KEY_NEXT", getEnv("AGENT_API_KEY_NEXT", ""), false)
	if err != nil {
		return "", "", "", "", err
	}
	if nextKey != "" {
		if nextKeyID == activeKeyID {
			return "", "", "", "", fmt.Errorf("AGENT_API_KEY_NEXT_ID must differ from AGENT_API_KEY_ACTIVE_ID")
		}
		if nextKey == activeKey {
			return "", "", "", "", fmt.Errorf("AGENT_API_KEY_NEXT must differ from AGENT_API_KEY_ACTIVE")
		}
	}
	return activeKeyID, activeKey, nextKeyID, nextKey, nil
}

func validateAgentAPIKeyValue(envKey, value string, required bool) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		if required {
			return "", fmt.Errorf("%s is required", envKey)
		}
		return "", nil
	}
	if trimmed == weakDefaultAgentAPIKey {
		return "", fmt.Errorf("%s uses a known weak default and must be replaced", envKey)
	}
	if len(trimmed) < minAgentAPIKeyLength {
		return "", fmt.Errorf("%s must be at least %d characters", envKey, minAgentAPIKeyLength)
	}
	return trimmed, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
