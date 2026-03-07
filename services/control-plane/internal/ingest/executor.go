package ingest

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"
)

const (
	// ErrorCodeExecutorSourceNotFound 表示执行时拉取源不存在。
	ErrorCodeExecutorSourceNotFound = "INGEST_SOURCE_NOT_FOUND"
	// ErrorCodeExecutorAuthNotFound 表示 key_ref 未解析到可用密钥。
	ErrorCodeExecutorAuthNotFound = "INGEST_AUTH_NOT_FOUND"
	// ErrorCodeExecutorAgentPullFailed 表示调用 agent 拉取失败。
	ErrorCodeExecutorAgentPullFailed = "INGEST_AGENT_PULL_FAILED"
	// ErrorCodeExecutorPackageBuildFailed 表示批次映射失败。
	ErrorCodeExecutorPackageBuildFailed = "INGEST_PACKAGE_BUILD_FAILED"
	// ErrorCodeExecutorPackageStoreFailed 表示包落库失败。
	ErrorCodeExecutorPackageStoreFailed = "INGEST_PACKAGE_STORE_FAILED"
	// ErrorCodeExecutorESWriteFailed 表示 ES 写入失败。
	ErrorCodeExecutorESWriteFailed = "INGEST_ES_WRITE_FAILED"
	// ErrorCodeExecutorAckFailed 表示 ACK/NACK 回写失败。
	ErrorCodeExecutorAckFailed = "INGEST_ACK_FAILED"
	// ErrorCodeExecutorCursorStoreFailed 表示游标更新失败。
	ErrorCodeExecutorCursorStoreFailed = "INGEST_CURSOR_STORE_FAILED"
)

// PullTaskExecutorConfig 定义执行器可调参数。
type PullTaskExecutorConfig struct {
	MaxRetries        int
	RetryBackoff      time.Duration
	ExecutionTimeout  time.Duration
	DefaultAgentKeyID string
	DefaultAgentKey   string
	LatencyMonitor    *PullLatencyMonitor
}

// PullTaskExecutor 负责异步执行 pull task 主链路。
type PullTaskExecutor struct {
	sourceStore     *PullSourceStore
	taskStore       *PullTaskStore
	packageStore    *PullPackageStore
	receiptStore    *ReceiptStore
	deadLetterStore *DeadLetterStore
	batchStore      *PullBatchStore
	cursorStore     *PullCursorStore
	authKeyStore    *AgentAuthKeyStore
	agentClient     *AgentClient
	esSink          *ESSink
	config          PullTaskExecutorConfig
	latencyMonitor  *PullLatencyMonitor
}

// NewPullTaskExecutor 创建任务执行器。
func NewPullTaskExecutor(
	sourceStore *PullSourceStore,
	taskStore *PullTaskStore,
	packageStore *PullPackageStore,
	receiptStore *ReceiptStore,
	deadLetterStore *DeadLetterStore,
	batchStore *PullBatchStore,
	cursorStore *PullCursorStore,
	authKeyStore *AgentAuthKeyStore,
	agentClient *AgentClient,
	esSink *ESSink,
	config PullTaskExecutorConfig,
) *PullTaskExecutor {
	if config.MaxRetries < 0 {
		config.MaxRetries = 0
	}
	if config.RetryBackoff <= 0 {
		config.RetryBackoff = 3 * time.Second
	}
	if config.ExecutionTimeout <= 0 {
		config.ExecutionTimeout = 2 * time.Minute
	}
	return &PullTaskExecutor{
		sourceStore:     sourceStore,
		taskStore:       taskStore,
		packageStore:    packageStore,
		receiptStore:    receiptStore,
		deadLetterStore: deadLetterStore,
		batchStore:      batchStore,
		cursorStore:     cursorStore,
		authKeyStore:    authKeyStore,
		agentClient:     agentClient,
		esSink:          esSink,
		config:          config,
		latencyMonitor:  config.LatencyMonitor,
	}
}

