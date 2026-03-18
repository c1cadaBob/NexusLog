package middleware

import (
	"context"
	"database/sql"
	"strings"
)

var globalTenantReadCapabilities = []string{
	"alert.event.read",
	"alert.rule.read",
	"alert.silence.read",
	"audit.log.read",
	"log.query.aggregate",
	"log.query.read",
	"notification.channel.read_metadata",
}

func HasGlobalTenantReadAccess(ctx context.Context, db *sql.DB, tenantID, userID string) (bool, error) {
	tenantID = strings.TrimSpace(tenantID)
	userID = strings.TrimSpace(userID)
	if tenantID == "" || userID == "" {
		return false, nil
	}
	if hasGlobalTenantReadAccessFromContext(ctx) {
		return true, nil
	}
	if hasAuthorizationReadyFromContext(ctx) {
		return false, nil
	}
	if db == nil {
		return false, nil
	}
	authzRecord, err := loadAuthorizationContext(ctx, db, tenantID, userID)
	if err != nil {
		return false, err
	}
	return hasGlobalTenantReadAccessFromSnapshot(authzRecord.Snapshot), nil
}

func hasGlobalTenantReadAccessFromContext(ctx context.Context) bool {
	return hasGlobalTenantReadAccessValues(
		authenticatedContextStringSlice(ctx, authContextKeyUserCapabilities),
		authenticatedContextStringSlice(ctx, authContextKeyUserScopes),
	)
}

func hasGlobalTenantReadAccessFromSnapshot(snapshot AuthorizationContextSnapshot) bool {
	return hasGlobalTenantReadAccessValues(snapshot.Capabilities, snapshot.Scopes)
}

func hasAuthorizationReadyFromContext(ctx context.Context) bool {
	if ctx == nil {
		return false
	}
	ready, ok := ctx.Value(authContextKeyAuthorizationReady).(bool)
	return ok && ready
}

func hasGlobalTenantReadAccessValues(capabilities, scopes []string) bool {
	if !hasAnyScope(scopes, "all_tenants", "system") {
		return false
	}
	if hasAuthorizationValue(capabilities, "*") {
		return true
	}
	return hasAnyCapability(capabilities, globalTenantReadCapabilities...)
}
