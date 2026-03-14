package auth

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

type contextKey string

const (
	contextKeyUserID   contextKey = "user_id"
	contextKeyTenantID contextKey = "tenant_id"
)

var uuidPattern = regexp.MustCompile(`^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$`)

type accessClaims struct {
	UserID   string `json:"user_id"`
	TenantID string `json:"tenant_id"`
	jwt.RegisteredClaims
}

func RequireAuthenticatedIdentity(db *sql.DB, jwtSecret string) gin.HandlerFunc {
	jwtSecret = strings.TrimSpace(jwtSecret)
	return func(c *gin.Context) {
		if c.Request.Method == http.MethodOptions || isPublicPath(c.Request.URL.Path) {
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

		authorizationReady := false
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
			permissions, err := loadUserPermissions(c.Request.Context(), db, tenantID, userID)
			if err != nil {
				writeAuthError(c, http.StatusInternalServerError, "failed to load permissions")
				return
			}
			c.Set(string(contextKeyUserPermissions), permissions)
			authorizationReady = true
		}

		c.Set(string(contextKeyUserID), userID)
		c.Set(string(contextKeyTenantID), tenantID)
		c.Set(string(contextKeyAuthorizationReady), authorizationReady)
		c.Request = c.Request.WithContext(context.WithValue(c.Request.Context(), contextKeyUserID, userID))
		c.Request = c.Request.WithContext(context.WithValue(c.Request.Context(), contextKeyTenantID, tenantID))
		c.Request.Header.Set("X-User-ID", userID)
		c.Request.Header.Set("X-Tenant-ID", tenantID)
		c.Next()
	}
}

func isPublicPath(path string) bool {
	switch strings.TrimSpace(path) {
	case "/healthz", "/readyz", "/metrics":
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

func validateAccessToken(tokenString, jwtSecret string) (*accessClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &accessClaims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrTokenSignatureInvalid
		}
		return []byte(jwtSecret), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*accessClaims)
	if !ok || !token.Valid {
		return nil, jwt.ErrTokenInvalidClaims
	}
	return claims, nil
}

func isAccessTokenSessionActive(ctx context.Context, db *sql.DB, tenantID, userID, accessTokenJTI string) (bool, error) {
	const q = `
		SELECT EXISTS(
			SELECT 1
			FROM user_sessions
			WHERE tenant_id = $1::uuid
			  AND user_id = $2::uuid
			  AND access_token_jti = $3
			  AND session_status = 'active'
			  AND expires_at > $4
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
		requestID = "ds-auth"
	}
	c.AbortWithStatusJSON(status, gin.H{
		"code":       "UNAUTHORIZED",
		"message":    message,
		"request_id": requestID,
		"details":    gin.H{},
	})
}
