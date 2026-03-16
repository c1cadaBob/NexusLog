package service

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"sync"
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

// SourceCount represents source identity and count.
type SourceCount struct {
	Source  string `json:"source"`
	Host    string `json:"host"`
	Service string `json:"service"`
	Count   int64  `json:"count"`
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

type overviewStatsCacheEntry struct {
	stats       OverviewStats
	refreshedAt time.Time
	expiresAt   time.Time
}

// StatsService provides dashboard and aggregation stats.
type StatsService struct {
	esRepo                *repository.ElasticsearchRepository
	db                    *sql.DB
	overviewCacheTTL      time.Duration
	overviewCacheStaleTTL time.Duration
	overviewCacheMu       sync.RWMutex
	overviewCache         map[string]overviewStatsCacheEntry
}

// NewStatsService creates a stats service.
func NewStatsService(esRepo *repository.ElasticsearchRepository, db *sql.DB) *StatsService {
	return &StatsService{
		esRepo:                esRepo,
		db:                    db,
		overviewCacheTTL:      5 * time.Second,
		overviewCacheStaleTTL: time.Minute,
		overviewCache:         make(map[string]overviewStatsCacheEntry),
	}
}

// GetOverviewStats returns overview stats for a tenant.
func (s *StatsService) GetOverviewStats(ctx context.Context, actor RequestActor) (*OverviewStats, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	actor = normalizeActor(actor)
	if actor.TenantID == "" {
		return nil, ErrTenantContextRequired
	}

	now := time.Now().UTC()
	cacheKey := overviewStatsCacheKey(actor)
	if cached, ok := s.getOverviewStatsCache(cacheKey, now); ok {
		return cached, nil
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
	from24h := now.Add(-24 * time.Hour).Format(time.RFC3339)
	to := now.Format(time.RFC3339)

	// Build base filter for tenant
	filters := []map[string]any{
		{"range": map[string]any{"@timestamp": map[string]any{"gte": from24h, "lte": to}}},
	}
	filters = appendTenantFilter(filters, actor.TenantID, actor.CanReadAllLogs)
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
			"aggs": map[string]any{
				"sample_document": map[string]any{
					"top_hits": map[string]any{
						"size": 1,
						"sort": []map[string]any{{
							"@timestamp": map[string]any{"order": "desc"},
						}},
						"_source": map[string]any{
							"includes": []string{
								"source.path",
								"log.file.path",
								"source_path",
								"source",
								"host.name",
								"host",
								"hostname",
								"syslog_hostname",
								"server_id",
								"agent.hostname",
								"service.name",
								"service_name",
								"service",
								"app",
								"container.name",
								"service.instance.id",
								"source_id",
							},
						},
					},
				},
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
		if cached, ok := s.getStaleOverviewStatsCache(cacheKey, now); ok {
			return cached, nil
		}
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
					stats.TopSources = append(stats.TopSources, parseOverviewSourceBucket(bucket))
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
		alertSummary, err := s.getAlertSummary(ctx, actor.TenantID, actor.CanReadAllLogs)
		if err == nil {
			stats.AlertSummary = *alertSummary
		}
	}

	s.setOverviewStatsCache(cacheKey, stats, now)
	return stats, nil
}

func overviewStatsCacheKey(actor RequestActor) string {
	return strings.TrimSpace(actor.TenantID) + "|" + strconv.FormatBool(actor.CanReadAllLogs)
}

func cloneOverviewStats(stats *OverviewStats) *OverviewStats {
	if stats == nil {
		return nil
	}
	levelDistribution := make(map[string]int64, len(stats.LevelDistribution))
	for key, value := range stats.LevelDistribution {
		levelDistribution[key] = value
	}
	topSources := append([]SourceCount(nil), stats.TopSources...)
	logTrend := append([]LogTrendPoint(nil), stats.LogTrend...)
	return &OverviewStats{
		TotalLogs:         stats.TotalLogs,
		LevelDistribution: levelDistribution,
		TopSources:        topSources,
		AlertSummary:      stats.AlertSummary,
		LogTrend:          logTrend,
	}
}

func (s *StatsService) getOverviewStatsCache(cacheKey string, now time.Time) (*OverviewStats, bool) {
	s.overviewCacheMu.RLock()
	entry, ok := s.overviewCache[cacheKey]
	s.overviewCacheMu.RUnlock()
	if !ok || now.After(entry.expiresAt) {
		return nil, false
	}
	return cloneOverviewStats(&entry.stats), true
}

func (s *StatsService) getStaleOverviewStatsCache(cacheKey string, now time.Time) (*OverviewStats, bool) {
	s.overviewCacheMu.RLock()
	entry, ok := s.overviewCache[cacheKey]
	s.overviewCacheMu.RUnlock()
	if !ok || now.After(entry.refreshedAt.Add(s.overviewCacheStaleTTL)) {
		return nil, false
	}
	return cloneOverviewStats(&entry.stats), true
}

func (s *StatsService) setOverviewStatsCache(cacheKey string, stats *OverviewStats, now time.Time) {
	cloned := cloneOverviewStats(stats)
	if cloned == nil {
		return
	}
	s.overviewCacheMu.Lock()
	s.overviewCache[cacheKey] = overviewStatsCacheEntry{
		stats:       *cloned,
		refreshedAt: now,
		expiresAt:   now.Add(s.overviewCacheTTL),
	}
	s.overviewCacheMu.Unlock()
}

func parseOverviewSourceBucket(bucket map[string]any) SourceCount {
	source := normalizeSourcePathForDisplay(stringFromOverviewBucketValue(bucket["key"]))
	count := int64FromOverviewBucketValue(bucket["doc_count"])
	sampleSource := extractOverviewSampleSource(bucket)

	host := ""
	service := ""
	if len(sampleSource) > 0 {
		if source == "" {
			source = displaySourcePathFromSource(sampleSource)
		}
		host = strings.TrimSpace(resolveDisplayHost(sampleSource))
		service = strings.TrimSpace(resolveDisplayService(sampleSource))
	}
	if source != "" && service == "" {
		service = strings.TrimSpace(resolveDisplayService(map[string]any{
			"source": map[string]any{"path": source},
		}))
	}
	if host == "" {
		host = "unknown"
	}
	if service == "" {
		service = "unknown"
	}

	return SourceCount{
		Source:  source,
		Host:    host,
		Service: service,
		Count:   count,
	}
}

func extractOverviewSampleSource(bucket map[string]any) map[string]any {
	sampleDocument, ok := bucket["sample_document"].(map[string]any)
	if !ok {
		return nil
	}
	hitsWrapper, ok := sampleDocument["hits"].(map[string]any)
	if !ok {
		return nil
	}
	hits, ok := hitsWrapper["hits"].([]any)
	if !ok || len(hits) == 0 {
		return nil
	}
	firstHit, ok := hits[0].(map[string]any)
	if !ok {
		return nil
	}
	source, ok := firstHit["_source"].(map[string]any)
	if !ok {
		return nil
	}
	return source
}

func int64FromOverviewBucketValue(raw any) int64 {
	switch value := raw.(type) {
	case float64:
		return int64(value)
	case int64:
		return value
	case int:
		return int64(value)
	default:
		return 0
	}
}

func stringFromOverviewBucketValue(raw any) string {
	text, _ := raw.(string)
	return strings.TrimSpace(text)
}

func (s *StatsService) getAlertSummary(ctx context.Context, tenantID string, bypassTenantScope bool) (*AlertSummary, error) {
	if s.db == nil {
		return &AlertSummary{}, nil
	}
	tenantScope := any(strings.TrimSpace(tenantID))
	if bypassTenantScope {
		tenantScope = nil
	}
	query := `
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'firing') as firing,
  COUNT(*) FILTER (WHERE status = 'resolved') as resolved
FROM alert_events
WHERE ($1::uuid IS NULL OR tenant_id = $1::uuid)
  AND fired_at >= NOW() - INTERVAL '24 hours'
`
	var total, firing, resolved int64
	err := s.db.QueryRowContext(ctx, query, tenantScope).Scan(&total, &firing, &resolved)
	if err != nil {
		return nil, err
	}
	return &AlertSummary{Total: total, Firing: firing, Resolved: resolved}, nil
}

// AggregateRequest for POST /api/v1/query/stats/aggregate
type AggregateRequest struct {
	GroupBy   string         `json:"group_by"`   // level|source|hour|minute
	TimeRange string         `json:"time_range"` // 30m|1h|6h|24h|7d
	Keywords  string         `json:"keywords"`
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
func (s *StatsService) Aggregate(ctx context.Context, actor RequestActor, req AggregateRequest) (*AggregateResult, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	actor = normalizeActor(actor)
	if actor.TenantID == "" {
		return nil, ErrTenantContextRequired
	}

	// Parse time range
	dur := 24 * time.Hour
	switch strings.ToLower(strings.TrimSpace(req.TimeRange)) {
	case "30m":
		dur = 30 * time.Minute
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

	now := time.Now().UTC().Truncate(time.Second)
	fromTime := now.Add(-dur)
	from := fromTime.Format(time.RFC3339)
	to := now.Format(time.RFC3339)

	query := repository.BuildESQuery(repository.SearchLogsInput{
		TenantID:          actor.TenantID,
		BypassTenantScope: actor.CanReadAllLogs,
		Keywords:          req.Keywords,
		TimeRangeFrom:     from,
		TimeRangeTo:       to,
		Filters:           req.Filters,
	})
	if boolQuery, ok := query["bool"].(map[string]any); ok {
		query["bool"] = boolQuery
	}

	groupBy := strings.ToLower(strings.TrimSpace(req.GroupBy))
	if groupBy == "" {
		groupBy = "level"
	}

	var aggField string
	var histogram map[string]any
	switch groupBy {
	case "level":
		aggField = "log.level"
	case "source":
		aggField = "source.path"
	case "hour":
		aggField = "@timestamp"
		histogram = map[string]any{
			"field":             aggField,
			"calendar_interval": "hour",
			"min_doc_count":     0,
			"extended_bounds": map[string]any{
				"min": from,
				"max": to,
			},
		}
	case "minute":
		aggField = "@timestamp"
		histogram = map[string]any{
			"field":          aggField,
			"fixed_interval": "1m",
			"min_doc_count":  0,
			"extended_bounds": map[string]any{
				"min": from,
				"max": to,
			},
		}
	default:
		aggField = "log.level"
	}

	aggs := map[string]any{}
	if histogram != nil {
		aggs["by_dim"] = map[string]any{
			"date_histogram": histogram,
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

func appendTenantFilter(filters []map[string]any, tenantID string, bypassTenantScope bool) []map[string]any {
	if bypassTenantScope {
		return filters
	}
	tenantID = strings.TrimSpace(tenantID)
	if tenantID == "" {
		return append(filters, map[string]any{"match_none": map[string]any{}})
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
