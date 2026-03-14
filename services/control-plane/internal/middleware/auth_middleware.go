package middleware

import (
	"context"
	"database/sql"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const (
	authContextKeyUserID   = "user_id"
	authContextKeyTenantID = "tenant_id"
	authContextKeyAgentID  = "agent_id"
)

var uuidPattern = regexp.MustCompile(`^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$`)

type authClaims struct {
	UserID   string `json:"user_id"`
	TenantID string `json:"tenant_id"`
	jwt.RegisteredClaims
}

func RequireAuthenticatedIdentity(db *sql.DB, jwtSecret string) gin.HandlerFunc {
	jwtSecret = strings.TrimSpace(jwtSecret)
	return func(c *gin.Context) {
		if c.Request.Method == http.MethodOptions || isPublicControlPlanePath(c.Request.URL.Path) {
			c.Next()
			return
		}
		if isAgentControlPlanePath(c.Request.URL.Path) {
			if !authenticateAgentIdentity(c, db) {
				return
			}
			c.Next()
			return
		}

		tokenString, ok := extractBearerToken(c.GetHeader("Authorization"))
		if !ok {
			writeAuthError(c, http.StatusUnauthorized, "missing or invalid authorization header")
			return
		}

		claims, err := validateAccessToken(tokenString, jwtSecret)
		if err != nil {
			writeAuthError(c, http.StatusUnauthorized, "invalid or expired token")
			return
		}

		userID := normalizeUUID(claims.UserID)
		tenantID := normalizeUUID(claims.TenantID)
		if userID == "" || tenantID == "" || strings.TrimSpace(claims.ID) == "" {
			writeAuthError(c, http.StatusUnauthorized, "invalid token claims")
			return
		}

		if db != nil {
			active, err := isAccessTokenSessionActive(c.Request.Context(), db, tenantID, userID, claims.ID)
			if err != nil {
				writeAuthError(c, http.StatusInternalServerError, "failed to validate session")
				return
			}
			if !active {
				writeAuthError(c, http.StatusUnauthorized, "session is revoked or expired")
				return
			}
		}

		bindAuthenticatedUserIdentity(c, tenantID, userID)
		c.Next()
	}
}

func isPublicControlPlanePath(path string) bool {
	switch strings.TrimSpace(path) {
	case "/healthz", "/api/v1/health", "/metrics":
		return true
	default:
		return false
	}
}

func isAgentControlPlanePath(path string) bool {
	switch strings.TrimSpace(path) {
	case "/api/v1/metrics/report":
		return true
	default:
		return false
	}
}

func extractBearerToken(header string) (string, bool) {
	header = strings.TrimSpace(header)
	if header == "" {
		return "", false
	}
	parts := strings.SplitN(header, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(strings.TrimSpace(parts[0]), "Bearer") {
		return "", false
	}
	token := strings.TrimSpace(parts[1])
	if token == "" {
		return "", false
	}
	return token, true
}

func validateAccessToken(tokenString, jwtSecret string) (*authClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &authClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrTokenSignatureInvalid
		}
		return []byte(jwtSecret), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*authClaims)
	if !ok || !token.Valid {
		return nil, jwt.ErrTokenInvalidClaims
	}
	return claims, nil
}

func authenticateAgentIdentity(c *gin.Context, db *sql.DB) bool {
	if db == nil {
		writeAuthError(c, http.StatusServiceUnavailable, "authentication backend unavailable")
		return false
	}
	agentKey := strings.TrimSpace(c.GetHeader("X-Agent-Key"))
	if agentKey == "" {
		writeAuthError(c, http.StatusUnauthorized, "missing or invalid agent key")
		return false
	}
	tenantID, agentID, ok, err := lookupAgentIdentity(c.Request.Context(), db, strings.TrimSpace(c.GetHeader("X-Key-Id")), agentKey)
	if err != nil {
		writeAuthError(c, http.StatusInternalServerError, "failed to validate agent key")
		return false
	}
	if !ok {
		writeAuthError(c, http.StatusUnauthorized, "unauthorized")
		return false
	}
	bindAuthenticatedAgentIdentity(c, tenantID, agentID)
	return true
}

