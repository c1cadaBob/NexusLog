package pipeline

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	goavro "github.com/linkedin/goavro/v2"

	"github.com/nexuslog/collector-agent/plugins"
)

const (
	confluentWireMagicByte      byte = 0
	defaultSchemaRegistryTimout      = 10 * time.Second
	defaultRawSchemaSubject          = "nexuslog.logs.raw-value"
)

type rawLogAvroEncoder struct {
	codec    *goavro.Codec
	registry *schemaRegistryClient
	subject  string
	schema   string

	mu       sync.Mutex
	schemaID int
}

type schemaRegistryClient struct {
	baseURL string
	client  *http.Client
}

type schemaRegistryRegisterRequest struct {
	Schema     string `json:"schema"`
	SchemaType string `json:"schemaType,omitempty"`
}

type schemaRegistryRegisterResponse struct {
	ID int `json:"id"`
}

func newRawLogAvroEncoder(registryURL, subject, schemaFile string) (*rawLogAvroEncoder, error) {
	registryURL = strings.TrimSpace(registryURL)
	if registryURL == "" {
		return nil, fmt.Errorf("schema registry url is required")
	}

	schemaContent, err := resolveLogRawSchema(schemaFile)
	if err != nil {
		return nil, err
	}

	codec, err := goavro.NewCodec(schemaContent)
	if err != nil {
		return nil, fmt.Errorf("compile log-raw schema: %w", err)
	}

	subject = strings.TrimSpace(subject)
	if subject == "" {
		subject = defaultRawSchemaSubject
	}

	return &rawLogAvroEncoder{
		codec:    codec,
		registry: newSchemaRegistryClient(registryURL),
		subject:  subject,
		schema:   schemaContent,
	}, nil
}

func resolveLogRawSchema(schemaFile string) (string, error) {
	candidates := logRawSchemaCandidates(schemaFile)
	var readErrors []string

	for _, candidate := range candidates {
		payload, err := os.ReadFile(candidate)
		if err != nil {
			readErrors = append(readErrors, fmt.Sprintf("%s (%v)", candidate, err))
			continue
		}
		trimmed := strings.TrimSpace(string(payload))
		if trimmed == "" {
			return "", fmt.Errorf("log-raw schema file %s is empty", candidate)
		}
		return trimmed, nil
	}

	if strings.TrimSpace(schemaFile) != "" {
		return "", fmt.Errorf("read log-raw schema file %s failed", schemaFile)
	}
	return "", fmt.Errorf("log-raw schema file is required; checked: %s", strings.Join(readErrors, "; "))
}

func logRawSchemaCandidates(schemaFile string) []string {
	trimmed := strings.TrimSpace(schemaFile)
	if trimmed != "" {
		return []string{trimmed}
	}

	return []string{
		"/workspace/contracts/schema-contracts/avro/log-raw.avsc",
		"/etc/nexuslog/contracts/log-raw.avsc",
		filepath.Join("contracts", "schema-contracts", "avro", "log-raw.avsc"),
		filepath.Join("..", "contracts", "schema-contracts", "avro", "log-raw.avsc"),
		filepath.Join("..", "..", "contracts", "schema-contracts", "avro", "log-raw.avsc"),
		filepath.Join("..", "..", "..", "contracts", "schema-contracts", "avro", "log-raw.avsc"),
		filepath.Join("..", "..", "..", "..", "contracts", "schema-contracts", "avro", "log-raw.avsc"),
	}
}

func newSchemaRegistryClient(baseURL string) *schemaRegistryClient {
	return &schemaRegistryClient{
		baseURL: strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		client: &http.Client{
			Timeout: defaultSchemaRegistryTimout,
		},
	}
}

func (c *schemaRegistryClient) RegisterAvroSchema(ctx context.Context, subject, schema string) (int, error) {
	if c == nil {
		return 0, fmt.Errorf("schema registry client is nil")
	}
	if strings.TrimSpace(subject) == "" {
		return 0, fmt.Errorf("schema registry subject is required")
	}
	if strings.TrimSpace(schema) == "" {
		return 0, fmt.Errorf("schema content is required")
	}

	payload, err := json.Marshal(schemaRegistryRegisterRequest{
		Schema:     schema,
		SchemaType: "AVRO",
	})
	if err != nil {
		return 0, fmt.Errorf("marshal schema registry payload: %w", err)
	}

	endpoint := c.baseURL + "/subjects/" + url.PathEscape(subject) + "/versions"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return 0, fmt.Errorf("build schema registry request: %w", err)
	}
	req.Header.Set("Content-Type", "application/vnd.schemaregistry.v1+json")

	resp, err := c.client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("register schema subject %s: %w", subject, err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return 0, fmt.Errorf("register schema subject %s failed: http %d: %s", subject, resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var result schemaRegistryRegisterResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return 0, fmt.Errorf("decode schema registry response: %w", err)
	}
	if result.ID <= 0 {
		return 0, fmt.Errorf("schema registry returned invalid schema id for %s", subject)
	}
	return result.ID, nil
}