// Execute 执行单个任务的完整主链路。
func (e *PullTaskExecutor) Execute(task PullTask) {
	if e == nil || strings.TrimSpace(task.TaskID) == "" {
		return
	}
	if e.taskStore == nil || e.sourceStore == nil || e.packageStore == nil || e.receiptStore == nil || e.deadLetterStore == nil || e.batchStore == nil || e.cursorStore == nil || e.agentClient == nil || e.esSink == nil {
		return
	}
	if !e.taskStore.MarkRunning(task.TaskID) {
		return
	}
	taskOutcome := "failed"
	defer e.observeTaskLatency(task, taskOutcome)

	source, ok := e.sourceStore.GetByID(task.SourceID)
	if !ok {
		e.taskStore.MarkFailed(task.TaskID, ErrorCodeExecutorSourceNotFound, "pull source not found", 0)
		return
	}

	credential, ok := e.resolveCredential(source)
	if !ok {
		e.taskStore.MarkFailed(task.TaskID, ErrorCodeExecutorAuthNotFound, "auth key is not configured", 0)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), e.config.ExecutionTimeout)
	defer cancel()

	cursor := e.resolveStartCursor(task, source)
	pullResp, err := e.agentClient.Pull(ctx, source, task, credential, cursor)
	if err != nil {
		e.taskStore.MarkFailed(task.TaskID, ErrorCodeExecutorAgentPullFailed, err.Error(), 0)
		return
	}

	// 空批次按成功处理，只更新游标字段。
	if len(pullResp.Records) == 0 {
		e.taskStore.MarkSuccess(task.TaskID, strings.TrimSpace(pullResp.BatchID), strings.TrimSpace(pullResp.Cursor.Next))
		return
	}

	agentID := e.resolveAgentID(task, source)
	pkg, err := BuildPullPackageFromAgentPull(BuildPullPackageInput{
		AgentID:   agentID,
		SourceID:  source.SourceID,
		SourceRef: source.Path,
		CreatedAt: time.Now().UTC(),
	}, pullResp)
	if err != nil {
		e.taskStore.MarkFailed(task.TaskID, ErrorCodeExecutorPackageBuildFailed, err.Error(), 0)
		return
	}
	pkg.TaskID = task.TaskID
	pkg.SourceID = source.SourceID
	pkg.RequestID = task.RequestID
	pkg.Status = "uploaded"

	createdPkg, err := e.packageStore.Create(pkg)
	if err != nil {
		e.taskStore.MarkFailed(task.TaskID, ErrorCodeExecutorPackageStoreFailed, err.Error(), 0)
		return
	}

	createdBatch, err := e.batchStore.Upsert(PullBatch{
		BatchID:     strings.TrimSpace(createdPkg.BatchID),
		Checksum:    strings.TrimSpace(createdPkg.Checksum),
		SourceID:    source.SourceID,
		TaskID:      task.TaskID,
		PackageID:   createdPkg.PackageID,
		AgentID:     agentID,
		Cursor:      cursor,
		NextCursor:  createdPkg.NextCursor,
		Status:      string(PullBatchStatusProcessed),
		RecordCount: createdPkg.RecordCount,
		SizeBytes:   createdPkg.SizeBytes,
		RequestID:   task.RequestID,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	})
	if err != nil {
		e.taskStore.MarkFailed(task.TaskID, ErrorCodeExecutorPackageStoreFailed, err.Error(), 0)
		return
	}

	retryCount := 0
	if err := e.writeToESWithRetry(ctx, task, source, agentID, pullResp, &retryCount); err != nil {
		failurePayload := extractFailureDetailPayload(err)
		_ = e.batchStore.MarkStatus(createdBatch.BatchID, createdBatch.Checksum, string(PullBatchStatusFailed), ErrorCodeExecutorESWriteFailed, err.Error(), retryCount, nil)
		e.handleNack(task, source, credential, createdPkg, createdBatch, retryCount, ErrorCodeExecutorESWriteFailed, err.Error(), failurePayload)
		return
	}

	if err := e.agentClient.Ack(ctx, source, credential, AgentAckRequestPayload{
		BatchID:         createdPkg.BatchID,
		Status:          "ack",
		CommittedCursor: createdPkg.NextCursor,
	}, task.RequestID); err != nil {
		_ = e.batchStore.MarkStatus(createdBatch.BatchID, createdBatch.Checksum, string(PullBatchStatusFailed), ErrorCodeExecutorAckFailed, err.Error(), retryCount, nil)
		e.handleNack(task, source, credential, createdPkg, createdBatch, retryCount, ErrorCodeExecutorAckFailed, err.Error(), nil)
		return
	}

	now := time.Now().UTC()
	_, _ = e.packageStore.ApplyReceipt(createdPkg.PackageID, "ack", now)
	_, _ = e.receiptStore.Create(DeliveryReceipt{
		PackageID:  createdPkg.PackageID,
		Status:     "ack",
		Checksum:   createdPkg.Checksum,
		Accepted:   true,
		ReceivedAt: now,
		CreatedAt:  now,
	})
	_ = e.batchStore.MarkStatus(createdBatch.BatchID, createdBatch.Checksum, string(PullBatchStatusAcked), "", "", retryCount, &now)
	if err := e.persistCursors(task, source, createdPkg, now); err != nil {
		e.taskStore.MarkFailed(task.TaskID, ErrorCodeExecutorCursorStoreFailed, err.Error(), retryCount)
		return
	}
	e.taskStore.MarkSuccess(task.TaskID, createdPkg.BatchID, createdPkg.NextCursor)
	taskOutcome = "success"
}

