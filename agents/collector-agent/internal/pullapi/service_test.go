package pullapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/nexuslog/collector-agent/internal/checkpoint"
	"github.com/nexuslog/collector-agent/plugins"
)

type mockCheckpointStore struct {
	saved map[string]int64
}

func newMockCheckpointStore() *mockCheckpointStore {
	return &mockCheckpointStore{saved: make(map[string]int64)}
}

func (m *mockCheckpointStore) Save(source string, offset int64) error {
	m.saved[source] = offset
	return nil
}

func (m *mockCheckpointStore) Load(source string) (checkpoint.Position, error) {
	return checkpoint.Position{Source: source, Offset: m.saved[source]}, nil
}

func (m *mockCheckpointStore) LoadAll() (map[string]checkpoint.Position, error) {
	result := make(map[string]checkpoint.Position, len(m.saved))
	for source, offset := range m.saved {
		result[source] = checkpoint.Position{Source: source, Offset: offset}
	}
	return result, nil
}

func (m *mockCheckpointStore) Close() error { return nil }

// TestMetaRouteSuccess 验证 GET /agent/v1/meta 正常返回。
func TestMetaRouteSuccess(t *testing.T) {
	store := newMockCheckpointStore()
	svc := New(store)
	meta := MetaInfo{
		AgentID:      "agent-test",
		Version:      "1.0.0",
		Hostname:     "host-a",
		IP:           "10.0.0.8",
		Status:       "online",
		Sources:      []string{"/var/log/*.log"},
		Capabilities: []string{"file_incremental", "pull_api", "ack_checkpoint"},
	}

	mux := http.NewServeMux()
	RegisterRoutes(mux, svc, meta, testAuthConfig())

	req := httptest.NewRequest(http.MethodGet, "/agent/v1/meta", nil)
	req.Header.Set("X-Agent-Key", "test-active-key")
	resp := httptest.NewRecorder()
	mux.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", resp.Code, resp.Body.String())
	}

	var got MetaInfo
	if err := json.Unmarshal(resp.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode meta response failed: %v", err)
	}
	if got.AgentID != "agent-test" || got.Version != "1.0.0" || got.Hostname != "host-a" || got.IP != "10.0.0.8" || got.Status != "online" {
		t.Fatalf("unexpected meta response: %+v", got)
	}
}

