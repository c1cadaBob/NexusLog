package middleware

import (
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
		ready, ok := c.Get(authContextKeyAuthorizationReady)
		if !ok {
			writeAuthorizationError(c, http.StatusServiceUnavailable, "AUTHORIZATION_UNAVAILABLE", "authorization backend unavailable")
			return
		}
		readyBool, ok := ready.(bool)
		if !ok || !readyBool {
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
