package main

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
	"github.com/nexuslog/health-worker/internal/checker"
	"github.com/nexuslog/health-worker/internal/reporter"
	"github.com/nexuslog/health-worker/internal/scheduler"
)

func main() {
	httpPort := getEnv("HTTP_PORT", "8081")
	checkInterval := getEnv("CHECK_INTERVAL", "30s")

	interval, err := time.ParseDuration(checkInterval)
	if err != nil {
		log.Fatalf("无效的检查间隔: %v", err)
	}

	// 初始化核心组件
	chk := checker.New()
	rpt := reporter.New()
	sched := scheduler.New(chk, rpt, interval)

	// HTTP 服务（Gin）
	router := gin.Default()
	router.Use(gin.Recovery())

	// 健康检查端点（Kubernetes 探针使用）
	router.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "health-worker",
			"time":    time.Now().UTC().Format(time.RFC3339),
		})
	})

	// 就绪检查端点
	router.GET("/readyz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ready",
			"service": "health-worker",
			"time":    time.Now().UTC().Format(time.RFC3339),
		})
	})

	// 检查结果查询端点
	router.GET("/api/v1/health/status", func(c *gin.Context) {
		results := sched.LatestResults()
		c.JSON(http.StatusOK, gin.H{
			"service": "health-worker",
			"results": results,
			"time":    time.Now().UTC().Format(time.RFC3339),
		})
	})

	httpServer := &http.Server{
		Addr:              ":" + httpPort,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
	}

	// 启动调度器
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	sched.Start(ctx)
	log.Printf("健康检查调度器已启动，检查间隔: %s", interval)

	// 启动 HTTP 服务
	go func() {
		log.Printf("HTTP 服务监听端口 :%s", httpPort)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP 服务启动失败: %v", err)
		}
	}()

	// 优雅关闭
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("正在关闭服务...")

	cancel() // 停止调度器

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Printf("HTTP 服务关闭错误: %v", err)
	}

	fmt.Println("服务已停止")
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
