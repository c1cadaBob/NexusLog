package middleware

import (
	"context"
	"strings"

	"github.com/gin-gonic/gin"
)

// AuthenticatedTenantID returns the tenant id set by authentication middleware.
func AuthenticatedTenantID(c *gin.Context) string {
	if c == nil {
		return ""
	}
	return strings.TrimSpace(c.GetString(authContextKeyTenantID))
}

// AuthenticatedUserID returns the user id set by authentication middleware.
func AuthenticatedUserID(c *gin.Context) string {
	if c == nil {
		return ""
	}
	return strings.TrimSpace(c.GetString(authContextKeyUserID))
}

// AuthenticatedUserIDPtr returns the authenticated user id pointer when present.
func AuthenticatedUserIDPtr(c *gin.Context) *string {
	userID := AuthenticatedUserID(c)
	if userID == "" {
		return nil
	}
	return &userID
}

// AuthenticatedPermissions returns permissions loaded by the authentication middleware.
func AuthenticatedPermissions(c *gin.Context) []string {
	return authenticatedStringSlice(c, authContextKeyUserPermissions)
}

// AuthenticatedCapabilities returns capabilities loaded by the authentication middleware.
func AuthenticatedCapabilities(c *gin.Context) []string {
	return authenticatedStringSlice(c, authContextKeyUserCapabilities)
}

// AuthenticatedScopes returns scopes loaded by the authentication middleware.
func AuthenticatedScopes(c *gin.Context) []string {
	return authenticatedStringSlice(c, authContextKeyUserScopes)
}

// AuthenticatedAuthzEpoch returns authz version loaded by the authentication middleware.
func AuthenticatedAuthzEpoch(c *gin.Context) int64 {
	if c == nil {
		return 0
	}
	value, ok := c.Get(authContextKeyUserAuthzEpoch)
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
	value, ok := c.Get(authContextKeyUserActorFlags)
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

func authenticatedContextStringSlice(ctx context.Context, key string) []string {
	if ctx == nil {
		return []string{}
	}
	value := ctx.Value(key)
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