// TestPullAndAckFlow 验证 pull/ack 主链路与 checkpoint 回写。
func TestPullAndAckFlow(t *testing.T) {
	store := newMockCheckpointStore()
	svc := New(store)
	mux := http.NewServeMux()
	RegisterRoutes(mux, svc, MetaInfo{
		AgentID:      "agent-test",
		Version:      "1.0.0",
		Status:       "online",
		Sources:      []string{"/var/log/*.log"},
		Capabilities: []string{"file_incremental", "pull_api", "ack_checkpoint"},
	}, testAuthConfig())

	svc.AddRecords([]plugins.Record{
		{Source: "/var/log/app.log", Data: []byte("line-a"), Metadata: map[string]string{"offset": "6"}},
		{Source: "/var/log/app.log", Data: []byte("line-b"), Metadata: map[string]string{"offset": "12"}},
	})

	pullResp := doJSONRequest(t, mux, http.MethodPost, "/agent/v1/logs/pull", map[string]any{
		"max_records": 10,
		"max_bytes":   1024,
	}, map[string]string{
		"X-Agent-Key": "test-active-key",
	})
	if pullResp.Code != http.StatusOK {
		t.Fatalf("pull failed: %d body=%s", pullResp.Code, pullResp.Body.String())
	}

	var pullData PullResponse
	if err := json.Unmarshal(pullResp.Body.Bytes(), &pullData); err != nil {
		t.Fatalf("decode pull response failed: %v", err)
	}
	if pullData.BatchID == "" || pullData.Cursor.Next == "" {
		t.Fatalf("expected non-empty batch_id/cursor.next: %+v", pullData)
	}
	if len(pullData.Records) != 2 {
		t.Fatalf("expected 2 records, got %d", len(pullData.Records))
	}
	first := pullData.Records[0]
	if first.RecordID == "" {
		t.Fatalf("expected non-empty record_id: %+v", first)
	}
	if first.Sequence <= 0 {
		t.Fatalf("expected positive sequence: %+v", first)
	}
	if first.Source.Offset != 6 {
		t.Fatalf("expected first record source.offset=6, got %d", first.Source.Offset)
	}
	if first.Source.Path != "/var/log/app.log" {
		t.Fatalf("expected first record source.path=/var/log/app.log, got %s", first.Source.Path)
	}
	if first.SizeBytes != len("line-a") {
		t.Fatalf("expected first record size=%d, got %d", len("line-a"), first.SizeBytes)
	}
	if first.ObservedAt == "" {
		t.Fatalf("expected non-empty observed_at: %+v", first)
	}
	if _, err := time.Parse(time.RFC3339Nano, first.ObservedAt); err != nil {
		t.Fatalf("parse observed_at failed: %v value=%s", err, first.ObservedAt)
	}

	ackResp := doJSONRequest(t, mux, http.MethodPost, "/agent/v1/logs/ack", map[string]any{
		"batch_id":         pullData.BatchID,
		"status":           "ack",
		"committed_cursor": pullData.Cursor.Next,
	}, map[string]string{
		"X-Agent-Key": "test-active-key",
	})
	if ackResp.Code != http.StatusOK {
		t.Fatalf("ack failed: %d body=%s", ackResp.Code, ackResp.Body.String())
	}

	var ackData AckResponse
	if err := json.Unmarshal(ackResp.Body.Bytes(), &ackData); err != nil {
		t.Fatalf("decode ack response failed: %v", err)
	}
	if !ackData.Accepted || !ackData.CheckpointUpdated {
		t.Fatalf("unexpected ack response: %+v", ackData)
	}
	if got := store.saved["/var/log/app.log"]; got != 12 {
		t.Fatalf("expected checkpoint offset 12, got %d", got)
	}
}

func TestPullFiltersBySourcePath(t *testing.T) {
	store := newMockCheckpointStore()
	svc := New(store)
	mux := http.NewServeMux()
	RegisterRoutes(mux, svc, MetaInfo{}, testAuthConfig())

	svc.AddRecords([]plugins.Record{
		{Source: "/var/log/app.log", Data: []byte("host-line"), Metadata: map[string]string{"offset": "10"}},
		{Source: "/host-docker-containers/abc/abc-json.log", Data: []byte("container-line"), Metadata: map[string]string{"offset": "20"}},
	})

	resp := doJSONRequest(t, mux, http.MethodPost, "/agent/v1/logs/pull", map[string]any{
		"source_path": "/var/log/*.log",
		"max_records": 10,
		"max_bytes":   1024,
	}, map[string]string{
		"X-Agent-Key": "test-active-key",
	})
	if resp.Code != http.StatusOK {
		t.Fatalf("pull failed: %d body=%s", resp.Code, resp.Body.String())
	}

	var pullData PullResponse
	if err := json.Unmarshal(resp.Body.Bytes(), &pullData); err != nil {
		t.Fatalf("decode pull response failed: %v", err)
	}
	if len(pullData.Records) != 1 {
		t.Fatalf("expected 1 filtered record, got %d", len(pullData.Records))
	}
	if got := pullData.Records[0].Source.Path; got != "/var/log/app.log" {
		t.Fatalf("unexpected filtered source path: %s", got)
	}
}

