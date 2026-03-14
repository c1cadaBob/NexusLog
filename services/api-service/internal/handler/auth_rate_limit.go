package handler

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
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
	loginUsername          authRateLimitRule
	loginIP                authRateLimitRule
	registerIP             authRateLimitRule
	resetRequestIdentifier authRateLimitRule
	resetRequestIP         authRateLimitRule
	resetConfirmToken      authRateLimitRule
	resetConfirmIP         authRateLimitRule
}

type AuthRateLimitMiddleware struct {
	mu              sync.Mutex
	now             func() time.Time
	cleanupInterval time.Duration
	maxWindow       time.Duration
	maxEntries      int
	lastCleanup     time.Time
	entries         map[string][]time.Time
	config          authRateLimitConfig
}

type loginRateLimitPayload struct {
	Username string `json:"username"`
}

type passwordResetRequestRateLimitPayload struct {
	EmailOrUsername string `json:"email_or_username"`
}

type passwordResetConfirmRateLimitPayload struct {
	Token string `json:"token"`
}

const (
	maxAuthRateLimitBodyBytes = 16 * 1024
	defaultAuthRateLimitKeys  = 10000
)

func NewDefaultAuthRateLimitMiddleware() *AuthRateLimitMiddleware {
	config := authRateLimitConfig{
		loginUsername:          authRateLimitRule{scope: "tenant_username", limit: 10, window: 15 * time.Minute},
		loginIP:                authRateLimitRule{scope: "tenant_ip", limit: 60, window: 15 * time.Minute},
		registerIP:             authRateLimitRule{scope: "tenant_ip", limit: 10, window: time.Hour},
		resetRequestIdentifier: authRateLimitRule{scope: "tenant_identifier", limit: 5, window: time.Hour},
		resetRequestIP:         authRateLimitRule{scope: "tenant_ip", limit: 20, window: time.Hour},
		resetConfirmToken:      authRateLimitRule{scope: "tenant_token", limit: 10, window: time.Hour},
		resetConfirmIP:         authRateLimitRule{scope: "tenant_ip", limit: 30, window: time.Hour},
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
	if config.resetRequestIdentifier.window > maxWindow {
		maxWindow = config.resetRequestIdentifier.window
	}
	if config.resetRequestIP.window > maxWindow {
		maxWindow = config.resetRequestIP.window
	}
	if config.resetConfirmToken.window > maxWindow {
		maxWindow = config.resetConfirmToken.window
	}
	if config.resetConfirmIP.window > maxWindow {
		maxWindow = config.resetConfirmIP.window
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
		maxEntries:      defaultAuthRateLimitKeys,
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

func (m *AuthRateLimitMiddleware) PasswordResetRequest() gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantKey := tenantRateLimitKey(c)
		ipKey := clientIPRateLimitKey(c)
		payload := readPasswordResetRequestRateLimitPayload(c)
		identifier := normalizePasswordResetRequestIdentifier(payload.EmailOrUsername)

		if identifier != "" {
			if allowed, retryAfter := m.allow(m.config.resetRequestIdentifier, buildRateLimitKey("auth.password_reset_request", m.config.resetRequestIdentifier.scope, tenantKey, identifier)); !allowed {
				setAuthAuditEvent(c, "auth.password_reset_request", "", "", buildAuditDetails(map[string]any{
					"result":              "failed",
					"email_or_username":   identifier,
					"error_code":          model.ErrorCodeAuthResetRequestRateLimited,
					"http_status":         http.StatusTooManyRequests,
					"rate_limit_scope":    m.config.resetRequestIdentifier.scope,
					"retry_after_seconds": retryAfterSeconds(retryAfter),
				}))
				writeRateLimitError(c, model.ErrorCodeAuthResetRequestRateLimited, m.config.resetRequestIdentifier.scope, retryAfter)
				return
			}
		}

		if allowed, retryAfter := m.allow(m.config.resetRequestIP, buildRateLimitKey("auth.password_reset_request", m.config.resetRequestIP.scope, tenantKey, ipKey)); !allowed {
			setAuthAuditEvent(c, "auth.password_reset_request", "", "", buildAuditDetails(map[string]any{
				"result":              "failed",
				"email_or_username":   identifier,
				"error_code":          model.ErrorCodeAuthResetRequestRateLimited,
				"http_status":         http.StatusTooManyRequests,
				"rate_limit_scope":    m.config.resetRequestIP.scope,
				"retry_after_seconds": retryAfterSeconds(retryAfter),
			}))
			writeRateLimitError(c, model.ErrorCodeAuthResetRequestRateLimited, m.config.resetRequestIP.scope, retryAfter)
			return
		}

		c.Next()
	}
}

func (m *AuthRateLimitMiddleware) PasswordResetConfirm() gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantKey := tenantRateLimitKey(c)
		ipKey := clientIPRateLimitKey(c)
		payload := readPasswordResetConfirmRateLimitPayload(c)
		token := normalizePasswordResetConfirmToken(payload.Token)
		tokenProvided := token != ""

		if tokenProvided {
			if allowed, retryAfter := m.allow(m.config.resetConfirmToken, buildRateLimitKey("auth.password_reset_confirm", m.config.resetConfirmToken.scope, tenantKey, token)); !allowed {
				setAuthAuditEvent(c, "auth.password_reset_confirm", "", "", buildAuditDetails(map[string]any{
					"result":              "failed",
					"token_provided":      tokenProvided,
					"error_code":          model.ErrorCodeAuthResetConfirmRateLimited,
					"http_status":         http.StatusTooManyRequests,
					"rate_limit_scope":    m.config.resetConfirmToken.scope,
					"retry_after_seconds": retryAfterSeconds(retryAfter),
				}))
				writeRateLimitError(c, model.ErrorCodeAuthResetConfirmRateLimited, m.config.resetConfirmToken.scope, retryAfter)
				return
			}
		}

		if allowed, retryAfter := m.allow(m.config.resetConfirmIP, buildRateLimitKey("auth.password_reset_confirm", m.config.resetConfirmIP.scope, tenantKey, ipKey)); !allowed {
			setAuthAuditEvent(c, "auth.password_reset_confirm", "", "", buildAuditDetails(map[string]any{
				"result":              "failed",
				"token_provided":      tokenProvided,
				"error_code":          model.ErrorCodeAuthResetConfirmRateLimited,
				"http_status":         http.StatusTooManyRequests,
				"rate_limit_scope":    m.config.resetConfirmIP.scope,
				"retry_after_seconds": retryAfterSeconds(retryAfter),
			}))
			writeRateLimitError(c, model.ErrorCodeAuthResetConfirmRateLimited, m.config.resetConfirmIP.scope, retryAfter)
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
	if len(timestamps) == 0 {
		m.ensureCapacityLocked(key)
		timestamps = m.entries[key]
	}
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
	rawBody := readRateLimitRequestBody(c)
	if len(rawBody) == 0 {
		return loginRateLimitPayload{}
	}
	var payload loginRateLimitPayload
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		return loginRateLimitPayload{}
	}
	return payload
}

