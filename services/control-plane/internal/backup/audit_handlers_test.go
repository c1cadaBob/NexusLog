package backup

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	cpMiddleware "github.com/nexuslog/control-plane/internal/middleware"
)

func newBackupTestHandler(t *testing.T, httpHandler http.HandlerFunc) (*Handler, func()) {
	t.Helper()
	server := httptest.NewServer(httpHandler)
	service := &Service{
		endpoint: server.URL,
		client:   server.Client(),
	}
	return NewHandler(service), server.Close
}

func newBackupTestContext(method, target string, body any) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	var reader *bytes.Reader
	if body == nil {
		reader = bytes.NewReader(nil)
	} else {
		payload, _ := json.Marshal(body)
		reader = bytes.NewReader(payload)
	}

	req := httptest.NewRequest(method, target, reader)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", "00000000-0000-0000-0000-000000000001")
	req.Header.Set("X-User-ID", "20000000-0000-0000-0000-000000000001")
	c.Request = req
	return c, w
}

func TestHandlerCreateRepositorySetsExplicitAuditEvent(t *testing.T) {
	handler, cleanup := newBackupTestHandler(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut || r.URL.Path != "/_snapshot/audit-repo" {
			t.Fatalf("unexpected request %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"acknowledged":true}`))
	})
	defer cleanup()

	c, w := newBackupTestContext(http.MethodPost, "/api/v1/backup/repositories", map[string]any{"name": "audit-repo"})
	handler.CreateRepository(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	event, ok := cpMiddleware.GetAuditEvent(c)
	if !ok {
		t.Fatal("expected audit event")
	}
	if event.Action != "backup_repositories.create" {
		t.Fatalf("expected backup_repositories.create, got %s", event.Action)
	}
	if event.ResourceID != "audit-repo" {
		t.Fatalf("expected resource id audit-repo, got %s", event.ResourceID)
	}
	if got := event.Details["location"]; got != defaultRepoPath {
		t.Fatalf("expected default repo path %s, got %#v", defaultRepoPath, got)
	}
}

func TestHandlerCreateSnapshotSetsExplicitAuditEvent(t *testing.T) {
	handler, cleanup := newBackupTestHandler(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut || r.URL.Path != "/_snapshot/audit-repo/snapshot-a" {
			t.Fatalf("unexpected request %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"accepted":true}`))
	})
	defer cleanup()

	c, w := newBackupTestContext(http.MethodPost, "/api/v1/backup/snapshots", map[string]any{
		"repository":  "audit-repo",
		"name":        "snapshot-a",
		"indices":     "nexuslog-*",
		"description": "backup audit create",
	})
	handler.CreateSnapshot(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	event, ok := cpMiddleware.GetAuditEvent(c)
	if !ok {
		t.Fatal("expected audit event")
	}
	if event.Action != "backup_snapshots.create" {
		t.Fatalf("expected backup_snapshots.create, got %s", event.Action)
	}
	if event.ResourceID != "snapshot-a" {
		t.Fatalf("expected resource id snapshot-a, got %s", event.ResourceID)
	}
	if got := event.Details["repository"]; got != "audit-repo" {
		t.Fatalf("expected repository audit-repo, got %#v", got)
	}
}

func TestHandlerRestoreSnapshotSetsExplicitAuditEvent(t *testing.T) {
	handler, cleanup := newBackupTestHandler(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/_snapshot/audit-repo/snapshot-a/_restore" {
			t.Fatalf("unexpected request %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"accepted":true}`))
	})
	defer cleanup()

	c, w := newBackupTestContext(http.MethodPost, "/api/v1/backup/snapshots/snapshot-a/restore", map[string]any{
		"repository": "audit-repo",
		"indices":    []string{"nexuslog-2026.03.13"},
	})
	c.Params = gin.Params{{Key: "name", Value: "snapshot-a"}}
	handler.RestoreSnapshot(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	event, ok := cpMiddleware.GetAuditEvent(c)
	if !ok {
		t.Fatal("expected audit event")
	}
	if event.Action != "backup_snapshots.restore" {
		t.Fatalf("expected backup_snapshots.restore, got %s", event.Action)
	}
	if got := event.Details["operation"]; got != "restore" {
		t.Fatalf("expected operation restore, got %#v", got)
	}
}

func TestHandlerDeleteSnapshotSetsExplicitAuditEvent(t *testing.T) {
	handler, cleanup := newBackupTestHandler(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete || r.URL.Path != "/_snapshot/audit-repo/snapshot-a" {
			t.Fatalf("unexpected request %s %s", r.Method, r.URL.Path)
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"acknowledged":true}`))
	})
	defer cleanup()

	c, w := newBackupTestContext(http.MethodDelete, "/api/v1/backup/snapshots/snapshot-a?repository=audit-repo", nil)
	c.Params = gin.Params{{Key: "name", Value: "snapshot-a"}}
	handler.DeleteSnapshot(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	event, ok := cpMiddleware.GetAuditEvent(c)
	if !ok {
		t.Fatal("expected audit event")
	}
	if event.Action != "backup_snapshots.delete" {
		t.Fatalf("expected backup_snapshots.delete, got %s", event.Action)
	}
	if event.ResourceID != "snapshot-a" {
		t.Fatalf("expected resource id snapshot-a, got %s", event.ResourceID)
	}
}

func TestHandlerListRepositoriesSetsExplicitAuditEvent(t *testing.T) {
	handler, cleanup := newBackupTestHandler(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet || r.URL.Path != "/_snapshot/_all" {
			t.Fatalf("unexpected request %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"repo-a":{"type":"fs","settings":{"location":"/tmp/backups"}}}`))
	})
	defer cleanup()

	c, w := newBackupTestContext(http.MethodGet, "/api/v1/backup/repositories", nil)
	handler.ListRepositories(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	event, ok := cpMiddleware.GetAuditEvent(c)
	if !ok {
		t.Fatal("expected audit event")
	}
	if event.Action != "backup_repositories.list" {
		t.Fatalf("expected backup_repositories.list, got %s", event.Action)
	}
	if got := event.Details["result_count"]; got != 1 {
		t.Fatalf("expected result_count 1, got %#v", got)
	}
}
