package server

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nexuslog/data-services/shared/response"
)

// Config 服务配置
type Config struct {
	Name string // 服务名称
	Port string // 监听端口
}

// Run 启动 HTTP 服务并注册健康检查端点，支持优雅关闭
// setupRoutes 回调用于注册业务路由
func Run(cfg Config, setupRoutes func(r *gin.Engine)) {
	router := gin.Default()
	router.Use(gin.Recovery())

	// 注册健康检查端点
	router.GET("/healthz", response.HealthHandler(cfg.Name))
	router.GET("/readyz", response.ReadyHandler(cfg.Name))
	router.GET("/metrics", func(c *gin.Context) {
		c.Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
		c.String(
			http.StatusOK,
			"# HELP nexuslog_service_up Whether the service is up.\n"+
				"# TYPE nexuslog_service_up gauge\n"+
				fmt.Sprintf("nexuslog_service_up{service=%q} 1\n", cfg.Name),
		)
	})

	// 注册业务路由
	if setupRoutes != nil {
		setupRoutes(router)
	}

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("[%s] HTTP 服务监听端口 :%s", cfg.Name, cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[%s] HTTP 服务启动失败: %v", cfg.Name, err)
		}
	}()

	// 优雅关闭
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Printf("[%s] 正在关闭服务...", cfg.Name)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("[%s] HTTP 服务关闭错误: %v", cfg.Name, err)
	}

	fmt.Printf("[%s] 服务已停止\n", cfg.Name)
}

// GetEnv 获取环境变量，不存在时返回默认值
func GetEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
