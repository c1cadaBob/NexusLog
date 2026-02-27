package main

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nexuslog/data-services/shared/server"
)

func main() {
	cfg := server.Config{
		Name: "query-api",
		Port: server.GetEnv("HTTP_PORT", "8082"),
	}

	server.Run(cfg, func(r *gin.Engine) {
		v1 := r.Group("/api/v1/query")
		{
			// 日志查询端点（占位）
			v1.POST("/logs", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{
					"service": "query-api",
					"message": "日志查询端点（待实现）",
					"time":    time.Now().UTC().Format(time.RFC3339),
				})
			})
		}
	})
}
