package metrics

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestReporterReportLatestSendsAgentKeyAndPayload(t *testing.T) {
	t.Parallel()

	var received reportRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("method=%s, want POST", r.Method)
		}
		if got := r.Header.Get("X-Key-Id"); got != "active" {
			t.Fatalf("X-Key-Id=%q, want active", got)
		}
		if got := r.Header.Get("X-Agent-Key"); got != "metrics-agent-secret" {
			t.Fatalf("X-Agent-Key=%q, want metrics-agent-secret", got)
		}
		rawBody, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("read body: %v", err)
		}
		if err := json.Unmarshal(rawBody, &received); err != nil {
			t.Fatalf("decode body: %v", err)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	collector := NewCollector(time.Second)
	collector.mu.Lock()
	collector.latest = &SystemMetrics{
		CPUUsagePct:      12.5,
		MemoryUsagePct:   34.5,
		DiskUsagePct:     56.5,
		DiskIOReadBytes:  1024,
		DiskIOWriteBytes: 2048,
		NetInBytes:       4096,
		NetOutBytes:      8192,
		CollectedAt:      time.Date(2026, 3, 15, 15, 0, 0, 0, time.UTC),
	}
	collector.mu.Unlock()

	reporter, err := NewReporter(ReporterConfig{
		Enabled:    true,
		BaseURL:    server.URL,
		AgentID:    "collector-agent-local",
		ServerID:   "dev-server-centos8",
		AgentKeyID: "active",
		AgentKey:   "metrics-agent-secret",
		Interval:   time.Second,
		Timeout:    2 * time.Second,
	})
	if err != nil {
		t.Fatalf("NewReporter: %v", err)
	}

	if err := reporter.reportLatest(context.Background(), collector); err != nil {
		t.Fatalf("reportLatest: %v", err)
	}

	if received.AgentID != "collector-agent-local" {
		t.Fatalf("agent_id=%q", received.AgentID)
	}
	if received.ServerID != "dev-server-centos8" {
		t.Fatalf("server_id=%q", received.ServerID)
	}
	if received.Metrics.CPUUsagePct != 12.5 || received.Metrics.NetOutBytes != 8192 {
		t.Fatalf("unexpected metrics payload: %+v", received.Metrics)
	}
}

func TestNewReporterDisabledWithoutBaseURL(t *testing.T) {
	t.Parallel()

	reporter, err := NewReporter(ReporterConfig{Enabled: true, AgentID: "agent-a", AgentKey: "secret"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if reporter != nil {
		t.Fatal("expected nil reporter when base url is missing")
	}
}