func TestPullFiltersByRecursiveSourcePath(t *testing.T) {
	store := newMockCheckpointStore()
	svc := New(store)
	mux := http.NewServeMux()
	RegisterRoutes(mux, svc, MetaInfo{}, testAuthConfig())

	svc.AddRecords([]plugins.Record{
		{Source: "/var/log/app.log", Data: []byte("root-line"), Metadata: map[string]string{"offset": "10"}},
		{Source: "/var/log/nginx/access.log", Data: []byte("nested-line"), Metadata: map[string]string{"offset": "20"}},
		{Source: "/opt/app/app.log", Data: []byte("outside-line"), Metadata: map[string]string{"offset": "30"}},
	})

	resp := doJSONRequest(t, mux, http.MethodPost, "/agent/v1/logs/pull", map[string]any{
		"source_path": "/var/**/*.log",
		"max_records": 10,
		"max_bytes":   1024,
	}, map[string]string{
		"X-Agent-Key": "test-active-key",
	})
	if resp.Code != http.StatusOK {
		t.Fatalf("pull failed: %d body=%s", resp.Code, resp.Body.String())
	}

	var pullData PullResponse
	if err := json.Unmarshal(resp.Body.Bytes(), &pullData); err != nil {
		t.Fatalf("decode pull response failed: %v", err)
	}
	if len(pullData.Records) != 2 {
		t.Fatalf("expected 2 recursively filtered records, got %d", len(pullData.Records))
	}
	if pullData.Records[0].Source.Path != "/var/log/app.log" && pullData.Records[1].Source.Path != "/var/log/app.log" {
		t.Fatalf("expected root log to match recursive pattern: %+v", pullData.Records)
	}
	if pullData.Records[0].Source.Path != "/var/log/nginx/access.log" && pullData.Records[1].Source.Path != "/var/log/nginx/access.log" {
		t.Fatalf("expected nested log to match recursive pattern: %+v", pullData.Records)
	}
}

func TestPullTracksCommittedCursorPerSourcePath(t *testing.T) {
	store := newMockCheckpointStore()
	svc := New(store)
	mux := http.NewServeMux()
	RegisterRoutes(mux, svc, MetaInfo{}, testAuthConfig())

	svc.AddRecords([]plugins.Record{
		{Source: "/host-docker-containers/abc/abc-json.log", Data: []byte("container-first"), Metadata: map[string]string{"offset": "10"}},
		{Source: "/var/log/app.log", Data: []byte("host-second"), Metadata: map[string]string{"offset": "20"}},
	})

	hostPull := doJSONRequest(t, mux, http.MethodPost, "/agent/v1/logs/pull", map[string]any{
		"source_path": "/var/log/*.log",
		"max_records": 10,
		"max_bytes":   1024,
	}, map[string]string{
		"X-Agent-Key": "test-active-key",
	})
	if hostPull.Code != http.StatusOK {
		t.Fatalf("host pull failed: %d body=%s", hostPull.Code, hostPull.Body.String())
	}
	var hostData PullResponse
	if err := json.Unmarshal(hostPull.Body.Bytes(), &hostData); err != nil {
		t.Fatalf("decode host pull failed: %v", err)
	}
	if len(hostData.Records) != 1 || hostData.Records[0].Source.Path != "/var/log/app.log" {
		t.Fatalf("unexpected host pull records: %+v", hostData.Records)
	}

	hostAck := doJSONRequest(t, mux, http.MethodPost, "/agent/v1/logs/ack", map[string]any{
		"batch_id":         hostData.BatchID,
		"status":           "ack",
		"committed_cursor": hostData.Cursor.Next,
	}, map[string]string{
		"X-Agent-Key": "test-active-key",
	})
	if hostAck.Code != http.StatusOK {
		t.Fatalf("host ack failed: %d body=%s", hostAck.Code, hostAck.Body.String())
	}

	dockerPull := doJSONRequest(t, mux, http.MethodPost, "/agent/v1/logs/pull", map[string]any{
		"source_path": "/host-docker-containers/*/*-json.log",
		"max_records": 10,
		"max_bytes":   1024,
	}, map[string]string{
		"X-Agent-Key": "test-active-key",
	})
	if dockerPull.Code != http.StatusOK {
		t.Fatalf("docker pull failed: %d body=%s", dockerPull.Code, dockerPull.Body.String())
	}
	var dockerData PullResponse
	if err := json.Unmarshal(dockerPull.Body.Bytes(), &dockerData); err != nil {
		t.Fatalf("decode docker pull failed: %v", err)
	}
	if len(dockerData.Records) != 1 || dockerData.Records[0].Source.Path != "/host-docker-containers/abc/abc-json.log" {
		t.Fatalf("unexpected docker pull records: %+v", dockerData.Records)
	}
}

