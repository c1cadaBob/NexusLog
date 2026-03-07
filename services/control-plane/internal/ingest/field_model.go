package ingest

import (
	"crypto/sha256"
	"encoding/hex"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// SchemaVersion 当前日志文档 schema 版本，用于 ingest layer。
const SchemaVersion = "2.0"

// PipelineVersion 当前 ingest pipeline 版本。
const PipelineVersion = "2.0"

type LogDocument struct {
	Timestamp string
	Message   string
	Event     EventLayer
	Log       LogLayer
	Source    SourceLayer
	Agent     AgentLayer
	Service   ServiceLayer
	Container ContainerLayer
	Host      HostLayer
	Process   ProcessLayer
	Trace     TraceLayer
	Request   RequestLayer
	User      UserLayer
	HTTP      HTTPLayer
	URL       URLLayer
	Error     ErrorLayer
	NexusLog  NexusLogLayer
	Labels    map[string]string
}

type EventLayer struct {
	ID       string
	RecordID string
	Sequence int64
	Original string
	Kind     string
	Category []string
	Type     []string
	Severity int
}

type LogLayer struct {
	Level  string
	Offset int64
	File   LogFileLayer
}

type LogFileLayer struct {
	Path      string
	Name      string
	Directory string
}

type SourceLayer struct {
	Kind   string
	Path   string
	Stream string
}

type AgentLayer struct {
	ID       string
	Version  string
	Hostname string
}

type ServiceLayer struct {
	Name        string
	Instance    ServiceInstanceLayer
	Version     string
	Environment string
}

type ServiceInstanceLayer struct {
	ID string
}

type ContainerLayer struct {
	Name string
}

type HostLayer struct {
	Name string
	IP   string
}

type ProcessLayer struct {
	PID      int
	ThreadID int64
}

type TraceLayer struct {
	ID   string
	Span string
}

type RequestLayer struct {
	ID string
}

type UserLayer struct {
	ID string
}

type HTTPLayer struct {
	Request  HTTPRequestLayer
	Response HTTPResponseLayer
}

type HTTPRequestLayer struct {
	Method string
}

type HTTPResponseLayer struct {
	StatusCode int
}

type URLLayer struct {
	Path string
	Full string
}

type ErrorLayer struct {
	Type       string
	Message    string
	StackTrace string
}

type NexusLogLayer struct {
	Transport  TransportLayer
	Ingest     IngestLayer
	Multiline  MultilineLayer
	Dedup      DedupLayer
	Governance GovernanceLayer
}

type TransportLayer struct {
	BatchID    string
	Channel    string
	Compressed bool
	Encrypted  bool
}

type IngestLayer struct {
	ReceivedAt      string
	SchemaVersion   string
	PipelineVersion string
	ParseStatus     string
	ParseRule       string
	RetryCount      int
}

type MultilineLayer struct {
	Enabled                 bool
	LineCount               int
	StartOffset             int64
	EndOffset               int64
	DroppedEmptyPrefixLines int
}

type DedupLayer struct {
	Fingerprint     string
	Hit             bool
	Count           int
	FirstSeenAt     string
	LastSeenAt      string
	WindowSec       int
	Strategy        string
	SuppressedCount int
}

type GovernanceLayer struct {
	TenantID        string
	RetentionPolicy string
	PIIMasked       bool
	Classification  string
}

func (d *LogDocument) ToESDocument() map[string]any {
	m := map[string]any{
		"@timestamp": d.Timestamp,
		"message":    d.Message,
		"event": map[string]any{
			"id":        d.Event.ID,
			"record_id": d.Event.RecordID,
			"sequence":  d.Event.Sequence,
			"original":  d.Event.Original,
			"kind":      d.Event.Kind,
			"category":  d.Event.Category,
			"type":      d.Event.Type,
			"severity":  d.Event.Severity,
		},
		"log": map[string]any{
			"level":  d.Log.Level,
			"offset": d.Log.Offset,
			"file": map[string]any{
				"path":      d.Log.File.Path,
				"name":      d.Log.File.Name,
				"directory": d.Log.File.Directory,
			},
		},
		"source": map[string]any{
			"kind":   d.Source.Kind,
			"path":   d.Source.Path,
			"stream": d.Source.Stream,
		},
		"agent": map[string]any{
			"id":       d.Agent.ID,
			"version":  d.Agent.Version,
			"hostname": d.Agent.Hostname,
		},
		"service": map[string]any{
			"name":        d.Service.Name,
			"instance":    map[string]any{"id": d.Service.Instance.ID},
			"version":     d.Service.Version,
			"environment": d.Service.Environment,
		},
		"container": map[string]any{"name": d.Container.Name},
		"host": map[string]any{
			"name": d.Host.Name,
			"ip":   d.Host.IP,
		},
		"process": map[string]any{
			"pid": d.Process.PID,
			"thread": map[string]any{
				"id": d.Process.ThreadID,
			},
		},
		"trace": map[string]any{"id": d.Trace.ID},
		"span":  map[string]any{"id": d.Trace.Span},
		"request": map[string]any{
			"id": d.Request.ID,
		},
		"user": map[string]any{"id": d.User.ID},
		"http": map[string]any{
			"request":  map[string]any{"method": d.HTTP.Request.Method},
			"response": map[string]any{"status_code": d.HTTP.Response.StatusCode},
		},
		"url": map[string]any{
			"path": d.URL.Path,
			"full": d.URL.Full,
		},
		"error": map[string]any{
			"type":        d.Error.Type,
			"message":     d.Error.Message,
			"stack_trace": d.Error.StackTrace,
		},
		"nexuslog": map[string]any{
			"transport": map[string]any{
				"batch_id":   d.NexusLog.Transport.BatchID,
				"channel":    d.NexusLog.Transport.Channel,
				"compressed": d.NexusLog.Transport.Compressed,
				"encrypted":  d.NexusLog.Transport.Encrypted,
			},
			"ingest": map[string]any{
				"received_at":      d.NexusLog.Ingest.ReceivedAt,
				"schema_version":   d.NexusLog.Ingest.SchemaVersion,
				"pipeline_version": d.NexusLog.Ingest.PipelineVersion,
				"parse_status":     d.NexusLog.Ingest.ParseStatus,
				"parse_rule":       d.NexusLog.Ingest.ParseRule,
				"retry_count":      d.NexusLog.Ingest.RetryCount,
			},
			"multiline": map[string]any{
				"enabled":                    d.NexusLog.Multiline.Enabled,
				"line_count":                 d.NexusLog.Multiline.LineCount,
				"start_offset":               d.NexusLog.Multiline.StartOffset,
				"end_offset":                 d.NexusLog.Multiline.EndOffset,
				"dropped_empty_prefix_lines": d.NexusLog.Multiline.DroppedEmptyPrefixLines,
			},
			"dedup": map[string]any{
				"fingerprint":      d.NexusLog.Dedup.Fingerprint,
				"hit":              d.NexusLog.Dedup.Hit,
				"count":            d.NexusLog.Dedup.Count,
				"first_seen_at":    d.NexusLog.Dedup.FirstSeenAt,
				"last_seen_at":     d.NexusLog.Dedup.LastSeenAt,
				"window_sec":       d.NexusLog.Dedup.WindowSec,
				"strategy":         d.NexusLog.Dedup.Strategy,
				"suppressed_count": d.NexusLog.Dedup.SuppressedCount,
			},
			"governance": map[string]any{
				"tenant_id":        d.NexusLog.Governance.TenantID,
				"retention_policy": d.NexusLog.Governance.RetentionPolicy,
				"pii_masked":       d.NexusLog.Governance.PIIMasked,
				"classification":   d.NexusLog.Governance.Classification,
			},
		},
	}
	if len(d.Labels) > 0 {
		m["labels"] = d.Labels
	}
	return pruneEmptyMap(m)
}

func GenerateEventID(agentID string, record AgentPullRecord) string {
	timestamp := resolveObservedAt(record)
	body := normalizeMessage(resolveRecordBody(record))
	input := strings.Join([]string{
		strings.TrimSpace(agentID),
		strings.TrimSpace(record.Source.Kind),
		resolveRecordSourcePath(record),
		timestamp,
		strconv.FormatInt(record.Sequence, 10),
		body,
	}, "|")
	h := sha256.Sum256([]byte(input))
	return hex.EncodeToString(h[:])
}

func GenerateDedupFingerprint(record AgentPullRecord) string {
	body := resolveRecordBody(record)
	errorType, _ := extractErrorFields(record, body)
	message := summarizeMessage(body)
	signature := normalizeStackSignature(body)
	parts := []string{
		strings.TrimSpace(record.Service.Name),
		strings.TrimSpace(record.Service.Instance.ID),
		strings.TrimSpace(resolveLogLevel(record)),
		normalizeMessage(message),
		errorType,
		signature,
	}
	h := sha256.Sum256([]byte(strings.Join(parts, "|")))
	return "sha256:" + hex.EncodeToString(h[:])
}

// BuildLogDocument 从 AgentPullRecord 及上下文构建 LogDocument。
// 包含兜底逻辑：当 Agent 未拆分服务名前缀或多行合并时，补充处理
func BuildLogDocument(record AgentPullRecord, responseAgent AgentPullAgent, agentID, batchID, sourceDisplay, tenantID, retentionPolicy string) LogDocument {
	resolvedAgentID := strings.TrimSpace(agentID)
	if resolvedAgentID == "" {
		resolvedAgentID = strings.TrimSpace(responseAgent.ID)
	}

	// 处理 body，可能需要兜底多行合并
	body := resolveRecordBody(record)
	original := strings.TrimSpace(record.Original)
	if original == "" {
		original = body
	}

	// 兜底多行合并：当 Agent 未合并时（multiline.enabled=false 且 body 包含多行）
	processedBody := body
	processedMultiline := record.Multiline
	if !record.Multiline.Enabled && strings.Contains(body, "\n") {
		lines := strings.Split(body, "\n")
		merged, lineCount, dropped := FallbackMergeMultiline(lines)
		if lineCount > 1 || dropped > 0 {
			processedBody = merged
			processedMultiline = AgentPullMultiline{
				Enabled:                 true,
				LineCount:               lineCount,
				StartOffset:             record.Source.Offset,
				EndOffset:               record.Source.Offset + int64(len(body)),
				DroppedEmptyPrefixLines: dropped,
			}
		}
	}

	if original == "" {
		original = processedBody
	}
	observedAt := resolveObservedAt(record)
	logLevel := resolveLogLevel(record)
	eventSeverity := resolveEventSeverity(record, logLevel)

	// 兜底服务名提取：当 Agent 未拆分时
	serviceName := strings.TrimSpace(record.Service.Name)
	instanceID := strings.TrimSpace(record.Service.Instance.ID)
	if serviceName == "" && instanceID == "" {
		// 尝试从 body 中提取服务名前缀
		extractedService, extractedInstance := FallbackExtractServiceInfo(processedBody)
		if extractedService != "" {
			serviceName = extractedService
			instanceID = extractedInstance
		}
	}

	errorType, errorMessage := extractErrorFields(record, processedBody)
	message := summarizeMessage(processedBody)
	filePath := resolveRecordSourcePath(record)
	fileName := filepath.Base(filePath)
	fileDir := filepath.Dir(filePath)
	if filePath == "" || filePath == "." {
		fileName = ""
		fileDir = ""
	}

	// 使用处理后的 body 生成 fingerprint
	dedupRecord := record
	dedupRecord.Service.Name = serviceName
	dedupRecord.Service.Instance.ID = instanceID
	dedupRecord.Body = processedBody
	fingerprint := GenerateDedupFingerprint(dedupRecord)
	dedupCount := record.Dedup.Count
	if dedupCount <= 0 {
		dedupCount = 1
	}
	strategy := strings.TrimSpace(record.Dedup.Strategy)
	if strategy == "" {
		if processedMultiline.Enabled {
			strategy = "multiline"
		} else {
			strategy = "exact"
		}
	}
	return LogDocument{
		Timestamp: observedAt,
		Message:   message,
		Event: EventLayer{
			ID:       GenerateEventID(resolvedAgentID, dedupRecord),
			RecordID: strings.TrimSpace(record.RecordID),
			Sequence: record.Sequence,
			Original: original,
			Kind:     "event",
			Category: []string{"application"},
			Type:     []string{"log"},
			Severity: eventSeverity,
		},
		Log: LogLayer{
			Level:  logLevel,
			Offset: resolveRecordOffset(record, resolveRecordSize(record), 0),
			File: LogFileLayer{
				Path:      filePath,
				Name:      fileName,
				Directory: fileDir,
			},
		},
		Source: SourceLayer{
			Kind:   resolveSourceKind(record),
			Path:   sourceDisplay,
			Stream: strings.TrimSpace(record.Source.Stream),
		},
		Agent: AgentLayer{
			ID:       resolvedAgentID,
			Version:  strings.TrimSpace(responseAgent.Version),
			Hostname: strings.TrimSpace(responseAgent.Hostname),
		},
		Service: ServiceLayer{
			Name: serviceName,
			Instance: ServiceInstanceLayer{
				ID: instanceID,
			},
			Version:     strings.TrimSpace(record.Service.Version),
			Environment: strings.TrimSpace(record.Service.Environment),
		},
		Container: ContainerLayer{Name: strings.TrimSpace(record.Container.Name)},
		Host: HostLayer{
			Name: strings.TrimSpace(attrValue(record, "host.name")),
			IP:   strings.TrimSpace(attrValue(record, "host.ip")),
		},
		Process: ProcessLayer{
			PID:      parseInt(attrValue(record, "process.pid")),
			ThreadID: parseInt64(attrValue(record, "process.thread.id")),
		},
		Trace: TraceLayer{
			ID:   strings.TrimSpace(attrValue(record, "trace.id")),
			Span: strings.TrimSpace(attrValue(record, "span.id")),
		},
		Request: RequestLayer{ID: strings.TrimSpace(attrValue(record, "request.id"))},
		User:    UserLayer{ID: strings.TrimSpace(attrValue(record, "user.id"))},
		HTTP: HTTPLayer{
			Request:  HTTPRequestLayer{Method: strings.TrimSpace(attrValue(record, "http.request.method"))},
			Response: HTTPResponseLayer{StatusCode: parseInt(attrValue(record, "http.response.status_code"))},
		},
		URL: URLLayer{
			Path: strings.TrimSpace(attrValue(record, "url.path")),
			Full: strings.TrimSpace(attrValue(record, "url.full")),
		},
		Error: ErrorLayer{
			Type:       errorType,
			Message:    errorMessage,
			StackTrace: processedBody,
		},
		NexusLog: NexusLogLayer{
			Transport: TransportLayer{
				BatchID: strings.TrimSpace(batchID),
				Channel: strings.TrimSpace(attrValue(record, "transport.channel")),
			},
			Ingest: IngestLayer{
				ReceivedAt:      time.Now().UTC().Format(time.RFC3339Nano),
				SchemaVersion:   SchemaVersion,
				PipelineVersion: PipelineVersion,
				ParseStatus:     "success",
				ParseRule:       resolveParseRule(record, serviceName),
			},
			Multiline: MultilineLayer{
				Enabled:                 processedMultiline.Enabled,
				LineCount:               processedMultiline.LineCount,
				StartOffset:             processedMultiline.StartOffset,
				EndOffset:               processedMultiline.EndOffset,
				DroppedEmptyPrefixLines: processedMultiline.DroppedEmptyPrefixLines,
			},
			Dedup: DedupLayer{
				Fingerprint:     fingerprint,
				Hit:             record.Dedup.Hit,
				Count:           dedupCount,
				FirstSeenAt:     firstNonEmpty(record.Dedup.FirstSeenAt, observedAt),
				LastSeenAt:      firstNonEmpty(record.Dedup.LastSeenAt, observedAt),
				WindowSec:       resolveDedupWindow(record),
				Strategy:        strategy,
				SuppressedCount: maxLogInt(dedupCount-1, 0),
			},
			Governance: GovernanceLayer{
				TenantID:        strings.TrimSpace(tenantID),
				RetentionPolicy: strings.TrimSpace(retentionPolicy),
				PIIMasked:       false,
				Classification:  strings.TrimSpace(attrValue(record, "classification")),
			},
		},
		Labels: buildLabels(record),
	}
}

func resolveObservedAt(record AgentPullRecord) string {
	if observedAt := strings.TrimSpace(record.ObservedAt); observedAt != "" {
		return observedAt
	}
	return time.Now().UTC().Format(time.RFC3339Nano)
}

func resolveLogLevel(record AgentPullRecord) string {
	if level := normalizeLevel(record.Severity.Text); level != "" {
		return level
	}
	body := strings.ToLower(resolveRecordBody(record))
	switch {
	case strings.Contains(body, "fatal") || strings.Contains(body, "panic"):
		return "fatal"
	case strings.Contains(body, " error") || strings.HasPrefix(body, "error") || strings.Contains(body, "exception"):
		return "error"
	case strings.Contains(body, " warn") || strings.HasPrefix(body, "warn"):
		return "warn"
	case strings.Contains(body, "debug"):
		return "debug"
	case strings.Contains(body, "trace"):
		return "trace"
	default:
		return "info"
	}
}

func resolveEventSeverity(record AgentPullRecord, level string) int {
	if record.Severity.Number > 0 {
		return record.Severity.Number
	}
	switch normalizeLevel(level) {
	case "trace":
		return 1
	case "debug":
		return 5
	case "info":
		return 9
	case "warn":
		return 13
	case "error":
		return 17
	case "fatal":
		return 21
	default:
		return 0
	}
}

func resolveSourceKind(record AgentPullRecord) string {
	if kind := strings.TrimSpace(record.Source.Kind); kind != "" {
		return kind
	}
	path := strings.ToLower(resolveRecordSourcePath(record))
	switch {
	case strings.HasPrefix(path, "syslog://"):
		return "syslog"
	case strings.HasPrefix(path, "journald://"):
		return "journald"
	case strings.Contains(path, "docker") || strings.Contains(path, "container"):
		return "container"
	case path == "":
		return "other"
	default:
		return "file"
	}
}

func resolveParseRule(record AgentPullRecord, serviceName string) string {
	// 优先使用 Agent 已拆分的结果
	if strings.TrimSpace(record.Service.Instance.ID) != "" {
		return "docker-compose-prefix-v1"
	}
	// 使用兜底提取的服务名
	if strings.TrimSpace(serviceName) != "" {
		return "docker-compose-prefix-fallback-v1"
	}
	if record.Multiline.Enabled {
		return "multiline-fallback-v1"
	}
	return "plain-line-v1"
}

func resolveDedupWindow(record AgentPullRecord) int {
	if record.Dedup.WindowSec > 0 {
		return record.Dedup.WindowSec
	}
	return 10
}

var errorTypePattern = regexp.MustCompile(`([A-Za-z0-9_.]+(?:Exception|Error))`)

// servicePrefixPattern 用于匹配常见的服务名前缀格式
// 支持格式: service-name | message, service-name: message, [service-name] message
var servicePrefixPattern = regexp.MustCompile(`^([a-zA-Z0-9][-a-zA-Z0-9_]*)(?:\s*[\|:]\s*|\s+\[?\s*)(.*)$`)

// multilineStackTracePatterns 检测多行堆栈跟踪的模式
var multilinePatterns = []*regexp.Regexp{
	// Java/Kotlin stack trace
	regexp.MustCompile(`^\s+at\s+[a-zA-Z0-9_.]+\([^)]+\)$`),
	// Python traceback
	regexp.MustCompile(`^\s+File\s+"[^"]+",\s+line\s+\d+`),
	// Node.js stack trace
	regexp.MustCompile(`^\s+at\s+[a-zA-Z0-9_.\-><()]+\s+\([^)]+\)$`),
	// Go stack trace
	regexp.MustCompile(`^github\.com/[a-zA-Z0-9/]+\s+\([^)]+\)$`),
	// .NET stack trace
	regexp.MustCompile(`^\s+at\s+[a-zA-Z0-9_.]+\s+in\s+`),
	// npm error block continuation
	regexp.MustCompile(`^\s+npm\s+error\s+`),
	// Generic "Caused by" line
	regexp.MustCompile(`^Caused by:\s+`),
}

func extractErrorFields(record AgentPullRecord, body string) (string, string) {
	trimmed := strings.TrimSpace(body)
	if trimmed == "" {
		return "", ""
	}
	firstLine := summarizeMessage(body)
	if strings.Contains(strings.ToLower(trimmed), "npm error lifecycle script") {
		return "npm.lifecycle_error", firstLine
	}
	if match := errorTypePattern.FindString(firstLine); match != "" {
		return match, firstLine
	}
	if normalizeLevel(resolveLogLevel(record)) == "error" || normalizeLevel(resolveLogLevel(record)) == "fatal" {
		return "log.error", firstLine
	}
	// 使用增强的错误检测器
	errorType, errorMsg, _ := ExtractErrorFieldsWithCategory(record, body)
	if errorType != "" {
		return errorType, errorMsg
	}
	return "", ""
}

// FallbackExtractServiceInfo 当 Agent 未拆分服务名前缀时，control-plane 兜底提取
// 支持格式: service-name | message, service-name: message, [service-name] message
func FallbackExtractServiceInfo(body string) (serviceName, instanceID string) {
	trimmed := strings.TrimSpace(body)
	if trimmed == "" {
		return "", ""
	}

	// 匹配服务名前缀
	matches := servicePrefixPattern.FindStringSubmatch(trimmed)
	if len(matches) >= 3 {
		prefix := matches[1]
		rest := matches[2]

		// 检查是否是有效的前缀（不是纯数字等）
		if len(prefix) > 0 && len(prefix) <= 64 {
			// 检查 rest 是否为空或只有空白（空前缀行）
			if strings.TrimSpace(rest) == "" {
				return "", ""
			}
			// 检查是否包含连字符，可能是实例名（如 keycloak-1）
			if strings.Contains(prefix, "-") {
				// 可能是 instance id，尝试分离
				parts := strings.SplitN(prefix, "-", 2)
				if len(parts) == 2 && len(parts[0]) > 0 {
					serviceName = parts[0]
					instanceID = prefix
					return serviceName, instanceID
				}
			}
			// 没有连字符，整个作为服务名
			return prefix, ""
		}
	}
	return "", ""
}

// FallbackMergeMultiline 当 Agent 未合并多行日志时，control-plane 兜底合并
// 返回合并后的日志和是否执行了合并
func FallbackMergeMultiline(lines []string) (merged string, mergedLines int, droppedEmptyPrefix int) {
	if len(lines) == 0 {
		return "", 0, 0
	}

	var result []string
	droppedEmptyPrefix = 0

	for i, line := range lines {
		trimmed := strings.TrimSpace(line)

		// 跳过空行
		if trimmed == "" {
			continue
		}

		// 检查是否是空前缀行（如 "service-name |" 只有前缀没有内容）
		if i > 0 && isEmptyPrefixLine(trimmed, lines[:i]) {
			droppedEmptyPrefix++
			continue
		}

		// 检查是否是堆栈跟踪行
		if i > 0 && isStackTraceLine(trimmed) {
			// 附加到上一行
			if len(result) > 0 {
				result[len(result)-1] = result[len(result)-1] + "\n" + trimmed
			} else {
				result = append(result, trimmed)
			}
			continue
		}

		// 新日志行
		result = append(result, trimmed)
	}

	if len(result) == 0 {
		return "", 0, droppedEmptyPrefix
	}

	return strings.Join(result, "\n"), len(result), droppedEmptyPrefix
}

// isEmptyPrefixLine 检查是否是空前缀行（如 "keycloak-1 |" 或 "service ["）
func isEmptyPrefixLine(line string, previousLines []string) bool {
	trimmed := strings.TrimSpace(line)

	// 检查是否符合 "service |" 或 "service:" 格式但后面没有内容
	if matched := servicePrefixPattern.FindStringSubmatch(trimmed); len(matched) >= 3 {
		rest := matched[2]
		return strings.TrimSpace(rest) == ""
	}

	// 检查是否只有服务名加方括号
	emptyBracketPattern := regexp.MustCompile(`^\[?[a-zA-Z0-9][-a-zA-Z0-9_]*\]?\s*$`)
	return emptyBracketPattern.MatchString(trimmed)
}

// isStackTraceLine 检查是否是堆栈跟踪行
func isStackTraceLine(line string) bool {
	trimmed := strings.TrimSpace(line)
	for _, pattern := range multilinePatterns {
		if pattern.MatchString(trimmed) {
			return true
		}
	}
	return false
}

func summarizeMessage(body string) string {
	for _, line := range strings.Split(body, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func normalizeMessage(message string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(message)), " ")
}

func normalizeStackSignature(body string) string {
	lines := strings.Split(body, "\n")
	parts := make([]string, 0, len(lines))
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		if strings.HasPrefix(trimmed, "at ") {
			trimmed = "at"
		}
		parts = append(parts, trimmed)
		if len(parts) >= 6 {
			break
		}
	}
	return strings.Join(parts, "|")
}

