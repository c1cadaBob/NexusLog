// NexusLog Collector Agent 入口
// 日志采集代理，支持插件化架构（gRPC + WASM）、
// checkpoint 断点续传（at-least-once 语义）、
// 指数退避重试和本地磁盘缓存、Kafka Producer 发送
package main

import (
	"context"
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
	"github.com/nexuslog/collector-agent/internal/pipeline"
	"github.com/nexuslog/collector-agent/internal/pullapi"
	"github.com/nexuslog/collector-agent/internal/retry"
	"github.com/nexuslog/collector-agent/plugins"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("启动 NexusLog Collector Agent...")

	configPath := getEnv("CONFIG_PATH", "./configs/agent.yaml")
	log.Printf("加载配置: %s", configPath)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

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

	// 3. 初始化 pull API 服务（供控制面主动拉取日志）
	pullService := pullapi.New(ckpStore)
	authConfig := pullapi.NewAuthConfig(
		getEnv("AGENT_API_KEY_ACTIVE_ID", "active"),
		getEnv("AGENT_API_KEY_ACTIVE", "dev-agent-key"),
		getEnv("AGENT_API_KEY_NEXT_ID", "next"),
		getEnv("AGENT_API_KEY_NEXT", ""),
	)

	// 4. 初始化采集器（7.6：支持 include/exclude 采集范围）
	includePaths := parseCSV(getEnv("COLLECTOR_INCLUDE_PATHS", "/var/log/*.log"))
	criticalIncludePaths := parseCSV(getEnv("COLLECTOR_CRITICAL_INCLUDE_PATHS", ""))
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

	sourceConfigs := make([]collector.SourceConfig, 0, 2)
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
	if len(sourceConfigs) == 0 {
		sourceConfigs = append(sourceConfigs, collector.SourceConfig{
			Type:             collector.SourceTypeFile,
			Paths:            []string{"/var/log/*.log"},
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

	// 5. Kafka 主推链路降级为 P1 兼容项，不再阻塞 M2 pull 主路径启动。
	enableKafkaPipeline := isTruthy(getEnv("ENABLE_KAFKA_PIPELINE", "true"))
	kafkaBrokers := getEnv("KAFKA_BROKERS", "localhost:9092")
	kafkaTopic := getEnv("KAFKA_TOPIC", "nexuslog-raw-logs")

	var pipe *pipeline.Pipeline
	if enableKafkaPipeline {
		producer, producerErr := pipeline.NewKafkaProducer(pipeline.KafkaConfig{
			Brokers:     []string{kafkaBrokers},
			Topic:       kafkaTopic,
			Compression: "snappy",
			BatchSize:   500,
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

	// 6. 启动采集器与数据分发。
	if err := coll.Start(ctx); err != nil {
		log.Fatalf("启动采集器失败: %v", err)
	}

	var pipelineInputCh chan []plugins.Record
	if enableKafkaPipeline && pipe != nil {
		// 通过 fan-out 同时喂给 pull API 与兼容 pipeline。
		pipelineInputCh = make(chan []plugins.Record, 128)
		go fanOutCollectorOutput(ctx, coll.Output(), pipelineInputCh, pullService)
		pipe.Start(ctx, pipelineInputCh)
		log.Println("采集分发已启动：pull + kafka-compat")
	} else {
		// pull 主路径独立运行，不依赖 Kafka。
		go fanOutCollectorOutput(ctx, coll.Output(), nil, pullService)
		log.Println("采集分发已启动：pull-only")
	}

	// 7. 启动健康检查与 Agent Pull API HTTP 端点
	httpPort := getEnv("HTTP_PORT", "9091")
	httpServer := startHTTPServer(httpPort, pullService, buildMetaInfo(sourceConfigs), authConfig)

	// 优雅关闭
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

	fmt.Println("Collector Agent 已停止")
}

// fanOutCollectorOutput 将采集批次广播到 pull API 与 pipeline 输入通道。
func fanOutCollectorOutput(ctx context.Context, collectorOut <-chan []plugins.Record, pipelineIn chan<- []plugins.Record, pullService *pullapi.Service) {
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
			pullService.AddRecords(batch)
			if pipelineIn == nil {
				continue
			}
			select {
			case pipelineIn <- batch:
			case <-ctx.Done():
				return
			}
		}
	}
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

// buildMetaInfo 构造 /agent/v1/meta 响应。
func buildMetaInfo(sourceConfigs []collector.SourceConfig) pullapi.MetaInfo {
	sourcePaths := make([]string, 0)
	for _, source := range sourceConfigs {
		if source.Type != collector.SourceTypeFile {
			continue
		}
		sourcePaths = append(sourcePaths, source.Paths...)
	}
	return pullapi.MetaInfo{
		AgentID: getEnv("AGENT_ID", "collector-agent-local"),
		Version: getEnv("AGENT_VERSION", "0.1.0"),
		Status:  "online",
		Sources: sourcePaths,
		Capabilities: []string{
			"file_incremental",
			"pull_api",
			"ack_checkpoint",
		},
	}
}

// startHTTPServer 启动健康检查与 agent pull API 服务。
func startHTTPServer(port string, pullService *pullapi.Service, meta pullapi.MetaInfo, auth pullapi.AuthConfig) *http.Server {
	mux := http.NewServeMux()

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

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
