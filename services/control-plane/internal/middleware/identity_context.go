package middleware

import (
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
