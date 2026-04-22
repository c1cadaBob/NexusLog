package ingest

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	cpMiddleware "github.com/nexuslog/control-plane/internal/middleware"
)

func newPullSourceAuditTestContext(method, target string, body any) (*gin.Context, *httptest.ResponseRecorder) {
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

func seedPullSourceForAuditTest(t *testing.T, store *PullSourceStore, name string, status string) PullSource {
	t.Helper()
	created, err := store.Create(CreatePullSourceRequest{
		Name:            name,
		Host:            "127.0.0.1",
		Port:            19091,
		Protocol:        "http",
		Path:            "/tmp/" + name + ".log",
		Auth:            "audit-key-ref",
		AgentBaseURL:    "http://172.29.0.1:19091",
		PullIntervalSec: 30,
		PullTimeoutSec:  30,
		Status:          status,
	})
	if err != nil {
		t.Fatalf("seed source failed: %v", err)
	}
	return created
}

func TestHandlerCreatePullSourceSetsExplicitAuditEvent(t *testing.T) {
	handler := NewPullSourceHandler(NewPullSourceStore())

	c, w := newPullSourceAuditTestContext(http.MethodPost, "/api/v1/ingest/pull-sources", map[string]any{
		"name":              "audit-source-create",
		"host":              "127.0.0.1",
		"port":              19091,
		"protocol":          "http",
		"path":              "/tmp/audit-source-create.log",
		"auth":              "audit-key-ref",
		"agent_base_url":    "http://172.29.0.1:19091",
		"pull_interval_sec": 30,
		"pull_timeout_sec":  30,
		"status":            "active",
	})

	handler.CreatePullSource(c)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	event, ok := cpMiddleware.GetAuditEvent(c)
	if !ok {
		t.Fatal("expected audit event")
	}
	if event.Action != "pull_sources.create" {
		t.Fatalf("expected pull_sources.create, got %s", event.Action)
	}
	if event.ResourceType != "pull_sources" {
		t.Fatalf("expected resource type pull_sources, got %s", event.ResourceType)
	}
	if event.ResourceID == "" {
		t.Fatal("expected non-empty resource id")
	}
	if got := event.Details["source_name"]; got != "audit-source-create" {
		t.Fatalf("expected source_name audit-source-create, got %#v", got)
	}
	if got := event.Details["path"]; got != "/tmp/audit-source-create.log" {
		t.Fatalf("expected path /tmp/audit-source-create.log, got %#v", got)
	}
}

func TestHandlerListPullSourcesSetsExplicitAuditEvent(t *testing.T) {
	store := NewPullSourceStore()
	handler := NewPullSourceHandler(store)
	seedPullSourceForAuditTest(t, store, "audit-source-list-a", "active")
	seedPullSourceForAuditTest(t, store, "audit-source-list-b", "disabled")

	c, w := newPullSourceAuditTestContext(http.MethodGet, "/api/v1/ingest/pull-sources?status=active&page=1&page_size=10", nil)
	handler.ListPullSources(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	event, ok := cpMiddleware.GetAuditEvent(c)
	if !ok {
		t.Fatal("expected audit event")
	}
	if event.Action != "pull_sources.list" {
		t.Fatalf("expected pull_sources.list, got %s", event.Action)
	}
	if got := event.Details["status"]; got != "active" {
		t.Fatalf("expected status active, got %#v", got)
	}
	if got := event.Details["result_count"]; got != 1 {
		t.Fatalf("expected result_count 1, got %#v", got)
	}
}

func TestHandlerUpdatePullSourceStatusSetsExplicitAuditEvent(t *testing.T) {
	tests := []struct {
		name     string
		initial  string
		next     string
		expected string
	}{
		{name: "pause", initial: "active", next: "paused", expected: "pull_sources.pause"},
		{name: "resume", initial: "paused", next: "active", expected: "pull_sources.resume"},
		{name: "disable", initial: "active", next: "disabled", expected: "pull_sources.disable"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := NewPullSourceStore()
			handler := NewPullSourceHandler(store)
			seeded := seedPullSourceForAuditTest(t, store, "audit-source-"+tc.name, tc.initial)

			c, w := newPullSourceAuditTestContext(http.MethodPut, "/api/v1/ingest/pull-sources/"+seeded.SourceID, map[string]any{
				"status": tc.next,
			})
			c.Params = gin.Params{{Key: "source_id", Value: seeded.SourceID}}

			handler.UpdatePullSourceByPath(c)
			if w.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
			}

			event, ok := cpMiddleware.GetAuditEvent(c)
			if !ok {
				t.Fatal("expected audit event")
			}
			if event.Action != tc.expected {
				t.Fatalf("expected %s, got %s", tc.expected, event.Action)
			}
			if event.ResourceID != seeded.SourceID {
				t.Fatalf("expected resource id %s, got %s", seeded.SourceID, event.ResourceID)
			}
			if got := event.Details["status"]; got != tc.next {
				t.Fatalf("expected status %s, got %#v", tc.next, got)
			}
		})
	}
}

func TestHandlerUpdatePullSourceSetsExplicitAuditEvent(t *testing.T) {
	store := NewPullSourceStore()
	handler := NewPullSourceHandler(store)
	seeded := seedPullSourceForAuditTest(t, store, "audit-source-update", "active")

	c, w := newPullSourceAuditTestContext(http.MethodPut, "/api/v1/ingest/pull-sources/"+seeded.SourceID, map[string]any{
		"name": "audit-source-update-renamed",
		"path": "/tmp/audit-source-update-renamed.log",
	})
	c.Params = gin.Params{{Key: "source_id", Value: seeded.SourceID}}

	handler.UpdatePullSourceByPath(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	event, ok := cpMiddleware.GetAuditEvent(c)
	if !ok {
		t.Fatal("expected audit event")
	}
	if event.Action != "pull_sources.update" {
		t.Fatalf("expected pull_sources.update, got %s", event.Action)
	}
	if got := event.Details["source_name"]; got != "audit-source-update-renamed" {
		t.Fatalf("expected renamed source_name, got %#v", got)
	}
	if got := event.Details["path"]; got != "/tmp/audit-source-update-renamed.log" {
		t.Fatalf("expected renamed path, got %#v", got)
	}
}

func TestHandlerDeletePullSourceSetsExplicitAuditEvent(t *testing.T) {
	store := NewPullSourceStore()
	handler := NewPullSourceHandler(store)
	seeded := seedPullSourceForAuditTest(t, store, "audit-source-delete", "active")

	c, w := newPullSourceAuditTestContext(http.MethodDelete, "/api/v1/ingest/pull-sources/"+seeded.SourceID, nil)
	c.Params = gin.Params{{Key: "source_id", Value: seeded.SourceID}}

	handler.DeletePullSource(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	event, ok := cpMiddleware.GetAuditEvent(c)
	if !ok {
		t.Fatal("expected audit event")
	}
	if event.Action != "pull_sources.delete" {
		t.Fatalf("expected pull_sources.delete, got %s", event.Action)
	}
	if event.ResourceID != seeded.SourceID {
		t.Fatalf("expected resource id %s, got %s", seeded.SourceID, event.ResourceID)
	}
	if got := event.Details["source_name"]; got != "audit-source-delete" {
		t.Fatalf("expected deleted source_name, got %#v", got)
	}
	if got := event.Details["path"]; got != "/tmp/audit-source-delete.log" {
		t.Fatalf("expected deleted path, got %#v", got)
	}
}
