package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	log.Println("NexusLog Collector Agent 启动中...")

	// 等待退出信号，优雅关闭
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	<-ctx.Done()
	fmt.Println("Collector Agent 已停止")
	os.Exit(0)
}
