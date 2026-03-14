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
