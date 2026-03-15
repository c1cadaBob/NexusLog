package metrics

import (
	"context"
	"fmt"
	"math"
	"strings"
	"time"
)

// ThresholdEvaluator evaluates metrics against resource thresholds.
type ThresholdEvaluator interface {
	EvaluateMetrics(ctx context.Context, tenantID, agentID string, m *SystemMetrics) error
}

// MetricsOverviewSnapshot is the latest snapshot returned to the dashboard.
type MetricsOverviewSnapshot struct {
	AgentID          string    `json:"agent_id"`
	ServerID         string    `json:"server_id"`
	CPUUsagePct      float64   `json:"cpu_usage_pct"`
	MemoryUsagePct   float64   `json:"memory_usage_pct"`
	DiskUsagePct     float64   `json:"disk_usage_pct"`
	DiskIOReadBytes  int64     `json:"disk_io_read_bytes"`
	DiskIOWriteBytes int64     `json:"disk_io_write_bytes"`
	NetInBytes       int64     `json:"net_in_bytes"`
	NetOutBytes      int64     `json:"net_out_bytes"`
	CollectedAt      time.Time `json:"collected_at"`
}

// MetricsOverviewTrendPoint is an aggregated point used by the dashboard chart.
type MetricsOverviewTrendPoint struct {
	Timestamp         string  `json:"timestamp"`
	ActiveAgents      int     `json:"active_agents"`
	AvgCPUUsagePct    float64 `json:"avg_cpu_usage_pct"`
	AvgMemoryUsagePct float64 `json:"avg_memory_usage_pct"`
	AvgDiskUsagePct   float64 `json:"avg_disk_usage_pct"`
	TotalNetInBytes   int64   `json:"total_net_in_bytes"`
	TotalNetOutBytes  int64   `json:"total_net_out_bytes"`
	NetInDeltaBytes   int64   `json:"net_in_delta_bytes"`
	NetOutDeltaBytes  int64   `json:"net_out_delta_bytes"`
}

