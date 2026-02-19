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
	log.Println("Starting health-worker service...")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start health check scheduler
	go runScheduler(ctx)

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down health-worker...")
	cancel()
	time.Sleep(2 * time.Second)
	fmt.Println("Health-worker stopped")
}

func runScheduler(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			log.Println("Running health checks...")
			// TODO: implement health check logic
		}
	}
}
