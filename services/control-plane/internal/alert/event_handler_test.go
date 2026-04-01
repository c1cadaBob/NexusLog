package alert

import (
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
	mock.ExpectQuery("FROM alert_events").
		WithArgs("").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	mock.ExpectQuery("FROM alert_events").
		WithArgs("", 0, 20).
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
			Items []AlertEvent `json:"items"`
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
	if len(body.Data.Items[0].NotificationResult) == 0 {
		t.Fatalf("expected notification result to be returned")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}
