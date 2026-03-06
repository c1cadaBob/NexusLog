package alert

import (
	"sync"
	"time"
)

// Suppressor deduplicates alert events from the same rule+source within a time window.
type Suppressor struct {
	mu     sync.Mutex
	window time.Duration
	seen   map[string]time.Time
}

// NewSuppressor creates a suppressor with the given dedup window.
func NewSuppressor(window time.Duration) *Suppressor {
	if window <= 0 {
		window = 5 * time.Minute
	}
	return &Suppressor{
		window: window,
		seen:   make(map[string]time.Time),
	}
}

// ShouldSuppress returns true if the same ruleID+sourceID fired within the window.
func (s *Suppressor) ShouldSuppress(ruleID, sourceID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	key := ruleID + ":" + sourceID
	last, ok := s.seen[key]
	if !ok {
		return false
	}
	return time.Since(last) < s.window
}

// Record records a fire for ruleID+sourceID.
func (s *Suppressor) Record(ruleID, sourceID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	key := ruleID + ":" + sourceID
	s.seen[key] = time.Now()
}

// Cleanup removes expired entries from the seen map.
func (s *Suppressor) Cleanup() {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	for k, t := range s.seen {
		if now.Sub(t) >= s.window {
			delete(s.seen, k)
		}
	}
}

// SuppressedCount returns the number of entries currently in the suppressor (for metrics).
func (s *Suppressor) SuppressedCount() int64 {
	s.mu.Lock()
	defer s.mu.Unlock()
	return int64(len(s.seen))
}