func buildLabels(record AgentPullRecord) map[string]string {
	// 使用白名单治理
	return FilterRecordLabels(record)
}

func attrValue(record AgentPullRecord, key string) string {
	return strings.TrimSpace(record.Attributes[key])
}

func parseInt(raw string) int {
	value, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil {
		return 0
	}
	return value
}

func parseInt64(raw string) int64 {
	value, err := strconv.ParseInt(strings.TrimSpace(raw), 10, 64)
	if err != nil {
		return 0
	}
	return value
}

func normalizeLevel(level string) string {
	switch strings.ToLower(strings.TrimSpace(level)) {
	case "trace", "trc":
		return "trace"
	case "debug", "dbg":
		return "debug"
	case "info", "information", "notice":
		return "info"
	case "warn", "warning":
		return "warn"
	case "error", "err":
		return "error"
	case "fatal", "panic", "critical", "alert", "emergency", "emerg":
		return "fatal"
	default:
		return ""
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func maxLogInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func pruneEmptyMap(input map[string]any) map[string]any {
	output := make(map[string]any)
	for key, value := range input {
		switch typed := value.(type) {
		case map[string]any:
			if nested := pruneEmptyMap(typed); len(nested) > 0 {
				output[key] = nested
			}
		case []string:
			if len(typed) > 0 {
				output[key] = typed
			}
		case string:
			if strings.TrimSpace(typed) != "" {
				output[key] = typed
			}
		case bool:
			if typed {
				output[key] = typed
			}
		case int:
			if typed != 0 {
				output[key] = typed
			}
		case int64:
			if typed != 0 {
				output[key] = typed
			}
		default:
			if value != nil {
				output[key] = value
			}
		}
	}
	return output
}
