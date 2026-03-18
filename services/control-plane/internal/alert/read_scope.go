package alert

import (
	"context"
	"database/sql"
	"strings"

	cpMiddleware "github.com/nexuslog/control-plane/internal/middleware"
)

// ReadScope expresses whether a read should stay tenant-scoped or explicitly span all authorized tenants.
type ReadScope struct {
	TenantID string
	Global   bool
}

func resolveReadScope(ctx context.Context, db *sql.DB, tenantID, actorID string) (ReadScope, error) {
	scope := ReadScope{TenantID: strings.TrimSpace(tenantID)}
	if scope.TenantID == "" || strings.TrimSpace(actorID) == "" {
		return scope, nil
	}
	allowed, err := cpMiddleware.HasGlobalTenantReadAccess(ctx, db, scope.TenantID, actorID)
	if err != nil {
		return ReadScope{}, err
	}
	if allowed {
		scope.Global = true
	}
	return scope, nil
}
