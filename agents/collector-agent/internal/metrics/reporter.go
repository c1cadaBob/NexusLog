package metrics

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

type ReporterConfig struct {
	Enabled    bool
	BaseURL    string
	Path       string
	AgentID    string
	ServerID   string
	AgentKeyID string
	AgentKey   string
	Interval   time.Duration
	Timeout    time.Duration
}

type Reporter struct {
	endpoint   string
	agentID    string
	serverID   string
	agentKeyID string
	agentKey   string
	interval   time.Duration
	timeout    time.Duration
	client     *http.Client
}

type reportRequest struct {
	AgentID  string        `json:"agent_id"`
	ServerID string        `json:"server_id"`
	Metrics  SystemMetrics `json:"metrics"`
}

func NewReporter(cfg ReporterConfig) (*Reporter, error) {
	if !cfg.Enabled {
		return nil, nil
	}

	baseURL := strings.TrimSpace(cfg.BaseURL)
	if baseURL == "" {
		return nil, nil
	}
	path := strings.TrimSpace(cfg.Path)
	if path == "" {
		path = "/api/v1/metrics/report"
	}
	path = "/" + strings.TrimLeft(path, "/")

	agentID := strings.TrimSpace(cfg.AgentID)
	if agentID == "" {
		return nil, fmt.Errorf("agent id is required")
	}
	serverID := strings.TrimSpace(cfg.ServerID)
	if serverID == "" {
		serverID = agentID
	}
	agentKeyID := strings.TrimSpace(cfg.AgentKeyID)
	if agentKeyID == "" {
		agentKeyID = "active"
	}
	agentKey := strings.TrimSpace(cfg.AgentKey)
	if agentKey == "" {
		return nil, fmt.Errorf("agent key is required")
	}
	interval := cfg.Interval
	if interval <= 0 {
		interval = 30 * time.Second
	}
	timeout := cfg.Timeout
	if timeout <= 0 {
		timeout = 10 * time.Second
	}

	return &Reporter{
		endpoint:   strings.TrimRight(baseURL, "/") + path,
		agentID:    agentID,
		serverID:   serverID,
		agentKeyID: agentKeyID,
		agentKey:   agentKey,
		interval:   interval,
		timeout:    timeout,
		client:     &http.Client{Timeout: timeout},
	}, nil
}

func (r *Reporter) Start(ctx context.Context, collector *Collector) {
	if r == nil || collector == nil {
		return
	}
	go r.run(ctx, collector)
}

func (r *Reporter) run(ctx context.Context, collector *Collector) {
	if err := r.reportLatest(ctx, collector); err != nil {
		log.Printf("system metrics initial report failed: %v", err)
	}

	ticker := time.NewTicker(r.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := r.reportLatest(ctx, collector); err != nil {
				log.Printf("system metrics report failed: %v", err)
			}
		}
	}
}

func (r *Reporter) reportLatest(ctx context.Context, collector *Collector) error {
	if r == nil || collector == nil {
		return nil
	}
	latest := collector.Latest()
	if latest == nil {
		return nil
	}

	payload := reportRequest{
		AgentID:  r.agentID,
		ServerID: r.serverID,
		Metrics:  *latest,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal metrics payload: %w", err)
	}

	requestCtx, cancel := context.WithTimeout(ctx, r.timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(requestCtx, http.MethodPost, r.endpoint, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build metrics request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Key-Id", r.agentKeyID)
	req.Header.Set("X-Agent-Key", r.agentKey)

	resp, err := r.client.Do(req)
	if err != nil {
		return fmt.Errorf("send metrics request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= http.StatusMultipleChoices {
		rawBody, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		message := strings.TrimSpace(string(rawBody))
		if message == "" {
			message = resp.Status
		}
		return fmt.Errorf("metrics report rejected: status=%d body=%s", resp.StatusCode, message)
	}

	return nil
}
