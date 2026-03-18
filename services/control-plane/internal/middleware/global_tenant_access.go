package middleware

import (
	"context"
	"database/sql"
	"strings"
)

const globalTenantReadAccessQuery = `
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

func HasGlobalTenantReadAccess(ctx context.Context, db *sql.DB, tenantID, userID string) (bool, error) {
	tenantID = strings.TrimSpace(tenantID)
	userID = strings.TrimSpace(userID)
	if tenantID == "" || userID == "" {
		return false, nil
	}
	if hasGlobalTenantReadAccessFromContext(ctx) {
		return true, nil
	}
	if db == nil {
		return false, nil
	}
	var allowed bool
	if err := db.QueryRowContext(ctx, globalTenantReadAccessQuery, userID, tenantID).Scan(&allowed); err != nil {
		return false, err
	}
	return allowed, nil
}

func hasGlobalTenantReadAccessFromContext(ctx context.Context) bool {
	capabilities := authenticatedContextStringSlice(ctx, authContextKeyUserCapabilities)
	if !hasAuthorizationValue(capabilities, "*") {
		return false
	}
	return hasAnyScope(authenticatedContextStringSlice(ctx, authContextKeyUserScopes), "all_tenants", "system")
}
