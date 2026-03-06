package metrics

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// ThresholdEvaluator evaluates metrics against resource thresholds.
type ThresholdEvaluator interface {
	EvaluateMetrics(ctx context.Context, tenantID, agentID string, m *SystemMetrics) error
}

// Service handles metrics business logic.
type Service struct {
	repo      *Repository
	evaluator ThresholdEvaluator
}

// NewService creates a new metrics service.
func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

// WithEvaluator sets the threshold evaluator for alert triggering.
func (s *Service) WithEvaluator(e ThresholdEvaluator) *Service {
	s.evaluator = e
	return s
}

// ValidateMetrics validates the report request.
func (s *Service) ValidateMetrics(req *ReportRequest) error {
	if strings.TrimSpace(req.AgentID) == "" {
		return fmt.Errorf("agent_id is required")
	}
	if strings.TrimSpace(req.ServerID) == "" {
		return fmt.Errorf("server_id is required")
	}
	if req.Metrics.CollectedAt.IsZero() {
		req.Metrics.CollectedAt = time.Now().UTC()
	}
	return nil
}

// ReportMetrics validates, inserts metrics, and evaluates thresholds for alerts.
func (s *Service) ReportMetrics(ctx context.Context, tenantID string, req *ReportRequest) error {
	if err := s.ValidateMetrics(req); err != nil {
		return err
	}
	if err := s.repo.InsertMetrics(ctx, tenantID, req); err != nil {
		return err
	}
	if s.evaluator != nil {
		_ = s.evaluator.EvaluateMetrics(ctx, tenantID, req.AgentID, &req.Metrics)
	}
	return nil
}

// QueryMetrics returns metrics for an agent within the time range.
func (s *Service) QueryMetrics(ctx context.Context, tenantID, agentID string, from, to time.Time) ([]ServerMetric, error) {
	return s.repo.QueryMetrics(ctx, tenantID, agentID, from, to)
}
