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

func newSilenceTestRouter(handler *SilenceHandler) *gin.Engine {
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
	RegisterSilenceRoutes(router, handler)
	return router
}

func TestSilenceHandler_ListSilences_GlobalTenantRead(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	handler := NewSilenceHandler(NewSilenceService(db))
	router := newSilenceTestRouter(handler)

	now := time.Now().UTC()
	mock.ExpectQuery("FROM users u").
		WithArgs("20000000-0000-0000-0000-000000000001", "10000000-0000-0000-0000-000000000001").
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
	mock.ExpectQuery("FROM alert_silences").
		WithArgs(sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "matchers", "reason", "starts_at", "ends_at", "created_by", "created_at", "updated_at"}).
			AddRow("sil-1", "00000000-0000-0000-0000-000000000002", []byte(`{"severity":"critical"}`), "cross-tenant", now.Add(-time.Hour), now.Add(time.Hour), "user-1", now.Add(-2*time.Hour), now))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/alert/silences", nil)
	req.Header.Set("X-Tenant-ID", "10000000-0000-0000-0000-000000000001")
	req.Header.Set("X-User-ID", "20000000-0000-0000-0000-000000000001")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", resp.Code, resp.Body.String())
	}
	var body struct {
		Data struct {
			Items []map[string]any `json:"items"`
		} `json:"data"`
	}
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if len(body.Data.Items) != 1 {
		t.Fatalf("expected 1 silence, got %d", len(body.Data.Items))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}