func (e *PullTaskExecutor) handleNack(task PullTask, source PullSource, credential AgentAuthCredential, pkg PullPackage, batch PullBatch, retryCount int, errorCode, errorMessage string, failurePayload map[string]any) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	now := time.Now().UTC()
	_, _ = e.packageStore.ApplyReceipt(pkg.PackageID, "nack", now)
	_, _ = e.receiptStore.Create(DeliveryReceipt{
		PackageID:  pkg.PackageID,
		Status:     "nack",
		Reason:     errorMessage,
		Checksum:   pkg.Checksum,
		Accepted:   true,
		ReceivedAt: now,
		CreatedAt:  now,
	})
	_, _ = e.deadLetterStore.CreateFromReceipt(pkg, errorMessage, failurePayload)
	_ = e.batchStore.MarkStatus(batch.BatchID, batch.Checksum, string(PullBatchStatusDeadLettered), errorCode, errorMessage, retryCount, nil)
	_ = e.agentClient.Ack(ctx, source, credential, AgentAckRequestPayload{
		BatchID: pkg.BatchID,
		Status:  "nack",
		Reason:  errorMessage,
	}, task.RequestID)
	e.taskStore.MarkFailed(task.TaskID, errorCode, errorMessage, retryCount)
}

func (e *PullTaskExecutor) writeToESWithRetry(ctx context.Context, task PullTask, source PullSource, agentID string, pullResp AgentPullResponse, retryCount *int) error {
	maxAttempts := e.config.MaxRetries + 1
	var lastErr error
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		_, err := e.esSink.WriteRecords(ctx, task, source, agentID, pullResp)
		if err == nil {
			if retryCount != nil {
				*retryCount = attempt - 1
			}
			return nil
		}
		lastErr = err
		if attempt >= maxAttempts {
			break
		}
		time.Sleep(e.config.RetryBackoff)
	}
	if retryCount != nil {
		*retryCount = e.config.MaxRetries
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("es write failed")
	}
	return lastErr
}

