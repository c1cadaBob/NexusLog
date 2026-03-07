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

	"github.com/nexuslog/control-plane/internal/alert"
	"github.com/nexuslog/control-plane/internal/backup"
	"github.com/nexuslog/control-plane/internal/incident"
	"github.com/nexuslog/control-plane/internal/ingest"
	"github.com/nexuslog/control-plane/internal/ingestv3"
	"github.com/nexuslog/control-plane/internal/metrics"
	"github.com/nexuslog/control-plane/internal/middleware"
	"github.com/nexuslog/control-plane/internal/notification"
	"github.com/nexuslog/control-plane/internal/resource"
)

func main() {
	httpPort := getEnv("HTTP_PORT", "8080")
	grpcPort := getEnv("GRPC_PORT", "9090")

	// HTTP server (Gin)
	router := gin.Default()
	router.Use(gin.Recovery())
	legacyLogPipelineEnabled := isTruthy(getEnv("LEGACY_LOG_PIPELINE_ENABLED", "false"))

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

	if pgDB != nil {
		router.Use(middleware.AuditMiddleware(pgDB))
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

	// 后台任务统一使用可取消上下文，便于服务优雅退出。
	workerCtx, workerCancel := context.WithCancel(context.Background())
	defer workerCancel()

	// 执行引擎：run-task 异步触发 pull -> ES -> ack/nack -> dead-letter 主链路。
	executorEnabled := legacyLogPipelineEnabled && isTruthy(getEnv("INGEST_EXECUTOR_ENABLED", "true"))
	var latencyMonitor *ingest.PullLatencyMonitor
	if executorEnabled {
		latencyMonitor = ingest.NewPullLatencyMonitor(
			parseEnvInt("INGEST_LATENCY_WINDOW_SIZE", 200),
			int64(parseEnvInt("INGEST_LATENCY_ALERT_P95_MS", 3000)),
			int64(parseEnvInt("INGEST_LATENCY_ALERT_P99_MS", 5000)),
			time.Duration(parseEnvInt("INGEST_LATENCY_ALERT_COOLDOWN_SEC", 60))*time.Second,
		)
	}
	if executorEnabled {
		agentClient := ingest.NewAgentClient(time.Duration(parseEnvInt("INGEST_AGENT_TIMEOUT_SEC", 15)) * time.Second)
		esSink := ingest.NewESSink(
			getEnv("INGEST_ES_ENDPOINT", getEnv("ELASTICSEARCH_URL", "http://localhost:9200")),
			getEnv("INGEST_ES_INDEX", "nexuslog-logs-v2"),
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
				LatencyMonitor:    latencyMonitor,
			},
		)
		pullTaskStore.SetExecutor(executor.Execute)
		log.Printf("ingest executor enabled")
	} else {
		log.Printf("ingest executor disabled")
	}

	// 自动调度器：按 source.pull_interval_sec 定时创建 scheduled 任务。
	schedulerEnabled := executorEnabled && isTruthy(getEnv("INGEST_SCHEDULER_ENABLED", "true"))
	if schedulerEnabled {
		schedulerCheckIntervalSec := parseEnvInt("INGEST_SCHEDULER_CHECK_INTERVAL_SEC", 1)
		if schedulerCheckIntervalSec <= 0 {
			schedulerCheckIntervalSec = 1
		}
		schedulerPageSize := parseEnvInt("INGEST_SCHEDULER_PAGE_SIZE", 200)
		if schedulerPageSize <= 0 {
			schedulerPageSize = 200
		}
		scheduler := ingest.NewPullTaskScheduler(
			pullSourceStore,
			pullTaskStore,
			ingest.PullTaskSchedulerConfig{
				CheckInterval:           time.Duration(schedulerCheckIntervalSec) * time.Second,
				PageSize:                schedulerPageSize,
				CriticalSourcePatterns:  parseCSV(getEnv("INGEST_CRITICAL_SOURCE_PATTERNS", "")),
				CriticalPullIntervalSec: parseEnvInt("INGEST_CRITICAL_PULL_INTERVAL_SEC", 2),
			},
		)
		go scheduler.Start(workerCtx)
		log.Printf(
			"ingest scheduler enabled (check_interval_sec=%d, page_size=%d)",
			schedulerCheckIntervalSec,
			schedulerPageSize,
		)
	} else {
		log.Printf("ingest scheduler disabled")
	}

	v3CursorAdapter := &ingestv3.LegacyCursorStoreAdapter{
		Store:        pullCursorStore,
		DefaultAgent: getEnv("INGESTV3_DEFAULT_AGENT_ID", "ingestv3-rewrite"),
	}
	registerIngestV3Routes(router, v3CursorAdapter, v3CursorAdapter)

	if legacyLogPipelineEnabled {
		ingest.RegisterPullSourceRoutes(router, pullSourceStore)
		ingest.RegisterPullTaskRoutes(router, pullSourceStore, pullTaskStore)
	} else {
		log.Printf("legacy log pipeline disabled: ingest routes removed")
		registerLegacyPipelineRemovedRoutes(router)
	}

	// ES Snapshot Backup/Restore (W4-B3)
	backupSvc := backup.NewService()
	backup.RegisterRoutes(router, backup.NewHandler(backupSvc))

	// Metrics report + query API (W3-B6, W3-B8)
	if pgDB != nil {
		metricsRepo := metrics.NewRepository(pgDB)
		metricsSvc := metrics.NewService(metricsRepo)
		// Threshold evaluator for alert triggering (W3-B7)
		thresholdRepo := resource.NewThresholdRepository(pgDB)
		evaluator := resource.NewThresholdEvaluator(thresholdRepo, pgDB)
		metricsSvc.WithEvaluator(evaluator)
		metricsHandler := metrics.NewHandler(metricsSvc)
		metrics.RegisterRoutes(router, metricsHandler)
		// Background cleanup: delete metrics older than 30 days, run daily
		metrics.StartCleanupJob(workerCtx, metricsRepo, 30, 24*time.Hour)
		// Resource threshold CRUD (W3-B7)
		resource.RegisterRoutes(router, resource.NewThresholdHandler(thresholdRepo))
	}

	// Alert rules API (requires PostgreSQL)
	if pgDB != nil {
		alertRuleRepo := alert.NewRuleRepositoryPG(pgDB)
		alertRuleService := alert.NewRuleService(alertRuleRepo)
		alertRuleHandler := alert.NewRuleHandler(alertRuleService)
		alert.RegisterAlertRuleRoutes(router, alertRuleHandler)
		alert.RegisterAlertEventRoutes(router, alert.NewEventHandler(pgDB))

		// Alert silence policy (W4-B6)
		silenceSvc := alert.NewSilenceService(pgDB)
		alert.RegisterSilenceRoutes(router, alert.NewSilenceHandler(silenceSvc))

		// Incident API
		incidentRepo := incident.NewRepositoryPG(pgDB)
		incidentTimeline := incident.NewTimelineStorePG(pgDB)
		incidentService := incident.NewService(incidentRepo, incidentTimeline)
		incidentHandler := incident.NewHandler(incidentService)
		incident.RegisterIncidentRoutes(router, incidentHandler)

		// Alert evaluation engine (runs every 30s)
		if legacyLogPipelineEnabled && isTruthy(getEnv("ALERT_EVALUATOR_ENABLED", "true")) {
			esEndpoint := getEnv("INGEST_ES_ENDPOINT", getEnv("ELASTICSEARCH_URL", "http://localhost:9200"))
			esIndex := getEnv("INGEST_ES_INDEX", "nexuslog-logs-v2")
			esClient := alert.NewHTTPESSearchClient(
				esEndpoint,
				getEnv("INGEST_ES_USERNAME", ""),
				getEnv("INGEST_ES_PASSWORD", ""),
				time.Duration(parseEnvInt("INGEST_ES_TIMEOUT_SEC", 15))*time.Second,
			)
			incidentCreator := alert.NewIncidentCreator(pgDB)
			evaluator := alert.NewEvaluator(alertRuleRepo, esClient, pgDB, esIndex).
				WithIncidentCreator(incidentCreator).
				WithSilenceChecker(silenceSvc)
			go evaluator.Start()
			log.Printf("alert evaluator enabled (interval=30s)")
		}
	}

	// Notification channels (requires pgDB)
	if pgDB != nil {
		channelRepo := notification.NewChannelRepository(pgDB)
		smtpSender := notification.NewSMTPSender()
		notification.RegisterChannelRoutes(router, channelRepo, smtpSender)
	}
	if legacyLogPipelineEnabled {
		ingest.RegisterPullPackageRoutes(router, pullPackageStore)
		ingest.RegisterReceiptRoutes(router, pullPackageStore, receiptStore, deadLetterStore)
		ingest.RegisterDeadLetterRoutes(router, deadLetterStore)
		router.GET("/api/v1/ingest/metrics/latency", func(c *gin.Context) {
			if latencyMonitor == nil {
				c.JSON(http.StatusOK, gin.H{
					"code":       "OK",
					"message":    "success",
					"request_id": resolveRequestID(c),
					"data":       gin.H{"enabled": false},
					"meta":       gin.H{},
				})
				return
			}
			snapshot := latencyMonitor.Snapshot()
			c.JSON(http.StatusOK, gin.H{
				"code":       "OK",
				"message":    "success",
				"request_id": resolveRequestID(c),
				"data": gin.H{
					"enabled":  true,
					"snapshot": snapshot,
					"thresholds": gin.H{
						"p95_ms": parseEnvInt("INGEST_LATENCY_ALERT_P95_MS", 3000),
						"p99_ms": parseEnvInt("INGEST_LATENCY_ALERT_P99_MS", 5000),
					},
				},
				"meta": gin.H{},
			})
		})
	}

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
	workerCancel()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	grpcServer.GracefulStop()
	if err := httpServer.Shutdown(ctx); err != nil {
		log.Printf("HTTP server shutdown error: %v", err)
	}

	fmt.Println("Servers stopped")
}

