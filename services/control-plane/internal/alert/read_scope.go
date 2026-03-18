package alert

import (
	"context"
	"database/sql"

	cpMiddleware "github.com/nexuslog/control-plane/internal/middleware"
)

func resolveReadScope(ctx context.Context, db *sql.DB, tenantID, actorID string) (cpMiddleware.TenantReadScope, error) {
	return cpMiddleware.ResolveTenantReadScope(
		ctx,
		tenantID,
		actorID,
		cpMiddleware.GlobalTenantReadAccessResolverFunc(func(ctx context.Context, tenantID, userID string) (bool, error) {
			return cpMiddleware.HasGlobalTenantReadAccess(ctx, db, tenantID, userID)
		}),
	)
}
