package backup

import (
	"errors"
	"net/http"
	"strings"
	"testing"

	cpMiddleware "github.com/nexuslog/control-plane/internal/middleware"
)

func TestNormalizeRepositoryLocation_DefaultsToConfiguredBasePath(t *testing.T) {
	t.Setenv("BACKUP_REPOSITORY_BASE_PATH", "/var/lib/nexuslog/backups")

	location, err := normalizeRepositoryLocation("")
	if err != nil {
		t.Fatalf("normalizeRepositoryLocation() error = %v", err)
	}
	if location != "/var/lib/nexuslog/backups" {
		t.Fatalf("normalizeRepositoryLocation() = %q, want /var/lib/nexuslog/backups", location)
	}
}

func TestNormalizeRepositoryLocation_RejectsPathOutsideConfiguredBasePath(t *testing.T) {
	t.Setenv("BACKUP_REPOSITORY_BASE_PATH", "/var/lib/nexuslog/backups")

	_, err := normalizeRepositoryLocation("/etc")
	if !errors.Is(err, ErrInvalidRepositoryLocation) {
		t.Fatalf("normalizeRepositoryLocation() error = %v, want ErrInvalidRepositoryLocation", err)
	}
}

func TestHandlerCreateRepositoryRejectsUnsafeLocation(t *testing.T) {
	t.Setenv("BACKUP_REPOSITORY_BASE_PATH", "/var/lib/nexuslog/backups")

	handler, cleanup := newBackupTestHandler(t, func(w http.ResponseWriter, r *http.Request) {
		t.Fatalf("unexpected upstream request %s %s", r.Method, r.URL.Path)
	})
	defer cleanup()

	c, w := newBackupTestContext(http.MethodPost, "/api/v1/backup/repositories", map[string]any{
		"name": "audit-repo",
		"settings": map[string]string{
			"location": "/etc",
		},
	})
	handler.CreateRepository(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "invalid repository location") {
		t.Fatalf("unexpected body: %s", w.Body.String())
	}
	event, ok := cpMiddleware.GetAuditEvent(c)
	if !ok {
		t.Fatal("expected audit event")
	}
	if event.Action != "backup_repositories.create" {
		t.Fatalf("expected backup_repositories.create, got %s", event.Action)
	}
}
