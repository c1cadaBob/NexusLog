package handler

import (
	"bytes"
	"encoding/json"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/nexuslog/api-service/internal/httpx"
	"github.com/nexuslog/api-service/internal/model"
)

type authRateLimitRule struct {
	scope  string
	limit  int
	window time.Duration
}

type authRateLimitConfig struct {
	loginUsername authRateLimitRule
	loginIP       authRateLimitRule
	registerIP    authRateLimitRule
}

type AuthRateLimitMiddleware struct {
	mu              sync.Mutex
	now             func() time.Time
	cleanupInterval time.Duration
	maxWindow       time.Duration
	lastCleanup     time.Time
	entries         map[string][]time.Time
	config          authRateLimitConfig
}

type loginRateLimitPayload struct {
	Username string `json:"username"`
}

func NewDefaultAuthRateLimitMiddleware() *AuthRateLimitMiddleware {
	config := authRateLimitConfig{
		loginUsername: authRateLimitRule{scope: "tenant_username", limit: 10, window: 15 * time.Minute},
		loginIP:       authRateLimitRule{scope: "tenant_ip", limit: 60, window: 15 * time.Minute},
		registerIP:    authRateLimitRule{scope: "tenant_ip", limit: 10, window: time.Hour},
	}
	return newAuthRateLimitMiddleware(time.Now, config)
}

func newAuthRateLimitMiddleware(now func() time.Time, config authRateLimitConfig) *AuthRateLimitMiddleware {
	maxWindow := config.loginUsername.window
	if config.loginIP.window > maxWindow {
		maxWindow = config.loginIP.window
	}
	if config.registerIP.window > maxWindow {
		maxWindow = config.registerIP.window
	}
	if maxWindow <= 0 {
		maxWindow = time.Hour
	}
	cleanupInterval := maxWindow / 2
	if cleanupInterval < time.Minute {
		cleanupInterval = time.Minute
	}
	return &AuthRateLimitMiddleware{
		now:             now,
		cleanupInterval: cleanupInterval,
		maxWindow:       maxWindow,
		entries:         make(map[string][]time.Time),
		config:          config,
	}
}

func (m *AuthRateLimitMiddleware) Register() gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantKey := tenantRateLimitKey(c)
		ipKey := clientIPRateLimitKey(c)
		if allowed, retryAfter := m.allow(m.config.registerIP, buildRateLimitKey("auth.register", m.config.registerIP.scope, tenantKey, ipKey)); !allowed {
			setAuthAuditEvent(c, "auth.register", "", "", buildAuditDetails(map[string]any{
				"result":              "failed",
				"error_code":          model.ErrorCodeAuthRegisterRateLimited,
				"http_status":         http.StatusTooManyRequests,
				"rate_limit_scope":    m.config.registerIP.scope,
				"retry_after_seconds": retryAfterSeconds(retryAfter),
			}))
			writeRateLimitError(c, model.ErrorCodeAuthRegisterRateLimited, m.config.registerIP.scope, retryAfter)
			return
		}
		c.Next()
	}
}

func (m *AuthRateLimitMiddleware) Login() gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantKey := tenantRateLimitKey(c)
		ipKey := clientIPRateLimitKey(c)
		payload := readLoginRateLimitPayload(c)
		username := strings.TrimSpace(payload.Username)

		if username != "" {
			if allowed, retryAfter := m.allow(m.config.loginUsername, buildRateLimitKey("auth.login", m.config.loginUsername.scope, tenantKey, username)); !allowed {
				setAuthAuditEvent(c, "auth.login", "", "", buildAuditDetails(map[string]any{
					"result":              "failed",
					"username":            username,
					"error_code":          model.ErrorCodeAuthLoginRateLimited,
					"http_status":         http.StatusTooManyRequests,
					"rate_limit_scope":    m.config.loginUsername.scope,
					"retry_after_seconds": retryAfterSeconds(retryAfter),
				}))
				writeRateLimitError(c, model.ErrorCodeAuthLoginRateLimited, m.config.loginUsername.scope, retryAfter)
				return
			}
		}

		if allowed, retryAfter := m.allow(m.config.loginIP, buildRateLimitKey("auth.login", m.config.loginIP.scope, tenantKey, ipKey)); !allowed {
			setAuthAuditEvent(c, "auth.login", "", "", buildAuditDetails(map[string]any{
				"result":              "failed",
				"username":            username,
				"error_code":          model.ErrorCodeAuthLoginRateLimited,
				"http_status":         http.StatusTooManyRequests,
				"rate_limit_scope":    m.config.loginIP.scope,
				"retry_after_seconds": retryAfterSeconds(retryAfter),
			}))
			writeRateLimitError(c, model.ErrorCodeAuthLoginRateLimited, m.config.loginIP.scope, retryAfter)
			return
		}

		c.Next()
	}
}

