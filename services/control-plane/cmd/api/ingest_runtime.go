package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/nexuslog/control-plane/internal/ingest"
	"github.com/nexuslog/control-plane/internal/middleware"
)

const (
	weakDefaultAgentSharedKey = "dev-agent-key"
	minAgentSharedKeyLength   = 24
)

func enablePullIngestRuntime(router gin.IRouter, db *sql.DB, workerCtx context.Context, pgBackend *ingest.PGBackend) error {
	if router == nil {
		return fmt.Errorf("router is nil")
	}
	if workerCtx == nil {
		workerCtx = context.Background()
	}

	sourceStore := ingest.NewPullSourceStore()
	taskStore := ingest.NewPullTaskStore()
	packageStore := ingest.NewPullPackageStore()
	receiptStore := ingest.NewReceiptStore()
	deadLetterStore := ingest.NewDeadLetterStore()
	batchStore := ingest.NewPullBatchStore()
	cursorStore := ingest.NewPullCursorStore()
	authKeyStore := ingest.NewAgentAuthKeyStore()
	backendName := "memory"
	if pgBackend != nil {
		sourceStore = ingest.NewPullSourceStoreWithPG(pgBackend)
		taskStore = ingest.NewPullTaskStoreWithPG(pgBackend)
		packageStore = ingest.NewPullPackageStoreWithPG(pgBackend)
		receiptStore = ingest.NewReceiptStoreWithPG(pgBackend)
		deadLetterStore = ingest.NewDeadLetterStoreWithPG(pgBackend)
		batchStore = ingest.NewPullBatchStoreWithPG(pgBackend)
		cursorStore = ingest.NewPullCursorStoreWithPG(pgBackend)
		authKeyStore = ingest.NewAgentAuthKeyStoreWithPG(pgBackend)
		backendName = "postgres"
	}

	latencyMonitor := ingest.NewPullLatencyMonitor(
		parseEnvInt("INGEST_LATENCY_WINDOW_SIZE", 300),
		int64(parseEnvInt("INGEST_LATENCY_ALERT_P95_MS", 3000)),
		int64(parseEnvInt("INGEST_LATENCY_ALERT_P99_MS", 5000)),
		time.Duration(parseEnvInt("INGEST_LATENCY_ALERT_COOLDOWN_SEC", 60))*time.Second,
	)

	agentClient := ingest.NewAgentClient(time.Duration(parseEnvInt("INGEST_AGENT_HTTP_TIMEOUT_SEC", 15)) * time.Second)
	esSink := ingest.NewESSink(
		resolveFirstAddress(
			getEnv("INGEST_ES_ENDPOINT", ""),
			getEnv("SEARCH_ELASTICSEARCH_ADDRESSES", ""),
			getEnv("DATABASE_ELASTICSEARCH_ADDRESSES", "http://localhost:9200"),
		),
		strings.TrimSpace(getEnv("INGEST_ES_INDEX", "nexuslog-logs-write-pull")),
		strings.TrimSpace(getEnv("INGEST_ES_USERNAME", getEnv("DATABASE_ELASTICSEARCH_USERNAME", ""))),
		strings.TrimSpace(getEnv("INGEST_ES_PASSWORD", getEnv("DATABASE_ELASTICSEARCH_PASSWORD", ""))),
		parseDurationSecondsEnv("INGEST_ES_TIMEOUT_SEC", 15*time.Second),
	)

	defaultAgentKeyID, defaultAgentKey, err := resolveDefaultAgentCredential()
	if err != nil {
		return err
	}
	if defaultAgentKey != "" {
		if err := authKeyStore.Upsert(ingest.AgentAuthKey{
			KeyRef:            defaultAgentKeyID,
			ActiveKeyID:       defaultAgentKeyID,
			ActiveKeyMaterial: defaultAgentKey,
			Status:            "active",
		}); err != nil {
			return fmt.Errorf("bootstrap default agent auth key: %w", err)
		}
	}

	executionTimeout := parseDurationSecondsEnv("INGEST_EXECUTION_TIMEOUT_SEC", 120*time.Second)
	executor := ingest.NewPullTaskExecutor(
		sourceStore,
		taskStore,
		packageStore,
		receiptStore,
		deadLetterStore,
		batchStore,
		cursorStore,
		authKeyStore,
		agentClient,
		esSink,
		ingest.PullTaskExecutorConfig{
			MaxRetries:        parseEnvInt("INGEST_MAX_RETRIES", 1),
			RetryBackoff:      parseDurationSecondsEnv("INGEST_RETRY_BACKOFF_SEC", 3*time.Second),
			ExecutionTimeout:  executionTimeout,
			DefaultAgentKeyID: defaultAgentKeyID,
			DefaultAgentKey:   defaultAgentKey,
			LatencyMonitor:    latencyMonitor,
		},
	)
	taskStore.SetExecutor(executor.Execute)

	registerAuthorizedPullIngestRuntimeRoutes(
		router,
		db,
		sourceStore,
		taskStore,
		packageStore,
		receiptStore,
		deadLetterStore,
		latencyMonitor,
	)

	staleTaskAfter := parseDurationSecondsEnv("INGEST_STALE_TASK_AFTER_SEC", executionTimeout+30*time.Second)
	scheduler := ingest.NewPullTaskScheduler(sourceStore, taskStore, ingest.PullTaskSchedulerConfig{
		CheckInterval:           parseDurationSecondsEnv("INGEST_SCHEDULER_CHECK_INTERVAL_SEC", time.Second),
		PageSize:                parseEnvInt("INGEST_SCHEDULER_PAGE_SIZE", 200),
		CriticalSourcePatterns:  parseCSV(getEnv("INGEST_CRITICAL_SOURCE_PATTERNS", "")),
		CriticalPullIntervalSec: parseEnvInt("INGEST_CRITICAL_PULL_INTERVAL_SEC", 2),
		StaleTaskAfter:          staleTaskAfter,
	})
	go scheduler.Start(workerCtx)

	log.Printf("pull ingest runtime enabled: backend=%s es_index=%s", backendName, strings.TrimSpace(getEnv("INGEST_ES_INDEX", "nexuslog-logs-write-pull")))
	return nil
}

