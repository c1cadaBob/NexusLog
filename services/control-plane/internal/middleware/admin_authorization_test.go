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

const (
	testAdminTenantID = "10000000-0000-0000-0000-000000000001"
	testAdminUserID   = "20000000-0000-0000-0000-000000000001"
)

func TestRequireAdminRole_AllowsTenantAdmin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery(regexp.QuoteMeta(adminRoleExistsQuery)).
		WithArgs(testAdminUserID, testAdminTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(authContextKeyTenantID, testAdminTenantID)
		c.Set(authContextKeyUserID, testAdminUserID)
		c.Next()
	})
	router.Use(RequireAdminRole(db))
	router.GET("/api/v1/backup/repositories", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/backup/repositories", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRequireAdminRole_AllowsContextBackedAdministratorWithoutDatabase(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(authContextKeyTenantID, testAdminTenantID)
		c.Set(authContextKeyUserID, testAdminUserID)
		c.Set(authContextKeyUserPermissions, []string{"users:write"})
		c.Set(authContextKeyUserCapabilities, []string{"iam.user.grant_role"})
		c.Next()
	})
	router.Use(RequireAdminRole(nil))
	router.GET("/api/v1/backup/repositories", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, httptest.NewRequest(http.MethodGet, "/api/v1/backup/repositories", nil))

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestRequireAdminRole_RejectsNonAdminUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery(regexp.QuoteMeta(adminRoleExistsQuery)).
		WithArgs(testAdminUserID, testAdminTenantID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(authContextKeyTenantID, testAdminTenantID)
		c.Set(authContextKeyUserID, testAdminUserID)
		c.Next()
	})
	router.Use(RequireAdminRole(db))
	router.GET("/api/v1/backup/repositories", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/backup/repositories", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", resp.Code, resp.Body.String())
	}
	if !strings.Contains(resp.Body.String(), "administrator role required") {
		t.Fatalf("unexpected body: %s", resp.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRequireAdminRole_FailsClosedWhenAuthorizationBackendUnavailable(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(authContextKeyTenantID, testAdminTenantID)
		c.Set(authContextKeyUserID, testAdminUserID)
		c.Next()
	})
	router.Use(RequireAdminRole(nil))
	router.GET("/api/v1/backup/repositories", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/backup/repositories", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestRequireAdminRole_RejectsMissingAuthContext(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RequireAdminRole(nil))
	router.GET("/api/v1/backup/repositories", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/backup/repositories", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", resp.Code, resp.Body.String())
	}
	if !strings.Contains(resp.Body.String(), "auth context missing") {
		t.Fatalf("unexpected body: %s", resp.Body.String())
	}
}
