package handler

import (
	"strings"

	"github.com/gin-gonic/gin"
)

func authenticatedTenantID(c *gin.Context) string {
	if c == nil {
		return ""
	}
	return strings.TrimSpace(c.GetString(contextKeyTenantID))
}

func authenticatedUserID(c *gin.Context) string {
	if c == nil {
		return ""
	}
	return strings.TrimSpace(c.GetString(contextKeyUserID))
}

func authenticatedPermissions(c *gin.Context) []string {
	return authenticatedStringSlice(c, contextKeyUserPermissions)
}

func authenticatedCapabilities(c *gin.Context) []string {
	return authenticatedStringSlice(c, contextKeyUserCapabilities)
}

func authenticatedScopes(c *gin.Context) []string {
	return authenticatedStringSlice(c, contextKeyUserScopes)
}

func authenticatedEntitlements(c *gin.Context) []string {
	return authenticatedStringSlice(c, contextKeyUserEntitlements)
}

func authenticatedFeatureFlags(c *gin.Context) []string {
	return authenticatedStringSlice(c, contextKeyUserFeatureFlags)
}

func authenticatedAuthzEpoch(c *gin.Context) int64 {
	if c == nil {
		return 0
	}
	value, exists := c.Get(contextKeyUserAuthzEpoch)
	if !exists {
		return 0
	}
	if epoch, ok := value.(int64); ok {
		return epoch
	}
	return 0
}

func authenticatedActorFlags(c *gin.Context) map[string]bool {
	if c == nil {
		return map[string]bool{}
	}
	value, exists := c.Get(contextKeyUserActorFlags)
	if !exists {
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

func hasAuthenticatedAuthorizationSnapshot(c *gin.Context) bool {
	return isAuthorizationReady(c)
}

func authenticatedStringSlice(c *gin.Context, key string) []string {
	if c == nil {
		return []string{}
	}
	value, exists := c.Get(key)
	if !exists {
		return []string{}
	}
	items, ok := value.([]string)
	if !ok {
		return []string{}
	}
	copied := make([]string, len(items))
	copy(copied, items)
	return copied
}
