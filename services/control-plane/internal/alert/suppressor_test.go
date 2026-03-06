package alert

import (
	"testing"
	"time"
)

func TestSuppressor_SameRuleSourceWithinWindow_Suppress(t *testing.T) {
	s := NewSuppressor(5 * time.Minute)
	ruleID, sourceID := "r1", "s1"

	s.Record(ruleID, sourceID)
	if !s.ShouldSuppress(ruleID, sourceID) {
		t.Error("expected suppress: same rule+source within 5min")
	}
}

func TestSuppressor_DifferentRule_NotSuppress(t *testing.T) {
	s := NewSuppressor(5 * time.Minute)
	s.Record("r1", "s1")

	if s.ShouldSuppress("r2", "s1") {
		t.Error("expected not suppress: different rule")
	}
}

func TestSuppressor_DifferentSource_NotSuppress(t *testing.T) {
	s := NewSuppressor(5 * time.Minute)
	s.Record("r1", "s1")

	if s.ShouldSuppress("r1", "s2") {
		t.Error("expected not suppress: different source")
	}
}

func TestSuppressor_AfterWindow_NotSuppress(t *testing.T) {
	s := NewSuppressor(100 * time.Millisecond)
	ruleID, sourceID := "r1", "s1"

	s.Record(ruleID, sourceID)
	time.Sleep(150 * time.Millisecond)
	if s.ShouldSuppress(ruleID, sourceID) {
		t.Error("expected not suppress: after 5min window")
	}
}

func TestSuppressor_CleanupRemovesExpired(t *testing.T) {
	s := NewSuppressor(50 * time.Millisecond)
	s.Record("r1", "s1")
	s.Record("r2", "s2")
	if c := s.SuppressedCount(); c != 2 {
		t.Errorf("SuppressedCount want 2, got %d", c)
	}
	time.Sleep(60 * time.Millisecond)
	s.Cleanup()
	if c := s.SuppressedCount(); c != 0 {
		t.Errorf("after Cleanup SuppressedCount want 0, got %d", c)
	}
}

func TestSuppressor_SuppressedCount(t *testing.T) {
	s := NewSuppressor(5 * time.Minute)
	if c := s.SuppressedCount(); c != 0 {
		t.Errorf("initial SuppressedCount want 0, got %d", c)
	}
	s.Record("r1", "s1")
	if c := s.SuppressedCount(); c != 1 {
		t.Errorf("SuppressedCount want 1, got %d", c)
	}
	s.Record("r1", "s2")
	if c := s.SuppressedCount(); c != 2 {
		t.Errorf("SuppressedCount want 2, got %d", c)
	}
}

func TestNewSuppressor_DefaultWindow(t *testing.T) {
	s := NewSuppressor(0)
	if s.window != 5*time.Minute {
		t.Errorf("default window want 5m, got %v", s.window)
	}
}
