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

	jwtSecret := requireJWTSecret()

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
			backend, backendErr := ingest.NewPGBackend(pgDB, ingest.PGOptions{
				DefaultTenantID: getEnv("INGEST_DEFAULT_TENANT_ID", ""),
			})
			if backendErr != nil {
				if allowMemoryFallback {
					log.Printf("ingest postgres backend requires explicit tenant id, fallback to memory: %v", backendErr)
				} else {
					log.Fatalf("ingest postgres backend init failed: %v", backendErr)
				}
			} else {
				pgBackend = backend
				log.Printf("ingest store backend: postgres")
			}
		}
	} else {
		log.Printf("ingest store backend: memory")
	}

	userRoutes := router.Group("/")
	userRoutes.Use(middleware.RequireAuthenticatedUserIdentity(pgDB, jwtSecret))
	if pgDB != nil {
		userRoutes.Use(middleware.AuditMiddleware(pgDB))
	}

	agentRoutes := router.Group("/")
	agentRoutes.Use(middleware.RequireAuthenticatedAgentIdentity(pgDB))

	var pullCursorStore *ingest.PullCursorStore
	if pgBackend != nil {
		pullCursorStore = ingest.NewPullCursorStoreWithPG(pgBackend)
	} else {
		pullCursorStore = ingest.NewPullCursorStore()
	}

	// 后台任务统一使用可取消上下文，便于服务优雅退出。
	workerCtx, workerCancel := context.WithCancel(context.Background())
	defer workerCancel()

	v3CursorAdapter := &ingestv3.LegacyCursorStoreAdapter{
		Store:        pullCursorStore,
		DefaultAgent: getEnv("INGESTV3_DEFAULT_AGENT_ID", "ingestv3-rewrite"),
	}
	registerIngestV3Routes(userRoutes, pgDB, v3CursorAdapter, v3CursorAdapter)

	if err := enablePullIngestRuntime(userRoutes, pgDB, workerCtx, pgBackend); err != nil {
		log.Printf("pull ingest runtime unavailable, fallback to gone routes: %v", err)
		registerLegacyPipelineRemovedRoutes(userRoutes, pgDB)
	}

	// ES Snapshot Backup/Restore (W4-B3)
	backupSvc := backup.NewService()
	backup.RegisterAuthorizedRoutes(userRoutes, pgDB, backup.NewHandler(backupSvc))

	var (
		channelRepo    *notification.ChannelRepository
		smtpSender     *notification.SMTPSender
		dingTalkSender *notification.DingTalkSender
		notifier       *notification.Dispatcher
	)
	if pgDB != nil {
		channelRepo = notification.NewChannelRepository(pgDB)
		smtpSender = notification.NewSMTPSender()
		dingTalkSender = notification.NewDingTalkSender()
		notifier = notification.NewDispatcher(channelRepo, smtpSender, dingTalkSender)
	}

	// Metrics report + query API (W3-B6, W3-B8)
	if pgDB != nil {
		metricsRepo := metrics.NewRepository(pgDB)
		metricsSvc := metrics.NewService(metricsRepo)
		// Threshold evaluator for alert triggering (W3-B7)
		thresholdRepo := resource.NewThresholdRepository(pgDB)
		evaluator := resource.NewThresholdEvaluator(thresholdRepo, pgDB).WithNotifier(notifier)
		metricsSvc.WithEvaluator(evaluator)
		metricsHandler := metrics.NewHandler(metricsSvc)
		metrics.RegisterReportRoutes(agentRoutes, metricsHandler)
		metrics.RegisterAuthorizedQueryRoutes(userRoutes, pgDB, metricsHandler)
		// Background cleanup: delete metrics older than 30 days, run daily
		metrics.StartCleanupJob(workerCtx, metricsRepo, 30, 24*time.Hour)
		// Resource threshold CRUD (W3-B7)
		resource.RegisterAuthorizedRoutes(userRoutes, pgDB, resource.NewThresholdHandler(thresholdRepo))
	}

	// Alert rules API (requires PostgreSQL)
	if pgDB != nil {
		alertRuleRepo := alert.NewRuleRepositoryPG(pgDB)
		alertRuleService := alert.NewRuleService(alertRuleRepo)
		alertRuleHandler := alert.NewRuleHandler(alertRuleService)
		alert.RegisterAuthorizedAlertRuleRoutes(userRoutes, pgDB, alertRuleHandler)
		alert.RegisterAuthorizedAlertEventRoutes(userRoutes, pgDB, alert.NewEventHandler(pgDB))

		// Alert silence policy (W4-B6)
		silenceSvc := alert.NewSilenceService(pgDB)
		alert.RegisterAuthorizedSilenceRoutes(userRoutes, pgDB, alert.NewSilenceHandler(silenceSvc))

		// Incident API
		incidentRepo := incident.NewRepositoryPG(pgDB)
		incidentTimeline := incident.NewTimelineStorePG(pgDB)
		incidentService := incident.NewService(incidentRepo, incidentTimeline)
		incidentHandler := incident.NewHandler(incidentService)
		incident.RegisterAuthorizedIncidentRoutes(userRoutes, pgDB, incidentHandler)

		if isTruthy(getEnv("ALERT_EVALUATOR_ENABLED", "false")) {
			evaluatorInterval := parseDurationEnv("ALERT_EVALUATOR_INTERVAL", 30*time.Second)
			esEndpoint := resolveFirstAddress(
				getEnv("ALERT_EVALUATOR_ES_ENDPOINT", ""),
				getEnv("SEARCH_ELASTICSEARCH_ADDRESSES", ""),
				getEnv("DATABASE_ELASTICSEARCH_ADDRESSES", ""),
				getEnv("INGEST_ES_ENDPOINT", ""),
				"http://elasticsearch:9200",
			)
			esIndex := strings.TrimSpace(getEnv("ALERT_EVALUATOR_ES_INDEX", getEnv("QUERY_LOGS_INDEX", "nexuslog-logs-read")))
			evaluator := alert.NewEvaluator(
				alertRuleRepo,
				alert.NewHTTPESSearchClient(
					esEndpoint,
					strings.TrimSpace(getEnv("ALERT_EVALUATOR_ES_USERNAME", getEnv("DATABASE_ELASTICSEARCH_USERNAME", ""))),
					strings.TrimSpace(getEnv("ALERT_EVALUATOR_ES_PASSWORD", getEnv("DATABASE_ELASTICSEARCH_PASSWORD", ""))),
					parseDurationEnv("ALERT_EVALUATOR_ES_TIMEOUT", 10*time.Second),
				),
				pgDB,
				esIndex,
			).
				WithIncidentCreator(alert.NewIncidentCreator(pgDB)).
				WithSilenceChecker(silenceSvc).
				WithNotifier(notifier).
				WithInterval(evaluatorInterval)
			go evaluator.Start()
			go func() {
				<-workerCtx.Done()
				evaluator.Stop()
			}()
			log.Printf("log alert evaluator enabled: endpoint=%s index=%s interval=%s", esEndpoint, esIndex, evaluatorInterval)
		} else {
			log.Printf("log alert evaluator disabled")
		}

		if isTruthy(getEnv("ALERTMANAGER_BRIDGE_ENABLED", "false")) {
			bridgeInterval := parseDurationEnv("ALERTMANAGER_BRIDGE_INTERVAL", 10*time.Second)
			bridge := alert.NewAlertmanagerBridge(
				pgDB,
				getEnv("ALERTMANAGER_URL", "http://alertmanager:9093"),
				getEnv("ALERTMANAGER_GENERATOR_URL", "http://control-plane:8080"),
			).
				WithBatchSize(parseEnvInt("ALERTMANAGER_BRIDGE_BATCH_SIZE", 50)).
				WithInterval(bridgeInterval)
			go bridge.Run(workerCtx)
			log.Printf("alertmanager bridge enabled: endpoint=%s interval=%s", getEnv("ALERTMANAGER_URL", "http://alertmanager:9093"), bridgeInterval)
		} else {
			log.Printf("alertmanager bridge disabled")
		}
	}

	// Notification channels (requires pgDB, admin only)
	if pgDB != nil {
		notification.RegisterAuthorizedChannelRoutes(userRoutes, pgDB, channelRepo, smtpSender)
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
	router.GET("/metrics", func(c *gin.Context) {
		writeServiceMetrics(c, "control-plane")
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

func registerLegacyPipelineRemovedRoutes(router gin.IRouter, db *sql.DB) {
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

	router.GET("/api/v1/ingest/pull-sources", middleware.RequireCapabilityOrAdminRole(db, "ingest.source.read"), respondGone)
	router.POST("/api/v1/ingest/pull-sources", middleware.RequireCapabilityOrAdminRole(db, "ingest.source.create"), respondGone)
	router.PUT("/api/v1/ingest/pull-sources", middleware.RequireCapabilityOrAdminRole(db, "ingest.source.update"), respondGone)
	router.PUT("/api/v1/ingest/pull-sources/:source_id", middleware.RequireCapabilityOrAdminRole(db, "ingest.source.update"), respondGone)
	router.GET("/api/v1/ingest/pull-sources/status", middleware.RequireCapabilityOrAdminRole(db, "ingest.task.read"), respondGone)
	router.GET("/api/v1/ingest/agents", middleware.RequireCapabilityOrAdminRole(db, "agent.read"), respondGone)
	router.POST("/api/v1/ingest/deployment-scripts/generate", middleware.RequireCapabilityOrAdminRole(db, "ingest.source.read"), respondGone)
	router.GET("/api/v1/ingest/pull-tasks", middleware.RequireCapabilityOrAdminRole(db, "ingest.task.read"), respondGone)
	router.GET("/api/v1/ingest/pull-tasks/:task_id", middleware.RequireCapabilityOrAdminRole(db, "ingest.task.read"), respondGone)
	router.POST("/api/v1/ingest/pull-tasks/run", middleware.RequireCapabilityOrAdminRole(db, "ingest.task.run"), respondGone)
	router.GET("/api/v1/ingest/packages", middleware.RequireCapabilityOrAdminRole(db, "ingest.package.read"), respondGone)
	router.GET("/api/v1/ingest/packages/:package_id", middleware.RequireCapabilityOrAdminRole(db, "ingest.package.read"), respondGone)
	router.GET("/api/v1/ingest/dead-letters", middleware.RequireCapabilityOrAdminRole(db, "ingest.dead_letter.read"), respondGone)
	router.POST("/api/v1/ingest/dead-letters/replay", middleware.RequireCapabilityOrAdminRole(db, "ingest.dead_letter.replay"), respondGone)
	router.GET("/api/v1/ingest/metrics/latency", middleware.RequireCapabilityOrAdminRole(db, "metric.read"), respondGone)
	router.GET("/api/v1/ingest/receipts", middleware.RequireCapabilityOrAdminRole(db, "ingest.package.read"), respondGone)
	router.POST("/api/v1/ingest/receipts", middleware.RequireCapabilityOrOperatorRole(db, "ingest.receipt.create"), respondGone)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func requireJWTSecret() string {
	secret := strings.TrimSpace(getEnv("JWT_SECRET", ""))
	if secret == "" {
		log.Fatal("JWT_SECRET is required")
	}
	if secret == "nexuslog-dev-secret-change-in-production" {
		log.Fatal("JWT_SECRET uses a known weak default and must be replaced")
	}
	if len(secret) < 32 {
		log.Fatal("JWT_SECRET must be at least 32 characters")
	}
	return secret
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

func parseDurationEnv(key string, fallback time.Duration) time.Duration {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	if parsed, err := time.ParseDuration(raw); err == nil && parsed > 0 {
		return parsed
	}
	if seconds, err := strconv.Atoi(raw); err == nil && seconds > 0 {
		return time.Duration(seconds) * time.Second
	}
	return fallback
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

func writeServiceMetrics(c *gin.Context, serviceName string) {
	if c == nil {
		return
	}
	c.Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	c.String(
		http.StatusOK,
		"# HELP nexuslog_service_up Whether the service is up.\n"+
			"# TYPE nexuslog_service_up gauge\n"+
			fmt.Sprintf("nexuslog_service_up{service=%q} 1\n", serviceName),
	)
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
