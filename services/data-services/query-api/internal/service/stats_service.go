package service

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/nexuslog/data-services/query-api/internal/repository"
)

// OverviewStats represents dashboard overview statistics.
type OverviewStats struct {
	TotalLogs         int64            `json:"total_logs"`
	LevelDistribution map[string]int64 `json:"level_distribution"`
	TopSources        []SourceCount    `json:"top_sources"`
	AlertSummary      AlertSummary     `json:"alert_summary"`
	LogTrend          []LogTrendPoint  `json:"log_trend"`
}

// SourceCount represents source and count.
type SourceCount struct {
	Source string `json:"source"`
	Count  int64  `json:"count"`
}

// AlertSummary represents alert event summary.
type AlertSummary struct {
	Total    int64 `json:"total"`
	Firing   int64 `json:"firing"`
	Resolved int64 `json:"resolved"`
}

// LogTrendPoint represents a time bucket with count.
type LogTrendPoint struct {
	Time  string `json:"time"`
	Count int64  `json:"count"`
}

// StatsService provides dashboard and aggregation stats.
type StatsService struct {
	esRepo *repository.ElasticsearchRepository
	db     *sql.DB
}

// NewStatsService creates a stats service.
func NewStatsService(esRepo *repository.ElasticsearchRepository, db *sql.DB) *StatsService {
	return &StatsService{esRepo: esRepo, db: db}
}

// GetOverviewStats returns overview stats for a tenant. Must complete in < 3s.
func (s *StatsService) GetOverviewStats(ctx context.Context, tenantID string) (*OverviewStats, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	tenantID = strings.TrimSpace(tenantID)
	if tenantID == "" {
		tenantID = DefaultTenantID
	}

	stats := &OverviewStats{
		LevelDistribution: map[string]int64{
			"debug": 0, "info": 0, "warn": 0, "error": 0, "fatal": 0,
		},
		TopSources:   []SourceCount{},
		AlertSummary: AlertSummary{},
		LogTrend:     []LogTrendPoint{},
	}

	// Time range: last 24h
	now := time.Now().UTC()
	from24h := now.Add(-24 * time.Hour).Format(time.RFC3339)
	to := now.Format(time.RFC3339)

	// Build base filter for tenant
	filters := []map[string]any{
		{"range": map[string]any{"@timestamp": map[string]any{"gte": from24h, "lte": to}}},
	}
	filters = appendTenantFilter(filters, tenantID)
	query := map[string]any{
		"bool": map[string]any{"filter": filters},
	}

	// Single aggregation request for total, level_distribution, top_sources, log_trend
	aggs := map[string]any{
		"by_level": map[string]any{
			"terms": map[string]any{
				"field":   "log.level",
				"size":    20,
				"missing": "info",
			},
		},
		"by_source": map[string]any{
			"terms": map[string]any{
				"field": "source.path",
				"size":  10,
				"order": map[string]any{"_count": "desc"},
			},
		},
		"log_trend": map[string]any{
			"date_histogram": map[string]any{
				"field":             "@timestamp",
				"calendar_interval": "hour",
				"min_doc_count":     0,
			},
		},
	}

	body := map[string]any{
		"track_total_hits": true,
		"size":             0,
		"query":            query,
		"aggs":             aggs,
	}

	result, err := s.esRepo.SearchWithBody(ctx, body)
	if err != nil {
		return nil, fmt.Errorf("es overview query: %w", err)
	}

	stats.TotalLogs = result.Total

	// Parse level distribution
	if byLevel, ok := result.Aggregations["by_level"].(map[string]any); ok {
		if buckets, ok := byLevel["buckets"].([]any); ok {
			for _, b := range buckets {
				if bucket, ok := b.(map[string]any); ok {
					key, _ := bucket["key"].(string)
					count := int64(0)
					if c, ok := bucket["doc_count"].(float64); ok {
						count = int64(c)
					}
					key = strings.ToLower(strings.TrimSpace(key))
					if key == "" {
						key = "info"
					}
					if _, exists := stats.LevelDistribution[key]; exists {
						stats.LevelDistribution[key] += count
					} else {
						stats.LevelDistribution[key] = count
					}
				}
			}
		}
	}

	// Parse top sources
	if bySource, ok := result.Aggregations["by_source"].(map[string]any); ok {
		if buckets, ok := bySource["buckets"].([]any); ok {
			for _, b := range buckets {
				if bucket, ok := b.(map[string]any); ok {
					key, _ := bucket["key"].(string)
					count := int64(0)
					if c, ok := bucket["doc_count"].(float64); ok {
						count = int64(c)
					}
					stats.TopSources = append(stats.TopSources, SourceCount{Source: key, Count: count})
				}
			}
		}
	}

	// Parse log trend (date_histogram returns key_as_string)
	if logTrend, ok := result.Aggregations["log_trend"].(map[string]any); ok {
		if buckets, ok := logTrend["buckets"].([]any); ok {
			for _, b := range buckets {
				if bucket, ok := b.(map[string]any); ok {
					key := ""
					if keyStr, ok := bucket["key_as_string"].(string); ok {
						key = keyStr
					} else if keyNum, ok := bucket["key"].(float64); ok {
						key = time.UnixMilli(int64(keyNum)).UTC().Format(time.RFC3339)
					}
					count := int64(0)
					if c, ok := bucket["doc_count"].(float64); ok {
						count = int64(c)
					}
					stats.LogTrend = append(stats.LogTrend, LogTrendPoint{Time: key, Count: count})
				}
			}
		}
	}

	// Alert summary from PostgreSQL
	if s.db != nil {
		alertSummary, err := s.getAlertSummary(ctx, tenantID)
		if err == nil {
			stats.AlertSummary = *alertSummary
		}
	}

	return stats, nil
}

