package main

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/nexuslog/control-plane/internal/ingest"
)

const (
	weakDefaultAgentSharedKey = "dev-agent-key"
	minAgentSharedKeyLength   = 24
)

func enablePullIngestRuntime(authenticatedRoutes gin.IRouter, adminRoutes gin.IRouter, workerCtx context.Context, pgBackend *ingest.PGBackend) error {
	if authenticatedRoutes == nil {
		return fmt.Errorf("authenticated routes are nil")
	}
	if adminRoutes == nil {
		return fmt.Errorf("admin routes are nil")
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
			ExecutionTimeout:  parseDurationSecondsEnv("INGEST_EXECUTION_TIMEOUT_SEC", 120*time.Second),
			DefaultAgentKeyID: defaultAgentKeyID,
			DefaultAgentKey:   defaultAgentKey,
			LatencyMonitor:    latencyMonitor,
		},
	)
	taskStore.SetExecutor(executor.Execute)

	ingest.RegisterPullSourceRoutes(adminRoutes, sourceStore)
	ingest.RegisterPullTaskRoutes(adminRoutes, sourceStore, taskStore)
	ingest.RegisterPullPackageRoutes(adminRoutes, packageStore)
	ingest.RegisterReceiptRoutes(authenticatedRoutes, packageStore, receiptStore, deadLetterStore)
	ingest.RegisterDeadLetterRoutes(adminRoutes, deadLetterStore)
	ingest.RegisterPullLatencyRoutes(adminRoutes, latencyMonitor)

	scheduler := ingest.NewPullTaskScheduler(sourceStore, taskStore, ingest.PullTaskSchedulerConfig{
		CheckInterval:           parseDurationSecondsEnv("INGEST_SCHEDULER_CHECK_INTERVAL_SEC", time.Second),
		PageSize:                parseEnvInt("INGEST_SCHEDULER_PAGE_SIZE", 200),
		CriticalSourcePatterns:  parseCSV(getEnv("INGEST_CRITICAL_SOURCE_PATTERNS", "")),
		CriticalPullIntervalSec: parseEnvInt("INGEST_CRITICAL_PULL_INTERVAL_SEC", 2),
	})
	go scheduler.Start(workerCtx)

	log.Printf("pull ingest runtime enabled: backend=%s es_index=%s", backendName, strings.TrimSpace(getEnv("INGEST_ES_INDEX", "nexuslog-logs-write-pull")))
	return nil
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
