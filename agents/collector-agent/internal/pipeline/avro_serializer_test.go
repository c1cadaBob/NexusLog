package pipeline

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	goavro "github.com/linkedin/goavro/v2"

	"github.com/nexuslog/collector-agent/plugins"
)

func TestRawLogAvroEncoderEncode(t *testing.T) {
	t.Parallel()

	var seenSubject string
	var seenSchemaType string
	registry := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("unexpected method: %s", r.Method)
		}
		seenSubject = r.URL.Path
		defer r.Body.Close()
		var payload map[string]any
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		seenSchemaType, _ = payload["schemaType"].(string)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":17}`))
	}))
	defer registry.Close()

	schemaPath := filepath.Join("..", "..", "..", "..", "contracts", "schema-contracts", "avro", "log-raw.avsc")
	encoder, err := newRawLogAvroEncoder(registry.URL, "nexuslog.logs.raw-value", schemaPath)
	if err != nil {
		t.Fatalf("newRawLogAvroEncoder: %v", err)
	}

	record := plugins.Record{
		Source:    "/var/log/app.log",
		Timestamp: time.Date(2026, time.March, 8, 12, 30, 0, 0, time.UTC).UnixNano(),
		Data:      []byte("2026-03-08T12:30:00Z ERROR test message"),
		Metadata: map[string]string{
			"agent_id":            "collector-agent-e2e",
			"event_id":            "evt-001",
			"dedupe_key":          "dup-001",
			"source_path":         "/var/log/app.log",
			"source_collect_path": "/var/log/*.log",
			"offset":              "42",
			"batch_id":            "batch-001",
			"tenant_id":           "tenant-001",
			"host":                "node-a",
			"host.ip":             "10.0.0.8",
			"agent.ip":            "10.0.0.8",
		},
	}

	encoded, err := encoder.Encode(context.Background(), record)
	if err != nil {
		t.Fatalf("Encode: %v", err)
	}
	if len(encoded) <= 5 {
		t.Fatalf("encoded payload too short: %d", len(encoded))
	}
	if encoded[0] != confluentWireMagicByte {
		t.Fatalf("unexpected magic byte: %d", encoded[0])
	}
	if got := binary.BigEndian.Uint32(encoded[1:5]); got != 17 {
		t.Fatalf("schema id = %d, want 17", got)
	}
	if seenSubject != "/subjects/nexuslog.logs.raw-value/versions" {
		t.Fatalf("subject path = %s", seenSubject)
	}
	if seenSchemaType != "AVRO" {
		t.Fatalf("schemaType = %s", seenSchemaType)
	}

	schemaPayload, err := os.ReadFile(schemaPath)
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	codec, err := goavro.NewCodec(string(schemaPayload))
	if err != nil {
		t.Fatalf("NewCodec: %v", err)
	}
	native, _, err := codec.NativeFromBinary(encoded[5:])
	if err != nil {
		t.Fatalf("NativeFromBinary: %v", err)
	}
	decoded, ok := native.(map[string]any)
	if !ok {
		t.Fatalf("decoded payload type = %T", native)
	}
	if got := decoded["id"]; got != "evt-001" {
		t.Fatalf("decoded id = %#v", got)
	}
	if got := decoded["agent_id"]; got != "collector-agent-e2e" {
		t.Fatalf("decoded agent_id = %#v", got)
	}
	if got := decoded["source_type"]; got != "FILE" {
		t.Fatalf("decoded source_type = %#v", got)
	}

	eventIDUnion, ok := decoded["event_id"].(map[string]any)
	if !ok {
		t.Fatalf("decoded event_id type = %T", decoded["event_id"])
	}
	if got := eventIDUnion["string"]; got != "evt-001" {
		t.Fatalf("decoded event_id = %#v", got)
	}

	tags, ok := decoded["tags"].(map[string]any)
	if !ok {
		t.Fatalf("decoded tags type = %T", decoded["tags"])
	}
	if got := tags["batch_id"]; got != "batch-001" {
		t.Fatalf("decoded tag batch_id = %#v", got)
	}

	hostIPUnion, ok := decoded["host_ip"].(map[string]any)
	if !ok {
		t.Fatalf("decoded host_ip type = %T", decoded["host_ip"])
	}
	if got := hostIPUnion["string"]; got != "10.0.0.8" {
		t.Fatalf("decoded host_ip = %#v", got)
	}

	agentIPUnion, ok := decoded["agent_ip"].(map[string]any)
	if !ok {
		t.Fatalf("decoded agent_ip type = %T", decoded["agent_ip"])
	}
	if got := agentIPUnion["string"]; got != "10.0.0.8" {
		t.Fatalf("decoded agent_ip = %#v", got)
	}
}
