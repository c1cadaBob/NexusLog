package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestAuthRateLimitMiddleware_LoginBlocksByUsername(t *testing.T) {
	gin.SetMode(gin.TestMode)
	limiter := newAuthRateLimitMiddleware(time.Now, authRateLimitConfig{
		loginUsername: authRateLimitRule{scope: "tenant_username", limit: 1, window: time.Hour},
		loginIP:       authRateLimitRule{scope: "tenant_ip", limit: 10, window: time.Hour},
		registerIP:    authRateLimitRule{scope: "tenant_ip", limit: 10, window: time.Hour},
	})

	router := gin.New()
	router.POST("/api/v1/auth/login", limiter.Login(), func(c *gin.Context) {
		var req struct {
			Username string `json:"username"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"username": req.Username})
	})

	first := performJSONRequest(t, router, http.MethodPost, "/api/v1/auth/login", map[string]any{"username": "alice", "password": "Password123"}, "tenant-a", "10.0.0.1:1234")
	if first.Code != http.StatusOK {
		t.Fatalf("expected first login 200, got %d body=%s", first.Code, first.Body.String())
	}
	var firstBody map[string]any
	if err := json.Unmarshal(first.Body.Bytes(), &firstBody); err != nil {
		t.Fatalf("unmarshal first body: %v", err)
	}
	if firstBody["username"] != "alice" {
		t.Fatalf("expected handler to read username, got %#v", firstBody)
	}

	second := performJSONRequest(t, router, http.MethodPost, "/api/v1/auth/login", map[string]any{"username": "alice", "password": "Password123"}, "tenant-a", "10.0.0.2:1234")
	assertRateLimitedResponse(t, second, http.StatusTooManyRequests, "AUTH_LOGIN_RATE_LIMITED", "tenant_username")
}

func TestAuthRateLimitMiddleware_LoginBlocksByIP(t *testing.T) {
	gin.SetMode(gin.TestMode)
	limiter := newAuthRateLimitMiddleware(time.Now, authRateLimitConfig{
		loginUsername: authRateLimitRule{scope: "tenant_username", limit: 10, window: time.Hour},
		loginIP:       authRateLimitRule{scope: "tenant_ip", limit: 1, window: time.Hour},
		registerIP:    authRateLimitRule{scope: "tenant_ip", limit: 10, window: time.Hour},
	})

	router := gin.New()
	router.POST("/api/v1/auth/login", limiter.Login(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	first := performJSONRequest(t, router, http.MethodPost, "/api/v1/auth/login", map[string]any{"username": "alice", "password": "Password123"}, "tenant-a", "10.0.0.3:1234")
	if first.Code != http.StatusOK {
		t.Fatalf("expected first login 200, got %d body=%s", first.Code, first.Body.String())
	}

	second := performJSONRequest(t, router, http.MethodPost, "/api/v1/auth/login", map[string]any{"username": "bob", "password": "Password123"}, "tenant-a", "10.0.0.3:5678")
	assertRateLimitedResponse(t, second, http.StatusTooManyRequests, "AUTH_LOGIN_RATE_LIMITED", "tenant_ip")
}

func TestAuthRateLimitMiddleware_RegisterBlocksByIP(t *testing.T) {
	gin.SetMode(gin.TestMode)
	limiter := newAuthRateLimitMiddleware(time.Now, authRateLimitConfig{
		loginUsername: authRateLimitRule{scope: "tenant_username", limit: 10, window: time.Hour},
		loginIP:       authRateLimitRule{scope: "tenant_ip", limit: 10, window: time.Hour},
		registerIP:    authRateLimitRule{scope: "tenant_ip", limit: 1, window: time.Hour},
	})

	router := gin.New()
	router.POST("/api/v1/auth/register", limiter.Register(), func(c *gin.Context) {
		c.JSON(http.StatusCreated, gin.H{"ok": true})
	})

	first := performJSONRequest(t, router, http.MethodPost, "/api/v1/auth/register", map[string]any{"username": "alice", "password": "Password123", "email": "alice@example.com"}, "tenant-a", "10.0.0.4:1234")
	if first.Code != http.StatusCreated {
		t.Fatalf("expected first register 201, got %d body=%s", first.Code, first.Body.String())
	}

	second := performJSONRequest(t, router, http.MethodPost, "/api/v1/auth/register", map[string]any{"username": "bob", "password": "Password123", "email": "bob@example.com"}, "tenant-a", "10.0.0.4:5678")
	assertRateLimitedResponse(t, second, http.StatusTooManyRequests, "AUTH_REGISTER_RATE_LIMITED", "tenant_ip")
}

func performJSONRequest(t *testing.T, router *gin.Engine, method, path string, payload map[string]any, tenantID, remoteAddr string) *httptest.ResponseRecorder {
	t.Helper()
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", tenantID)
	req.RemoteAddr = remoteAddr
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)
	return resp
}

func assertRateLimitedResponse(t *testing.T, resp *httptest.ResponseRecorder, wantStatus int, wantCode, wantScope string) {
	t.Helper()
	if resp.Code != wantStatus {
		t.Fatalf("expected %d, got %d body=%s", wantStatus, resp.Code, resp.Body.String())
	}
	if retryAfter := resp.Header().Get("Retry-After"); retryAfter == "" {
		t.Fatalf("expected Retry-After header")
	}
	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal rate limit body: %v", err)
	}
	if body["code"] != wantCode {
		t.Fatalf("expected code %s, got %#v", wantCode, body)
	}
	details, ok := body["details"].(map[string]any)
	if !ok {
		t.Fatalf("expected details object, got %#v", body)
	}
	if details["scope"] != wantScope {
		t.Fatalf("expected scope %s, got %#v", wantScope, details)
	}
	if got, ok := details["retry_after_seconds"].(float64); !ok || got < 1 {
		t.Fatalf("expected retry_after_seconds >= 1, got %#v", details)
	}
}