// MetricsOverview is the dashboard payload for infrastructure cards.
type MetricsOverview struct {
	ActiveAgents           int                         `json:"active_agents"`
	LatestCollectedAt      string                      `json:"latest_collected_at"`
	AvgCPUUsagePct         float64                     `json:"avg_cpu_usage_pct"`
	AvgMemoryUsagePct      float64                     `json:"avg_memory_usage_pct"`
	AvgDiskUsagePct        float64                     `json:"avg_disk_usage_pct"`
	TotalDiskIOReadBytes   int64                       `json:"total_disk_io_read_bytes"`
	TotalDiskIOWriteBytes  int64                       `json:"total_disk_io_write_bytes"`
	TotalNetInBytes        int64                       `json:"total_net_in_bytes"`
	TotalNetOutBytes       int64                       `json:"total_net_out_bytes"`
	LatestNetInDeltaBytes  int64                       `json:"latest_net_in_delta_bytes"`
	LatestNetOutDeltaBytes int64                       `json:"latest_net_out_delta_bytes"`
	Snapshots              []MetricsOverviewSnapshot   `json:"snapshots"`
	Trend                  []MetricsOverviewTrendPoint `json:"trend"`
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

// QueryOverview returns aggregated dashboard metrics for the tenant.
func (s *Service) QueryOverview(ctx context.Context, tenantID string, from, to time.Time, snapshotLimit int) (*MetricsOverview, error) {
	if snapshotLimit <= 0 {
		snapshotLimit = 4
	}

	snapshots, err := s.repo.QueryLatestMetricsSnapshots(ctx, tenantID, from, to)
	if err != nil {
		return nil, err
	}

	bucketSeconds := int64(resolveOverviewBucket(from, to).Seconds())
	trendRows, err := s.repo.QueryOverviewTrend(ctx, tenantID, from, to, bucketSeconds)
	if err != nil {
		return nil, err
	}

	result := &MetricsOverview{
		Snapshots: make([]MetricsOverviewSnapshot, 0, minInt(snapshotLimit, len(snapshots))),
		Trend:     make([]MetricsOverviewTrendPoint, 0, len(trendRows)),
	}
	if len(snapshots) == 0 {
		for index, row := range trendRows {
			point := buildTrendPoint(row, trendRows, index)
			result.Trend = append(result.Trend, point)
		}
		if len(result.Trend) > 0 {
			last := result.Trend[len(result.Trend)-1]
			result.LatestNetInDeltaBytes = last.NetInDeltaBytes
			result.LatestNetOutDeltaBytes = last.NetOutDeltaBytes
		}
		return result, nil
	}

	var cpuSum float64
	var memorySum float64
	var diskSum float64
	for index, snapshot := range snapshots {
		cpuSum += snapshot.CPUUsagePct
		memorySum += snapshot.MemoryUsagePct
		diskSum += snapshot.DiskUsagePct
		result.TotalDiskIOReadBytes += snapshot.DiskIOReadBytes
		result.TotalDiskIOWriteBytes += snapshot.DiskIOWriteBytes
		result.TotalNetInBytes += snapshot.NetInBytes
		result.TotalNetOutBytes += snapshot.NetOutBytes
		if index < snapshotLimit {
			result.Snapshots = append(result.Snapshots, MetricsOverviewSnapshot{
				AgentID:          snapshot.AgentID,
				ServerID:         snapshot.ServerID,
				CPUUsagePct:      roundMetricValue(snapshot.CPUUsagePct),
				MemoryUsagePct:   roundMetricValue(snapshot.MemoryUsagePct),
				DiskUsagePct:     roundMetricValue(snapshot.DiskUsagePct),
				DiskIOReadBytes:  snapshot.DiskIOReadBytes,
				DiskIOWriteBytes: snapshot.DiskIOWriteBytes,
				NetInBytes:       snapshot.NetInBytes,
				NetOutBytes:      snapshot.NetOutBytes,
				CollectedAt:      snapshot.CollectedAt,
			})
		}
	}

	result.ActiveAgents = len(snapshots)
	result.LatestCollectedAt = snapshots[0].CollectedAt.Format(time.RFC3339)
	result.AvgCPUUsagePct = roundMetricValue(cpuSum / float64(len(snapshots)))
	result.AvgMemoryUsagePct = roundMetricValue(memorySum / float64(len(snapshots)))
	result.AvgDiskUsagePct = roundMetricValue(diskSum / float64(len(snapshots)))

	for index, row := range trendRows {
		point := buildTrendPoint(row, trendRows, index)
		result.Trend = append(result.Trend, point)
	}
	if len(result.Trend) > 0 {
		last := result.Trend[len(result.Trend)-1]
		result.LatestNetInDeltaBytes = last.NetInDeltaBytes
		result.LatestNetOutDeltaBytes = last.NetOutDeltaBytes
	}

	return result, nil
}

func buildTrendPoint(row OverviewTrendRow, rows []OverviewTrendRow, index int) MetricsOverviewTrendPoint {
	point := MetricsOverviewTrendPoint{
		Timestamp:         row.BucketStart.Format(time.RFC3339),
		ActiveAgents:      row.ActiveAgents,
		AvgCPUUsagePct:    roundMetricValue(row.AvgCPUUsagePct),
		AvgMemoryUsagePct: roundMetricValue(row.AvgMemoryUsagePct),
		AvgDiskUsagePct:   roundMetricValue(row.AvgDiskUsagePct),
		TotalNetInBytes:   row.TotalNetInBytes,
		TotalNetOutBytes:  row.TotalNetOutBytes,
	}
	if index > 0 {
		deltaIn := row.TotalNetInBytes - rows[index-1].TotalNetInBytes
		deltaOut := row.TotalNetOutBytes - rows[index-1].TotalNetOutBytes
		if deltaIn > 0 {
			point.NetInDeltaBytes = deltaIn
		}
		if deltaOut > 0 {
			point.NetOutDeltaBytes = deltaOut
		}
	}
	return point
}

func resolveOverviewBucket(from, to time.Time) time.Duration {
	window := to.Sub(from)
	switch {
	case window <= time.Hour:
		return 5 * time.Minute
	case window <= 6*time.Hour:
		return 15 * time.Minute
	case window <= 24*time.Hour:
		return time.Hour
	default:
		return 6 * time.Hour
	}
}

func roundMetricValue(value float64) float64 {
	return math.Round(value*100) / 100
}

func minInt(left, right int) int {
	if left < right {
		return left
	}
	return right
}