func (m *AuthRateLimitMiddleware) allow(rule authRateLimitRule, key string) (bool, time.Duration) {
	if rule.limit <= 0 || rule.window <= 0 {
		return true, 0
	}

	now := m.now().UTC()
	cutoff := now.Add(-rule.window)

	m.mu.Lock()
	defer m.mu.Unlock()

	m.cleanupLocked(now)

	timestamps := m.entries[key]
	keepFrom := 0
	for keepFrom < len(timestamps) && !timestamps[keepFrom].After(cutoff) {
		keepFrom++
	}
	if keepFrom > 0 {
		timestamps = append([]time.Time(nil), timestamps[keepFrom:]...)
	}

	if len(timestamps) >= rule.limit {
		retryAfter := timestamps[0].Add(rule.window).Sub(now)
		if retryAfter < time.Second {
			retryAfter = time.Second
		}
		m.entries[key] = timestamps
		return false, retryAfter
	}

	timestamps = append(timestamps, now)
	m.entries[key] = timestamps
	return true, 0
}

func (m *AuthRateLimitMiddleware) cleanupLocked(now time.Time) {
	if !m.lastCleanup.IsZero() && now.Sub(m.lastCleanup) < m.cleanupInterval {
		return
	}
	cutoff := now.Add(-m.maxWindow)
	for key, timestamps := range m.entries {
		keepFrom := 0
		for keepFrom < len(timestamps) && !timestamps[keepFrom].After(cutoff) {
			keepFrom++
		}
		switch {
		case keepFrom >= len(timestamps):
			delete(m.entries, key)
		case keepFrom > 0:
			m.entries[key] = append([]time.Time(nil), timestamps[keepFrom:]...)
		}
	}
	m.lastCleanup = now
}

func readLoginRateLimitPayload(c *gin.Context) loginRateLimitPayload {
	if c == nil || c.Request == nil || c.Request.Body == nil {
		return loginRateLimitPayload{}
	}
	rawBody, err := io.ReadAll(io.LimitReader(c.Request.Body, 1<<20))
	if err != nil {
		c.Request.Body = io.NopCloser(bytes.NewReader(nil))
		return loginRateLimitPayload{}
	}
	c.Request.Body = io.NopCloser(bytes.NewReader(rawBody))
	if len(rawBody) == 0 {
		return loginRateLimitPayload{}
	}
	var payload loginRateLimitPayload
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		return loginRateLimitPayload{}
	}
	return payload
}

func tenantRateLimitKey(c *gin.Context) string {
	if c == nil {
		return "unknown_tenant"
	}
	tenantID := strings.TrimSpace(c.GetHeader("X-Tenant-ID"))
	if tenantID == "" {
		tenantID = strings.TrimSpace(c.GetHeader("X-Tenant-Id"))
	}
	if tenantID == "" {
		return "unknown_tenant"
	}
	return tenantID
}

func clientIPRateLimitKey(c *gin.Context) string {
	if c == nil {
		return "unknown_ip"
	}
	ip := strings.TrimSpace(c.ClientIP())
	if ip == "" {
		return "unknown_ip"
	}
	return ip
}

func buildRateLimitKey(action, scope, tenantKey, subject string) string {
	return strings.Join([]string{action, scope, tenantKey, strings.TrimSpace(subject)}, "|")
}

func writeRateLimitError(c *gin.Context, code, scope string, retryAfter time.Duration) {
	seconds := retryAfterSeconds(retryAfter)
	c.Header("Retry-After", strconv.Itoa(seconds))
	httpx.Error(c, &model.APIError{
		HTTPStatus: http.StatusTooManyRequests,
		Code:       code,
		Details: map[string]any{
			"scope":               scope,
			"retry_after_seconds": seconds,
		},
	})
	c.Abort()
}

func retryAfterSeconds(retryAfter time.Duration) int {
	seconds := int(math.Ceil(retryAfter.Seconds()))
	if seconds < 1 {
		return 1
	}
	return seconds
}
