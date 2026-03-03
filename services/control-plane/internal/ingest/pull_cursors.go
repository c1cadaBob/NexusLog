package ingest

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"
)

// PullCursor 定义按 source/path 保存的断点游标模型。
type PullCursor struct {
	SourceID    string    `json:"source_id"`
	TaskID      string    `json:"task_id,omitempty"`
	AgentID     string    `json:"agent_id"`
	SourceRef   string    `json:"source_ref"`
	SourcePath  string    `json:"source_path"`
	LastCursor  string    `json:"last_cursor,omitempty"`
	LastOffset  int64     `json:"last_offset"`
	LastBatchID string    `json:"last_batch_id,omitempty"`
	RequestID   string    `json:"request_id,omitempty"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// PullCursorStore 管理游标持久化。
type PullCursorStore struct {
	mu      sync.RWMutex
	items   map[string]PullCursor
	backend *PGBackend
}

// NewPullCursorStore 创建内存仓储。
func NewPullCursorStore() *PullCursorStore {
	return &PullCursorStore{
		items: make(map[string]PullCursor),
	}
}

// NewPullCursorStoreWithPG 创建 PostgreSQL 仓储。
func NewPullCursorStoreWithPG(backend *PGBackend) *PullCursorStore {
	return &PullCursorStore{
		items:   make(map[string]PullCursor),
		backend: backend,
	}
}

// Upsert 按 source_id + source_path 幂等写入游标。
func (s *PullCursorStore) Upsert(cursor PullCursor) error {
	if s.backend != nil {
		return s.upsertFromDB(context.Background(), cursor)
	}

	normalized, err := normalizePullCursor(cursor)
	if err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.items[buildCursorKey(normalized.SourceID, normalized.SourcePath)] = normalized
	return nil
}

// GetBySourceAndPath 查询单个游标。
func (s *PullCursorStore) GetBySourceAndPath(sourceID, sourcePath string) (PullCursor, bool) {
	if s.backend != nil {
		return s.getFromDB(context.Background(), sourceID, sourcePath)
	}

	s.mu.RLock()
	defer s.mu.RUnlock()
	item, ok := s.items[buildCursorKey(sourceID, sourcePath)]
	return item, ok
}

func buildCursorKey(sourceID, sourcePath string) string {
	return strings.TrimSpace(sourceID) + "|" + strings.TrimSpace(sourcePath)
}

func normalizePullCursor(cursor PullCursor) (PullCursor, error) {
	cursor.SourceID = strings.TrimSpace(cursor.SourceID)
	cursor.TaskID = strings.TrimSpace(cursor.TaskID)
	cursor.AgentID = strings.TrimSpace(cursor.AgentID)
	cursor.SourceRef = strings.TrimSpace(cursor.SourceRef)
	cursor.SourcePath = strings.TrimSpace(cursor.SourcePath)
	cursor.LastCursor = strings.TrimSpace(cursor.LastCursor)
	cursor.LastBatchID = strings.TrimSpace(cursor.LastBatchID)
	cursor.RequestID = strings.TrimSpace(cursor.RequestID)
	if cursor.SourceID == "" {
		return PullCursor{}, fmt.Errorf("source_id is required")
	}
	if cursor.AgentID == "" {
		return PullCursor{}, fmt.Errorf("agent_id is required")
	}
	if cursor.SourcePath == "" {
		return PullCursor{}, fmt.Errorf("source_path is required")
	}
	if cursor.LastOffset < 0 {
		cursor.LastOffset = 0
	}
	if cursor.UpdatedAt.IsZero() {
		cursor.UpdatedAt = time.Now().UTC()
	}
	return cursor, nil
}