func TestPullResetsStaleCursorAfterAgentRestart(t *testing.T) {
	store := newMockCheckpointStore()
	svc := New(store)
	mux := http.NewServeMux()
	RegisterRoutes(mux, svc, MetaInfo{}, testAuthConfig())

	svc.AddRecords([]plugins.Record{{Source: "/host-docker-containers/abc/abc-json.log", Data: []byte("fresh-after-restart"), Metadata: map[string]string{"offset": "10"}}})

	resp := doJSONRequest(t, mux, http.MethodPost, "/agent/v1/logs/pull", map[string]any{
		"source_path": "/host-docker-containers/*/*-json.log",
		"cursor":      "999999",
		"max_records": 10,
		"max_bytes":   1024,
	}, map[string]string{
		"X-Agent-Key": "test-active-key",
	})
	if resp.Code != http.StatusOK {
		t.Fatalf("pull failed: %d body=%s", resp.Code, resp.Body.String())
	}
	var pullData PullResponse
	if err := json.Unmarshal(resp.Body.Bytes(), &pullData); err != nil {
		t.Fatalf("decode pull response failed: %v", err)
	}
	if len(pullData.Records) != 1 {
		t.Fatalf("expected stale cursor reset to return 1 record, got %d", len(pullData.Records))
	}
	if got := pullData.Records[0].Body; got != "fresh-after-restart" {
		t.Fatalf("unexpected record body: %q", got)
	}
}

// TestPullRecordFallbackOffsetMetadata 验证缺省 metadata 时仍返回结构化 offset 与 metadata.offset。
func TestPullRecordFallbackOffsetMetadata(t *testing.T) {
	svc := New(newMockCheckpointStore())
	mux := http.NewServeMux()
	RegisterRoutes(mux, svc, MetaInfo{}, testAuthConfig())

	svc.AddRecords([]plugins.Record{
		{Source: "syslog://local", Data: []byte("hello")},
	})

	resp := doJSONRequest(t, mux, http.MethodPost, "/agent/v1/logs/pull", map[string]any{
		"max_records": 1,
		"max_bytes":   1024,
	}, map[string]string{
		"X-Agent-Key": "test-active-key",
	})
	if resp.Code != http.StatusOK {
		t.Fatalf("pull failed: %d body=%s", resp.Code, resp.Body.String())
	}

	var pullData PullResponse
	if err := json.Unmarshal(resp.Body.Bytes(), &pullData); err != nil {
		t.Fatalf("decode pull response failed: %v", err)
	}
	if len(pullData.Records) != 1 {
		t.Fatalf("expected 1 record, got %d", len(pullData.Records))
	}
	got := pullData.Records[0]
	if got.Source.Offset != int64(len("hello")) {
		t.Fatalf("expected source.offset=%d, got %d", len("hello"), got.Source.Offset)
	}
	if got.Source.Path != "syslog://local" {
		t.Fatalf("expected source.path=syslog://local, got %s", got.Source.Path)
	}
}

// TestPullInvalidArgument 验证 pull 参数非法场景。
func TestPullInvalidArgument(t *testing.T) {
	svc := New(newMockCheckpointStore())
	mux := http.NewServeMux()
	RegisterRoutes(mux, svc, MetaInfo{}, testAuthConfig())

	resp := doJSONRequest(t, mux, http.MethodPost, "/agent/v1/logs/pull", map[string]any{
		"max_records": -1,
	}, map[string]string{
		"X-Agent-Key": "test-active-key",
	})
	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", resp.Code, resp.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode error body failed: %v", err)
	}
	if body["code"] != ErrorCodeInvalidParams {
		t.Fatalf("unexpected error code: %#v", body["code"])
	}
}

