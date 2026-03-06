package ingest

import (
	"sync"
)

// Deduplicator implements a sliding-window deduplicator based on event_id.
// Uses a ring of sets to keep memory bounded while detecting duplicates
// across the configured number of batches.
type Deduplicator struct {
	mu         sync.Mutex
	windowSize int
	slots      []map[string]struct{}
	writeIdx   int
	totalSeen  int64
	totalDup   int64
}

// DeduplicatorStats exposes observable metrics including duplicate_ratio.
type DeduplicatorStats struct {
	TotalSeen      int64
	TotalDuplicate int64
	DuplicateRatio float64
	WindowBatches  int
}

// NewDeduplicator creates a deduplicator with the given sliding window size (batches).
// Defaults to 5 if windowSize <= 0.
func NewDeduplicator(windowSize int) *Deduplicator {
	if windowSize <= 0 {
		windowSize = 5
	}
	slots := make([]map[string]struct{}, windowSize)
	for i := range slots {
		slots[i] = make(map[string]struct{})
	}
	return &Deduplicator{
		windowSize: windowSize,
		slots:      slots,
		writeIdx:   0,
	}
}

// IsDuplicate returns true if eventID was already seen within the current window.
// Thread-safe.
func (d *Deduplicator) IsDuplicate(eventID string) bool {
	d.mu.Lock()
	defer d.mu.Unlock()

	d.totalSeen++

	for _, slot := range d.slots {
		if _, ok := slot[eventID]; ok {
			d.totalDup++
			return true
		}
	}

	d.slots[d.writeIdx][eventID] = struct{}{}
	return false
}

// AdvanceBatch moves to the next batch window: clears the oldest slot and advances the write pointer.
// Thread-safe.
func (d *Deduplicator) AdvanceBatch() {
	d.mu.Lock()
	defer d.mu.Unlock()

	nextIdx := (d.writeIdx + 1) % d.windowSize
	d.slots[nextIdx] = make(map[string]struct{})
	d.writeIdx = nextIdx
}

// Stats returns current deduplicator metrics including duplicate_ratio.
// Thread-safe.
func (d *Deduplicator) Stats() DeduplicatorStats {
	d.mu.Lock()
	defer d.mu.Unlock()

	ratio := 0.0
	if d.totalSeen > 0 {
		ratio = float64(d.totalDup) / float64(d.totalSeen)
	}
	return DeduplicatorStats{
		TotalSeen:      d.totalSeen,
		TotalDuplicate: d.totalDup,
		DuplicateRatio: ratio,
		WindowBatches:  d.windowSize,
	}
}