func (s *StatsService) getAlertSummary(ctx context.Context, tenantID string) (*AlertSummary, error) {
	if s.db == nil {
		return &AlertSummary{}, nil
	}
	query := `
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'firing') as firing,
  COUNT(*) FILTER (WHERE status = 'resolved') as resolved
FROM alert_events
WHERE tenant_id = $1::uuid
  AND fired_at >= NOW() - INTERVAL '24 hours'
`
	var total, firing, resolved int64
	err := s.db.QueryRowContext(ctx, query, tenantID).Scan(&total, &firing, &resolved)
	if err != nil {
		return nil, err
	}
	return &AlertSummary{Total: total, Firing: firing, Resolved: resolved}, nil
}

// AggregateRequest for POST /api/v1/query/stats/aggregate
type AggregateRequest struct {
	GroupBy   string         `json:"group_by"`   // level|source|hour
	TimeRange string         `json:"time_range"` // 1h|6h|24h|7d
	Filters   map[string]any `json:"filters"`
}

// AggregateResult represents aggregated data.
type AggregateResult struct {
	Buckets []AggregateBucket `json:"buckets"`
}

// AggregateBucket represents a single bucket.
type AggregateBucket struct {
	Key   string `json:"key"`
	Count int64  `json:"count"`
}

// Aggregate returns aggregated data based on group_by dimension.
func (s *StatsService) Aggregate(ctx context.Context, tenantID string, req AggregateRequest) (*AggregateResult, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tenantID = strings.TrimSpace(tenantID)
	if tenantID == "" {
		tenantID = DefaultTenantID
	}

	// Parse time range
	dur := 24 * time.Hour
	switch strings.ToLower(strings.TrimSpace(req.TimeRange)) {
	case "1h":
		dur = 1 * time.Hour
	case "6h":
		dur = 6 * time.Hour
	case "24h":
		dur = 24 * time.Hour
	case "7d":
		dur = 7 * 24 * time.Hour
	default:
		dur = 24 * time.Hour
	}

	now := time.Now().UTC()
	from := now.Add(-dur).Format(time.RFC3339)
	to := now.Format(time.RFC3339)

	filters := []map[string]any{
		{"range": map[string]any{"@timestamp": map[string]any{"gte": from, "lte": to}}},
	}
	filters = appendTenantFilter(filters, tenantID)
	for k, v := range req.Filters {
		if k == "" || v == nil {
			continue
		}
		filters = append(filters, map[string]any{"term": map[string]any{k: v}})
	}

	query := map[string]any{
		"bool": map[string]any{"filter": filters},
	}

	groupBy := strings.ToLower(strings.TrimSpace(req.GroupBy))
	if groupBy == "" {
		groupBy = "level"
	}

	var aggField string
	var interval string
	switch groupBy {
	case "level":
		aggField = "log.level"
	case "source":
		aggField = "source.path"
	case "hour":
		aggField = "@timestamp"
		interval = "hour"
	default:
		aggField = "level.keyword"
	}

	aggs := map[string]any{}
	if interval != "" {
		aggs["by_dim"] = map[string]any{
			"date_histogram": map[string]any{
				"field":             aggField,
				"calendar_interval": "hour",
				"min_doc_count":     0,
			},
		}
	} else {
		aggs["by_dim"] = map[string]any{
			"terms": map[string]any{
				"field": aggField,
				"size":  50,
			},
		}
	}

	body := map[string]any{
		"size":  0,
		"query": query,
		"aggs":  aggs,
	}

	result, err := s.esRepo.SearchWithBody(ctx, body)
	if err != nil {
		return nil, fmt.Errorf("es aggregate query: %w", err)
	}

	buckets := []AggregateBucket{}
	if byDim, ok := result.Aggregations["by_dim"].(map[string]any); ok {
		if bList, ok := byDim["buckets"].([]any); ok {
			for _, b := range bList {
				if bucket, ok := b.(map[string]any); ok {
					key := ""
					if k, ok := bucket["key"].(string); ok {
						key = k
					} else if k, ok := bucket["key"].(float64); ok {
						key = time.UnixMilli(int64(k)).UTC().Format(time.RFC3339)
					}
					if key == "" {
						if keyStr, ok := bucket["key_as_string"].(string); ok {
							key = keyStr
						}
					}
					count := int64(0)
					if c, ok := bucket["doc_count"].(float64); ok {
						count = int64(c)
					}
					buckets = append(buckets, AggregateBucket{Key: key, Count: count})
				}
			}
		}
	}

	return &AggregateResult{Buckets: buckets}, nil
}

func appendTenantFilter(filters []map[string]any, tenantID string) []map[string]any {
	tenantID = strings.TrimSpace(tenantID)
	if tenantID == "" || tenantID == DefaultTenantID {
		return filters
	}
	return append(filters, map[string]any{
		"bool": map[string]any{
			"should": []any{
				map[string]any{"term": map[string]any{"tenant_id": tenantID}},
				map[string]any{"term": map[string]any{"nexuslog.governance.tenant_id": tenantID}},
			},
			"minimum_should_match": 1,
		},
	})
}
