package auth

import (
	"errors"
	"sort"
	"strings"
)

var ErrAuthorizedTenantSetRequired = errors.New("authorized tenant scope is required")

// AuthorizedTenantSet describes the effective tenant range an actor may read.
//
// Current callers still only load `tenant` vs `all_tenants` from the auth snapshot,
// but the explicit tenant id list keeps the repository contract ready for future
// tenant-group / delegated tenant authorization facts.
type AuthorizedTenantSet struct {
	allowAll  bool
	tenantIDs []string
}

// ResolveAuthorizedTenantSet builds a fail-closed tenant authorization range.
func ResolveAuthorizedTenantSet(currentTenantID string, tenantReadScope TenantReadScope, authorizedTenantIDs []string) (AuthorizedTenantSet, error) {
	if TenantReadScopeAllowsAllTenants(tenantReadScope) {
		return AuthorizedTenantSet{allowAll: true}, nil
	}

	tenantIDs := NormalizeAuthorizedTenantIDs(authorizedTenantIDs)
	if len(tenantIDs) == 0 {
		currentTenantID = strings.TrimSpace(currentTenantID)
		if currentTenantID != "" {
			tenantIDs = []string{currentTenantID}
		}
	}
	if len(tenantIDs) == 0 {
		return AuthorizedTenantSet{}, ErrAuthorizedTenantSetRequired
	}
	return AuthorizedTenantSet{tenantIDs: tenantIDs}, nil
}

// AllowsAllTenants reports whether the actor can read across all tenants.
func (s AuthorizedTenantSet) AllowsAllTenants() bool {
	return s.allowAll
}

// TenantIDs returns the explicit authorized tenant id set.
func (s AuthorizedTenantSet) TenantIDs() []string {
	if len(s.tenantIDs) == 0 {
		return []string{}
	}
	copied := make([]string, len(s.tenantIDs))
	copy(copied, s.tenantIDs)
	return copied
}

// NormalizeAuthorizedTenantIDs trims, deduplicates, and sorts tenant ids.
func NormalizeAuthorizedTenantIDs(tenantIDs []string) []string {
	if len(tenantIDs) == 0 {
		return []string{}
	}
	unique := make(map[string]struct{}, len(tenantIDs))
	for _, tenantID := range tenantIDs {
		trimmed := strings.TrimSpace(tenantID)
		if trimmed == "" {
			continue
		}
		unique[trimmed] = struct{}{}
	}
	if len(unique) == 0 {
		return []string{}
	}
	result := make([]string, 0, len(unique))
	for tenantID := range unique {
		result = append(result, tenantID)
	}
	sort.Strings(result)
	return result
}
