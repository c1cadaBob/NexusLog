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
		permissions := []string{}
		roles := []string{}
		capabilities := []string{}
		scopes := []string{}
		entitlements := []string{}
		featureFlags := []string{}
		actorFlags := map[string]bool{}
		authzEpoch := int64(0)
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
			authzRecord, err := loadAuthorizationContext(c.Request.Context(), db, tenantID, userID)
			if err != nil {
				writeAuthError(c, http.StatusInternalServerError, "failed to load permissions")
				return
			}
			if !isInteractiveAccessAllowed(authzRecord.Snapshot.ActorFlags) {
				writeAuthorizationError(c, http.StatusForbidden, "FORBIDDEN", "interactive login is disabled for this account")
				return
			}
			permissions = append([]string{}, authzRecord.Permissions...)
			roles = append([]string{}, authzRecord.Roles...)
			capabilities = append([]string{}, authzRecord.Snapshot.Capabilities...)
			scopes = append([]string{}, authzRecord.Snapshot.Scopes...)
			entitlements = append([]string{}, authzRecord.Snapshot.Entitlements...)
			featureFlags = append([]string{}, authzRecord.Snapshot.FeatureFlags...)
			actorFlags = make(map[string]bool, len(authzRecord.Snapshot.ActorFlags))
			for key, enabled := range authzRecord.Snapshot.ActorFlags {
				actorFlags[key] = enabled
			}
			authzEpoch = authzRecord.Snapshot.AuthzEpoch
			authorizationReady = true
		}

		c.Set(string(contextKeyUserID), userID)
		c.Set(string(contextKeyTenantID), tenantID)
		c.Set(string(contextKeyAuthorizationReady), authorizationReady)
		c.Set(string(contextKeyUserPermissions), permissions)
		c.Set(string(contextKeyUserRoles), roles)
		c.Set(string(contextKeyUserCapabilities), capabilities)
		c.Set(string(contextKeyUserScopes), scopes)
		c.Set(string(contextKeyUserEntitlements), entitlements)
		c.Set(string(contextKeyUserFeatureFlags), featureFlags)
		c.Set(string(contextKeyUserAuthzEpoch), authzEpoch)
		c.Set(string(contextKeyUserActorFlags), actorFlags)

		ctx := c.Request.Context()
		ctx = context.WithValue(ctx, contextKeyUserID, userID)
		ctx = context.WithValue(ctx, contextKeyTenantID, tenantID)
		ctx = context.WithValue(ctx, contextKeyAuthorizationReady, authorizationReady)
		ctx = context.WithValue(ctx, contextKeyUserPermissions, permissions)
		ctx = context.WithValue(ctx, contextKeyUserRoles, roles)
		ctx = context.WithValue(ctx, contextKeyUserCapabilities, capabilities)
		ctx = context.WithValue(ctx, contextKeyUserScopes, scopes)
		ctx = context.WithValue(ctx, contextKeyUserEntitlements, entitlements)
		ctx = context.WithValue(ctx, contextKeyUserFeatureFlags, featureFlags)
		ctx = context.WithValue(ctx, contextKeyUserAuthzEpoch, authzEpoch)
		ctx = context.WithValue(ctx, contextKeyUserActorFlags, actorFlags)
		c.Request = c.Request.WithContext(ctx)
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

func isInteractiveAccessAllowed(actorFlags map[string]bool) bool {
	if len(actorFlags) == 0 {
		return true
	}
	allowed, exists := actorFlags["interactive_login_allowed"]
	return !exists || allowed
}
