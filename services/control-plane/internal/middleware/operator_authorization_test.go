package middleware

import (
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
)

func TestRequireOperatorRole_AllowsOperator(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery(regexp.QuoteMeta(operatorRoleExistsQuery)).
		WithArgs(testAdminUserID, testAdminTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(authContextKeyTenantID, testAdminTenantID)
		c.Set(authContextKeyUserID, testAdminUserID)
		c.Next()
	})
	router.Use(RequireOperatorRole(db))
	router.POST("/api/v1/ingest/receipts", func(c *gin.Context) {
		c.Status(http.StatusCreated)
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/ingest/receipts", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", resp.Code, resp.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRequireOperatorRole_AllowsContextBackedOperatorWithoutDatabase(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(authContextKeyAuthorizationReady, true)
		c.Set(authContextKeyTenantID, testAdminTenantID)
		c.Set(authContextKeyUserID, testAdminUserID)
		c.Set(authContextKeyUserPermissions, []string{"alerts:write"})
		c.Set(authContextKeyUserCapabilities, []string{"alert.rule.update"})
		c.Next()
	})
	router.Use(RequireOperatorRole(nil))
	router.POST("/api/v1/ingest/receipts", func(c *gin.Context) {
		c.Status(http.StatusCreated)
	})

	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, httptest.NewRequest(http.MethodPost, "/api/v1/ingest/receipts", nil))

	if resp.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestRequireOperatorRole_RejectsNonOperator(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery(regexp.QuoteMeta(operatorRoleExistsQuery)).
		WithArgs(testAdminUserID, testAdminTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(authContextKeyTenantID, testAdminTenantID)
		c.Set(authContextKeyUserID, testAdminUserID)
		c.Next()
	})
	router.Use(RequireOperatorRole(db))
	router.POST("/api/v1/ingest/receipts", func(c *gin.Context) {
		c.Status(http.StatusCreated)
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/ingest/receipts", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", resp.Code, resp.Body.String())
	}
	if !strings.Contains(resp.Body.String(), "operator or administrator role required") {
		t.Fatalf("unexpected body: %s", resp.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRequireOperatorRole_FailsClosedWhenAuthorizationBackendUnavailable(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(authContextKeyTenantID, testAdminTenantID)
		c.Set(authContextKeyUserID, testAdminUserID)
		c.Next()
	})
	router.Use(RequireOperatorRole(nil))
	router.POST("/api/v1/ingest/receipts", func(c *gin.Context) {
		c.Status(http.StatusCreated)
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/ingest/receipts", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestRequireOperatorRole_RejectsUntrustedAuthorizationSnapshot(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(authContextKeyTenantID, testAdminTenantID)
		c.Set(authContextKeyUserID, testAdminUserID)
		c.Set(authContextKeyUserPermissions, []string{"alerts:write"})
		c.Set(authContextKeyUserCapabilities, []string{"alert.rule.update"})
		c.Next()
	})
	router.Use(RequireOperatorRole(nil))
	router.POST("/api/v1/ingest/receipts", func(c *gin.Context) {
		c.Status(http.StatusCreated)
	})

	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, httptest.NewRequest(http.MethodPost, "/api/v1/ingest/receipts", nil))

	if resp.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestRequireOperatorRole_RejectsMissingAuthContext(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RequireOperatorRole(nil))
	router.POST("/api/v1/ingest/receipts", func(c *gin.Context) {
		c.Status(http.StatusCreated)
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/ingest/receipts", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", resp.Code, resp.Body.String())
	}
	if !strings.Contains(resp.Body.String(), "auth context missing") {
		t.Fatalf("unexpected body: %s", resp.Body.String())
	}
}
