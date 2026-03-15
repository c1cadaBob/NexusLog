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
		"auth.session.read",
		"iam.user.read",
		"iam.role.read",
	},
	"users:write": {
		"agent.read",
		"auth.login_policy.read",
		"auth.login_policy.update",
		"backup.read",
		"data.retention.read",
		"field.dictionary.read",
		"field.mapping.read",
		"ingest.source.read",
		"integration.plugin.read",
		"integration.webhook.read_metadata",
		"iam.user.create",
		"iam.user.grant_role",
		"iam.user.revoke_role",
		"iam.user.update_profile",
		"iam.user.update_status",
		"masking.rule.read",
		"parse.rule.read",
		"settings.global.read",
		"settings.global.update",
		"settings.parameter.read",
		"settings.parameter.update",
		"settings.version.read",
		"settings.version.rollback",
		"storage.index.read",
	},
	"logs:read": {
		"analysis.anomaly.read",
		"analysis.cluster.read",
		"dashboard.read",
		"log.query.aggregate",
		"log.query.read",
		"query.history.read",
		"query.saved.read",
		"trace.analysis.read",
		"trace.read",
		"trace.topology.read",
	},
	"logs:export": {
		"log.export.read",
		"report.download.read",
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
		"incident.assign",
		"incident.comment.create",
		"incident.resolve",
		"incident.update",
	},
	"metrics:read": {
		"dr.read",
		"ingest.task.read",
		"metric.read",
		"ops.health.read",
		"ops.scaling.read",
		"storage.capacity.read",
	},
	"dashboards:read": {
		"cost.budget.read",
		"cost.optimization.read",
		"cost.read",
		"dashboard.read",
		"help.read",
		"integration.api_doc.read",
		"integration.sdk.read",
		"report.download.read",
		"report.read",
		"report.schedule.read",
	},
	"audit:read": {
		"audit.log.read",
	},
}

var legacyPermissionScopes = map[string][]string{
	"users:read":      {"tenant", "self"},
	"users:write":     {"tenant", "self"},
	"logs:read":       {"tenant", "owned"},
	"logs:export":     {"tenant", "owned"},
	"alerts:read":     {"tenant"},
	"alerts:write":    {"tenant"},
	"incidents:read":  {"tenant", "resource"},
	"incidents:write": {"tenant", "resource"},
	"metrics:read":    {"tenant"},
	"dashboards:read": {"tenant", "owned"},
	"audit:read":      {"tenant"},
}

type authorizationContextData struct {
	Capabilities []string
	Scopes       []string
	Entitlements []string
	FeatureFlags []string
	AuthzEpoch   int64
	ActorFlags   map[string]bool
}

func buildAuthorizationContext(username string, roles []model.RoleData, permissions []string) authorizationContextData {
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
	}

	for _, role := range roles {
		roleName := strings.TrimSpace(role.Name)
		if roleName == "" {
			continue
		}
		if isProtectedRoleName(roleName) {
			actorFlags["reserved"] = true
		}
		if strings.EqualFold(roleName, protectedRoleNameSystemAutomation) {
			actorFlags["interactive_login_allowed"] = false
			actorFlags["system_subject"] = true
		}
		if strings.EqualFold(roleName, protectedRoleNameSuperAdmin) {
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
			for _, scope := range []string{"system", "all_tenants", "tenant_group", "tenant", "owned", "resource", "self"} {
				scopeSet[scope] = struct{}{}
			}
		}
	}

	if actorFlags["system_subject"] {
		scopeSet["system"] = struct{}{}
		scopeSet["tenant"] = struct{}{}
	}

	return authorizationContextData{
		Capabilities: sortedStringSet(capabilitySet),
		Scopes:       sortedStringSet(scopeSet),
		Entitlements: []string{},
		FeatureFlags: []string{},
		AuthzEpoch:   defaultAuthzEpoch,
		ActorFlags:   actorFlags,
	}
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
