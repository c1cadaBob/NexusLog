package notification

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

func newChannelTestRouter(handler *ChannelHandler) *gin.Engine {
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
	RegisterChannelRoutes(router, handler.repo, handler.sender)
	return router
}

func TestChannelHandler_GetChannel_GlobalTenantRead(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	handler := NewChannelHandler(NewChannelRepository(db), nil)
	router := newChannelTestRouter(handler)
	now := time.Now().UTC()

	mock.ExpectQuery(regexp.QuoteMeta(cpAuthorizationContextQuery)).
		WithArgs("20000000-0000-0000-0000-000000000001", "10000000-0000-0000-0000-000000000001").
		WillReturnRows(
			sqlmock.NewRows([]string{"username", "name", "permissions"}).
				AddRow("cross-tenant-reader", "viewer", []byte(`["notification.channel.read_metadata","all_tenants"]`)),
		)
	mock.ExpectQuery("FROM legacy_permission_mapping").
		WillReturnRows(sqlmock.NewRows([]string{"legacy_permission", "capability_bundle", "scope_bundle", "enabled"}))
	mock.ExpectQuery("FROM authz_version").
		WithArgs("10000000-0000-0000-0000-000000000001", "20000000-0000-0000-0000-000000000001").
		WillReturnRows(sqlmock.NewRows([]string{"authz_epoch"}).AddRow(1))
	mock.ExpectQuery("FROM notification_channels").
		WithArgs("channel-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "type", "config", "enabled", "created_by", "created_at", "updated_at"}).
			AddRow("channel-1", "00000000-0000-0000-0000-000000000002", "cross-tenant-channel", "email", []byte(`{"smtp_host":"smtp.example.com"}`), true, "user-1", now.Add(-time.Hour), now))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/notification/channels/channel-1", nil)
	req.Header.Set("X-Tenant-ID", "10000000-0000-0000-0000-000000000001")
	req.Header.Set("X-User-ID", "20000000-0000-0000-0000-000000000001")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", resp.Code, resp.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestChannelHandler_ListChannels_GlobalTenantRead(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	handler := NewChannelHandler(NewChannelRepository(db), nil)
	router := newChannelTestRouter(handler)
	now := time.Now().UTC()

	mock.ExpectQuery(regexp.QuoteMeta(cpAuthorizationContextQuery)).
		WithArgs("20000000-0000-0000-0000-000000000001", "10000000-0000-0000-0000-000000000001").
		WillReturnRows(
			sqlmock.NewRows([]string{"username", "name", "permissions"}).
				AddRow("cross-tenant-reader", "viewer", []byte(`["notification.channel.read_metadata","all_tenants"]`)),
		)
	mock.ExpectQuery("FROM legacy_permission_mapping").
		WillReturnRows(sqlmock.NewRows([]string{"legacy_permission", "capability_bundle", "scope_bundle", "enabled"}))
	mock.ExpectQuery("FROM authz_version").
		WithArgs("10000000-0000-0000-0000-000000000001", "20000000-0000-0000-0000-000000000001").
		WillReturnRows(sqlmock.NewRows([]string{"authz_epoch"}).AddRow(1))
	mock.ExpectQuery("SELECT COUNT\\(1\\) FROM notification_channels$").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	mock.ExpectQuery("FROM notification_channels").
		WithArgs(0, 20).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "type", "config", "enabled", "created_by", "created_at", "updated_at"}).
			AddRow("channel-1", "00000000-0000-0000-0000-000000000002", "cross-tenant-channel", "email", []byte(`{"smtp_host":"smtp.example.com"}`), true, "user-1", now.Add(-time.Hour), now))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/notification/channels", nil)
	req.Header.Set("X-Tenant-ID", "10000000-0000-0000-0000-000000000001")
	req.Header.Set("X-User-ID", "20000000-0000-0000-0000-000000000001")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", resp.Code, resp.Body.String())
	}
	var body struct {
		Data struct {
			Items []Channel `json:"items"`
		} `json:"data"`
		Meta struct {
			Total int `json:"total"`
		} `json:"meta"`
	}
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if body.Meta.Total != 1 || len(body.Data.Items) != 1 {
		t.Fatalf("expected 1 channel, got total=%d items=%d", body.Meta.Total, len(body.Data.Items))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}
