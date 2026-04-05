package alert

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
)

const cpAuthorizationContextQuery = `
	SELECT u.username, COALESCE(r.name, ''), COALESCE(r.permissions, '[]'::jsonb)
	FROM users u
	LEFT JOIN user_roles ur ON ur.user_id = u.id
	LEFT JOIN roles r ON r.id = ur.role_id AND r.tenant_id = u.tenant_id
	WHERE u.id = $1::uuid
	  AND u.tenant_id = $2::uuid
	  AND u.status = 'active'
`

func newEventTestRouter(handler *EventHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		if tenantID := c.GetHeader("X-Tenant-ID"); tenantID != "" {
			c.Set("tenant_id", tenantID)
		}
		if userID := c.GetHeader("X-User-ID"); userID != "" {
			c.Set("user_id", userID)
		}
		c.Next()
	})
	RegisterAlertEventRoutes(router, handler)
	return router
}

func TestEventHandler_ResolveEvent_AllowsGlobalTenantMutation(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	handler := NewEventHandler(db)
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		ctx := context.WithValue(c.Request.Context(), "authorization_ready", true)
		ctx = context.WithValue(ctx, "user_scopes", []string{"all_tenants", "tenant"})
		ctx = context.WithValue(ctx, "user_capabilities", []string{"*"})
		c.Request = c.Request.WithContext(ctx)
		c.Set("tenant_id", "10000000-0000-0000-0000-000000000001")
		c.Set("user_id", "20000000-0000-0000-0000-000000000001")
		c.Set("authorization_ready", true)
		c.Set("user_scopes", []string{"all_tenants", "tenant"})
		c.Set("user_capabilities", []string{"*"})
		c.Next()
	})
	RegisterAlertEventRoutes(router, handler)

	firedAt := time.Now().UTC().Add(-time.Hour)
	resolvedAt := time.Now().UTC()
	mock.ExpectQuery(`FROM alert_events[\s\S]*WHERE id = \$1::uuid`).
		WithArgs("bf50d840-fbef-4a38-ba5f-e1bc66bee6ec").
		WillReturnRows(sqlmock.NewRows([]string{"tenant_id", "id", "rule_id", "severity", "status", "title", "detail", "source_id", "fired_at", "resolved_at"}).
			AddRow("30000000-0000-0000-0000-000000000001", "bf50d840-fbef-4a38-ba5f-e1bc66bee6ec", "rule-1", "critical", "firing", "cross-tenant", "detail", "source-1", firedAt, nil))
	mock.ExpectQuery(`UPDATE alert_events[\s\S]*WHERE tenant_id = \$1::uuid[\s\S]*AND id = \$2::uuid`).
		WithArgs("30000000-0000-0000-0000-000000000001", "bf50d840-fbef-4a38-ba5f-e1bc66bee6ec", "resolved").
		WillReturnRows(sqlmock.NewRows([]string{"id", "rule_id", "severity", "status", "title", "detail", "source_id", "fired_at", "resolved_at"}).
			AddRow("bf50d840-fbef-4a38-ba5f-e1bc66bee6ec", "rule-1", "critical", "resolved", "cross-tenant", "detail", "source-1", firedAt, resolvedAt))

	req := httptest.NewRequest(http.MethodPost, "/api/v1/alert/events/bf50d840-fbef-4a38-ba5f-e1bc66bee6ec/resolve", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", resp.Code, resp.Body.String())
	}
	if !regexp.MustCompile(`"status":"resolved"`).Match(resp.Body.Bytes()) {
		t.Fatalf("expected resolved response, got %s", resp.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestEventHandler_ListEvents_GlobalTenantRead(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	handler := NewEventHandler(db)
	router := newEventTestRouter(handler)

	mock.ExpectQuery(regexp.QuoteMeta(cpAuthorizationContextQuery)).
		WithArgs("20000000-0000-0000-0000-000000000001", "10000000-0000-0000-0000-000000000001").
		WillReturnRows(
			sqlmock.NewRows([]string{"username", "name", "permissions"}).
				AddRow("cross-tenant-reader", "viewer", []byte(`["alert.event.read","all_tenants"]`)),
		)
	mock.ExpectQuery("FROM legacy_permission_mapping").
		WillReturnRows(sqlmock.NewRows([]string{"legacy_permission", "capability_bundle", "scope_bundle", "enabled"}))
	mock.ExpectQuery("FROM authz_version").
		WithArgs("10000000-0000-0000-0000-000000000001", "20000000-0000-0000-0000-000000000001").
		WillReturnRows(sqlmock.NewRows([]string{"authz_epoch"}).AddRow(1))
	mock.ExpectQuery("FROM subject_reserved_policy").
		WithArgs("10000000-0000-0000-0000-000000000001", "cross-tenant-reader").
		WillReturnRows(sqlmock.NewRows([]string{"reserved", "interactive_login_allowed", "system_subject", "break_glass_allowed", "managed_by"}))
	mock.ExpectQuery("SELECT COUNT\\(1\\)\\s+FROM alert_events").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	mock.ExpectQuery("COUNT\\(1\\) FILTER \\(WHERE status = 'firing'\\)").
		WillReturnRows(sqlmock.NewRows([]string{"pending", "critical", "warning", "silenced"}).AddRow(1, 1, 0, 0))
	mock.ExpectQuery("ORDER BY fired_at DESC").
		WithArgs(0, 20).
		WillReturnRows(sqlmock.NewRows([]string{"id", "rule_id", "severity", "status", "title", "detail", "source_id", "fired_at", "resolved_at", "notified_at", "notification_result"}).
			AddRow("event-1", "rule-1", "critical", "firing", "cross-tenant", "detail", "source-1", time.Now().UTC(), nil, time.Now().UTC(), []byte(`{"channel_dispatch":{"status":"sent","successful_channels":1}}`)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/alert/events", nil)
	req.Header.Set("X-Tenant-ID", "10000000-0000-0000-0000-000000000001")
	req.Header.Set("X-User-ID", "20000000-0000-0000-0000-000000000001")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", resp.Code, resp.Body.String())
	}
	var body struct {
		Data struct {
			Items   []AlertEvent `json:"items"`
			Summary struct {
				Pending  int `json:"pending"`
				Critical int `json:"critical"`
				Warning  int `json:"warning"`
				Silenced int `json:"silenced"`
			} `json:"summary"`
		} `json:"data"`
		Meta struct {
			Total int `json:"total"`
		} `json:"meta"`
	}
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if body.Meta.Total != 1 || len(body.Data.Items) != 1 {
		t.Fatalf("expected 1 event, got total=%d items=%d", body.Meta.Total, len(body.Data.Items))
	}
	if body.Data.Summary.Pending != 1 || body.Data.Summary.Critical != 1 {
		t.Fatalf("expected summary to be returned, got %+v", body.Data.Summary)
	}
	if len(body.Data.Items[0].NotificationResult) == 0 {
		t.Fatalf("expected notification result to be returned")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}
