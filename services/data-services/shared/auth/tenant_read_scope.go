package auth

import (
	"strings"

	"github.com/gin-gonic/gin"
)

// TenantReadScope represents the effective read scope for tenant-bound log and audit APIs.
type TenantReadScope string

const (
	TenantReadScopeTenant     TenantReadScope = "tenant"
	TenantReadScopeAllTenants TenantReadScope = "all_tenants"
)

// NormalizeTenantReadScope returns a supported tenant read scope value.
func NormalizeTenantReadScope(scope TenantReadScope) TenantReadScope {
	switch strings.TrimSpace(string(scope)) {
	case string(TenantReadScopeAllTenants):
		return TenantReadScopeAllTenants
	default:
		return TenantReadScopeTenant
	}
}

// ResolveTenantReadScope derives the effective tenant read scope from capabilities and scopes.
func ResolveTenantReadScope(capabilities, scopes []string) TenantReadScope {
	snapshot := AuthorizationContextSnapshot{
		Capabilities: append([]string{}, capabilities...),
		Scopes:       append([]string{}, scopes...),
	}
	if canBypassTenantScope(snapshot) {
		return TenantReadScopeAllTenants
	}
	return TenantReadScopeTenant
}

// AuthenticatedTenantReadScope returns the effective tenant read scope of the authenticated actor.
func AuthenticatedTenantReadScope(c *gin.Context) TenantReadScope {
	if c == nil {
		return TenantReadScopeTenant
	}
	return ResolveTenantReadScope(AuthenticatedCapabilities(c), AuthenticatedScopes(c))
}

// TenantReadScopeAllowsAllTenants reports whether the scope permits cross-tenant reads.
func TenantReadScopeAllowsAllTenants(scope TenantReadScope) bool {
	return NormalizeTenantReadScope(scope) == TenantReadScopeAllTenants
}
