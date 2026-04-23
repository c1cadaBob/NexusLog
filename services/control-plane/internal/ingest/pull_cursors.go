package ingest

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/nexuslog/control-plane/internal/pathmatch"
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

// GetLatestBySource 查询同一 source_id 下最近更新的游标。
func (s *PullCursorStore) GetLatestBySource(sourceID string) (PullCursor, bool) {
	if s.backend != nil {
		return s.getLatestBySourceFromDB(context.Background(), sourceID)
	}

	normalizedSourceID := strings.TrimSpace(sourceID)
	if normalizedSourceID == "" {
		return PullCursor{}, false
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	latest := PullCursor{}
	found := false
	for _, item := range s.items {
		if strings.TrimSpace(item.SourceID) != normalizedSourceID {
			continue
		}
		if !found || item.UpdatedAt.After(latest.UpdatedAt) || (item.UpdatedAt.Equal(latest.UpdatedAt) && item.LastOffset > latest.LastOffset) {
			latest = item
			found = true
		}
	}
	return latest, found
}

// GetLatestMatchingSourcePath 查询同一 source_id 下与路径模式匹配的最近游标。
func (s *PullCursorStore) GetLatestMatchingSourcePath(sourceID, sourcePathPattern string) (PullCursor, bool) {
	if s.backend != nil {
		return s.getLatestMatchingSourcePathFromDB(context.Background(), sourceID, sourcePathPattern)
	}

	normalizedSourceID := strings.TrimSpace(sourceID)
	if normalizedSourceID == "" {
		return PullCursor{}, false
	}
	patterns := parseCursorSourcePathPatterns(sourcePathPattern)
	if len(patterns) == 0 {
		return PullCursor{}, false
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	latest := PullCursor{}
	found := false
	for _, item := range s.items {
		if strings.TrimSpace(item.SourceID) != normalizedSourceID {
			continue
		}
		if !cursorSourcePathMatches(patterns, item.SourcePath) {
			continue
		}
		if !found || item.UpdatedAt.After(latest.UpdatedAt) || (item.UpdatedAt.Equal(latest.UpdatedAt) && item.LastOffset > latest.LastOffset) {
			latest = item
			found = true
		}
	}
	return latest, found
}

func buildCursorKey(sourceID, sourcePath string) string {
	return strings.TrimSpace(sourceID) + "|" + strings.TrimSpace(sourcePath)
}

func hasSourcePathPattern(sourcePath string) bool {
	trimmed := strings.TrimSpace(sourcePath)
	return strings.Contains(trimmed, ",") || strings.ContainsAny(trimmed, "*?[")
}

func parseCursorSourcePathPatterns(sourcePath string) []string {
	parts := strings.Split(strings.TrimSpace(sourcePath), ",")
	patterns := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed == "" {
			continue
		}
		patterns = append(patterns, trimmed)
	}
	return patterns
}

func cursorSourcePathMatches(patterns []string, sourcePath string) bool {
	sourcePath = strings.TrimSpace(sourcePath)
	if sourcePath == "" {
		return false
	}
	for _, pattern := range patterns {
		pattern = strings.TrimSpace(pattern)
		if pattern == "" {
			continue
		}
		if matched, err := pathmatch.Match(pattern, sourcePath); err == nil && matched {
			return true
		}
		if pattern == sourcePath {
			return true
		}
	}
	return false
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
