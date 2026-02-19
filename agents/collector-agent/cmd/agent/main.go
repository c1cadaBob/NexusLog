package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("Starting NexusLog Collector Agent...")

	configPath := getEnv("CONFIG_PATH", "./configs/agent.yaml")
	log.Printf("Loading config from: %s", configPath)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-quit
		log.Println("Received shutdown signal, stopping agent...")
		cancel()
	}()

	// TODO: 初始化采集管道
	// TODO: 初始化 checkpoint 管理
	// TODO: 启动采集器
	// TODO: 启动 gRPC/WASM 插件系统

	<-ctx.Done()
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	_ = shutdownCtx

	fmt.Println("Collector Agent stopped")
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
