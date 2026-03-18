package middleware

import (
	"context"
	"strings"
)

// TenantReadScope expresses whether a read stays tenant-scoped or explicitly spans all authorized tenants.
type TenantReadScope struct {
	TenantID string
	Global   bool
}

// GlobalTenantReadAccessResolver resolves whether an actor can read across all tenants.
type GlobalTenantReadAccessResolver interface {
	HasGlobalTenantReadAccess(ctx context.Context, tenantID, userID string) (bool, error)
}

// GlobalTenantReadAccessResolverFunc adapts a function into a resolver.
type GlobalTenantReadAccessResolverFunc func(ctx context.Context, tenantID, userID string) (bool, error)

func (fn GlobalTenantReadAccessResolverFunc) HasGlobalTenantReadAccess(ctx context.Context, tenantID, userID string) (bool, error) {
	if fn == nil {
		return false, nil
	}
	return fn(ctx, tenantID, userID)
}

// ResolveTenantReadScope converts tenant + actor identity into an explicit read scope.
func ResolveTenantReadScope(ctx context.Context, tenantID, userID string, resolver GlobalTenantReadAccessResolver) (TenantReadScope, error) {
	scope := TenantReadScope{TenantID: strings.TrimSpace(tenantID)}
	if scope.TenantID == "" || strings.TrimSpace(userID) == "" || resolver == nil {
		return scope, nil
	}
	allowed, err := resolver.HasGlobalTenantReadAccess(ctx, scope.TenantID, strings.TrimSpace(userID))
	if err != nil {
		return TenantReadScope{}, err
	}
	if allowed {
		scope.Global = true
	}
	return scope, nil
}