func registerAuthorizedPullIngestRuntimeRoutes(
	router gin.IRouter,
	db *sql.DB,
	sourceStore *ingest.PullSourceStore,
	taskStore *ingest.PullTaskStore,
	packageStore *ingest.PullPackageStore,
	receiptStore *ingest.ReceiptStore,
	deadLetterStore *ingest.DeadLetterStore,
	latencyMonitor *ingest.PullLatencyMonitor,
) {
	if router == nil {
		return
	}

	sourceHandler := ingest.NewPullSourceHandler(sourceStore)
	router.GET("/api/v1/ingest/pull-sources", middleware.RequireCapabilityOrAdminRole(db, "ingest.source.read"), sourceHandler.ListPullSources)
	router.POST("/api/v1/ingest/pull-sources", middleware.RequireCapabilityOrAdminRole(db, "ingest.source.create"), sourceHandler.CreatePullSource)
	router.PUT("/api/v1/ingest/pull-sources", middleware.RequireCapabilityOrAdminRole(db, "ingest.source.update"), sourceHandler.UpdatePullSourceByBody)
	router.PUT("/api/v1/ingest/pull-sources/:source_id", middleware.RequireCapabilityOrAdminRole(db, "ingest.source.update"), sourceHandler.UpdatePullSourceByPath)

	taskHandler := ingest.NewPullTaskHandler(sourceStore, taskStore)
	router.GET("/api/v1/ingest/pull-tasks", middleware.RequireCapabilityOrAdminRole(db, "ingest.task.read"), taskHandler.ListPullTasks)
	router.POST("/api/v1/ingest/pull-tasks/run", middleware.RequireCapabilityOrAdminRole(db, "ingest.task.run"), taskHandler.RunPullTask)

	packageHandler := ingest.NewPullPackageHandler(packageStore)
	router.GET("/api/v1/ingest/packages", middleware.RequireCapabilityOrAdminRole(db, "ingest.package.read"), packageHandler.ListPullPackages)

	receiptHandler := ingest.NewReceiptHandler(packageStore, receiptStore, deadLetterStore)
	router.POST("/api/v1/ingest/receipts", middleware.RequireCapabilityOrOperatorRole(db, "ingest.receipt.create"), receiptHandler.CreateReceipt)

	deadLetterHandler := ingest.NewDeadLetterHandler(deadLetterStore)
	router.POST("/api/v1/ingest/dead-letters/replay", middleware.RequireCapabilityOrAdminRole(db, "ingest.dead_letter.replay"), deadLetterHandler.ReplayDeadLetters)

	latencyHandler := ingest.NewPullLatencyHandler(latencyMonitor)
	router.GET("/api/v1/ingest/metrics/latency", middleware.RequireCapabilityOrAdminRole(db, "metric.read"), latencyHandler.GetPullLatency)
}

func resolveDefaultAgentCredential() (string, string, error) {
	keyID := strings.TrimSpace(getEnv("INGEST_DEFAULT_AGENT_KEY_ID", "active"))
	if keyID == "" {
		keyID = "active"
	}
	key := strings.TrimSpace(getEnv("INGEST_DEFAULT_AGENT_KEY", ""))
	if key == "" {
		return keyID, "", nil
	}
	if err := validateSharedAgentKey("INGEST_DEFAULT_AGENT_KEY", key); err != nil {
		return "", "", err
	}
	return keyID, key, nil
}

func validateSharedAgentKey(envKey, key string) error {
	trimmed := strings.TrimSpace(key)
	if trimmed == "" {
		return fmt.Errorf("%s is required", envKey)
	}
	if trimmed == weakDefaultAgentSharedKey {
		return fmt.Errorf("%s uses a known weak default and must be replaced", envKey)
	}
	if len(trimmed) < minAgentSharedKeyLength {
		return fmt.Errorf("%s must be at least %d characters", envKey, minAgentSharedKeyLength)
	}
	return nil
}

func resolveFirstAddress(candidates ...string) string {
	for _, candidate := range candidates {
		for _, part := range strings.Split(candidate, ",") {
			trimmed := strings.TrimSpace(part)
			if trimmed != "" {
				return trimmed
			}
		}
	}
	return "http://localhost:9200"
}

func parseDurationSecondsEnv(key string, fallback time.Duration) time.Duration {
	if raw := strings.TrimSpace(getEnv(key, "")); raw != "" {
		if parsed, err := time.ParseDuration(raw); err == nil && parsed > 0 {
			return parsed
		}
	}
	seconds := parseEnvInt(key, 0)
	if seconds > 0 {
		return time.Duration(seconds) * time.Second
	}
	return fallback
}
