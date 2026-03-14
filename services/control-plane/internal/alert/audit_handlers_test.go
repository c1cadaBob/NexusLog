package alert

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"

	cpMiddleware "github.com/nexuslog/control-plane/internal/middleware"
)

func newTestContext(method, target string, body any) (*gin.Context, *httptest.ResponseRecorder) {
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
	c.Set("tenant_id", "00000000-0000-0000-0000-000000000001")
	c.Set("user_id", "20000000-0000-0000-0000-000000000001")
	return c, w
}

func TestRuleHandlerCreateRuleSetsExplicitAuditEvent(t *testing.T) {
	repo := newMockRuleRepo()
	svc := NewRuleService(repo)
	handler := NewRuleHandler(svc)

	body := map[string]any{
		"name":      "cpu-high",
		"condition": map[string]any{"type": "keyword", "keyword": "error", "field": "message"},
		"severity":  "HIGH",
	}
	c, w := newTestContext(http.MethodPost, "/api/v1/alert/rules", body)

	handler.CreateRule(c)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	event, ok := cpMiddleware.GetAuditEvent(c)
	if !ok {
		t.Fatal("expected audit event to be set")
	}
	if event.Action != "alert_rules.create" {
		t.Fatalf("expected action alert_rules.create, got %s", event.Action)
	}
	if event.ResourceType != "alert_rules" {
		t.Fatalf("expected resource type alert_rules, got %s", event.ResourceType)
	}
	if event.ResourceID == "" {
		t.Fatal("expected resource id to be populated")
	}
	if got := event.Details["rule_name"]; got != "cpu-high" {
		t.Fatalf("expected rule_name cpu-high, got %#v", got)
	}
	if got := event.Details["http_status"]; got != http.StatusCreated {
		t.Fatalf("expected http_status 201, got %#v", got)
	}
}

func TestRuleHandlerDisableRuleSetsExplicitAuditEvent(t *testing.T) {
	repo := newMockRuleRepo()
	repo.rules["rule-disable"] = AlertRule{
		ID:       "rule-disable",
		TenantID: "00000000-0000-0000-0000-000000000001",
		Name:     "disable-me",
		Enabled:  true,
	}
	svc := NewRuleService(repo)
	handler := NewRuleHandler(svc)

	c, w := newTestContext(http.MethodPut, "/api/v1/alert/rules/rule-disable/disable", nil)
	c.Params = gin.Params{{Key: "id", Value: "rule-disable"}}

	handler.DisableRule(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	event, ok := cpMiddleware.GetAuditEvent(c)
	if !ok {
		t.Fatal("expected audit event to be set")
	}
	if event.Action != "alert_rules.disable" {
		t.Fatalf("expected action alert_rules.disable, got %s", event.Action)
	}
	if event.ResourceID != "rule-disable" {
		t.Fatalf("expected resource id rule-disable, got %s", event.ResourceID)
	}
	if got := event.Details["enabled"]; got != false {
		t.Fatalf("expected enabled=false, got %#v", got)
	}
}

func TestSilenceHandlerDeleteSetsExplicitAuditEvent(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	silenceID := "11111111-1111-1111-1111-111111111111"
	tenantID := "00000000-0000-0000-0000-000000000001"
	mock.ExpectExec("DELETE FROM alert_silences").
		WithArgs(silenceID, tenantID).
		WillReturnResult(sqlmock.NewResult(1, 1))

	handler := NewSilenceHandler(NewSilenceService(db))
	c, w := newTestContext(http.MethodDelete, "/api/v1/alert/silences/"+silenceID, nil)
	c.Params = gin.Params{{Key: "id", Value: silenceID}}

	handler.DeleteSilence(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	event, ok := cpMiddleware.GetAuditEvent(c)
	if !ok {
		t.Fatal("expected audit event to be set")
	}
	if event.Action != "alert_silences.delete" {
		t.Fatalf("expected action alert_silences.delete, got %s", event.Action)
	}
	if event.ResourceType != "alert_silences" {
		t.Fatalf("expected resource type alert_silences, got %s", event.ResourceType)
	}
	if event.ResourceID != silenceID {
		t.Fatalf("expected resource id %s, got %s", silenceID, event.ResourceID)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations not met: %v", err)
	}
}
