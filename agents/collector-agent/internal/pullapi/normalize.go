package pullapi

import (
	"crypto/sha256"
	"encoding/hex"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/nexuslog/collector-agent/internal/collector"
	"github.com/nexuslog/collector-agent/plugins"
)

var composePrefixPattern = regexp.MustCompile(`^\s*([^|]+?)\s*\|\s?(.*)$`)

type normalizedLine struct {
	body                    string
	original                string
	timestamp               int64
	source                  string
	offset                  int64
	metadata                map[string]string
	sourceV2                APISource
	severity                APISeverity
	service                 APIService
	container               APIContainer
	attributes              map[string]string
	droppedEmptyPrefixLines int
}

func normalizePluginBatch(batch []plugins.Record) []internalRecord {
	lines := make([]normalizedLine, 0, len(batch))
	for _, record := range batch {
		line, ok := normalizePluginRecord(record)
		if !ok {
			continue
		}
		lines = append(lines, line)
	}
	if len(lines) == 0 {
		return nil
	}

	result := make([]internalRecord, 0, len(lines))
	var current *internalRecord
	for idx := range lines {
		line := lines[idx]
		if current == nil {
			current = newInternalRecordFromLine(line)
			continue
		}
		if shouldAppendToMultiline(*current, line) {
			appendLineToRecord(current, line)
			continue
		}
		finalizeInternalRecord(current)
		result = append(result, *current)
		current = newInternalRecordFromLine(line)
	}
	if current != nil {
		finalizeInternalRecord(current)
		result = append(result, *current)
	}
	return result
}

func normalizePluginRecord(record plugins.Record) (normalizedLine, bool) {
	text := strings.ReplaceAll(string(record.Data), "\r\n", "\n")
	text = strings.ReplaceAll(text, "\r", "\n")
	text = strings.TrimRight(text, "\n")
	if strings.TrimSpace(text) == "" {
		return normalizedLine{}, false
	}

	metadata := cloneMetadata(record.Metadata)
	body := text
	original := text
	service := APIService{}
	container := APIContainer{}
	droppedEmptyPrefixLines := 0

	if prefix, rest, ok := splitComposePrefix(text); ok {
		serviceName, instanceID := resolveServiceName(prefix)
		service = APIService{Name: serviceName, Instance: APIServiceInstance{ID: instanceID}}
		container = APIContainer{Name: instanceID}
		if strings.TrimSpace(rest) == "" {
			return normalizedLine{}, false
		}
		body = rest
		if strings.TrimSpace(rest) == "" {
			droppedEmptyPrefixLines = 1
		}
	}

	if strings.TrimSpace(body) == "" {
		return normalizedLine{}, false
	}

	timestamp := record.Timestamp
	if timestamp <= 0 {
		if detected := collector.DetectTimestamp([]byte(body)); detected > 0 {
			timestamp = detected
		} else {
			timestamp = time.Now().UTC().UnixNano()
		}
	}

	sourcePath := strings.TrimSpace(record.Source)
	offset := parseRecordOffset(metadata)
	if offset <= 0 {
		offset = int64(len(body))
	}

	severity := resolveSeverity(metadata, body)
	metadata = ensureMetadata(metadata, severity, service, offset)

	return normalizedLine{
		body:                    strings.TrimRight(body, "\n"),
		original:                original,
		timestamp:               timestamp,
		source:                  sourcePath,
		offset:                  offset,
		metadata:                metadata,
		sourceV2:                buildSourceInfo(sourcePath, offset, metadata),
		severity:                severity,
		service:                 service,
		container:               container,
		attributes:              buildAttributes(metadata),
		droppedEmptyPrefixLines: droppedEmptyPrefixLines,
	}, true
}

func splitComposePrefix(line string) (prefix, body string, ok bool) {
	match := composePrefixPattern.FindStringSubmatch(line)
	if len(match) != 3 {
		return "", "", false
	}
	prefix = strings.TrimSpace(match[1])
	body = strings.TrimSpace(match[2])
	if prefix == "" {
		return "", "", false
	}
	return prefix, body, true
}

func resolveServiceName(prefix string) (serviceName, instanceID string) {
	instanceID = strings.TrimSpace(prefix)
	serviceName = instanceID
	if instanceID == "" {
		return "", ""
	}
	if lastDash := strings.LastIndex(instanceID, "-"); lastDash > 0 {
		suffix := instanceID[lastDash+1:]
		if _, err := strconv.Atoi(suffix); err == nil {
			serviceName = instanceID[:lastDash]
		}
	}
	return strings.TrimSpace(serviceName), instanceID
}

