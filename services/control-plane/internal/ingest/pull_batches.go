package ingest

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"
)

// PullBatchStatus 定义批次处理状态集合。
type PullBatchStatus string

const (
	PullBatchStatusCreated      PullBatchStatus = "created"
	PullBatchStatusProcessed    PullBatchStatus = "processed"
	PullBatchStatusAcked        PullBatchStatus = "acked"
	PullBatchStatusNacked       PullBatchStatus = "nacked"
	PullBatchStatusFailed       PullBatchStatus = "failed"
	PullBatchStatusDeadLettered PullBatchStatus = "dead_lettered"
)

// PullBatch 定义 agent_pull_batches 的领域模型。
type PullBatch struct {
	BatchID      string    `json:"batch_id"`
	Checksum     string    `json:"checksum"`
	SourceID     string    `json:"source_id,omitempty"`
	TaskID       string    `json:"task_id,omitempty"`
	PackageID    string    `json:"package_id,omitempty"`
	AgentID      string    `json:"agent_id"`
	Cursor       string    `json:"cursor,omitempty"`
	NextCursor   string    `json:"next_cursor,omitempty"`
	Status       string    `json:"status"`
	RecordCount  int       `json:"record_count"`
	SizeBytes    int64     `json:"size_bytes"`
	RetryCount   int       `json:"retry_count"`
	RequestID    string    `json:"request_id,omitempty"`
	ErrorCode    string    `json:"error_code,omitempty"`
	ErrorMessage string    `json:"error_message,omitempty"`
	AckedAt      time.Time `json:"acked_at,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// PullBatchStore 管理批次幂等与状态流转。
type PullBatchStore struct {
	mu      sync.RWMutex
	items   map[string]PullBatch
	backend *PGBackend
}

// NewPullBatchStore 创建内存仓储。
func NewPullBatchStore() *PullBatchStore {
	return &PullBatchStore{
		items: make(map[string]PullBatch),
	}
}

// NewPullBatchStoreWithPG 创建 PostgreSQL 仓储。
func NewPullBatchStoreWithPG(backend *PGBackend) *PullBatchStore {
	return &PullBatchStore{
		items:   make(map[string]PullBatch),
		backend: backend,
	}
}

// Upsert 幂等写入批次元数据。
func (s *PullBatchStore) Upsert(batch PullBatch) (PullBatch, error) {
	if s.backend != nil {
		return s.upsertFromDB(context.Background(), batch)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	normalized, err := normalizePullBatch(batch)
	if err != nil {
		return PullBatch{}, err
	}
	key := buildPullBatchKey(normalized.BatchID, normalized.Checksum)
	if existing, ok := s.items[key]; ok {
		return existing, nil
	}
	s.items[key] = normalized
	return normalized, nil
}

// MarkStatus 更新批次状态。
func (s *PullBatchStore) MarkStatus(batchID, checksum, status, errorCode, errorMessage string, retryCount int, ackedAt *time.Time) bool {
	if s.backend != nil {
		return s.markStatusFromDB(context.Background(), batchID, checksum, status, errorCode, errorMessage, retryCount, ackedAt)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	key := buildPullBatchKey(batchID, checksum)
	item, ok := s.items[key]
	if !ok {
		return false
	}
	item.Status = normalizeBatchStatus(status)
	item.ErrorCode = strings.TrimSpace(errorCode)
	item.ErrorMessage = strings.TrimSpace(errorMessage)
	item.RetryCount = retryCount
	if ackedAt != nil && !ackedAt.IsZero() {
		item.AckedAt = ackedAt.UTC()
	}
	item.UpdatedAt = time.Now().UTC()
	s.items[key] = item
	return true
}

// GetByBatchID 查询批次（同 batch_id 可能对应多个 checksum 时返回最新记录）。
func (s *PullBatchStore) GetByBatchID(batchID string) (PullBatch, bool) {
	if s.backend != nil {
		return s.getLatestByBatchIDFromDB(context.Background(), batchID)
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	batchID = strings.TrimSpace(batchID)
	if batchID == "" {
		return PullBatch{}, false
	}
	var (
		best  PullBatch
		found bool
	)
	for _, item := range s.items {
		if item.BatchID != batchID {
			continue
		}
		if !found || item.CreatedAt.After(best.CreatedAt) {
			best = item
			found = true
		}
	}
	return best, found
}

func buildPullBatchKey(batchID, checksum string) string {
	return strings.TrimSpace(batchID) + "|" + strings.TrimSpace(checksum)
}

func normalizePullBatch(batch PullBatch) (PullBatch, error) {
	batch.BatchID = strings.TrimSpace(batch.BatchID)
	batch.Checksum = strings.TrimSpace(batch.Checksum)
	batch.SourceID = strings.TrimSpace(batch.SourceID)
	batch.TaskID = strings.TrimSpace(batch.TaskID)
	batch.PackageID = strings.TrimSpace(batch.PackageID)
	batch.AgentID = strings.TrimSpace(batch.AgentID)
	batch.Cursor = strings.TrimSpace(batch.Cursor)
	batch.NextCursor = strings.TrimSpace(batch.NextCursor)
	batch.Status = normalizeBatchStatus(batch.Status)
	batch.RequestID = strings.TrimSpace(batch.RequestID)
	batch.ErrorCode = strings.TrimSpace(batch.ErrorCode)
	batch.ErrorMessage = strings.TrimSpace(batch.ErrorMessage)
	if batch.BatchID == "" {
		return PullBatch{}, fmt.Errorf("batch_id is required")
	}
	if batch.Checksum == "" {
		return PullBatch{}, fmt.Errorf("checksum is required")
	}
	if batch.AgentID == "" {
		return PullBatch{}, fmt.Errorf("agent_id is required")
	}
	if batch.CreatedAt.IsZero() {
		batch.CreatedAt = time.Now().UTC()
	}
	if batch.UpdatedAt.IsZero() {
		batch.UpdatedAt = batch.CreatedAt
	}
	if batch.RecordCount < 0 {
		batch.RecordCount = 0
	}
	if batch.SizeBytes < 0 {
		batch.SizeBytes = 0
	}
	if batch.RetryCount < 0 {
		batch.RetryCount = 0
	}
	return batch, nil
}

func normalizeBatchStatus(status string) string {
	status = strings.ToLower(strings.TrimSpace(status))
	switch status {
	case string(PullBatchStatusProcessed),
		string(PullBatchStatusAcked),
		string(PullBatchStatusNacked),
		string(PullBatchStatusFailed),
		string(PullBatchStatusDeadLettered):
		return status
	default:
		return string(PullBatchStatusCreated)
	}
}