func (e *rawLogAvroEncoder) Encode(ctx context.Context, record plugins.Record) ([]byte, error) {
	if e == nil {
		return nil, fmt.Errorf("raw log avro encoder is nil")
	}

	schemaID, err := e.resolveSchemaID(ctx)
	if err != nil {
		return nil, err
	}

	native, err := buildRawLogNativeRecord(record)
	if err != nil {
		return nil, err
	}

	binaryPayload, err := e.codec.BinaryFromNative(nil, native)
	if err != nil {
		return nil, fmt.Errorf("encode avro payload: %w", err)
	}

	buf := bytes.NewBuffer(make([]byte, 0, 5+len(binaryPayload)))
	buf.WriteByte(confluentWireMagicByte)
	if err := binary.Write(buf, binary.BigEndian, uint32(schemaID)); err != nil {
		return nil, fmt.Errorf("write schema id prefix: %w", err)
	}
	if _, err := buf.Write(binaryPayload); err != nil {
		return nil, fmt.Errorf("write avro payload: %w", err)
	}
	return buf.Bytes(), nil
}

func (e *rawLogAvroEncoder) resolveSchemaID(ctx context.Context) (int, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	if e.schemaID > 0 {
		return e.schemaID, nil
	}

	schemaID, err := e.registry.RegisterAvroSchema(ctx, e.subject, e.schema)
	if err != nil {
		return 0, err
	}
	e.schemaID = schemaID
	return schemaID, nil
}

func buildRawLogNativeRecord(record plugins.Record) (map[string]any, error) {
	metadata := cloneAvroMetadata(record.Metadata)
	id := avroFirstNonEmpty(metadata["event_id"], metadata["record_id"])
	if id == "" {
		id = buildRawFallbackID(record)
	}

	timestamp := record.Timestamp / int64(time.Millisecond)
	if timestamp <= 0 {
		timestamp = time.Now().UTC().UnixMilli()
	}

	source := avroFirstNonEmpty(
		strings.TrimSpace(record.Source),
		metadata["source_path"],
		metadata["source_collect_path"],
		metadata["host"],
		metadata["hostname"],
	)
	if source == "" {
		source = "unknown"
	}

	agentID := avroFirstNonEmpty(metadata["agent_id"], "collector-agent")

	payload := map[string]any{
		"id":                  id,
		"timestamp":           timestamp,
		"source":              source,
		"source_type":         resolveAvroSourceType(record, metadata),
		"content":             string(record.Data),
		"tags":                metadata,
		"agent_id":            agentID,
		"event_id":            avroNullableString(metadata["event_id"]),
		"dedupe_key":          avroNullableString(metadata["dedupe_key"]),
		"source_path":         avroNullableString(metadata["source_path"]),
		"source_collect_path": avroNullableString(metadata["source_collect_path"]),
		"offset":              avroNullableLong(metadata["offset"]),
		"file_inode":          avroNullableLong(metadata["file_inode"]),
		"file_dev":            avroNullableLong(metadata["file_dev"]),
		"host":                avroNullableString(avroFirstNonEmpty(metadata["host"], metadata["hostname"])),
		"server_id":           avroNullableString(metadata["server_id"]),
		"batch_id":            avroNullableString(metadata["batch_id"]),
		"tenant_id":           avroNullableString(metadata["tenant_id"]),
		"host_ip":             avroNullableString(avroFirstNonEmpty(metadata["host.ip"], metadata["host_ip"], metadata["server_ip"])),
		"agent_ip":            avroNullableString(avroFirstNonEmpty(metadata["agent.ip"], metadata["agent_ip"])),
	}
	return payload, nil
}

func cloneAvroMetadata(metadata map[string]string) map[string]string {
	if len(metadata) == 0 {
		return map[string]string{}
	}
	cloned := make(map[string]string, len(metadata))
	for key, value := range metadata {
		trimmedKey := strings.TrimSpace(key)
		trimmedValue := strings.TrimSpace(value)
		if trimmedKey == "" || trimmedValue == "" {
			continue
		}
		cloned[trimmedKey] = trimmedValue
	}
	return cloned
}

func resolveAvroSourceType(record plugins.Record, metadata map[string]string) string {
	if metadata != nil {
		candidate := strings.ToUpper(strings.TrimSpace(metadata["source_type"]))
		switch candidate {
		case "FILE", "SYSLOG", "DOCKER", "KUBERNETES", "JOURNALD", "HTTP", "GRPC":
			return candidate
		}
		if strings.TrimSpace(metadata["hostname"]) != "" || strings.TrimSpace(metadata["syslog_hostname"]) != "" {
			return "SYSLOG"
		}
	}

	source := avroFirstNonEmpty(strings.TrimSpace(record.Source), metadata["source_path"], metadata["source_collect_path"])
	switch {
	case strings.Contains(source, "/var/lib/docker/"):
		return "DOCKER"
	case strings.Contains(source, "/var/log/") || strings.Contains(source, "/"):
		return "FILE"
	default:
		return "FILE"
	}
}

func avroNullableString(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return goavro.Union("string", trimmed)
}

func avroNullableLong(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	parsed, err := strconv.ParseInt(trimmed, 10, 64)
	if err != nil {
		return nil
	}
	return goavro.Union("long", parsed)
}

func buildRawFallbackID(record plugins.Record) string {
	parts := []string{
		strings.TrimSpace(record.Source),
		strconv.FormatInt(record.Timestamp, 10),
		strings.TrimSpace(string(record.Data)),
	}
	hash := sha256.Sum256([]byte(strings.Join(parts, "|")))
	return hex.EncodeToString(hash[:])
}

func avroFirstNonEmpty(values ...string) string {
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
}
