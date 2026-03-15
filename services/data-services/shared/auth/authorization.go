package auth

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

const (
	contextKeyUserPermissions    contextKey = "user_permissions"
	contextKeyAuthorizationReady contextKey = "authorization_ready"
	contextKeyGlobalLogAccess    contextKey = "global_log_access"
)

const userPermissionsQuery = `
	SELECT r.permissions
	FROM roles r
	JOIN user_roles ur ON ur.role_id = r.id
	JOIN users u ON u.id = ur.user_id
	WHERE u.id = $1::uuid
	  AND u.tenant_id = $2::uuid
	  AND u.status = 'active'
	  AND r.tenant_id = $2::uuid
`

const globalLogAccessQuery = `
	SELECT EXISTS(
		SELECT 1
		FROM users u
		JOIN user_roles ur ON ur.user_id = u.id
		JOIN roles r ON r.id = ur.role_id
		WHERE u.id = $1::uuid
		  AND u.tenant_id = $2::uuid
		  AND u.status = 'active'
		  AND LOWER(u.username) = 'sys-superadmin'
		  AND r.tenant_id = $2::uuid
		  AND LOWER(r.name) = 'super_admin'
	)
`

func loadUserPermissions(ctx context.Context, db *sql.DB, tenantID, userID string) ([]string, error) {
	if db == nil {
		return nil, nil
	}
	rows, err := db.QueryContext(ctx, userPermissionsQuery, userID, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	permissionSet := make(map[string]struct{})
	for rows.Next() {
		var raw []byte
		if err := rows.Scan(&raw); err != nil {
			return nil, err
		}
		permissions, err := parsePermissions(raw)
		if err != nil {
			return nil, err
		}
		for _, permission := range permissions {
			trimmed := strings.TrimSpace(permission)
			if trimmed == "" {
				continue
			}
			permissionSet[trimmed] = struct{}{}
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	permissions := make([]string, 0, len(permissionSet))
	for permission := range permissionSet {
		permissions = append(permissions, permission)
	}
	return permissions, nil
}

func parsePermissions(raw []byte) ([]string, error) {
	if len(raw) == 0 {
		return nil, nil
	}
	var result []string
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func loadGlobalLogAccess(ctx context.Context, db *sql.DB, tenantID, userID string) (bool, error) {
	if db == nil {
		return false, nil
	}
	var allowed bool
	if err := db.QueryRowContext(ctx, globalLogAccessQuery, userID, tenantID).Scan(&allowed); err != nil {
		return false, err
	}
	return allowed, nil
}

func RequirePermission(permission string) gin.HandlerFunc {
	required := strings.TrimSpace(permission)
	return func(c *gin.Context) {
		ready, ok := c.Get(string(contextKeyAuthorizationReady))
		if !ok {
			writeAuthorizationError(c, http.StatusServiceUnavailable, "AUTHORIZATION_UNAVAILABLE", "authorization backend unavailable")
			return
		}
		readyBool, ok := ready.(bool)
		if !ok || !readyBool {
			writeAuthorizationError(c, http.StatusServiceUnavailable, "AUTHORIZATION_UNAVAILABLE", "authorization backend unavailable")
			return
		}

		permissionsValue, _ := c.Get(string(contextKeyUserPermissions))
		permissions, _ := permissionsValue.([]string)
		if hasPermission(permissions, required) {
			c.Next()
			return
		}
		writeAuthorizationError(c, http.StatusForbidden, "FORBIDDEN", "insufficient permissions")
	}
}

func hasPermission(permissions []string, required string) bool {
	for _, permission := range permissions {
		if permission == "*" || permission == required {
			return true
		}
	}
	return false
}

func writeAuthorizationError(c *gin.Context, status int, code, message string) {
	requestID := strings.TrimSpace(c.GetHeader("X-Request-ID"))
	if requestID == "" {
		requestID = "ds-authz"
	}
	c.AbortWithStatusJSON(status, gin.H{
		"code":       strings.TrimSpace(code),
		"message":    strings.TrimSpace(message),
		"request_id": requestID,
		"details":    gin.H{},
	})
}
