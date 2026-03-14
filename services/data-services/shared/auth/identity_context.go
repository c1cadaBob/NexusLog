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
	if c == nil {
		return nil
	}
	value, ok := c.Get(string(contextKeyUserPermissions))
	if !ok {
		return nil
	}
	permissions, ok := value.([]string)
	if !ok {
		return nil
	}
	result := make([]string, 0, len(permissions))
	for _, permission := range permissions {
		trimmed := strings.TrimSpace(permission)
		if trimmed == "" {
			continue
		}
		result = append(result, trimmed)
	}
	return result
}
