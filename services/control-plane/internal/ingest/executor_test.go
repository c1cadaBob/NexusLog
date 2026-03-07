package ingest

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestPullTaskExecutorSuccess(t *testing.T) {
	t.Parallel()

	var ackStatus string
	agentServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/agent/v1/logs/pull":
			if got := r.Header.Get("X-Agent-Key"); got != "test-agent-key" {
				t.Fatalf("unexpected X-Agent-Key: %s", got)
			}
			_ = json.NewEncoder(w).Encode(AgentPullResponse{
				BatchID: "batch-success-001",
				Cursor:  AgentPullCursor{Next: "100", HasMore: false},
				Records: []AgentPullRecord{
					{
						RecordID:   "rec-1",
						Sequence:   1,
						ObservedAt: time.Now().UTC().Format(time.RFC3339Nano),
						Body:       "hello nexuslog",
						SizeBytes:  len("hello nexuslog"),
						Source:     AgentPullSource{Kind: "file", Path: "/var/log/app.log", Offset: 100},
						Severity:   AgentPullSeverity{Text: "info", Number: 9},
					},
				},
			})
		case "/agent/v1/logs/ack":
			var payload AgentAckRequestPayload
			if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
				t.Fatalf("decode ack payload failed: %v", err)
			}
			ackStatus = payload.Status
			_ = json.NewEncoder(w).Encode(map[string]any{
				"accepted":           true,
				"checkpoint_updated": true,
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer agentServer.Close()

	esServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/_bulk" {
			http.NotFound(w, r)
			return
		}
		raw, _ := io.ReadAll(r.Body)
		if !strings.Contains(string(raw), "hello nexuslog") {
			t.Fatalf("unexpected bulk payload: %s", string(raw))
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"errors":false,"items":[{"index":{"status":201}}]}`))
	}))
	defer esServer.Close()

	sourceStore := NewPullSourceStore()
	taskStore := NewPullTaskStore()
	packageStore := NewPullPackageStore()
	receiptStore := NewReceiptStore()
	deadLetterStore := NewDeadLetterStore()
	batchStore := NewPullBatchStore()
	cursorStore := NewPullCursorStore()
	authStore := NewAgentAuthKeyStore()

	if err := authStore.Upsert(AgentAuthKey{
		KeyRef:            "keyref-success",
		ActiveKeyID:       "active",
		ActiveKeyMaterial: "test-agent-key",
		Status:            "active",
	}); err != nil {
		t.Fatalf("upsert auth key failed: %v", err)
	}

	source, err := sourceStore.Create(CreatePullSourceRequest{
		Name:            "executor-success-source",
		Host:            "127.0.0.1",
		Port:            443,
		Protocol:        "https",
		Path:            "/var/log/*.log",
		Auth:            "auth-ref",
		AgentBaseURL:    agentServer.URL,
		PullIntervalSec: 30,
		PullTimeoutSec:  30,
		KeyRef:          "keyref-success",
		Status:          "active",
	})
	if err != nil {
		t.Fatalf("create source failed: %v", err)
	}

	task := taskStore.CreatePending(RunPullTaskRequest{
		SourceID:    source.SourceID,
		TriggerType: "manual",
		Options:     map[string]any{"max_records": 200},
	})
	if task.TaskID == "" {
		t.Fatalf("create pending task failed")
	}

	executor := NewPullTaskExecutor(
		sourceStore,
		taskStore,
		packageStore,
		receiptStore,
		deadLetterStore,
		batchStore,
		cursorStore,
		authStore,
		NewAgentClient(5*time.Second),
		NewESSink(esServer.URL, "nexuslog-logs-v2", "", "", 5*time.Second),
		PullTaskExecutorConfig{
			MaxRetries:       1,
			RetryBackoff:     10 * time.Millisecond,
			ExecutionTimeout: 5 * time.Second,
		},
	)
	executor.Execute(task)

	updatedTask, ok := taskStore.GetByID(task.TaskID)
	if !ok {
		t.Fatalf("task not found after execute")
	}
	if updatedTask.Status != "success" {
		t.Fatalf("expected task status success, got %s", updatedTask.Status)
	}
	if strings.TrimSpace(ackStatus) != "ack" {
		t.Fatalf("expected ack status=ack, got %s", ackStatus)
	}

	packages, total := packageStore.List("", "", "", 1, 20)
	if total != 1 || len(packages) != 1 {
		t.Fatalf("expected one package, total=%d len=%d", total, len(packages))
	}
	if packages[0].Status != "acked" {
		t.Fatalf("expected package status acked, got %s", packages[0].Status)
	}

	if deadLetterStore.Count() != 0 {
		t.Fatalf("expected dead letter count=0, got %d", deadLetterStore.Count())
	}

	batch, ok := batchStore.GetByBatchID(packages[0].BatchID)
	if !ok {
		t.Fatalf("batch not found: %s", packages[0].BatchID)
	}
	if batch.Status != string(PullBatchStatusAcked) {
		t.Fatalf("expected batch status acked, got %s", batch.Status)
	}

	cursor, ok := cursorStore.GetBySourceAndPath(source.SourceID, "/var/log/app.log")
	if !ok {
		t.Fatalf("cursor not found for source_path /var/log/app.log")
	}
	if cursor.LastCursor != "100" {
		t.Fatalf("expected last cursor 100, got %s", cursor.LastCursor)
	}
}

func TestPullTaskExecutorESFailure(t *testing.T) {
	t.Parallel()

	var ackStatus string
	agentServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/agent/v1/logs/pull":
			_ = json.NewEncoder(w).Encode(AgentPullResponse{
				BatchID: "batch-failed-001",
				Cursor:  AgentPullCursor{Next: "88", HasMore: false},
				Records: []AgentPullRecord{
					{
						RecordID:   "rec-1",
						Sequence:   1,
						ObservedAt: time.Now().UTC().Format(time.RFC3339Nano),
						Body:       "this will fail in es",
						SizeBytes:  len("this will fail in es"),
						Source:     AgentPullSource{Kind: "file", Path: "/var/log/error.log", Offset: 88},
						Severity:   AgentPullSeverity{Text: "error", Number: 17},
					},
				},
			})
		case "/agent/v1/logs/ack":
			var payload AgentAckRequestPayload
			_ = json.NewDecoder(r.Body).Decode(&payload)
			ackStatus = payload.Status
			_ = json.NewEncoder(w).Encode(map[string]any{
				"accepted":           true,
				"checkpoint_updated": false,
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer agentServer.Close()

	esServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"errors":true,"items":[{"index":{"status":500,"error":{"type":"server_error"}}}]}`))
	}))
	defer esServer.Close()

	sourceStore := NewPullSourceStore()
	taskStore := NewPullTaskStore()
	packageStore := NewPullPackageStore()
	receiptStore := NewReceiptStore()
	deadLetterStore := NewDeadLetterStore()
	batchStore := NewPullBatchStore()
	cursorStore := NewPullCursorStore()
	authStore := NewAgentAuthKeyStore()

	if err := authStore.Upsert(AgentAuthKey{
		KeyRef:            "keyref-failed",
		ActiveKeyID:       "active",
		ActiveKeyMaterial: "test-agent-key",
		Status:            "active",
	}); err != nil {
		t.Fatalf("upsert auth key failed: %v", err)
	}

	source, err := sourceStore.Create(CreatePullSourceRequest{
		Name:            "executor-failed-source",
		Host:            "127.0.0.1",
		Port:            443,
		Protocol:        "https",
		Path:            "/var/log/*.log",
		Auth:            "auth-ref",
		AgentBaseURL:    agentServer.URL,
		PullIntervalSec: 30,
		PullTimeoutSec:  30,
		KeyRef:          "keyref-failed",
		Status:          "active",
	})
	if err != nil {
		t.Fatalf("create source failed: %v", err)
	}

	task := taskStore.CreatePending(RunPullTaskRequest{
		SourceID:    source.SourceID,
		TriggerType: "manual",
	})
	if task.TaskID == "" {
		t.Fatalf("create pending task failed")
	}

	executor := NewPullTaskExecutor(
		sourceStore,
		taskStore,
		packageStore,
		receiptStore,
		deadLetterStore,
		batchStore,
		cursorStore,
		authStore,
		NewAgentClient(5*time.Second),
		NewESSink(esServer.URL, "nexuslog-logs-v2", "", "", 5*time.Second),
		PullTaskExecutorConfig{
			MaxRetries:       0,
			RetryBackoff:     10 * time.Millisecond,
			ExecutionTimeout: 5 * time.Second,
		},
	)
	executor.Execute(task)

	updatedTask, ok := taskStore.GetByID(task.TaskID)
	if !ok {
		t.Fatalf("task not found after execute")
	}
	if updatedTask.Status != "failed" {
		t.Fatalf("expected task status failed, got %s", updatedTask.Status)
	}
	if updatedTask.ErrorCode != ErrorCodeExecutorESWriteFailed {
		t.Fatalf("unexpected task error code: %s", updatedTask.ErrorCode)
	}

	packages, total := packageStore.List("", "", "", 1, 20)
	if total != 1 || len(packages) != 1 {
		t.Fatalf("expected one package, total=%d len=%d", total, len(packages))
	}
	if packages[0].Status != "nacked" {
		t.Fatalf("expected package status nacked, got %s", packages[0].Status)
	}

	if deadLetterStore.Count() != 1 {
		t.Fatalf("expected dead letter count=1, got %d", deadLetterStore.Count())
	}
	if strings.TrimSpace(ackStatus) != "nack" {
		t.Fatalf("expected ack status=nack, got %s", ackStatus)
	}

	batch, ok := batchStore.GetByBatchID(packages[0].BatchID)
	if !ok {
		t.Fatalf("batch not found")
	}
	if batch.Status != string(PullBatchStatusDeadLettered) {
		t.Fatalf("expected batch status dead_lettered, got %s", batch.Status)
	}
}
