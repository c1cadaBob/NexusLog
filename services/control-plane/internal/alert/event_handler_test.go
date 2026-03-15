package alert

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
)

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

	mock.ExpectQuery("FROM users u").
		WithArgs("20000000-0000-0000-0000-000000000001", "10000000-0000-0000-0000-000000000001").
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
	mock.ExpectQuery("FROM alert_events").
		WithArgs("").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	mock.ExpectQuery("FROM alert_events").
		WithArgs("", 0, 20).
		WillReturnRows(sqlmock.NewRows([]string{"id", "rule_id", "severity", "status", "title", "detail", "source_id", "fired_at", "resolved_at"}).
			AddRow("event-1", "rule-1", "critical", "firing", "cross-tenant", "detail", "source-1", time.Now().UTC(), nil))

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
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}
