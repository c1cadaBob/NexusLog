package middleware

import (
	"context"
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
)

const authContextKeyOperatorRoleGranted = "operator_role_granted"

const operatorRoleExistsQuery = `
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
			LOWER(r.name) IN ('super_admin', 'system_admin', 'operator')
			OR COALESCE(r.permissions, '[]'::jsonb) ? '*'
		  )
	)
`

var operatorAuthorizationCapabilities = []string{
	"alert.rule.update",
	"alert.silence.update",
	"export.job.create",
	"incident.update",
}

// RequireOperatorRole restricts routes to tenant operators and administrators.
func RequireOperatorRole(db *sql.DB) gin.HandlerFunc {
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
		if hasOperatorAuthorizationSnapshot(c) {
			markOperatorRoleGranted(c)
			c.Next()
			return
		}
		if db == nil {
			writeAuthorizationError(c, http.StatusServiceUnavailable, "AUTHORIZATION_UNAVAILABLE", "authorization backend unavailable")
			return
		}

		allowed, err := hasOperatorRole(c.Request.Context(), db, tenantID, userID)
		if err != nil {
			writeAuthorizationError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to authorize request")
			return
		}
		if !allowed {
			writeAuthorizationError(c, http.StatusForbidden, "FORBIDDEN", "operator or administrator role required")
			return
		}
		markOperatorRoleGranted(c)
		c.Next()
	}
}

func hasOperatorRole(ctx context.Context, db *sql.DB, tenantID, userID string) (bool, error) {
	var allowed bool
	if err := db.QueryRowContext(ctx, operatorRoleExistsQuery, userID, tenantID).Scan(&allowed); err != nil {
		return false, err
	}
	return allowed, nil
}

func markOperatorRoleGranted(c *gin.Context) {
	if c == nil {
		return
	}
	c.Set(authContextKeyOperatorRoleGranted, true)
}

func hasOperatorAuthorizationSnapshot(c *gin.Context) bool {
	if hasAdminAuthorizationSnapshot(c) {
		return true
	}
	permissions := AuthenticatedPermissions(c)
	if hasAuthorizationValue(permissions, "alerts:write") || hasAuthorizationValue(permissions, "incidents:write") || hasAuthorizationValue(permissions, "logs:export") {
		return true
	}
	return hasAnyCapability(AuthenticatedCapabilities(c), operatorAuthorizationCapabilities...)
}
