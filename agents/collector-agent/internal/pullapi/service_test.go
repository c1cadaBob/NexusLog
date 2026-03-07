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
	if got.AgentID != "agent-test" || got.Version != "1.0.0" || got.Status != "online" {
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
	svc.SetAgentInfo("agent-structured", "2.0.0")
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
	if pullData.Agent.ID != "agent-structured" || pullData.Agent.Version != "2.0.0" {
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
