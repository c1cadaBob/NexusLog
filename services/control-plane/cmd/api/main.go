package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"

	"github.com/nexuslog/control-plane/internal/ingest"
)

func main() {
	httpPort := getEnv("HTTP_PORT", "8080")
	grpcPort := getEnv("GRPC_PORT", "9090")

	// HTTP server (Gin)
	router := gin.Default()
	router.Use(gin.Recovery())

	// ingest 仓储默认使用 PostgreSQL；连接失败时可按配置降级为内存模式。
	backendMode := strings.ToLower(strings.TrimSpace(getEnv("INGEST_STORE_BACKEND", "postgres")))
	allowMemoryFallback := strings.EqualFold(getEnv("INGEST_STORE_ALLOW_FALLBACK", "true"), "true")
	var (
		pgDB      *sql.DB
		pgBackend *ingest.PGBackend
	)
	if backendMode == "postgres" {
		db, err := newPostgresDBFromEnv()
		if err != nil {
			if allowMemoryFallback {
				log.Printf("ingest postgres init failed, fallback to memory: %v", err)
			} else {
				log.Fatalf("ingest postgres init failed: %v", err)
			}
		} else {
			pgDB = db
			defer pgDB.Close()
			pgBackend = ingest.NewPGBackend(pgDB, ingest.PGOptions{
				DefaultTenantID: getEnv("INGEST_DEFAULT_TENANT_ID", ""),
			})
			log.Printf("ingest store backend: postgres")
		}
	} else {
		log.Printf("ingest store backend: memory")
	}

	var (
		pullSourceStore  *ingest.PullSourceStore
		pullTaskStore    *ingest.PullTaskStore
		pullPackageStore *ingest.PullPackageStore
		receiptStore     *ingest.ReceiptStore
		deadLetterStore  *ingest.DeadLetterStore
		pullBatchStore   *ingest.PullBatchStore
		pullCursorStore  *ingest.PullCursorStore
		authKeyStore     *ingest.AgentAuthKeyStore
	)
	if pgBackend != nil {
		pullSourceStore = ingest.NewPullSourceStoreWithPG(pgBackend)
		pullTaskStore = ingest.NewPullTaskStoreWithPG(pgBackend)
		pullPackageStore = ingest.NewPullPackageStoreWithPG(pgBackend)
		receiptStore = ingest.NewReceiptStoreWithPG(pgBackend)
		deadLetterStore = ingest.NewDeadLetterStoreWithPG(pgBackend)
		pullBatchStore = ingest.NewPullBatchStoreWithPG(pgBackend)
		pullCursorStore = ingest.NewPullCursorStoreWithPG(pgBackend)
		authKeyStore = ingest.NewAgentAuthKeyStoreWithPG(pgBackend)
	} else {
		pullSourceStore = ingest.NewPullSourceStore()
		pullTaskStore = ingest.NewPullTaskStore()
		pullPackageStore = ingest.NewPullPackageStore()
		receiptStore = ingest.NewReceiptStore()
		deadLetterStore = ingest.NewDeadLetterStore()
		pullBatchStore = ingest.NewPullBatchStore()
		pullCursorStore = ingest.NewPullCursorStore()
		authKeyStore = ingest.NewAgentAuthKeyStore()
	}

	// 执行引擎：run-task 异步触发 pull -> ES -> ack/nack -> dead-letter 主链路。
	if isTruthy(getEnv("INGEST_EXECUTOR_ENABLED", "true")) {
		agentClient := ingest.NewAgentClient(time.Duration(parseEnvInt("INGEST_AGENT_TIMEOUT_SEC", 15)) * time.Second)
		esSink := ingest.NewESSink(
			getEnv("INGEST_ES_ENDPOINT", getEnv("ELASTICSEARCH_URL", "http://localhost:9200")),
			getEnv("INGEST_ES_INDEX", "logs-remote"),
			getEnv("INGEST_ES_USERNAME", ""),
			getEnv("INGEST_ES_PASSWORD", ""),
			time.Duration(parseEnvInt("INGEST_ES_TIMEOUT_SEC", 15))*time.Second,
		)
		executor := ingest.NewPullTaskExecutor(
			pullSourceStore,
			pullTaskStore,
			pullPackageStore,
			receiptStore,
			deadLetterStore,
			pullBatchStore,
			pullCursorStore,
			authKeyStore,
			agentClient,
			esSink,
			ingest.PullTaskExecutorConfig{
				MaxRetries:        parseEnvInt("INGEST_EXECUTOR_MAX_RETRIES", 2),
				RetryBackoff:      time.Duration(parseEnvInt("INGEST_EXECUTOR_RETRY_BACKOFF_SEC", 3)) * time.Second,
				ExecutionTimeout:  time.Duration(parseEnvInt("INGEST_EXECUTOR_TIMEOUT_SEC", 120)) * time.Second,
				DefaultAgentKeyID: getEnv("INGEST_AGENT_API_KEY_ID", getEnv("AGENT_API_KEY_ACTIVE_ID", "active")),
				DefaultAgentKey:   getEnv("INGEST_AGENT_API_KEY", getEnv("AGENT_API_KEY_ACTIVE", "")),
			},
		)
		pullTaskStore.SetExecutor(executor.Execute)
		log.Printf("ingest executor enabled")
	} else {
		log.Printf("ingest executor disabled")
	}

	ingest.RegisterPullSourceRoutes(router, pullSourceStore)
	ingest.RegisterPullTaskRoutes(router, pullSourceStore, pullTaskStore)
	ingest.RegisterPullPackageRoutes(router, pullPackageStore)
	ingest.RegisterReceiptRoutes(router, pullPackageStore, receiptStore, deadLetterStore)
	ingest.RegisterDeadLetterRoutes(router, deadLetterStore)

	// 健康检查端点（Kubernetes 探针使用）
	router.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "control-plane",
			"time":    time.Now().UTC().Format(time.RFC3339),
		})
	})

	// API 版本化健康检查端点
	router.GET("/api/v1/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "control-plane",
			"time":    time.Now().UTC().Format(time.RFC3339),
		})
	})

	httpServer := &http.Server{
		Addr:              ":" + httpPort,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
	}

	// gRPC server
	grpcServer := grpc.NewServer()
	healthServer := health.NewServer()
	healthpb.RegisterHealthServer(grpcServer, healthServer)
	healthServer.SetServingStatus("control-plane", healthpb.HealthCheckResponse_SERVING)

	// Start gRPC server
	go func() {
		lis, err := net.Listen("tcp", ":"+grpcPort)
		if err != nil {
			log.Fatalf("gRPC listen error: %v", err)
		}
		log.Printf("gRPC server listening on :%s", grpcPort)
		if err := grpcServer.Serve(lis); err != nil {
			log.Fatalf("gRPC serve error: %v", err)
		}
	}()

	// Start HTTP server
	go func() {
		log.Printf("HTTP server listening on :%s", httpPort)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP serve error: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down servers...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	grpcServer.GracefulStop()
	if err := httpServer.Shutdown(ctx); err != nil {
		log.Printf("HTTP server shutdown error: %v", err)
	}

	fmt.Println("Servers stopped")
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func parseEnvInt(key string, fallback int) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return parsed
}

func isTruthy(raw string) bool {
	value := strings.ToLower(strings.TrimSpace(raw))
	return value == "1" || value == "true" || value == "yes" || value == "on"
}

func newPostgresDBFromEnv() (*sql.DB, error) {
	if dsn := getEnv("DB_DSN", getEnv("DATABASE_URL", "")); dsn != "" {
		return openAndPing(dsn)
	}

	host := getEnv("DATABASE_POSTGRESQL_HOST", "localhost")
	port := getEnv("DATABASE_POSTGRESQL_PORT", "5432")
	dbname := getEnv("DATABASE_POSTGRESQL_DBNAME", "nexuslog")
	user := getEnv("DATABASE_POSTGRESQL_USER", "nexuslog")
	password := getEnv("DATABASE_POSTGRESQL_PASSWORD", "nexuslog_dev")
	sslmode := getEnv("DATABASE_POSTGRESQL_SSLMODE", "disable")

	dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s", user, password, host, port, dbname, sslmode)
	return openAndPing(dsn)
}

func openAndPing(dsn string) (*sql.DB, error) {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, err
	}
	return db, nil
}