func parseRecordOffset(metadata map[string]string) int64 {
	if len(metadata) == 0 {
		return 0
	}
	raw := strings.TrimSpace(metadata["offset"])
	if raw == "" {
		return 0
	}
	offset, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || offset <= 0 {
		return 0
	}
	return offset
}

func resolveSeverity(metadata map[string]string, body string) APISeverity {
	levelText := strings.ToLower(strings.TrimSpace(metadata["level"]))
	if levelText == "" {
		levelText = normalizeLevelText(string(collector.DetectLevel([]byte(body))))
	}
	if levelText == "" {
		levelText = "info"
	}
	return APISeverity{Text: levelText, Number: severityNumber(levelText)}
}

func normalizeLevelText(level string) string {
	level = strings.ToLower(strings.TrimSpace(level))
	switch level {
	case "fatal", "panic", "critical", "alert", "emergency", "emerg":
		return "fatal"
	case "error", "err":
		return "error"
	case "warn", "warning":
		return "warn"
	case "info", "information", "notice":
		return "info"
	case "debug", "dbg":
		return "debug"
	case "trace", "trc":
		return "trace"
	case "unknown":
		return "unknown"
	default:
		return ""
	}
}

func severityNumber(level string) int {
	switch normalizeLevelText(level) {
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

func ensureMetadata(metadata map[string]string, severity APISeverity, service APIService, offset int64) map[string]string {
	if metadata == nil {
		metadata = make(map[string]string)
	}
	if severity.Text != "" && strings.TrimSpace(metadata["level"]) == "" {
		metadata["level"] = severity.Text
	}
	if offset > 0 && strings.TrimSpace(metadata["offset"]) == "" {
		metadata["offset"] = strconv.FormatInt(offset, 10)
	}
	if service.Name != "" && strings.TrimSpace(metadata["service.name"]) == "" {
		metadata["service.name"] = service.Name
	}
	if service.Instance.ID != "" && strings.TrimSpace(metadata["service.instance.id"]) == "" {
		metadata["service.instance.id"] = service.Instance.ID
	}
	return metadata
}

func buildSourceInfo(sourcePath string, offset int64, metadata map[string]string) APISource {
	kind := "file"
	trimmed := strings.TrimSpace(sourcePath)
	switch {
	case strings.HasPrefix(trimmed, "syslog://"):
		kind = "syslog"
	case strings.HasPrefix(trimmed, "journald://"):
		kind = "journald"
	case strings.Contains(trimmed, "docker") || strings.Contains(trimmed, "container"):
		kind = "container"
	case trimmed == "":
		kind = "other"
	}
	return APISource{
		Kind:   kind,
		Path:   trimmed,
		Offset: offset,
		Stream: strings.TrimSpace(metadata["stream"]),
	}
}

func buildAttributes(metadata map[string]string) map[string]string {
	if len(metadata) == 0 {
		return nil
	}
	attributes := make(map[string]string)
	for key, value := range metadata {
		trimmedKey := strings.TrimSpace(key)
		if trimmedKey == "" {
			continue
		}
		switch trimmedKey {
		case "offset", "level", "service.name", "service.instance.id", "stream":
			continue
		default:
			attributes[trimmedKey] = value
		}
	}
	if len(attributes) == 0 {
		return nil
	}
	return attributes
}

func newInternalRecordFromLine(line normalizedLine) *internalRecord {
	return &internalRecord{
		Source:     line.source,
		Timestamp:  line.timestamp,
		Data:       []byte(line.body),
		Original:   line.original,
		Offset:     line.offset,
		Metadata:   cloneMetadata(line.metadata),
		SourceV2:   line.sourceV2,
		Severity:   line.severity,
		Service:    line.service,
		Container:  line.container,
		Attributes: cloneMetadata(line.attributes),
		Multiline: APIMultiline{
			Enabled:                 false,
			LineCount:               1,
			StartOffset:             line.offset,
			EndOffset:               line.offset,
			DroppedEmptyPrefixLines: line.droppedEmptyPrefixLines,
		},
		Dedup: APIDedup{},
	}
}

func shouldAppendToMultiline(current internalRecord, next normalizedLine) bool {
	if current.Source != next.source {
		return false
	}
	if current.Service.Instance.ID != "" && next.service.Instance.ID != "" && current.Service.Instance.ID != next.service.Instance.ID {
		return false
	}
	currentLastLine := lastNonEmptyLine(string(current.Data))
	nextLine := strings.TrimSpace(next.body)
	if nextLine == "" {
		return false
	}
	if isStackTraceContinuation(nextLine) {
		return true
	}
	if isNPMErrorLine(currentLastLine) && isNPMErrorLine(nextLine) {
		return true
	}
	if strings.HasPrefix(next.body, " ") || strings.HasPrefix(next.body, "\t") {
		return isErrorHeader(currentLastLine) || current.Multiline.Enabled
	}
	return false
}

func appendLineToRecord(current *internalRecord, next normalizedLine) {
	if current == nil {
		return
	}
	current.Multiline.Enabled = true
	current.Multiline.LineCount++
	current.Multiline.EndOffset = next.offset
	current.Multiline.DroppedEmptyPrefixLines += next.droppedEmptyPrefixLines
	current.Offset = next.offset
	current.SourceV2.Offset = next.offset
	current.Data = append(current.Data, '\n')
	current.Data = append(current.Data, []byte(next.body)...)
	current.Original = current.Original + "\n" + next.original
	if next.timestamp > current.Timestamp {
		current.Timestamp = next.timestamp
	}
	if current.Severity.Number < next.severity.Number {
		current.Severity = next.severity
	}
}

func finalizeInternalRecord(record *internalRecord) {
	if record == nil {
		return
	}
	body := strings.TrimSpace(string(record.Data))
	record.Data = []byte(body)
	if record.Multiline.LineCount <= 1 {
		record.Multiline.Enabled = false
		record.Multiline.LineCount = 1
	}
	record.Fingerprint = buildFingerprint(record)
	record.Dedup.WindowSec = int(defaultDedupWindow.Seconds())
	if record.Multiline.Enabled {
		record.Dedup.Strategy = "multiline"
	} else {
		record.Dedup.Strategy = "exact"
	}
	if record.Offset <= 0 {
		record.Offset = int64(len(record.Data))
	}
	if record.SourceV2.Offset <= 0 {
		record.SourceV2.Offset = record.Offset
	}
	if record.Multiline.StartOffset <= 0 {
		record.Multiline.StartOffset = record.Offset
	}
	if record.Multiline.EndOffset <= 0 {
		record.Multiline.EndOffset = record.Offset
	}
	record.Metadata = ensureMetadata(record.Metadata, record.Severity, record.Service, record.Offset)
	if len(record.Attributes) == 0 {
		record.Attributes = nil
	}
}

func lastNonEmptyLine(body string) string {
	parts := strings.Split(body, "\n")
	for i := len(parts) - 1; i >= 0; i-- {
		if trimmed := strings.TrimSpace(parts[i]); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func isStackTraceContinuation(line string) bool {
	trimmed := strings.TrimSpace(line)
	if trimmed == "" {
		return false
	}
	return strings.HasPrefix(trimmed, "at ") ||
		strings.HasPrefix(trimmed, "...") ||
		strings.HasPrefix(trimmed, "Caused by:") ||
		strings.HasPrefix(trimmed, "Suppressed:") ||
		strings.HasPrefix(trimmed, "Traceback")
}

func isNPMErrorLine(line string) bool {
	trimmed := strings.ToLower(strings.TrimSpace(line))
	return strings.HasPrefix(trimmed, "npm error") || strings.HasPrefix(trimmed, "npm err!")
}

func isErrorHeader(line string) bool {
	trimmed := strings.TrimSpace(line)
	upper := strings.ToUpper(trimmed)
	return strings.Contains(trimmed, "Exception") || strings.Contains(trimmed, "Error") || strings.HasPrefix(upper, "ERROR") || isNPMErrorLine(trimmed)
}

func buildFingerprint(record *internalRecord) string {
	if record == nil {
		return ""
	}
	body := normalizeForFingerprint(string(record.Data))
	builder := strings.Builder{}
	builder.WriteString(strings.TrimSpace(record.Source))
	builder.WriteString("|")
	builder.WriteString(strings.TrimSpace(record.Service.Name))
	builder.WriteString("|")
	builder.WriteString(strings.TrimSpace(record.Service.Instance.ID))
	builder.WriteString("|")
	builder.WriteString(strings.TrimSpace(record.Severity.Text))
	builder.WriteString("|")
	builder.WriteString(body)
	h := sha256.Sum256([]byte(builder.String()))
	return "sha256:" + hex.EncodeToString(h[:])
}

func normalizeForFingerprint(body string) string {
	lines := strings.Split(body, "\n")
	parts := make([]string, 0, len(lines))
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		parts = append(parts, trimmed)
	}
	return strings.Join(parts, "\n")
}

func detectFileFields(sourcePath string) (name, dir string) {
	trimmed := strings.TrimSpace(sourcePath)
	if trimmed == "" {
		return "", ""
	}
	return filepath.Base(trimmed), filepath.Dir(trimmed)
}
