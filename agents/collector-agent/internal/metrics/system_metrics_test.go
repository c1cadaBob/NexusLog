package metrics

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestNewCollector(t *testing.T) {
	c := NewCollector(30 * time.Second)
	if c == nil {
		t.Fatal("NewCollector returned nil")
	}
	if c.interval != 30*time.Second {
		t.Errorf("interval = %v, want 30s", c.interval)
	}
}

func TestCollector_StartStop(t *testing.T) {
	c := NewCollector(100 * time.Millisecond)
	c.Start()
	time.Sleep(150 * time.Millisecond)
	m := c.Latest()
	if m == nil {
		t.Error("Latest() returned nil after Start")
	}
	c.Stop()
}

func TestCollector_Latest(t *testing.T) {
	c := NewCollector(1 * time.Hour)
	// Before Start, Latest should be nil
	if m := c.Latest(); m != nil {
		t.Errorf("Latest() before Start = %v, want nil", m)
	}
	c.Start()
	time.Sleep(50 * time.Millisecond)
	m := c.Latest()
	if m == nil {
		t.Fatal("Latest() after Start = nil")
	}
	if m.CollectedAt.IsZero() {
		t.Error("CollectedAt is zero")
	}
	c.Stop()
}

func TestCollector_DefaultInterval(t *testing.T) {
	c := NewCollector(0)
	if c.interval != 30*time.Second {
		t.Errorf("zero interval should default to 30s, got %v", c.interval)
	}
}

func TestMetricsHandler(t *testing.T) {
	c := NewCollector(50 * time.Millisecond)
	c.Start()
	defer c.Stop()
	time.Sleep(60 * time.Millisecond)

	req := httptest.NewRequest(http.MethodGet, "/agent/v1/metrics", nil)
	rec := httptest.NewRecorder()
	MetricsHandler(c).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", rec.Code)
	}
	var m SystemMetrics
	if err := json.NewDecoder(rec.Body).Decode(&m); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if m.CollectedAt.IsZero() {
		t.Error("CollectedAt is zero in response")
	}
}
