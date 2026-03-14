package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestBuildRateLimitKey_HashesSubject(t *testing.T) {
	rawSubject := strings.Repeat("reset-token-very-sensitive-", 8)
	key := buildRateLimitKey("auth.password_reset_confirm", "tenant_token", "tenant-a", rawSubject)
	if strings.Contains(key, rawSubject) {
		t.Fatalf("expected rate limit key to avoid raw subject, got %q", key)
	}
	parts := strings.Split(key, "|")
	if len(parts) != 4 {
		t.Fatalf("expected 4 key parts, got %q", key)
	}
	if len(parts[3]) != 64 {
		t.Fatalf("expected hashed subject width 64, got %q", parts[3])
	}
}

func TestAuthRateLimitMiddleware_EvictsOldestTrackedKeyAtCapacity(t *testing.T) {
	current := time.Date(2026, 3, 14, 12, 0, 0, 0, time.UTC)
	limiter := newAuthRateLimitMiddleware(func() time.Time { return current }, authRateLimitConfig{})
	limiter.maxEntries = 2
	rule := authRateLimitRule{scope: "tenant_ip", limit: 5, window: time.Hour}

	if allowed, _ := limiter.allow(rule, "key-a"); !allowed {
		t.Fatal("expected key-a allowed")
	}
	current = current.Add(time.Second)
	if allowed, _ := limiter.allow(rule, "key-b"); !allowed {
		t.Fatal("expected key-b allowed")
	}
	current = current.Add(time.Second)
	if allowed, _ := limiter.allow(rule, "key-c"); !allowed {
		t.Fatal("expected key-c allowed")
	}

	if got := len(limiter.entries); got != 2 {
		t.Fatalf("expected capped tracked keys, got %d", got)
	}
	if _, exists := limiter.entries["key-a"]; exists {
		t.Fatalf("expected oldest key to be evicted")
	}
	if _, exists := limiter.entries["key-b"]; !exists {
		t.Fatalf("expected newer key-b retained")
	}
	if _, exists := limiter.entries["key-c"]; !exists {
		t.Fatalf("expected newest key-c retained")
	}
}

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

func TestAuthRateLimitMiddleware_PasswordResetRequestBlocksByIdentifier(t *testing.T) {
	gin.SetMode(gin.TestMode)
	limiter := newAuthRateLimitMiddleware(time.Now, authRateLimitConfig{
		loginUsername:          authRateLimitRule{scope: "tenant_username", limit: 10, window: time.Hour},
		loginIP:                authRateLimitRule{scope: "tenant_ip", limit: 10, window: time.Hour},
		registerIP:             authRateLimitRule{scope: "tenant_ip", limit: 10, window: time.Hour},
		resetRequestIdentifier: authRateLimitRule{scope: "tenant_identifier", limit: 1, window: time.Hour},
		resetRequestIP:         authRateLimitRule{scope: "tenant_ip", limit: 10, window: time.Hour},
	})

	router := gin.New()
	router.POST("/api/v1/auth/password/reset-request", limiter.PasswordResetRequest(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"accepted": true})
	})

	first := performJSONRequest(t, router, http.MethodPost, "/api/v1/auth/password/reset-request", map[string]any{"email_or_username": "Alice@Example.com"}, "tenant-a", "10.0.0.5:1234")
	if first.Code != http.StatusOK {
		t.Fatalf("expected first reset request 200, got %d body=%s", first.Code, first.Body.String())
	}

	second := performJSONRequest(t, router, http.MethodPost, "/api/v1/auth/password/reset-request", map[string]any{"email_or_username": "alice@example.com"}, "tenant-a", "10.0.0.6:1234")
	assertRateLimitedResponse(t, second, http.StatusTooManyRequests, "AUTH_RESET_REQUEST_RATE_LIMITED", "tenant_identifier")
}

