package ingest

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestAgentClientPullSendsSourcePathAndClipsTimeout(t *testing.T) {
	t.Parallel()

	var got AgentPullRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewDecoder(r.Body).Decode(&got); err != nil {
			t.Fatalf("decode request failed: %v", err)
		}
		_ = json.NewEncoder(w).Encode(AgentPullResponse{BatchID: "batch-1", Cursor: AgentPullCursor{Next: got.Cursor}})
	}))
	defer server.Close()

	client := NewAgentClient(2 * time.Second)
	_, err := client.Pull(context.Background(), PullSource{
		AgentBaseURL:   server.URL,
		Path:           "/var/log/*.log",
		PullTimeoutSec: 5,
	}, PullTask{}, AgentAuthCredential{KeyID: "active", Key: "secret"}, "123")
	if err != nil {
		t.Fatalf("pull failed: %v", err)
	}
	if got.SourcePath != "/var/log/*.log" {
		t.Fatalf("source_path=%q, want /var/log/*.log", got.SourcePath)
	}
	if got.TimeoutMS >= 2000 {
		t.Fatalf("timeout_ms=%d, want value below client timeout", got.TimeoutMS)
	}
	if got.TimeoutMS != 1000 {
		t.Fatalf("timeout_ms=%d, want 1000ms headroom-clipped value", got.TimeoutMS)
	}
}