func TestPullStructuredMultilineAndDedup(t *testing.T) {
	store := newMockCheckpointStore()
	svc := New(store)
	svc.SetAgentInfo("agent-structured", "2.0.0", "host-structured", "10.1.0.8")
	mux := http.NewServeMux()
	RegisterRoutes(mux, svc, MetaInfo{}, testAuthConfig())

	now := time.Now().UTC().UnixNano()
	svc.AddRecords([]plugins.Record{
		{Source: "/var/lib/docker/containers/keycloak.log", Timestamp: now, Data: []byte("keycloak-1           | ERROR failed to start transaction"), Metadata: map[string]string{"offset": "100"}},
		{Source: "/var/lib/docker/containers/keycloak.log", Timestamp: now + int64(time.Millisecond), Data: []byte("keycloak-1           | \tat org.hibernate.resource.transaction.backend.jta.internal.JtaIsolationDelegate.doTheWork(JtaIsolationDelegate.java:186)"), Metadata: map[string]string{"offset": "200"}},
		{Source: "/var/lib/docker/containers/keycloak.log", Timestamp: now + 2*int64(time.Millisecond), Data: []byte("keycloak-1           |"), Metadata: map[string]string{"offset": "210"}},
	})
	svc.AddRecords([]plugins.Record{
		{Source: "/var/lib/docker/containers/keycloak.log", Timestamp: now + 3*int64(time.Millisecond), Data: []byte("keycloak-1           | ERROR failed to start transaction"), Metadata: map[string]string{"offset": "300"}},
		{Source: "/var/lib/docker/containers/keycloak.log", Timestamp: now + 4*int64(time.Millisecond), Data: []byte("keycloak-1           | \tat org.hibernate.resource.transaction.backend.jta.internal.JtaIsolationDelegate.doTheWork(JtaIsolationDelegate.java:186)"), Metadata: map[string]string{"offset": "400"}},
	})

	pullResp := doJSONRequest(t, mux, http.MethodPost, "/agent/v1/logs/pull", map[string]any{
		"source_path": "/var/lib/docker/containers/keycloak.log",
		"max_records": 10,
		"max_bytes":   4096,
	}, map[string]string{
		"X-Agent-Key": "test-active-key",
	})
	if pullResp.Code != http.StatusOK {
		t.Fatalf("pull failed: %d body=%s", pullResp.Code, pullResp.Body.String())
	}

	var pullData PullResponse
	if err := json.Unmarshal(pullResp.Body.Bytes(), &pullData); err != nil {
		t.Fatalf("decode pull response failed: %v", err)
	}
	if pullData.Agent.ID != "agent-structured" || pullData.Agent.Version != "2.0.0" || pullData.Agent.Hostname != "host-structured" {
		t.Fatalf("unexpected agent info: %+v", pullData.Agent)
	}
	if len(pullData.Records) != 1 {
		t.Fatalf("expected 1 merged record, got %d", len(pullData.Records))
	}

	record := pullData.Records[0]
	if record.Service.Name != "keycloak" || record.Service.Instance.ID != "keycloak-1" {
		t.Fatalf("unexpected service extraction: %+v", record.Service)
	}
	if record.Container.Name != "keycloak-1" {
		t.Fatalf("unexpected container extraction: %+v", record.Container)
	}
	if !record.Multiline.Enabled || record.Multiline.LineCount != 2 {
		t.Fatalf("expected multiline merge, got %+v", record.Multiline)
	}
	if strings.Contains(record.Body, "keycloak-1           |") {
		t.Fatalf("expected body without service prefix, got %q", record.Body)
	}
	if record.Dedup.Count != 2 || !record.Dedup.Hit {
		t.Fatalf("expected dedup hit count=2, got %+v", record.Dedup)
	}
	if record.Source.Path != "/var/lib/docker/containers/keycloak.log" {
		t.Fatalf("unexpected source path: %+v", record.Source)
	}
	if record.Source.Offset != 200 {
		t.Fatalf("unexpected source offset: %+v", record.Source)
	}
}

