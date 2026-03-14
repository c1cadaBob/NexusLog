package middleware

import (
	"context"
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const (
	authContextKeyUserID   = "user_id"
	authContextKeyTenantID = "tenant_id"
)

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
		if strings.TrimSpace(claims.UserID) == "" || strings.TrimSpace(claims.TenantID) == "" || strings.TrimSpace(claims.ID) == "" {
			writeAuthError(c, http.StatusUnauthorized, "invalid token claims")
			return
		}

		if db != nil {
			active, err := isAccessTokenSessionActive(c.Request.Context(), db, claims.TenantID, claims.UserID, claims.ID)
			if err != nil {
				writeAuthError(c, http.StatusInternalServerError, "failed to validate session")
				return
			}
			if !active {
				writeAuthError(c, http.StatusUnauthorized, "session is revoked or expired")
				return
			}
		}

		c.Set(authContextKeyUserID, claims.UserID)
		c.Set(authContextKeyTenantID, claims.TenantID)
		c.Request = c.Request.WithContext(context.WithValue(c.Request.Context(), authContextKeyUserID, claims.UserID))
		c.Request = c.Request.WithContext(context.WithValue(c.Request.Context(), authContextKeyTenantID, claims.TenantID))
		c.Request.Header.Set("X-User-ID", claims.UserID)
		c.Request.Header.Set("X-Tenant-ID", claims.TenantID)
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
