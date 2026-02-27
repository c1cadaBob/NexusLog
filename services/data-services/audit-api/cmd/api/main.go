package main

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nexuslog/data-services/shared/server"
)

func main() {
	cfg := server.Config{
		Name: "audit-api",
		Port: server.GetEnv("HTTP_PORT", "8083"),
	}

	server.Run(cfg, func(r *gin.Engine) {
		v1 := r.Group("/api/v1/audit")
		{
			// 审计日志查询端点（占位）
			v1.GET("/logs", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{
					"service": "audit-api",
					"message": "审计日志查询端点（待实现）",
					"time":    time.Now().UTC().Format(time.RFC3339),
				})
			})
		}
	})
}
