package auth

import (
	"strings"

	"github.com/gin-gonic/gin"
)

// AuthenticatedTenantID returns the tenant id set by authentication middleware.
func AuthenticatedTenantID(c *gin.Context) string {
	if c == nil {
		return ""
	}
	return strings.TrimSpace(c.GetString(string(contextKeyTenantID)))
}

// AuthenticatedUserID returns the user id set by authentication middleware.
func AuthenticatedUserID(c *gin.Context) string {
	if c == nil {
		return ""
	}
	return strings.TrimSpace(c.GetString(string(contextKeyUserID)))
}

// AuthenticatedPermissions returns permissions loaded by the authentication middleware.
func AuthenticatedPermissions(c *gin.Context) []string {
	return authenticatedStringSlice(c, string(contextKeyUserPermissions))
}

// AuthenticatedCapabilities returns capabilities loaded by the authentication middleware.
func AuthenticatedCapabilities(c *gin.Context) []string {
	return authenticatedStringSlice(c, string(contextKeyUserCapabilities))
}

// AuthenticatedScopes returns scopes loaded by the authentication middleware.
func AuthenticatedScopes(c *gin.Context) []string {
	return authenticatedStringSlice(c, string(contextKeyUserScopes))
}

// AuthenticatedEntitlements returns entitlements loaded by the authentication middleware.
func AuthenticatedEntitlements(c *gin.Context) []string {
	return authenticatedStringSlice(c, string(contextKeyUserEntitlements))
}

// AuthenticatedFeatureFlags returns feature flags loaded by the authentication middleware.
func AuthenticatedFeatureFlags(c *gin.Context) []string {
	return authenticatedStringSlice(c, string(contextKeyUserFeatureFlags))
}

// AuthenticatedAuthzEpoch returns authz version loaded by the authentication middleware.
func AuthenticatedAuthzEpoch(c *gin.Context) int64 {
	if c == nil {
		return 0
	}
	value, ok := c.Get(string(contextKeyUserAuthzEpoch))
	if !ok {
		return 0
	}
	epoch, ok := value.(int64)
	if !ok {
		return 0
	}
	return epoch
}

// AuthenticatedActorFlags returns actor governance flags.
func AuthenticatedActorFlags(c *gin.Context) map[string]bool {
	if c == nil {
		return map[string]bool{}
	}
	value, ok := c.Get(string(contextKeyUserActorFlags))
	if !ok {
		return map[string]bool{}
	}
	flags, ok := value.(map[string]bool)
	if !ok {
		return map[string]bool{}
	}
	copied := make(map[string]bool, len(flags))
	for key, enabled := range flags {
		copied[key] = enabled
	}
	return copied
}

func authenticatedStringSlice(c *gin.Context, key string) []string {
	if c == nil {
		return []string{}
	}
	value, ok := c.Get(key)
	if !ok {
		return []string{}
	}
	items, ok := value.([]string)
	if !ok {
		return []string{}
	}
	result := make([]string, 0, len(items))
	for _, item := range items {
		trimmed := strings.TrimSpace(item)
		if trimmed == "" {
			continue
		}
		result = append(result, trimmed)
	}
	return result
}
