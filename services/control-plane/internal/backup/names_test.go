package backup

import (
	"errors"
	"net/http"
	"strings"
	"testing"
)

func TestNormalizeRepositoryName_AcceptsSafeName(t *testing.T) {
	name, err := normalizeRepositoryName("repo-2026.03.14")
	if err != nil {
		t.Fatalf("normalizeRepositoryName() error = %v", err)
	}
	if name != "repo-2026.03.14" {
		t.Fatalf("normalizeRepositoryName() = %q, want repo-2026.03.14", name)
	}
}

func TestNormalizeRepositoryName_RejectsTraversal(t *testing.T) {
	_, err := normalizeRepositoryName("../repo")
	if !errors.Is(err, ErrInvalidBackupName) {
		t.Fatalf("normalizeRepositoryName() error = %v, want ErrInvalidBackupName", err)
	}
}

func TestHandlerListSnapshotsRejectsUnsafeRepositoryName(t *testing.T) {
	handler, cleanup := newBackupTestHandler(t, func(w http.ResponseWriter, r *http.Request) {
		t.Fatalf("unexpected upstream request %s %s", r.Method, r.URL.Path)
	})
	defer cleanup()

	c, w := newBackupTestContext(http.MethodGet, "/api/v1/backup/snapshots?repository=../repo", nil)
	handler.ListSnapshots(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "invalid repository name") {
		t.Fatalf("unexpected body: %s", w.Body.String())
	}
}

func TestHandlerCreateSnapshotRejectsUnsafeSnapshotName(t *testing.T) {
	handler, cleanup := newBackupTestHandler(t, func(w http.ResponseWriter, r *http.Request) {
		t.Fatalf("unexpected upstream request %s %s", r.Method, r.URL.Path)
	})
	defer cleanup()

	c, w := newBackupTestContext(http.MethodPost, "/api/v1/backup/snapshots", map[string]any{
		"repository": "audit-repo",
		"name":       "../snapshot-a",
	})
	handler.CreateSnapshot(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "invalid repository or snapshot name") {
		t.Fatalf("unexpected body: %s", w.Body.String())
	}
}
