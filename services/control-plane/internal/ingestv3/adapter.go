package ingestv3

import (
	"strings"
	"time"

	legacyingest "github.com/nexuslog/control-plane/internal/ingest"
)

type LegacyCursorStoreAdapter struct {
	Store        *legacyingest.PullCursorStore
	DefaultAgent string
}

func (a *LegacyCursorStoreAdapter) Get(sourceID string, filePath string) (CursorEntry, bool) {
	if a == nil || a.Store == nil {
		return CursorEntry{}, false
	}
	item, ok := a.Store.GetBySourceAndPath(sourceID, filePath)
	if !ok {
		return CursorEntry{}, false
	}
	return CursorEntry{
		SourceID:   item.SourceID,
		FilePath:   item.SourcePath,
		LastCursor: item.LastCursor,
		LastOffset: item.LastOffset,
	}, true
}

func (a *LegacyCursorStoreAdapter) Put(entry CursorEntry) error {
	if a == nil || a.Store == nil {
		return nil
	}
	agentID := strings.TrimSpace(a.DefaultAgent)
	if agentID == "" {
		agentID = "ingestv3-rewrite"
	}
	sourceRef := strings.TrimSpace(entry.FilePath)
	return a.Store.Upsert(legacyingest.PullCursor{
		SourceID:   strings.TrimSpace(entry.SourceID),
		AgentID:    agentID,
		SourceRef:  sourceRef,
		SourcePath: strings.TrimSpace(entry.FilePath),
		LastCursor: strings.TrimSpace(entry.LastCursor),
		LastOffset: entry.LastOffset,
		UpdatedAt:  time.Now().UTC(),
	})
}
