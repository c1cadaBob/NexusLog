package middleware

import (
	"context"
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

const adminRoleExistsQuery = `
	SELECT EXISTS(
		SELECT 1
		FROM users u
		JOIN user_roles ur ON ur.user_id = u.id
		JOIN roles r ON r.id = ur.role_id
		WHERE u.id = $1::uuid
		  AND u.tenant_id = $2::uuid
		  AND u.status = 'active'
		  AND r.tenant_id = $2::uuid
		  AND (
			LOWER(r.name) IN ('super_admin', 'system_admin')
			OR COALESCE(r.permissions, '[]'::jsonb) ? '*'
		  )
	)
`

var adminAuthorizationCapabilities = []string{
	"iam.user.create",
	"iam.user.delete",
	"iam.user.grant_role",
	"iam.user.revoke_role",
	"iam.user.update_profile",
	"iam.user.update_status",
}

// RequireAdminRole restricts sensitive routes to tenant administrators.
func RequireAdminRole(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method == http.MethodOptions {
			c.Next()
			return
		}
		tenantID := AuthenticatedTenantID(c)
		userID := AuthenticatedUserID(c)
		if tenantID == "" || userID == "" {
			writeAuthorizationError(c, http.StatusForbidden, "FORBIDDEN", "permission check failed: auth context missing")
			return
		}
		if hasAdminAuthorizationSnapshot(c) {
			c.Next()
			return
		}
		if db == nil {
			writeAuthorizationError(c, http.StatusServiceUnavailable, "AUTHORIZATION_UNAVAILABLE", "authorization backend unavailable")
			return
		}

		allowed, err := hasAdminRole(c.Request.Context(), db, tenantID, userID)
		if err != nil {
			writeAuthorizationError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to authorize request")
			return
		}
		if !allowed {
			writeAuthorizationError(c, http.StatusForbidden, "FORBIDDEN", "administrator role required")
			return
		}
		c.Next()
	}
}

func hasAdminRole(ctx context.Context, db *sql.DB, tenantID, userID string) (bool, error) {
	var allowed bool
	if err := db.QueryRowContext(ctx, adminRoleExistsQuery, userID, tenantID).Scan(&allowed); err != nil {
		return false, err
	}
	return allowed, nil
}

func hasAdminAuthorizationSnapshot(c *gin.Context) bool {
	permissions := AuthenticatedPermissions(c)
	if hasAuthorizationValue(permissions, "*") || hasAuthorizationValue(permissions, "users:write") {
		return true
	}
	return hasAnyCapability(AuthenticatedCapabilities(c), adminAuthorizationCapabilities...)
}

func writeAuthorizationError(c *gin.Context, status int, code, message string) {
	requestID := strings.TrimSpace(c.GetHeader("X-Request-ID"))
	if requestID == "" {
		requestID = "cp-authz"
	}
	c.AbortWithStatusJSON(status, gin.H{
		"code":       strings.TrimSpace(code),
		"message":    strings.TrimSpace(message),
		"request_id": requestID,
		"details":    gin.H{},
	})
}