func TestNormalizePluginRecord_UnwrapsDockerJSONEnvelope(t *testing.T) {
	record, ok := normalizePluginRecord(plugins.Record{
		Source: "/var/lib/docker/containers/72ba83f606fed9df0acbfe6450145197a173e5eb934715f7da97d4241ed8b95f/72ba83f606fed9df0acbfe6450145197a173e5eb934715f7da97d4241ed8b95f-json.log",
		Data:   []byte(`{"log":"[GIN] 2026/03/09 - 13:16:17 |\u001b[97;42m 200 \u001b[0m|   16.940775ms |     172.29.0.18 |\u001b[97;46m POST    \u001b[0m \"/api/v1/query/logs\"\r\n","stream":"stderr","time":"2026-03-09T13:16:17.746751141Z"}`),
		Metadata: map[string]string{
			"offset":                 "4041522",
			"service.name":           "query-api",
			"service.instance.id":    "nexuslog-query-api-1",
			"container.name":         "nexuslog-query-api-1",
			"docker.compose.service": "query-api",
			"source_type":            "docker-json",
		},
	}, "dev-server-centos8", "10.0.0.8")
	if !ok {
		t.Fatal("normalizePluginRecord() returned ok=false")
	}
	if got := record.service.Name; got != "query-api" {
		t.Fatalf("record.service.Name=%q, want query-api", got)
	}
	if got := record.service.Instance.ID; got != "nexuslog-query-api-1" {
		t.Fatalf("record.service.Instance.ID=%q, want nexuslog-query-api-1", got)
	}
	if got := record.container.Name; got != "nexuslog-query-api-1" {
		t.Fatalf("record.container.Name=%q, want nexuslog-query-api-1", got)
	}
	if !strings.HasPrefix(record.body, "[GIN] 2026/03/09 - 13:16:17 |") {
		t.Fatalf("record.body=%q, want unwrapped docker log body", record.body)
	}
	if !strings.HasPrefix(record.original, `{"log":"[GIN]`) {
		t.Fatalf("record.original=%q, want original docker json envelope", record.original)
	}
	if got := record.sourceV2.Stream; got != "stderr" {
		t.Fatalf("record.sourceV2.Stream=%q, want stderr", got)
	}
	wantTimestamp := time.Date(2026, time.March, 9, 13, 16, 17, 746751141, time.UTC).UnixNano()
	if record.timestamp != wantTimestamp {
		t.Fatalf("record.timestamp=%d, want %d", record.timestamp, wantTimestamp)
	}
}

func TestPullMergesDockerJSONStacktraceAcrossBatches(t *testing.T) {
	store := newMockCheckpointStore()
	svc := New(store)
	mux := http.NewServeMux()
	RegisterRoutes(mux, svc, MetaInfo{}, testAuthConfig())

	source := "/var/lib/docker/containers/72ba83f606fed9df0acbfe6450145197a173e5eb934715f7da97d4241ed8b95f/72ba83f606fed9df0acbfe6450145197a173e5eb934715f7da97d4241ed8b95f-json.log"
	baseMetadata := map[string]string{
		"service.name":        "flink-taskmanager",
		"service.instance.id": "nexuslog-flink-taskmanager-1",
		"container.name":      "nexuslog-flink-taskmanager-1",
		"source_type":         "docker-json",
	}
	svc.AddRecords([]plugins.Record{{
		Source:    source,
		Timestamp: time.Date(2026, time.March, 11, 10, 30, 0, 0, time.UTC).UnixNano(),
		Data:      []byte(`{"log":"ERROR failed to deserialize consumer record\n","stream":"stderr","time":"2026-03-11T10:30:00.000000001Z"}`),
		Metadata:  map[string]string{"offset": "100", "service.name": baseMetadata["service.name"], "service.instance.id": baseMetadata["service.instance.id"], "container.name": baseMetadata["container.name"], "source_type": baseMetadata["source_type"]},
	}})
	svc.AddRecords([]plugins.Record{{
		Source:    "/var/log/messages",
		Timestamp: time.Date(2026, time.March, 11, 10, 30, 0, 0, time.UTC).UnixNano(),
		Data:      []byte("INFO unrelated log between header and stack"),
		Metadata:  map[string]string{"offset": "1000", "service.name": "host-syslog"},
	}})
	svc.AddRecords([]plugins.Record{{
		Source:    source,
		Timestamp: time.Date(2026, time.March, 11, 10, 30, 0, int(time.Millisecond), time.UTC).UnixNano(),
		Data:      []byte(`{"log":"\tat org.apache.flink.connector.kafka.source.reader.KafkaRecordEmitter.emitRecord(KafkaRecordEmitter.java:53)\n","stream":"stderr","time":"2026-03-11T10:30:00.000000002Z"}`),
		Metadata:  map[string]string{"offset": "200", "service.name": baseMetadata["service.name"], "service.instance.id": baseMetadata["service.instance.id"], "container.name": baseMetadata["container.name"], "source_type": baseMetadata["source_type"]},
	}})

	pullResp := doJSONRequest(t, mux, http.MethodPost, "/agent/v1/logs/pull", map[string]any{
		"source_path": source,
		"max_records": 10,
		"max_bytes":   4096,
	}, map[string]string{
		"X-Agent-Key": "test-active-key",
	})
	if pullResp.Code != http.StatusOK {
		t.Fatalf("pull failed: %d body=%s", pullResp.Code, pullResp.Body.String())
	}

	var pullData PullResponse
	if err := json.Unmarshal(pullResp.Body.Bytes(), &pullData); err != nil {
		t.Fatalf("decode pull response failed: %v", err)
	}
	if len(pullData.Records) != 1 {
		t.Fatalf("expected 1 merged record, got %d", len(pullData.Records))
	}

	record := pullData.Records[0]
	if !record.Multiline.Enabled || record.Multiline.LineCount != 2 {
		t.Fatalf("expected multiline merge, got %+v", record.Multiline)
	}
	if !strings.Contains(record.Body, "ERROR failed to deserialize consumer record\nat org.apache.flink.connector.kafka.source.reader.KafkaRecordEmitter.emitRecord") {
		t.Fatalf("unexpected merged body: %q", record.Body)
	}
	if !strings.Contains(record.Original, `{"log":"ERROR failed to deserialize consumer record`) || !strings.Contains(record.Original, `{"log":"\tat org.apache.flink.connector.kafka.source.reader.KafkaRecordEmitter.emitRecord`) {
		t.Fatalf("expected original payload to preserve docker envelopes, got %q", record.Original)
	}
	if record.Source.Offset != 200 {
		t.Fatalf("record.Source.Offset=%d, want 200", record.Source.Offset)
	}
}

