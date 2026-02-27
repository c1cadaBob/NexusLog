// NexusLog Collector Agent 入口
// 日志采集代理，支持插件化架构（gRPC + WASM）、
// checkpoint 断点续传（at-least-once 语义）、
// 指数退避重试和本地磁盘缓存、Kafka Producer 发送
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

	"github.com/nexuslog/collector-agent/internal/checkpoint"
	"github.com/nexuslog/collector-agent/internal/collector"
	"github.com/nexuslog/collector-agent/internal/pipeline"
	"github.com/nexuslog/collector-agent/internal/retry"
	"github.com/nexuslog/collector-agent/plugins"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("启动 NexusLog Collector Agent...")

	configPath := getEnv("CONFIG_PATH", "./configs/agent.yaml")
	log.Printf("加载配置: %s", configPath)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 1. 初始化 checkpoint 存储（at-least-once 语义保证）
	ckpDir := getEnv("CHECKPOINT_DIR", "/var/lib/collector-agent/checkpoints")
	ckpStore, err := checkpoint.NewFileStore(ckpDir)
	if err != nil {
		log.Fatalf("初始化 checkpoint 存储失败: %v", err)
	}
	defer ckpStore.Close()
	log.Println("Checkpoint 存储已初始化")

	// 2. 初始化插件注册表（gRPC + WASM 插件系统）
	registry := plugins.NewRegistry()
	// TODO: 根据配置文件加载 gRPC/WASM 插件
	// 示例:
	//   grpcPlugin := grpcplugin.New("example-grpc", "localhost:9091")
	//   grpcPlugin.Init(map[string]string{"addr": "localhost:9091"})
	//   registry.Register(grpcPlugin)
	log.Println("插件注册表已初始化")

	// 3. 初始化 Kafka Producer
	kafkaBrokers := getEnv("KAFKA_BROKERS", "localhost:9092")
	kafkaTopic := getEnv("KAFKA_TOPIC", "nexuslog-raw-logs")
	producer, err := pipeline.NewKafkaProducer(pipeline.KafkaConfig{
		Brokers:     []string{kafkaBrokers},
		Topic:       kafkaTopic,
		Compression: "snappy",
		BatchSize:   500,
	})
	if err != nil {
		log.Fatalf("初始化 Kafka Producer 失败: %v", err)
	}
	log.Println("Kafka Producer 已初始化")

	// 4. 初始化采集器
	coll := collector.New(collector.Config{
		Sources: []collector.SourceConfig{
			{Type: collector.SourceTypeFile, Paths: []string{"/var/log/*.log"}},
		},
		BatchSize:     1000,
		FlushInterval: 5 * time.Second,
		BufferSize:    10000,
	}, ckpStore)

	// 5. 初始化处理管道
	pipe, err := pipeline.New(pipeline.Config{
		Workers:     4,
		Topic:       kafkaTopic,
		CacheDir:    getEnv("CACHE_DIR", "/var/lib/collector-agent/cache"),
		RetryConfig: retry.DefaultConfig(),
	}, registry, producer, ckpStore)
	if err != nil {
		log.Fatalf("初始化处理管道失败: %v", err)
	}

	// 6. 启动采集器和管道
	if err := coll.Start(ctx); err != nil {
		log.Fatalf("启动采集器失败: %v", err)
	}
	pipe.Start(ctx, coll.Output())
	log.Println("采集管道已启动")

	// 7. 启动健康检查 HTTP 端点
	httpPort := getEnv("HTTP_PORT", "9091")
	httpServer := startHealthServer(httpPort)

	// 优雅关闭
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("收到关闭信号，正在停止...")

	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Printf("HTTP 服务关闭错误: %v", err)
	}

	pipe.Wait()
	if err := pipe.Close(); err != nil {
		log.Printf("管道关闭错误: %v", err)
	}

	fmt.Println("Collector Agent 已停止")
}

// startHealthServer 启动健康检查 HTTP 服务
func startHealthServer(port string) *http.Server {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"healthy","service":"collector-agent","time":"%s"}`,
			time.Now().UTC().Format(time.RFC3339))
	})

	mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"ready","service":"collector-agent","time":"%s"}`,
			time.Now().UTC().Format(time.RFC3339))
	})

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("健康检查 HTTP 服务监听端口 :%s", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("HTTP 服务启动失败: %v", err)
		}
	}()

	return server
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
