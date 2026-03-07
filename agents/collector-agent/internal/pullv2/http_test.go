package pullv2

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRoutesRequireAuth(t *testing.T) {
	svc := New(10, &memoryCheckpointSaver{})
	mux := http.NewServeMux()
	RegisterRoutes(mux, svc, BuildDefaultMeta("agent-v2", "0.0.1"), NewAuthConfig("active", "secret", "", ""))

	req := httptest.NewRequest(http.MethodGet, "/agent/v2/meta", nil)
	resp := httptest.NewRecorder()
	mux.ServeHTTP(resp, req)
	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d body=%s", resp.Code, resp.Body.String())
	}
}

func TestPullAckHTTPFlow(t *testing.T) {
	saver := &memoryCheckpointSaver{}
	svc := New(10, saver)
	if err := svc.Append("source-a", []Record{{FilePath: "/var/log/a.log", Body: "hello", Offset: 10}}); err != nil {
		t.Fatalf("append failed: %v", err)
	}

	mux := http.NewServeMux()
	RegisterRoutes(mux, svc, BuildDefaultMeta("agent-v2", "0.0.1"), NewAuthConfig("active", "secret", "", ""))

	pullResp := doRequest(t, mux, http.MethodPost, "/agent/v2/logs/pull", map[string]any{
		"source_key":  "source-a",
		"max_records": 10,
	})
	if pullResp.Code != http.StatusOK {
		t.Fatalf("pull failed: %d body=%s", pullResp.Code, pullResp.Body.String())
	}

	var pullData PullResponse
	if err := json.Unmarshal(pullResp.Body.Bytes(), &pullData); err != nil {
		t.Fatalf("decode pull response failed: %v", err)
	}
	if len(pullData.Records) != 1 || pullData.SourceKey != "source-a" {
		t.Fatalf("unexpected pull response: %+v", pullData)
	}
	if pullData.Records[0].RecordID == "" {
		t.Fatalf("expected generated record id")
	}

	ackResp := doRequest(t, mux, http.MethodPost, "/agent/v2/logs/ack", map[string]any{
		"batch_id":         pullData.BatchID,
		"status":           "ack",
		"committed_cursor": pullData.Cursor.Next,
	})
	if ackResp.Code != http.StatusOK {
		t.Fatalf("ack failed: %d body=%s", ackResp.Code, ackResp.Body.String())
	}

	var ackData AckResult
	if err := json.Unmarshal(ackResp.Body.Bytes(), &ackData); err != nil {
		t.Fatalf("decode ack response failed: %v", err)
	}
	if !ackData.Accepted || !ackData.CheckpointUpdated {
		t.Fatalf("unexpected ack result: %+v", ackData)
	}
}

func doRequest(t *testing.T, handler http.Handler, method, path string, payload any) *httptest.ResponseRecorder {
	t.Helper()
	body := bytes.NewBuffer(nil)
	if payload != nil {
		if err := json.NewEncoder(body).Encode(payload); err != nil {
			t.Fatalf("encode payload failed: %v", err)
		}
	}
	req := httptest.NewRequest(method, path, body)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Agent-Key", "secret")
	req.Header.Set("X-Key-Id", "active")
	resp := httptest.NewRecorder()
	handler.ServeHTTP(resp, req)
	return resp
}
