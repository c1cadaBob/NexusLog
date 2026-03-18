package service

import (
	"sort"
	"strings"

	"github.com/nexuslog/api-service/internal/model"
)

const defaultAuthzEpoch int64 = 1

var allAuthorizationScopes = []string{"system", "all_tenants", "tenant_group", "tenant", "owned", "resource", "self"}

var legacyPermissionCapabilityAliases = map[string][]string{
	"users:read": {
		"iam.role.read",
		"iam.user.read",
	},
	"users:write": {
		"iam.user.create",
		"iam.user.delete",
		"iam.user.grant_role",
		"iam.user.revoke_role",
		"iam.user.update_profile",
		"iam.user.update_status",
	},
	"logs:read": {
		"log.query.aggregate",
		"log.query.read",
		"query.history.read",
		"query.saved.read",
	},
	"logs:export": {
		"export.job.create",
		"export.job.download",
		"export.job.read",
	},
	"alerts:read": {
		"alert.event.read",
		"alert.rule.read",
		"alert.silence.read",
		"notification.channel.read_metadata",
	},
	"alerts:write": {
		"alert.rule.create",
		"alert.rule.delete",
		"alert.rule.disable",
		"alert.rule.enable",
		"alert.rule.update",
		"alert.silence.create",
		"alert.silence.delete",
		"alert.silence.update",
		"notification.channel.create",
		"notification.channel.delete",
		"notification.channel.test",
		"notification.channel.update",
	},
	"incidents:read": {
		"incident.analysis.read",
		"incident.archive.read",
		"incident.read",
		"incident.sla.read",
		"incident.timeline.read",
	},
	"incidents:write": {
		"incident.archive",
		"incident.assign",
		"incident.close",
		"incident.create",
		"incident.update",
	},
	"metrics:read": {
		"metric.read",
		"ops.health.read",
		"storage.capacity.read",
	},
	"dashboards:read": {
		"dashboard.read",
		"report.read",
	},
	"audit:read": {
		"audit.log.read",
	},
	"audit:write": {
		"audit.log.write_system",
	},
}

var legacyPermissionScopes = map[string][]string{
	"users:read":      {"tenant"},
	"users:write":     {"tenant"},
	"logs:read":       {"tenant", "owned"},
	"logs:export":     {"tenant", "owned"},
	"alerts:read":     {"tenant"},
	"alerts:write":    {"tenant"},
	"incidents:read":  {"tenant", "resource"},
	"incidents:write": {"tenant", "resource"},
	"metrics:read":    {"tenant"},
	"dashboards:read": {"tenant"},
	"audit:read":      {"tenant"},
	"audit:write":     {"system"},
}

type AuthorizationContextSnapshot struct {
	Capabilities []string
	Scopes       []string
	Entitlements []string
	FeatureFlags []string
	AuthzEpoch   int64
	ActorFlags   map[string]bool
}

func BuildAuthorizationContext(username string, roleNames []string, permissions []string) AuthorizationContextSnapshot {
	return buildAuthorizationContextFromRoleNames(username, roleNames, permissions)
}

func buildAuthorizationContext(username string, roles []model.RoleData, permissions []string) AuthorizationContextSnapshot {
	roleNames := make([]string, 0, len(roles))
	for _, role := range roles {
		roleNames = append(roleNames, role.Name)
	}
	return buildAuthorizationContextFromRoleNames(username, roleNames, permissions)
}

func buildAuthorizationContextFromRoleNames(username string, roleNames []string, permissions []string) AuthorizationContextSnapshot {
	capabilitySet := make(map[string]struct{})
	scopeSet := make(map[string]struct{})
	actorFlags := map[string]bool{
		"reserved":                  false,
		"interactive_login_allowed": true,
		"system_subject":            false,
	}

	username = strings.TrimSpace(username)
	isSuperAdminSubject := strings.EqualFold(username, reservedUsernameSuperAdmin)
	isSystemAutomationSubject := strings.EqualFold(username, reservedUsernameSystemAutomation)
	if isReservedUsername(username) {
		actorFlags["reserved"] = true
	}
	if isSystemAutomationSubject {
		actorFlags["interactive_login_allowed"] = false
		actorFlags["system_subject"] = true
	}

	hasWildcard := false
	for _, permission := range permissions {
		normalizedPermission := strings.TrimSpace(permission)
		if normalizedPermission == "" {
			continue
		}
		if normalizedPermission == "*" {
			hasWildcard = true
			continue
		}
		for _, capability := range legacyPermissionCapabilityAliases[normalizedPermission] {
			capabilitySet[capability] = struct{}{}
		}
		for _, scope := range legacyPermissionScopes[normalizedPermission] {
			scopeSet[scope] = struct{}{}
		}
		if isAuthorizationScopeName(normalizedPermission) {
			scopeSet[normalizedPermission] = struct{}{}
			continue
		}
		if isDirectCapabilityPermission(normalizedPermission) {
			capabilitySet[normalizedPermission] = struct{}{}
		}
	}

	for _, roleName := range roleNames {
		normalizedRoleName := strings.TrimSpace(roleName)
		if normalizedRoleName == "" {
			continue
		}
		if isProtectedRoleName(normalizedRoleName) {
			actorFlags["reserved"] = true
		}
		if strings.EqualFold(normalizedRoleName, protectedRoleNameSystemAutomation) {
			actorFlags["interactive_login_allowed"] = false
			actorFlags["system_subject"] = true
		}
		if strings.EqualFold(normalizedRoleName, protectedRoleNameSuperAdmin) {
			isSuperAdminSubject = true
		}
	}

	if hasWildcard {
		capabilitySet = map[string]struct{}{"*": {}}
		for _, scope := range allAuthorizationScopes {
			scopeSet[scope] = struct{}{}
		}
	} else {
		if len(capabilitySet) > 0 && len(scopeSet) == 0 {
			scopeSet["tenant"] = struct{}{}
		}
		if isSuperAdminSubject {
			for _, scope := range allAuthorizationScopes {
				scopeSet[scope] = struct{}{}
			}
		}
	}

	if actorFlags["system_subject"] {
		scopeSet["system"] = struct{}{}
		scopeSet["tenant"] = struct{}{}
	}

	return AuthorizationContextSnapshot{
		Capabilities: sortedStringSet(capabilitySet),
		Scopes:       sortedStringSet(scopeSet),
		Entitlements: []string{},
		FeatureFlags: []string{},
		AuthzEpoch:   defaultAuthzEpoch,
		ActorFlags:   actorFlags,
	}
}

func isAuthorizationScopeName(value string) bool {
	trimmed := strings.TrimSpace(value)
	for _, scope := range allAuthorizationScopes {
		if trimmed == scope {
			return true
		}
	}
	return false
}

func isDirectCapabilityPermission(value string) bool {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" || strings.Contains(trimmed, ":") {
		return false
	}
	return strings.Contains(trimmed, ".")
}

func sortedStringSet(values map[string]struct{}) []string {
	if len(values) == 0 {
		return []string{}
	}
	items := make([]string, 0, len(values))
	for value := range values {
		items = append(items, value)
	}
	sort.Strings(items)
	return items
}