func (e *PullTaskExecutor) persistCursors(task PullTask, source PullSource, pkg PullPackage, now time.Time) error {
	if len(pkg.Files) == 0 {
		return e.cursorStore.Upsert(PullCursor{
			SourceID:    source.SourceID,
			TaskID:      task.TaskID,
			AgentID:     pkg.AgentID,
			SourceRef:   pkg.SourceRef,
			SourcePath:  source.Path,
			LastCursor:  pkg.NextCursor,
			LastOffset:  pkg.ToOffset,
			LastBatchID: pkg.BatchID,
			RequestID:   task.RequestID,
			UpdatedAt:   now,
		})
	}
	for _, file := range pkg.Files {
		if err := e.cursorStore.Upsert(PullCursor{
			SourceID:    source.SourceID,
			TaskID:      task.TaskID,
			AgentID:     pkg.AgentID,
			SourceRef:   pkg.SourceRef,
			SourcePath:  strings.TrimSpace(file.FilePath),
			LastCursor:  pkg.NextCursor,
			LastOffset:  file.ToOffset,
			LastBatchID: pkg.BatchID,
			RequestID:   task.RequestID,
			UpdatedAt:   now,
		}); err != nil {
			return err
		}
	}
	return nil
}

func (e *PullTaskExecutor) resolveStartCursor(task PullTask, source PullSource) string {
	if cursor := strings.TrimSpace(task.LastCursor); cursor != "" {
		return cursor
	}
	if sourcePath := strings.TrimSpace(source.Path); sourcePath != "" {
		if cursor, ok := e.cursorStore.GetBySourceAndPath(source.SourceID, sourcePath); ok {
			return strings.TrimSpace(cursor.LastCursor)
		}
	}
	return ""
}

func (e *PullTaskExecutor) resolveCredential(source PullSource) (AgentAuthCredential, bool) {
	// 优先按 key_ref 解析，支持 active/next 轮换能力。
	if keyRef := strings.TrimSpace(source.KeyRef); keyRef != "" && e.authKeyStore != nil {
		if credential, ok := e.authKeyStore.ResolveCredential(keyRef); ok {
			return credential, true
		}
	}
	key := strings.TrimSpace(e.config.DefaultAgentKey)
	if key == "" {
		return AgentAuthCredential{}, false
	}
	keyID := strings.TrimSpace(e.config.DefaultAgentKeyID)
	if keyID == "" {
		keyID = "active"
	}
	return AgentAuthCredential{
		KeyID: keyID,
		Key:   key,
	}, true
}

func (e *PullTaskExecutor) resolveAgentID(task PullTask, source PullSource) string {
	if candidate := strings.TrimSpace(resolveStringOption(task.Options, "agent_id")); candidate != "" {
		return candidate
	}
	if candidate := strings.TrimSpace(source.Host); candidate != "" {
		return candidate
	}
	return strings.TrimSpace(source.SourceID)
}

func (e *PullTaskExecutor) observeTaskLatency(task PullTask, status string) {
	if e == nil || e.latencyMonitor == nil {
		return
	}
	snapshot, shouldAlert := e.latencyMonitor.Observe(
		strings.TrimSpace(task.SourceID),
		strings.TrimSpace(task.TaskID),
		strings.TrimSpace(status),
		task.ScheduledAt.UTC(),
		time.Now().UTC(),
	)
	if !shouldAlert {
		return
	}
	log.Printf(
		"ingest latency alert source_id=%s task_id=%s status=%s count=%d p95_ms=%d p99_ms=%d max_ms=%d",
		snapshot.LastSourceID,
		snapshot.LastTaskID,
		snapshot.LastStatus,
		snapshot.Count,
		snapshot.P95MS,
		snapshot.P99MS,
		snapshot.MaxMS,
	)
}

type errorDetailPayloadCarrier interface {
	DetailPayload() map[string]any
}

func extractFailureDetailPayload(err error) map[string]any {
	var carrier errorDetailPayloadCarrier
	if !errors.As(err, &carrier) {
		return nil
	}
	return carrier.DetailPayload()
}

func resolveStringOption(options map[string]any, key string) string {
	if options == nil {
		return ""
	}
	raw, ok := options[key]
	if !ok || raw == nil {
		return ""
	}
	return strings.TrimSpace(fmt.Sprintf("%v", raw))
}
