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

func TestRequireCapability_AllowsExactCapability(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(authContextKeyAuthorizationReady, true)
		c.Set(authContextKeyUserCapabilities, []string{"alert.rule.read"})
		c.Next()
	})
	router.Use(RequireCapability("alert.rule.read"))
	router.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, httptest.NewRequest(http.MethodGet, "/protected", nil))
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestRequireCapability_AllowsWildcardCapability(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(authContextKeyAuthorizationReady, true)
		c.Set(authContextKeyUserCapabilities, []string{"*"})
		c.Next()
	})
	router.Use(RequireCapability("incident.close"))
	router.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, httptest.NewRequest(http.MethodGet, "/protected", nil))
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestRequireCapability_RejectsInsufficientCapabilities(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(authContextKeyAuthorizationReady, true)
		c.Set(authContextKeyUserCapabilities, []string{"alert.rule.read"})
		c.Next()
	})
	router.Use(RequireCapability("alert.rule.update"))
	router.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, httptest.NewRequest(http.MethodGet, "/protected", nil))
	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", resp.Code, resp.Body.String())
	}
	if !strings.Contains(resp.Body.String(), "insufficient capabilities") {
		t.Fatalf("unexpected body: %s", resp.Body.String())
	}
}

func TestRequireCapability_FailsClosedWhenAuthorizationUnavailable(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(authContextKeyAuthorizationReady, false)
		c.Next()
	})
	router.Use(RequireCapability("metric.read"))
	router.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, httptest.NewRequest(http.MethodGet, "/protected", nil))
	if resp.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestRequireCapabilityOrAdminRole_AllowsGrantedAdminFlag(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(authContextKeyAuthorizationReady, true)
		c.Set(authContextKeyAdminRoleGranted, true)
		c.Next()
	})
	router.Use(RequireCapabilityOrAdminRole(nil, "backup.read"))
	router.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, httptest.NewRequest(http.MethodGet, "/protected", nil))
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestRequireCapabilityOrAdminRole_FallsBackToRoleQuery(t *testing.T) {
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
		c.Set(authContextKeyAuthorizationReady, true)
		c.Set(authContextKeyTenantID, testAdminTenantID)
		c.Set(authContextKeyUserID, testAdminUserID)
		c.Set(authContextKeyUserCapabilities, []string{})
		c.Next()
	})
	router.Use(RequireCapabilityOrAdminRole(db, "backup.read"))
	router.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, httptest.NewRequest(http.MethodGet, "/protected", nil))
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRequireCapabilityOrOperatorRole_FallsBackToRoleQuery(t *testing.T) {
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
		c.Set(authContextKeyAuthorizationReady, true)
		c.Set(authContextKeyTenantID, testAdminTenantID)
		c.Set(authContextKeyUserID, testAdminUserID)
		c.Set(authContextKeyUserCapabilities, []string{})
		c.Next()
	})
	router.Use(RequireCapabilityOrOperatorRole(db, "ingest.task.run"))
	router.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, httptest.NewRequest(http.MethodGet, "/protected", nil))
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}