// TestAuthMissingHeader 验证缺失 X-Agent-Key 时返回 401。
func TestAuthMissingHeader(t *testing.T) {
	svc := New(newMockCheckpointStore())
	mux := http.NewServeMux()
	RegisterRoutes(mux, svc, MetaInfo{}, testAuthConfig())

	resp := doJSONRequest(t, mux, http.MethodPost, "/agent/v1/logs/pull", map[string]any{}, nil)
	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d body=%s", resp.Code, resp.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode error body failed: %v", err)
	}
	if body["code"] != ErrorCodeAuthMissingToken {
		t.Fatalf("unexpected error code: %#v", body["code"])
	}
}

// TestAuthInvalidKey 验证错误 key 返回 401 且不泄露细节。
func TestAuthInvalidKey(t *testing.T) {
	svc := New(newMockCheckpointStore())
	mux := http.NewServeMux()
	RegisterRoutes(mux, svc, MetaInfo{}, testAuthConfig())

	resp := doJSONRequest(t, mux, http.MethodGet, "/agent/v1/meta", nil, map[string]string{
		"X-Agent-Key": "wrong-key",
		"X-Key-Id":    "active",
	})
	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d body=%s", resp.Code, resp.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode error body failed: %v", err)
	}
	if body["code"] != ErrorCodeAuthInvalidToken {
		t.Fatalf("unexpected error code: %#v", body["code"])
	}
	if body["message"] != "unauthorized" {
		t.Fatalf("unexpected message: %#v", body["message"])
	}
}

func testAuthConfig() AuthConfig {
	return NewAuthConfig("active", "test-active-key", "next", "test-next-key")
}

func doJSONRequest(t *testing.T, handler http.Handler, method, path string, payload any, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	body := bytes.NewBuffer(nil)
	if payload != nil {
		if err := json.NewEncoder(body).Encode(payload); err != nil {
			t.Fatalf("encode payload failed: %v", err)
		}
	}

	req := httptest.NewRequest(method, path, body)
	req.Header.Set("Content-Type", "application/json")
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	resp := httptest.NewRecorder()
	handler.ServeHTTP(resp, req)
	return resp
}