func TestAuthRateLimitMiddleware_PasswordResetRequestBlocksByIP(t *testing.T) {
	gin.SetMode(gin.TestMode)
	limiter := newAuthRateLimitMiddleware(time.Now, authRateLimitConfig{
		loginUsername:          authRateLimitRule{scope: "tenant_username", limit: 10, window: time.Hour},
		loginIP:                authRateLimitRule{scope: "tenant_ip", limit: 10, window: time.Hour},
		registerIP:             authRateLimitRule{scope: "tenant_ip", limit: 10, window: time.Hour},
		resetRequestIdentifier: authRateLimitRule{scope: "tenant_identifier", limit: 10, window: time.Hour},
		resetRequestIP:         authRateLimitRule{scope: "tenant_ip", limit: 1, window: time.Hour},
	})

	router := gin.New()
	router.POST("/api/v1/auth/password/reset-request", limiter.PasswordResetRequest(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"accepted": true})
	})

	first := performJSONRequest(t, router, http.MethodPost, "/api/v1/auth/password/reset-request", map[string]any{"email_or_username": "alice@example.com"}, "tenant-a", "10.0.0.7:1234")
	if first.Code != http.StatusOK {
		t.Fatalf("expected first reset request 200, got %d body=%s", first.Code, first.Body.String())
	}

	second := performJSONRequest(t, router, http.MethodPost, "/api/v1/auth/password/reset-request", map[string]any{"email_or_username": "bob@example.com"}, "tenant-a", "10.0.0.7:5678")
	assertRateLimitedResponse(t, second, http.StatusTooManyRequests, "AUTH_RESET_REQUEST_RATE_LIMITED", "tenant_ip")
}

func TestAuthRateLimitMiddleware_PasswordResetConfirmBlocksByToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	limiter := newAuthRateLimitMiddleware(time.Now, authRateLimitConfig{
		loginUsername:     authRateLimitRule{scope: "tenant_username", limit: 10, window: time.Hour},
		loginIP:           authRateLimitRule{scope: "tenant_ip", limit: 10, window: time.Hour},
		registerIP:        authRateLimitRule{scope: "tenant_ip", limit: 10, window: time.Hour},
		resetConfirmToken: authRateLimitRule{scope: "tenant_token", limit: 1, window: time.Hour},
		resetConfirmIP:    authRateLimitRule{scope: "tenant_ip", limit: 10, window: time.Hour},
	})

	router := gin.New()
	router.POST("/api/v1/auth/password/reset-confirm", limiter.PasswordResetConfirm(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"reset": true})
	})

	first := performJSONRequest(t, router, http.MethodPost, "/api/v1/auth/password/reset-confirm", map[string]any{"token": "reset-token-1", "new_password": "Password123"}, "tenant-a", "10.0.0.8:1234")
	if first.Code != http.StatusOK {
		t.Fatalf("expected first reset confirm 200, got %d body=%s", first.Code, first.Body.String())
	}

	second := performJSONRequest(t, router, http.MethodPost, "/api/v1/auth/password/reset-confirm", map[string]any{"token": "reset-token-1", "new_password": "Password123"}, "tenant-a", "10.0.0.9:1234")
	assertRateLimitedResponse(t, second, http.StatusTooManyRequests, "AUTH_RESET_CONFIRM_RATE_LIMITED", "tenant_token")
}

func TestAuthRateLimitMiddleware_PasswordResetConfirmBlocksByIP(t *testing.T) {
	gin.SetMode(gin.TestMode)
	limiter := newAuthRateLimitMiddleware(time.Now, authRateLimitConfig{
		loginUsername:     authRateLimitRule{scope: "tenant_username", limit: 10, window: time.Hour},
		loginIP:           authRateLimitRule{scope: "tenant_ip", limit: 10, window: time.Hour},
		registerIP:        authRateLimitRule{scope: "tenant_ip", limit: 10, window: time.Hour},
		resetConfirmToken: authRateLimitRule{scope: "tenant_token", limit: 10, window: time.Hour},
		resetConfirmIP:    authRateLimitRule{scope: "tenant_ip", limit: 1, window: time.Hour},
	})

	router := gin.New()
	router.POST("/api/v1/auth/password/reset-confirm", limiter.PasswordResetConfirm(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"reset": true})
	})

	first := performJSONRequest(t, router, http.MethodPost, "/api/v1/auth/password/reset-confirm", map[string]any{"token": "reset-token-2", "new_password": "Password123"}, "tenant-a", "10.0.0.10:1234")
	if first.Code != http.StatusOK {
		t.Fatalf("expected first reset confirm 200, got %d body=%s", first.Code, first.Body.String())
	}

	second := performJSONRequest(t, router, http.MethodPost, "/api/v1/auth/password/reset-confirm", map[string]any{"token": "reset-token-3", "new_password": "Password123"}, "tenant-a", "10.0.0.10:5678")
	assertRateLimitedResponse(t, second, http.StatusTooManyRequests, "AUTH_RESET_CONFIRM_RATE_LIMITED", "tenant_ip")
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
