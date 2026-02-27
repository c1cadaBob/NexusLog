package main

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nexuslog/data-services/shared/server"
)

func main() {
	cfg := server.Config{
		Name: "export-api",
		Port: server.GetEnv("HTTP_PORT", "8084"),
	}

	server.Run(cfg, func(r *gin.Engine) {
		v1 := r.Group("/api/v1/export")
		{
			// 数据导出端点（占位）
			v1.POST("/jobs", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{
					"service": "export-api",
					"message": "数据导出端点（待实现）",
					"time":    time.Now().UTC().Format(time.RFC3339),
				})
			})
		}
	})
}