func registerLegacyPipelineRemovedRoutes(router *gin.Engine) {
	if router == nil {
		return
	}
	respondGone := func(c *gin.Context) {
		c.JSON(http.StatusGone, gin.H{
			"code":       "LEGACY_PIPELINE_REMOVED",
			"message":    "legacy log pipeline removed; rewrite in progress",
			"request_id": resolveRequestID(c),
			"data":       gin.H{},
			"meta":       gin.H{},
		})
	}
	router.GET("/api/v1/ingest/pull-sources", respondGone)
	router.POST("/api/v1/ingest/pull-sources", respondGone)
	router.PUT("/api/v1/ingest/pull-sources", respondGone)
	router.PUT("/api/v1/ingest/pull-sources/:source_id", respondGone)
	router.GET("/api/v1/ingest/pull-tasks", respondGone)
	router.POST("/api/v1/ingest/pull-tasks/run", respondGone)
	router.GET("/api/v1/ingest/packages", respondGone)
	router.POST("/api/v1/ingest/receipts", respondGone)
	router.GET("/api/v1/ingest/dead-letters", respondGone)
	router.POST("/api/v1/ingest/dead-letters/replay", respondGone)
	router.GET("/api/v1/ingest/metrics/latency", respondGone)
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

func parseCSV(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed == "" {
			continue
		}
		result = append(result, trimmed)
	}
	return result
}

func resolveRequestID(c *gin.Context) string {
	if c == nil {
		return ""
	}
	if existing := strings.TrimSpace(c.GetHeader("X-Request-ID")); existing != "" {
		c.Header("X-Request-ID", existing)
		return existing
	}
	generated := fmt.Sprintf("cp-%d", time.Now().UTC().UnixNano())
	c.Header("X-Request-ID", generated)
	return generated
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