func readPasswordResetRequestRateLimitPayload(c *gin.Context) passwordResetRequestRateLimitPayload {
	rawBody := readRateLimitRequestBody(c)
	if len(rawBody) == 0 {
		return passwordResetRequestRateLimitPayload{}
	}
	var payload passwordResetRequestRateLimitPayload
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		return passwordResetRequestRateLimitPayload{}
	}
	return payload
}

func readPasswordResetConfirmRateLimitPayload(c *gin.Context) passwordResetConfirmRateLimitPayload {
	rawBody := readRateLimitRequestBody(c)
	if len(rawBody) == 0 {
		return passwordResetConfirmRateLimitPayload{}
	}
	var payload passwordResetConfirmRateLimitPayload
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		return passwordResetConfirmRateLimitPayload{}
	}
	return payload
}

func readRateLimitRequestBody(c *gin.Context) []byte {
	if c == nil || c.Request == nil || c.Request.Body == nil {
		return nil
	}
	rawBody, err := io.ReadAll(io.LimitReader(c.Request.Body, maxAuthRateLimitBodyBytes))
	if err != nil {
		c.Request.Body = io.NopCloser(bytes.NewReader(nil))
		return nil
	}
	c.Request.Body = io.NopCloser(bytes.NewReader(rawBody))
	return rawBody
}

func normalizePasswordResetRequestIdentifier(identifier string) string {
	identifier = strings.TrimSpace(identifier)
	if strings.Contains(identifier, "@") {
		return strings.ToLower(identifier)
	}
	return identifier
}

func normalizePasswordResetConfirmToken(token string) string {
	return strings.TrimSpace(token)
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
	return strings.Join([]string{action, scope, tenantKey, hashRateLimitSubject(subject)}, "|")
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

func (m *AuthRateLimitMiddleware) ensureCapacityLocked(key string) {
	if key == "" || m.maxEntries <= 0 {
		return
	}
	if _, exists := m.entries[key]; exists || len(m.entries) < m.maxEntries {
		return
	}

	oldestKey := ""
	var oldestSeen time.Time
	for existingKey, timestamps := range m.entries {
		if len(timestamps) == 0 {
			delete(m.entries, existingKey)
			continue
		}
		lastSeen := timestamps[len(timestamps)-1]
		if oldestKey == "" || lastSeen.Before(oldestSeen) {
			oldestKey = existingKey
			oldestSeen = lastSeen
		}
	}
	if oldestKey != "" {
		delete(m.entries, oldestKey)
	}
}

func hashRateLimitSubject(subject string) string {
	subject = strings.TrimSpace(subject)
	if subject == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(subject))
	return hex.EncodeToString(sum[:])
}
