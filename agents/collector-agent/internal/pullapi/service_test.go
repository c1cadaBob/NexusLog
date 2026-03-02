package pullapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

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
	if pullData.BatchID == "" || pullData.NextCursor == "" {
		t.Fatalf("expected non-empty batch_id/next_cursor: %+v", pullData)
	}
	if len(pullData.Records) != 2 {
		t.Fatalf("expected 2 records, got %d", len(pullData.Records))
	}

	ackResp := doJSONRequest(t, mux, http.MethodPost, "/agent/v1/logs/ack", map[string]any{
		"batch_id":         pullData.BatchID,
		"status":           "ack",
		"committed_cursor": pullData.NextCursor,
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
