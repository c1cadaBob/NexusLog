package auth

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"sort"
	"strings"

	"github.com/gin-gonic/gin"
)

const (
	contextKeyUserPermissions         contextKey = "user_permissions"
	contextKeyAuthorizationReady      contextKey = "authorization_ready"
	contextKeyUserRoles               contextKey = "user_roles"
	contextKeyUserCapabilities        contextKey = "user_capabilities"
	contextKeyUserScopes              contextKey = "user_scopes"
	contextKeyUserAuthorizedTenantIDs contextKey = "user_authorized_tenant_ids"
	contextKeyUserEntitlements        contextKey = "user_entitlements"
	contextKeyUserFeatureFlags        contextKey = "user_feature_flags"
	contextKeyUserAuthzEpoch          contextKey = "user_authz_epoch"
	contextKeyUserActorFlags          contextKey = "user_actor_flags"
)

const authorizationContextQuery = `
	SELECT u.username, COALESCE(r.name, ''), COALESCE(r.permissions, '[]'::jsonb)
	FROM users u
	LEFT JOIN user_roles ur ON ur.user_id = u.id
	LEFT JOIN roles r ON r.id = ur.role_id AND r.tenant_id = u.tenant_id
	WHERE u.id = $1::uuid
	  AND u.tenant_id = $2::uuid
	  AND u.status = 'active'
`

type authorizationContextRecord struct {
	Username    string
	Roles       []string
	Permissions []string
	Snapshot    AuthorizationContextSnapshot
}

func loadAuthorizationContext(ctx context.Context, db *sql.DB, tenantID, userID string) (authorizationContextRecord, error) {
	if db == nil {
		return authorizationContextRecord{}, nil
	}
	rows, err := db.QueryContext(ctx, authorizationContextQuery, userID, tenantID)
	if err != nil {
		return authorizationContextRecord{}, err
	}
	defer rows.Close()

	permissionSet := make(map[string]struct{})
	roleSet := make(map[string]struct{})
	username := ""
	for rows.Next() {
		var (
			rowUsername    string
			rowRoleName    string
			rawPermissions []byte
		)
		if err := rows.Scan(&rowUsername, &rowRoleName, &rawPermissions); err != nil {
			return authorizationContextRecord{}, err
		}
		if username == "" {
			username = strings.TrimSpace(rowUsername)
		}
		if trimmedRole := strings.TrimSpace(rowRoleName); trimmedRole != "" {
			roleSet[trimmedRole] = struct{}{}
		}
		permissions, err := parsePermissions(rawPermissions)
		if err != nil {
			return authorizationContextRecord{}, err
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
		return authorizationContextRecord{}, err
	}

	permissions := make([]string, 0, len(permissionSet))
	for permission := range permissionSet {
		permissions = append(permissions, permission)
	}
	sort.Strings(permissions)

	roles := make([]string, 0, len(roleSet))
	for role := range roleSet {
		roles = append(roles, role)
	}
	sort.Strings(roles)

	capabilityAliases, permissionScopes, explicitLegacyMappings, err := loadLegacyPermissionMappings(ctx, db)
	if err != nil {
		return authorizationContextRecord{}, err
	}
	authzEpoch, err := loadUserAuthzEpoch(ctx, db, tenantID, userID)
	if err != nil {
		return authorizationContextRecord{}, err
	}

	snapshot := BuildAuthorizationContextWithOptions(
		username,
		roles,
		permissions,
		AuthorizationContextOptions{
			CapabilityAliases:         capabilityAliases,
			PermissionScopes:          permissionScopes,
			UseExplicitLegacyMappings: explicitLegacyMappings,
			AuthzEpoch:                authzEpoch,
		},
	)
	policy, err := lookupReservedSubjectPolicy(ctx, db, tenantID, username)
	if err != nil {
		return authorizationContextRecord{}, err
	}
	snapshot = applyReservedSubjectPolicy(snapshot, policy)

	return authorizationContextRecord{
		Username:    strings.TrimSpace(username),
		Roles:       roles,
		Permissions: permissions,
		Snapshot:    snapshot,
	}, nil
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
		if hasAuthorizationValue(permissions, required) {
			c.Next()
			return
		}
		writeAuthorizationError(c, http.StatusForbidden, "FORBIDDEN", "insufficient permissions")
	}
}

func RequireCapability(capability string) gin.HandlerFunc {
	required := strings.TrimSpace(capability)
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

		capabilitiesValue, _ := c.Get(string(contextKeyUserCapabilities))
		capabilities, _ := capabilitiesValue.([]string)
		if hasAuthorizationValue(capabilities, required) {
			c.Next()
			return
		}
		writeAuthorizationError(c, http.StatusForbidden, "FORBIDDEN", "insufficient capabilities")
	}
}

func hasAuthorizationValue(values []string, required string) bool {
	for _, value := range values {
		if value == "*" || value == required {
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
