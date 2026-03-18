package middleware

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// RequireCapability restricts routes to subjects that hold the required capability.
func RequireCapability(capability string) gin.HandlerFunc {
	required := strings.TrimSpace(capability)
	return func(c *gin.Context) {
		if c == nil {
			return
		}
		if !isAuthorizationReady(c) {
			writeAuthorizationError(c, http.StatusServiceUnavailable, "AUTHORIZATION_UNAVAILABLE", "authorization backend unavailable")
			return
		}

		if hasAuthorizationValue(AuthenticatedCapabilities(c), required) {
			c.Next()
			return
		}
		writeAuthorizationError(c, http.StatusForbidden, "FORBIDDEN", "insufficient capabilities")
	}
}

// RequireCapabilityOrAdminRole allows exact capability or falls back to legacy admin-role authorization.
func RequireCapabilityOrAdminRole(db *sql.DB, capability string) gin.HandlerFunc {
	required := strings.TrimSpace(capability)
	return func(c *gin.Context) {
		if c == nil {
			return
		}
		if required != "" && hasTrustedCapability(c, required) {
			c.Next()
			return
		}
		if hasContextBoolean(c, authContextKeyAdminRoleGranted) || hasTrustedAdminAuthorizationSnapshot(c) {
			c.Next()
			return
		}
		if !isAuthorizationReady(c) || db == nil {
			writeAuthorizationError(c, http.StatusServiceUnavailable, "AUTHORIZATION_UNAVAILABLE", "authorization backend unavailable")
			return
		}
		tenantID := AuthenticatedTenantID(c)
		userID := AuthenticatedUserID(c)
		if tenantID == "" || userID == "" {
			writeAuthorizationError(c, http.StatusForbidden, "FORBIDDEN", "permission check failed: auth context missing")
			return
		}
		allowed, err := hasAdminRole(c.Request.Context(), db, tenantID, userID)
		if err != nil {
			writeAuthorizationError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to authorize request")
			return
		}
		if !allowed {
			writeAuthorizationError(c, http.StatusForbidden, "FORBIDDEN", "insufficient capabilities")
			return
		}
		markAdminRoleGranted(c)
		c.Next()
	}
}

// RequireCapabilityOrOperatorRole allows exact capability or falls back to legacy operator-role authorization.
func RequireCapabilityOrOperatorRole(db *sql.DB, capability string) gin.HandlerFunc {
	required := strings.TrimSpace(capability)
	return func(c *gin.Context) {
		if c == nil {
			return
		}
		if required != "" && hasTrustedCapability(c, required) {
			c.Next()
			return
		}
		if hasContextBoolean(c, authContextKeyOperatorRoleGranted) || hasTrustedOperatorAuthorizationSnapshot(c) {
			c.Next()
			return
		}
		if !isAuthorizationReady(c) || db == nil {
			writeAuthorizationError(c, http.StatusServiceUnavailable, "AUTHORIZATION_UNAVAILABLE", "authorization backend unavailable")
			return
		}
		tenantID := AuthenticatedTenantID(c)
		userID := AuthenticatedUserID(c)
		if tenantID == "" || userID == "" {
			writeAuthorizationError(c, http.StatusForbidden, "FORBIDDEN", "permission check failed: auth context missing")
			return
		}
		allowed, err := hasOperatorRole(c.Request.Context(), db, tenantID, userID)
		if err != nil {
			writeAuthorizationError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to authorize request")
			return
		}
		if !allowed {
			writeAuthorizationError(c, http.StatusForbidden, "FORBIDDEN", "insufficient capabilities")
			return
		}
		markOperatorRoleGranted(c)
		c.Next()
	}
}

func hasTrustedCapability(c *gin.Context, capability string) bool {
	if !isAuthorizationReady(c) {
		return false
	}
	return hasAuthorizationValue(AuthenticatedCapabilities(c), strings.TrimSpace(capability))
}

func hasTrustedAdminAuthorizationSnapshot(c *gin.Context) bool {
	if !isAuthorizationReady(c) {
		return false
	}
	return hasAdminAuthorizationSnapshot(c)
}

func hasTrustedOperatorAuthorizationSnapshot(c *gin.Context) bool {
	if !isAuthorizationReady(c) {
		return false
	}
	return hasOperatorAuthorizationSnapshot(c)
}

func isAuthorizationReady(c *gin.Context) bool {
	if c == nil {
		return false
	}
	ready, ok := c.Get(authContextKeyAuthorizationReady)
	if !ok {
		return false
	}
	readyBool, ok := ready.(bool)
	return ok && readyBool
}

func hasContextBoolean(c *gin.Context, key string) bool {
	if c == nil {
		return false
	}
	value, ok := c.Get(key)
	if !ok {
		return false
	}
	allowed, ok := value.(bool)
	return ok && allowed
}
