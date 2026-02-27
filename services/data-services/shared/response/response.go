package response

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// HealthResponse 健康检查响应结构
type HealthResponse struct {
	Status  string `json:"status"`
	Service string `json:"service"`
	Time    string `json:"time"`
}

// NewHealthResponse 创建健康检查响应
func NewHealthResponse(service string) HealthResponse {
	return HealthResponse{
		Status:  "healthy",
		Service: service,
		Time:    time.Now().UTC().Format(time.RFC3339),
	}
}

// HealthHandler 返回通用健康检查 Handler
func HealthHandler(service string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, NewHealthResponse(service))
	}
}

// ReadyHandler 返回通用就绪检查 Handler
func ReadyHandler(service string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ready",
			"service": service,
			"time":    time.Now().UTC().Format(time.RFC3339),
		})
	}
}