func lookupAgentIdentity(ctx context.Context, db *sql.DB, keyID, agentKey string) (string, string, bool, error) {
	var (
		query string
		args  []any
	)
	now := time.Now().UTC()
	if strings.TrimSpace(keyID) != "" {
		query = `
			SELECT tenant_id::text, COALESCE(agent_id, '')
			FROM agent_pull_auth_keys
			WHERE tenant_id IS NOT NULL
			  AND status IN ('active', 'rotating')
			  AND (expires_at IS NULL OR expires_at > $3)
			  AND (
				(active_key_id = $1 AND active_key_ciphertext = $2)
				OR (next_key_id = $1 AND next_key_ciphertext = $2)
			  )
			ORDER BY updated_at DESC
			LIMIT 1
		`
		args = []any{keyID, agentKey, now}
	} else {
		query = `
			SELECT tenant_id::text, COALESCE(agent_id, '')
			FROM agent_pull_auth_keys
			WHERE tenant_id IS NOT NULL
			  AND status IN ('active', 'rotating')
			  AND (expires_at IS NULL OR expires_at > $2)
			  AND (
				active_key_ciphertext = $1
				OR next_key_ciphertext = $1
			  )
			ORDER BY updated_at DESC
			LIMIT 1
		`
		args = []any{agentKey, now}
	}

	var tenantID string
	var agentID string
	if err := db.QueryRowContext(ctx, query, args...).Scan(&tenantID, &agentID); err != nil {
		if err == sql.ErrNoRows {
			return "", "", false, nil
		}
		return "", "", false, err
	}
	tenantID = normalizeUUID(tenantID)
	if tenantID == "" {
		return "", "", false, nil
	}
	return tenantID, strings.TrimSpace(agentID), true, nil
}

func bindAuthenticatedUserIdentity(c *gin.Context, tenantID, userID string) {
	if c == nil {
		return
	}
	c.Set(authContextKeyUserID, userID)
	c.Set(authContextKeyTenantID, tenantID)
	c.Set(authContextKeyAgentID, "")
	ctx := context.WithValue(c.Request.Context(), authContextKeyUserID, userID)
	ctx = context.WithValue(ctx, authContextKeyTenantID, tenantID)
	c.Request = c.Request.WithContext(ctx)
	c.Request.Header.Set("X-User-ID", userID)
	c.Request.Header.Set("X-Tenant-ID", tenantID)
	c.Request.Header.Del("X-Agent-ID")
}

func bindAuthenticatedAgentIdentity(c *gin.Context, tenantID, agentID string) {
	if c == nil {
		return
	}
	c.Set(authContextKeyUserID, "")
	c.Set(authContextKeyTenantID, tenantID)
	c.Set(authContextKeyAgentID, agentID)
	ctx := context.WithValue(c.Request.Context(), authContextKeyTenantID, tenantID)
	if strings.TrimSpace(agentID) != "" {
		ctx = context.WithValue(ctx, authContextKeyAgentID, strings.TrimSpace(agentID))
	}
	c.Request = c.Request.WithContext(ctx)
	c.Request.Header.Del("X-User-ID")
	c.Request.Header.Set("X-Tenant-ID", tenantID)
	if strings.TrimSpace(agentID) != "" {
		c.Request.Header.Set("X-Agent-ID", strings.TrimSpace(agentID))
	} else {
		c.Request.Header.Del("X-Agent-ID")
	}
}

func isAccessTokenSessionActive(ctx context.Context, db *sql.DB, tenantID, userID, accessTokenJTI string) (bool, error) {
	const q = `
		SELECT EXISTS(
			SELECT 1
			FROM user_sessions s
			JOIN users u ON u.id = s.user_id AND u.tenant_id = s.tenant_id
			WHERE s.tenant_id = $1::uuid
			  AND s.user_id = $2::uuid
			  AND s.access_token_jti = $3
			  AND s.session_status = 'active'
			  AND s.expires_at > $4
			  AND u.status = 'active'
		)
	`
	var active bool
	if err := db.QueryRowContext(ctx, q, tenantID, userID, accessTokenJTI, time.Now().UTC()).Scan(&active); err != nil {
		return false, err
	}
	return active, nil
}

func normalizeUUID(raw string) string {
	value := strings.TrimSpace(raw)
	if !uuidPattern.MatchString(value) {
		return ""
	}
	return strings.ToLower(value)
}

func writeAuthError(c *gin.Context, status int, message string) {
	requestID := strings.TrimSpace(c.GetHeader("X-Request-ID"))
	if requestID == "" {
		requestID = "cp-auth"
	}
	c.AbortWithStatusJSON(status, gin.H{
		"code":       "UNAUTHORIZED",
		"message":    message,
		"request_id": requestID,
		"details":    gin.H{},
	})
}
