package alert

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func newAlertTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		if tenantID := strings.TrimSpace(c.GetHeader("X-Tenant-ID")); tenantID != "" {
			c.Set("tenant_id", tenantID)
		}
		if userID := strings.TrimSpace(c.GetHeader("X-User-ID")); userID != "" {
			c.Set("user_id", userID)
		}
		c.Next()
	})
	return router
}

func setupTestRouter() *gin.Engine {
	router := newAlertTestRouter()
	repo := newMockRuleRepo()
	svc := NewRuleService(repo)
	handler := NewRuleHandler(svc)
	RegisterAlertRuleRoutes(router, handler)
	return router
}

func performRequest(router *gin.Engine, method, path string, body any, tenantID string) *httptest.ResponseRecorder {
	var payload []byte
	if body != nil {
		payload, _ = json.Marshal(body)
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	if tenantID != "" {
		req.Header.Set("X-Tenant-ID", tenantID)
	}
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

func TestRuleHandler_CreateRule_ValidCondition(t *testing.T) {
	router := setupTestRouter()

	body := map[string]any{
		"name":      "test-rule",
		"condition": map[string]any{"type": "keyword", "keyword": "error", "field": "message"},
	}
	rec := performRequest(router, http.MethodPost, "/api/v1/alert/rules", body, "00000000-0000-0000-0000-000000000001")
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	var resp struct {
		Code string `json:"code"`
		Data struct {
			ID      string `json:"id"`
			Enabled bool   `json:"enabled"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.Code != "OK" || resp.Data.ID == "" {
		t.Errorf("unexpected response: %+v", resp)
	}
}

func TestRuleHandler_CreateRule_InvalidCondition(t *testing.T) {
	router := setupTestRouter()

	body := map[string]any{
		"name":      "test-rule",
		"condition": map[string]any{"type": "invalid_type"},
	}
	rec := performRequest(router, http.MethodPost, "/api/v1/alert/rules", body, "00000000-0000-0000-0000-000000000001")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestRuleHandler_CreateRule_MissingTenant(t *testing.T) {
	router := setupTestRouter()

	body := map[string]any{
		"name":      "test-rule",
		"condition": map[string]any{"type": "keyword", "keyword": "error"},
	}
	rec := performRequest(router, http.MethodPost, "/api/v1/alert/rules", body, "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing tenant, got %d", rec.Code)
	}
}

func TestRuleHandler_CreateRule_IgnoresTenantHeaderWithoutAuthenticatedContext(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	repo := newMockRuleRepo()
	handler := NewRuleHandler(NewRuleService(repo))
	RegisterAlertRuleRoutes(router, handler)

	body := map[string]any{
		"name":      "test-rule",
		"condition": map[string]any{"type": "keyword", "keyword": "error", "field": "message"},
	}
	rec := performRequest(router, http.MethodPost, "/api/v1/alert/rules", body, "00000000-0000-0000-0000-000000000001")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 when only tenant header is present, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestRuleHandler_ListRules_Pagination(t *testing.T) {
	router := setupTestRouter()

	rec := performRequest(router, http.MethodGet, "/api/v1/alert/rules?page=1&page_size=10", nil, "00000000-0000-0000-0000-000000000001")
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var resp struct {
		Code string `json:"code"`
		Data struct {
			Items []AlertRule `json:"items"`
		} `json:"data"`
		Meta struct {
			Page     int `json:"page"`
			PageSize int `json:"page_size"`
			Total    int `json:"total"`
		} `json:"meta"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.Code != "OK" || resp.Meta.Page != 1 || resp.Meta.PageSize != 10 {
		t.Errorf("unexpected list response: %+v", resp)
	}
}

func TestRuleHandler_DeleteRule(t *testing.T) {
	repo := newMockRuleRepo()
	repo.rules["rule-123"] = AlertRule{
		ID:       "rule-123",
		TenantID: "00000000-0000-0000-0000-000000000001",
		Name:     "to-delete",
	}
	svc := NewRuleService(repo)
	handler := NewRuleHandler(svc)
	r := newAlertTestRouter()
	RegisterAlertRuleRoutes(r, handler)

	rec := performRequest(r, http.MethodDelete, "/api/v1/alert/rules/rule-123", nil, "00000000-0000-0000-0000-000000000001")
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	// Verify rule is gone
	rec2 := performRequest(r, http.MethodGet, "/api/v1/alert/rules/rule-123", nil, "00000000-0000-0000-0000-000000000001")
	if rec2.Code != http.StatusNotFound {
		t.Fatalf("expected 404 after delete, got %d", rec2.Code)
	}
}

func TestRuleHandler_EnableDisable(t *testing.T) {
	repo := newMockRuleRepo()
	repo.rules["rule-enable"] = AlertRule{
		ID:       "rule-enable",
		TenantID: "00000000-0000-0000-0000-000000000001",
		Name:     "test",
		Enabled:  true,
	}
	svc := NewRuleService(repo)
	handler := NewRuleHandler(svc)
	r := newAlertTestRouter()
	RegisterAlertRuleRoutes(r, handler)

	rec := performRequest(r, http.MethodPut, "/api/v1/alert/rules/rule-enable/disable", nil, "00000000-0000-0000-0000-000000000001")
	if rec.Code != http.StatusOK {
		t.Fatalf("disable: expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	rec = performRequest(r, http.MethodPut, "/api/v1/alert/rules/rule-enable/enable", nil, "00000000-0000-0000-0000-000000000001")
	if rec.Code != http.StatusOK {
		t.Fatalf("enable: expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestRuleHandler_GetRule_Found(t *testing.T) {
	repo := newMockRuleRepo()
	repo.rules["rule-get"] = AlertRule{
		ID:        "rule-get",
		TenantID:  "00000000-0000-0000-0000-000000000001",
		Name:      "get-test",
		Condition: json.RawMessage(`{"type":"keyword","keyword":"err"}`),
	}
	svc := NewRuleService(repo)
	handler := NewRuleHandler(svc)
	r := newAlertTestRouter()
	RegisterAlertRuleRoutes(r, handler)

	rec := performRequest(r, http.MethodGet, "/api/v1/alert/rules/rule-get", nil, "00000000-0000-0000-0000-000000000001")
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var resp struct {
		Code string    `json:"code"`
		Data AlertRule `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.Data.Name != "get-test" {
		t.Errorf("expected name get-test, got %s", resp.Data.Name)
	}
}

func TestRuleHandler_GetRule_NotFound(t *testing.T) {
	router := setupTestRouter()
	rec := performRequest(router, http.MethodGet, "/api/v1/alert/rules/nonexistent-id", nil, "00000000-0000-0000-0000-000000000001")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestRuleHandler_UpdateRule(t *testing.T) {
	repo := newMockRuleRepo()
	repo.rules["rule-upd"] = AlertRule{
		ID:        "rule-upd",
		TenantID:  "00000000-0000-0000-0000-000000000001",
		Name:      "old-name",
		Condition: json.RawMessage(`{"type":"keyword","keyword":"err"}`),
	}
	svc := NewRuleService(repo)
	handler := NewRuleHandler(svc)
	r := newAlertTestRouter()
	RegisterAlertRuleRoutes(r, handler)

	body := map[string]any{"name": "new-name"}
	rec := performRequest(r, http.MethodPut, "/api/v1/alert/rules/rule-upd", body, "00000000-0000-0000-0000-000000000001")
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	r2, _ := repo.GetRule(nil, "00000000-0000-0000-0000-000000000001", "rule-upd")
	if r2.Name != "new-name" {
		t.Errorf("expected name new-name, got %s", r2.Name)
	}
}

func TestRuleHandler_RuleLimitExceeded(t *testing.T) {
	repo := newMockRuleRepo()
	for i := 0; i < MaxRulesPerTenant; i++ {
		repo.rules[fmt.Sprintf("rule-%d", i)] = AlertRule{
			ID:       fmt.Sprintf("rule-%d", i),
			TenantID: "00000000-0000-0000-0000-000000000001",
			Name:     "rule",
		}
	}
	svc := NewRuleService(repo)
	handler := NewRuleHandler(svc)
	r := newAlertTestRouter()
	RegisterAlertRuleRoutes(r, handler)

	body := map[string]any{
		"name":      "new-rule",
		"condition": map[string]any{"type": "keyword", "keyword": "error"},
	}
	rec := performRequest(r, http.MethodPost, "/api/v1/alert/rules", body, "00000000-0000-0000-0000-000000000001")
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestRuleHandler_CreateRule_LevelCountAndThreshold(t *testing.T) {
	router := setupTestRouter()

	levelCountBody := map[string]any{
		"name":      "level-rule",
		"condition": map[string]any{"type": "level_count", "level": "ERROR", "threshold": 10, "window_seconds": 300},
	}
	rec := performRequest(router, http.MethodPost, "/api/v1/alert/rules", levelCountBody, "00000000-0000-0000-0000-000000000001")
	if rec.Code != http.StatusCreated {
		t.Fatalf("level_count: expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	thresholdBody := map[string]any{
		"name":      "threshold-rule",
		"condition": map[string]any{"type": "threshold", "metric": "cpu_usage", "operator": ">", "value": 90},
	}
	rec = performRequest(router, http.MethodPost, "/api/v1/alert/rules", thresholdBody, "00000000-0000-0000-0000-000000000001")
	if rec.Code != http.StatusCreated {
		t.Fatalf("threshold: expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestRuleHandler_ListRules_InvalidPage(t *testing.T) {
	router := setupTestRouter()
	rec := performRequest(router, http.MethodGet, "/api/v1/alert/rules?page=0&page_size=10", nil, "00000000-0000-0000-0000-000000000001")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid page, got %d", rec.Code)
	}
}

func TestRuleHandler_CreateRule_EmptyName(t *testing.T) {
	router := setupTestRouter()
	body := map[string]any{
		"name":      "",
		"condition": map[string]any{"type": "keyword", "keyword": "error"},
	}
	rec := performRequest(router, http.MethodPost, "/api/v1/alert/rules", body, "00000000-0000-0000-0000-000000000001")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for empty name, got %d", rec.Code)
	}
}

func TestRuleHandler_UpdateRule_NotFound(t *testing.T) {
	router := setupTestRouter()
	body := map[string]any{"name": "new-name"}
	rec := performRequest(router, http.MethodPut, "/api/v1/alert/rules/nonexistent", body, "00000000-0000-0000-0000-000000000001")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestRuleHandler_UpdateRule_InvalidCondition(t *testing.T) {
	repo := newMockRuleRepo()
	repo.rules["rule-1"] = AlertRule{
		ID:        "rule-1",
		TenantID:  "00000000-0000-0000-0000-000000000001",
		Name:      "test",
		Condition: json.RawMessage(`{"type":"keyword","keyword":"err"}`),
	}
	svc := NewRuleService(repo)
	handler := NewRuleHandler(svc)
	r := newAlertTestRouter()
	RegisterAlertRuleRoutes(r, handler)

	body := map[string]any{"condition": map[string]any{"type": "invalid"}}
	rec := performRequest(r, http.MethodPut, "/api/v1/alert/rules/rule-1", body, "00000000-0000-0000-0000-000000000001")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid condition, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestRuleHandler_DeleteRule_NotFound(t *testing.T) {
	router := setupTestRouter()
	rec := performRequest(router, http.MethodDelete, "/api/v1/alert/rules/nonexistent", nil, "00000000-0000-0000-0000-000000000001")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}
