package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

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
