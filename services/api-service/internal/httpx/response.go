package httpx

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/nexuslog/api-service/internal/model"
)

const requestIDHeader = "X-Request-ID"

// RequestID returns request id from context/header or generates a fallback id.
func RequestID(c *gin.Context) string {
	if v, ok := c.Get("request_id"); ok {
		if rid, ok := v.(string); ok && rid != "" {
			return rid
		}
	}

	rid := c.GetHeader(requestIDHeader)
	if rid == "" {
		rid = generateRequestID()
	}

	c.Set("request_id", rid)
	c.Header(requestIDHeader, rid)
	return rid
}

// Success writes unified success response.
func Success(c *gin.Context, status int, data any) {
	c.JSON(status, gin.H{
		"code":       "OK",
		"message":    "success",
		"request_id": RequestID(c),
		"data":       data,
		"meta":       gin.H{},
	})
}

// Error writes unified error response.
func Error(c *gin.Context, apiErr *model.APIError) {
	if apiErr == nil {
		apiErr = &model.APIError{
			HTTPStatus: http.StatusInternalServerError,
			Code:       "AUTH_REGISTER_INTERNAL_ERROR",
			Message:    "internal error",
		}
	}

	resp := gin.H{
		"code":       apiErr.Code,
		"message":    apiErr.Message,
		"request_id": RequestID(c),
	}
	if len(apiErr.Details) > 0 {
		resp["details"] = apiErr.Details
	}

	c.JSON(apiErr.HTTPStatus, resp)
}

func generateRequestID() string {
	buf := make([]byte, 6)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("api-%d", time.Now().UnixNano())
	}
	return fmt.Sprintf("api-%d-%s", time.Now().Unix(), hex.EncodeToString(buf))
}
