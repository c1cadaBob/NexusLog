package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/lib/pq"
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

type aggregateCacheEntry struct {
	result      AggregateResult
	refreshedAt time.Time
	expiresAt   time.Time
}

const (
	overviewQueryTimeout  = 5 * time.Second
	aggregateQueryTimeout = 7 * time.Second
)

func normalizeOverviewTimeRange(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "7d":
		return "7d"
	case "24h":
		fallthrough
	default:
		return "24h"
	}
}

func resolveOverviewTimeRangeDuration(timeRange string) time.Duration {
	switch normalizeOverviewTimeRange(timeRange) {
	case "7d":
		return 7 * 24 * time.Hour
	default:
		return 24 * time.Hour
	}
}

func buildOverviewLogTrendAggregation(timeRange, from, to string) map[string]any {
	dateHistogram := map[string]any{
		"field":         "@timestamp",
		"min_doc_count": 0,
		"extended_bounds": map[string]any{
			"min": from,
			"max": to,
		},
	}
	if normalizeOverviewTimeRange(timeRange) == "7d" {
		dateHistogram["calendar_interval"] = "day"
	} else {
		dateHistogram["calendar_interval"] = "hour"
	}
	return map[string]any{
		"date_histogram": dateHistogram,
	}
}

// StatsService provides dashboard and aggregation stats.
type StatsService struct {
	esRepo                 *repository.ElasticsearchRepository
	db                     *sql.DB
	overviewCacheTTL       time.Duration
	overviewCacheStaleTTL  time.Duration
	overviewCacheMu        sync.RWMutex
	overviewCache          map[string]overviewStatsCacheEntry
	aggregateCacheTTL      time.Duration
	aggregateCacheStaleTTL time.Duration
	aggregateCacheMu       sync.RWMutex
	aggregateCache         map[string]aggregateCacheEntry
}

// NewStatsService creates a stats service.
func NewStatsService(esRepo *repository.ElasticsearchRepository, db *sql.DB) *StatsService {
	return &StatsService{
		esRepo:                 esRepo,
		db:                     db,
		overviewCacheTTL:       5 * time.Second,
		overviewCacheStaleTTL:  time.Minute,
		overviewCache:          make(map[string]overviewStatsCacheEntry),
		aggregateCacheTTL:      15 * time.Second,
		aggregateCacheStaleTTL: time.Minute,
		aggregateCache:         make(map[string]aggregateCacheEntry),
	}
}

// GetOverviewStats returns overview stats for a tenant.
func (s *StatsService) GetOverviewStats(ctx context.Context, actor RequestActor, timeRange string) (*OverviewStats, error) {
	ctx, cancel := context.WithTimeout(ctx, overviewQueryTimeout)
	defer cancel()

	actor = normalizeActor(actor)
	timeRange = normalizeOverviewTimeRange(timeRange)
	authorizedTenantSet, err := resolveAuthorizedTenantSet(actor)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	cacheKey := overviewStatsCacheKey(actor, timeRange)
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

	from := now.Add(-resolveOverviewTimeRangeDuration(timeRange)).Format(time.RFC3339)
	to := now.Format(time.RFC3339)

	query := repository.BuildESQuery(repository.SearchLogsInput{
		TenantID:            actor.TenantID,
		TenantReadScope:     actor.TenantReadScope,
		AuthorizedTenantIDs: authorizedTenantSet.TenantIDs(),
		TimeRangeFrom:       from,
		TimeRangeTo:         to,
	})

	// Single aggregation request for total, level_distribution, top_sources, log_trend
	aggs := map[string]any{
		"total_logs": map[string]any{
			"value_count": map[string]any{
				"field": "@timestamp",
			},
		},
		"by_level": map[string]any{
			"terms": map[string]any{
				"field":   "log.level",
				"size":    20,
				"missing": "info",
			},
		},
		"log_trend": buildOverviewLogTrendAggregation(timeRange, from, to),
	}
	for name, aggregation := range buildAggregateSourceTermsAggregation() {
		aggs[name] = aggregation
	}

	body := map[string]any{
		"track_total_hits": false,
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
	if totalLogsAgg, ok := result.Aggregations["total_logs"].(map[string]any); ok {
		if value, ok := totalLogsAgg["value"].(float64); ok {
			stats.TotalLogs = int64(value)
		}
	}

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
	stats.TopSources = buildOverviewTopSources(result.Aggregations)

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
		alertSummary, err := s.getAlertSummary(ctx, actor)
		if err == nil {
			stats.AlertSummary = *alertSummary
		}
	}

	s.setOverviewStatsCache(cacheKey, stats, now)
	return stats, nil
}

func overviewStatsCacheKey(actor RequestActor, timeRange string) string {
	return actorTenantAuthorizationCacheKey(actor) + "|overview|" + normalizeOverviewTimeRange(timeRange)
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

func cloneAggregateResult(result *AggregateResult) *AggregateResult {
	if result == nil {
		return nil
	}
	return &AggregateResult{Buckets: append([]AggregateBucket(nil), result.Buckets...)}
}

func normalizeAggregateRequest(req AggregateRequest) AggregateRequest {
	normalized := AggregateRequest{
		GroupBy:   strings.ToLower(strings.TrimSpace(req.GroupBy)),
		TimeRange: strings.ToLower(strings.TrimSpace(req.TimeRange)),
		Keywords:  strings.TrimSpace(req.Keywords),
		Filters:   make(map[string]any, len(req.Filters)),
	}
	if normalized.GroupBy == "" {
		normalized.GroupBy = "level"
	}
	switch normalized.TimeRange {
	case "30m", "1h", "6h", "24h", "7d":
	default:
		normalized.TimeRange = "24h"
	}
	for key, value := range req.Filters {
		normalized.Filters[strings.TrimSpace(key)] = value
	}
	return normalized
}

func aggregateCacheKey(actor RequestActor, req AggregateRequest) string {
	filtersRaw, err := json.Marshal(req.Filters)
	if err != nil {
		filtersRaw = []byte("{}")
	}
	return actorTenantAuthorizationCacheKey(actor) + "|" + req.GroupBy + "|" + req.TimeRange + "|" + req.Keywords + "|" + string(filtersRaw)
}

func (s *StatsService) getAggregateCache(cacheKey string, now time.Time) (*AggregateResult, bool) {
	s.aggregateCacheMu.RLock()
	entry, ok := s.aggregateCache[cacheKey]
	s.aggregateCacheMu.RUnlock()
	if !ok || now.After(entry.expiresAt) {
		return nil, false
	}
	return cloneAggregateResult(&entry.result), true
}

func (s *StatsService) getStaleAggregateCache(cacheKey string, now time.Time) (*AggregateResult, bool) {
	s.aggregateCacheMu.RLock()
	entry, ok := s.aggregateCache[cacheKey]
	s.aggregateCacheMu.RUnlock()
	if !ok || now.After(entry.refreshedAt.Add(s.aggregateCacheStaleTTL)) {
		return nil, false
	}
	return cloneAggregateResult(&entry.result), true
}

func (s *StatsService) setAggregateCache(cacheKey string, result *AggregateResult, now time.Time) {
	cloned := cloneAggregateResult(result)
	if cloned == nil {
		return
	}
	s.aggregateCacheMu.Lock()
	s.aggregateCache[cacheKey] = aggregateCacheEntry{
		result:      *cloned,
		refreshedAt: now,
		expiresAt:   now.Add(s.aggregateCacheTTL),
	}
	s.aggregateCacheMu.Unlock()
}

func buildOverviewTopSources(aggregations map[string]any) []SourceCount {
	buckets := buildAggregateSourceBuckets(aggregations)
	if len(buckets) == 0 {
		return []SourceCount{}
	}
	if len(buckets) > 10 {
		buckets = buckets[:10]
	}

	topSources := make([]SourceCount, 0, len(buckets))
	for _, bucket := range buckets {
		label := strings.TrimSpace(bucket.Label)
		if label == "" {
			label = buildAggregateSourceLabel(bucket.Host, bucket.Service)
		}
		topSources = append(topSources, SourceCount{
			Source:  label,
			Host:    bucket.Host,
			Service: bucket.Service,
			Count:   bucket.Count,
		})
	}
	return topSources
}

func (s *StatsService) getAlertSummary(ctx context.Context, actor RequestActor) (*AlertSummary, error) {
	if s.db == nil {
		return &AlertSummary{}, nil
	}
	query, args, err := buildAlertSummaryQuery(actor)
	if err != nil {
		return nil, err
	}
	var total, firing, resolved int64
	err = s.db.QueryRowContext(ctx, query, args...).Scan(&total, &firing, &resolved)
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
	Key     string `json:"key"`
	Label   string `json:"label,omitempty"`
	Host    string `json:"host,omitempty"`
	Service string `json:"service,omitempty"`
	Count   int64  `json:"count"`
}

func buildAlertSummaryQuery(actor RequestActor) (string, []any, error) {
	authorizedTenantSet, err := resolveAuthorizedTenantSet(actor)
	if err != nil {
		return "", nil, err
	}
	query := `
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'firing') as firing,
  COUNT(*) FILTER (WHERE status = 'resolved') as resolved
FROM alert_events
WHERE fired_at >= NOW() - INTERVAL '24 hours'
`
	if authorizedTenantSet.AllowsAllTenants() {
		return query, nil, nil
	}
	tenantIDs := authorizedTenantSet.TenantIDs()
	switch len(tenantIDs) {
	case 0:
		return "", nil, ErrTenantContextRequired
	case 1:
		query += "  AND tenant_id = $1::uuid\n"
		return query, []any{tenantIDs[0]}, nil
	default:
		query += "  AND tenant_id = ANY($1::uuid[])\n"
		return query, []any{pq.Array(tenantIDs)}, nil
	}
}

const (
	aggregateSourceKeySeparator = "\u001f"
	aggregateUnknownHost        = "unknown-host"
	aggregateUnknownService     = "unknown-service"

	aggregateSourceServiceNameAgg   = "by_source_service_name"
	aggregateSourceContainerNameAgg = "by_source_container_name"
	aggregateSourceInstanceIDAgg    = "by_source_instance_id"
	aggregateSourceLogPathAgg       = "by_source_log_path"
	aggregateSourcePairsAgg         = "pairs"
)

func resolveAggregateTimeRangeDuration(timeRange string) time.Duration {
	switch timeRange {
	case "30m":
		return 30 * time.Minute
	case "1h":
		return 1 * time.Hour
	case "6h":
		return 6 * time.Hour
	case "7d":
		return 7 * 24 * time.Hour
	case "24h":
		fallthrough
	default:
		return 24 * time.Hour
	}
}

func buildAggregateSourceTermsAggregation() map[string]any {
	return map[string]any{
		aggregateSourceServiceNameAgg: buildAggregateSourcePartitionAggregation(
			map[string]any{"exists": map[string]any{"field": "service.name"}},
			"service.name",
		),
		aggregateSourceContainerNameAgg: buildAggregateSourcePartitionAggregation(
			map[string]any{
				"bool": map[string]any{
					"must": []any{
						map[string]any{"exists": map[string]any{"field": "container.name"}},
					},
					"must_not": []any{
						map[string]any{"exists": map[string]any{"field": "service.name"}},
					},
				},
			},
			"container.name",
		),
		aggregateSourceInstanceIDAgg: buildAggregateSourcePartitionAggregation(
			map[string]any{
				"bool": map[string]any{
					"must": []any{
						map[string]any{"exists": map[string]any{"field": "service.instance.id"}},
					},
					"must_not": []any{
						map[string]any{"exists": map[string]any{"field": "service.name"}},
						map[string]any{"exists": map[string]any{"field": "container.name"}},
					},
				},
			},
			"service.instance.id",
		),
		aggregateSourceLogPathAgg: buildAggregateSourcePartitionAggregation(
			map[string]any{
				"bool": map[string]any{
					"must": []any{
						map[string]any{"exists": map[string]any{"field": "log.file.path"}},
					},
					"must_not": []any{
						map[string]any{"exists": map[string]any{"field": "service.name"}},
						map[string]any{"exists": map[string]any{"field": "container.name"}},
						map[string]any{"exists": map[string]any{"field": "service.instance.id"}},
					},
				},
			},
			"log.file.path",
		),
	}
}

func buildAggregateSourcePartitionAggregation(filter map[string]any, serviceField string) map[string]any {
	terms := []map[string]any{
		{"field": "host.name", "missing": aggregateUnknownHost},
		{"field": serviceField, "missing": aggregateUnknownService},
	}
	if serviceField != "log.file.path" {
		terms = append(terms, map[string]any{"field": "log.file.path", "missing": aggregateUnknownService})
	}
	return map[string]any{
		"filter": filter,
		"aggs": map[string]any{
			aggregateSourcePairsAgg: map[string]any{
				"multi_terms": map[string]any{
					"terms": terms,
					"size":  50,
				},
			},
		},
	}
}

func normalizeAggregateSourceValue(raw, fallback string) string {
	value := strings.TrimSpace(raw)
	if value == "" || value == "-" || value == "<nil>" {
		return fallback
	}
	return value
}

func normalizeAggregateSourcePathService(raw string) string {
	value := normalizeAggregateSourceValue(raw, aggregateUnknownService)
	if value == aggregateUnknownService {
		return aggregateUnknownService
	}
	if resolved := resolveDisplayService(map[string]any{"log.file.path": value}); resolved != "" && resolved != "unknown" {
		return resolved
	}
	return aggregateUnknownService
}

func isAggregateSourceServiceNoise(raw string) bool {
	value := strings.TrimSpace(raw)
	if value == "" {
		return true
	}
	hasDigit := false
	for _, char := range value {
		if unicode.IsDigit(char) {
			hasDigit = true
			continue
		}
		switch char {
		case '-', '/', '_', '.', ':', ' ':
			continue
		default:
			return false
		}
	}
	return hasDigit
}

func normalizeAggregateSourceServiceValue(serviceField, raw, rawPath string) string {
	if serviceField == "log.file.path" {
		return normalizeAggregateSourcePathService(raw)
	}
	if value := sanitizeDisplayServiceName(raw); value != "" && !isAggregateSourceServiceNoise(value) {
		return value
	}
	if value := normalizeAggregateSourcePathService(rawPath); value != aggregateUnknownService {
		return value
	}
	if value := normalizeAggregateSourcePathService(raw); value != aggregateUnknownService {
		return value
	}
	return aggregateUnknownService
}

func buildAggregateSourceBuckets(aggregations map[string]any) []AggregateBucket {
	type sourceAggregationSpec struct {
		name         string
		serviceField string
	}

	specs := []sourceAggregationSpec{
		{name: aggregateSourceServiceNameAgg, serviceField: "service.name"},
		{name: aggregateSourceContainerNameAgg, serviceField: "container.name"},
		{name: aggregateSourceInstanceIDAgg, serviceField: "service.instance.id"},
		{name: aggregateSourceLogPathAgg, serviceField: "log.file.path"},
	}

	bucketMap := make(map[string]*AggregateBucket)
	for _, spec := range specs {
		aggWrapper, ok := aggregations[spec.name].(map[string]any)
		if !ok {
			continue
		}
		pairsWrapper, ok := aggWrapper[aggregateSourcePairsAgg].(map[string]any)
		if !ok {
			continue
		}
		bucketList, ok := pairsWrapper["buckets"].([]any)
		if !ok {
			continue
		}

		for _, rawBucket := range bucketList {
			bucket, ok := rawBucket.(map[string]any)
			if !ok {
				continue
			}
			keyValues, ok := bucket["key"].([]any)
			if !ok || len(keyValues) < 2 {
				continue
			}
			host := normalizeAggregateSourceValue(fmt.Sprint(keyValues[0]), aggregateUnknownHost)
			rawPath := ""
			if len(keyValues) > 2 {
				rawPath = fmt.Sprint(keyValues[2])
			}
			service := normalizeAggregateSourceServiceValue(spec.serviceField, fmt.Sprint(keyValues[1]), rawPath)
			count := int64(0)
			if rawCount, ok := bucket["doc_count"].(float64); ok {
				count = int64(rawCount)
			}
			bucketKey := host + aggregateSourceKeySeparator + service
			if existing, ok := bucketMap[bucketKey]; ok {
				existing.Count += count
				continue
			}
			bucketMap[bucketKey] = &AggregateBucket{
				Key:     bucketKey,
				Label:   buildAggregateSourceLabel(host, service),
				Host:    host,
				Service: service,
				Count:   count,
			}
		}
	}

	buckets := make([]AggregateBucket, 0, len(bucketMap))
	for _, bucket := range bucketMap {
		buckets = append(buckets, *bucket)
	}
	sort.SliceStable(buckets, func(i, j int) bool {
		if buckets[i].Count == buckets[j].Count {
			return buckets[i].Label < buckets[j].Label
		}
		return buckets[i].Count > buckets[j].Count
	})
	if len(buckets) > 50 {
		buckets = buckets[:50]
	}
	return buckets
}

func extractAggregateSampleDocument(bucket map[string]any) map[string]any {
	sampleDocument, ok := bucket["sample_document"].(map[string]any)
	if !ok {
		return nil
	}
	hitsWrapper, ok := sampleDocument["hits"].(map[string]any)
	if !ok {
		return nil
	}
	hitsList, ok := hitsWrapper["hits"].([]any)
	if !ok || len(hitsList) == 0 {
		return nil
	}
	firstHit, ok := hitsList[0].(map[string]any)
	if !ok {
		return nil
	}
	source, ok := firstHit["_source"].(map[string]any)
	if !ok {
		return nil
	}
	return source
}

func splitAggregateSourceKey(rawKey string) (string, string) {
	parts := strings.SplitN(strings.TrimSpace(rawKey), aggregateSourceKeySeparator, 2)
	host := aggregateUnknownHost
	service := aggregateUnknownService
	if len(parts) > 0 && strings.TrimSpace(parts[0]) != "" {
		host = strings.TrimSpace(parts[0])
	}
	if len(parts) > 1 && strings.TrimSpace(parts[1]) != "" {
		service = strings.TrimSpace(parts[1])
	}
	return host, service
}

func buildAggregateSourceLabel(host, service string) string {
	return host + " / " + service
}

func resolveAggregateSourceBucketDisplay(rawKey string, sampleSource map[string]any) (string, string, string) {
	host := ""
	service := ""
	if strings.Contains(rawKey, aggregateSourceKeySeparator) {
		host, service = splitAggregateSourceKey(rawKey)
	}
	if len(sampleSource) > 0 {
		if resolvedHost := strings.TrimSpace(resolveDisplayHost(sampleSource)); resolvedHost != "" {
			host = resolvedHost
		}
		if resolvedService := strings.TrimSpace(resolveDisplayService(sampleSource)); resolvedService != "" {
			service = resolvedService
		}
	}
	if service == "" && strings.TrimSpace(rawKey) != "" && rawKey != "-" {
		service = strings.TrimSpace(resolveDisplayService(map[string]any{
			"source": map[string]any{"path": rawKey},
		}))
	}
	if host == "" {
		host = aggregateUnknownHost
	}
	if service == "" {
		service = aggregateUnknownService
	}
	return host, service, buildAggregateSourceLabel(host, service)
}

// Aggregate returns aggregated data based on group_by dimension.
func (s *StatsService) Aggregate(ctx context.Context, actor RequestActor, req AggregateRequest) (*AggregateResult, error) {
	ctx, cancel := context.WithTimeout(ctx, aggregateQueryTimeout)
	defer cancel()

	actor = normalizeActor(actor)
	authorizedTenantSet, err := resolveAuthorizedTenantSet(actor)
	if err != nil {
		return nil, err
	}

	req = normalizeAggregateRequest(req)
	now := time.Now().UTC()
	cacheKey := aggregateCacheKey(actor, req)
	if cached, ok := s.getAggregateCache(cacheKey, now); ok {
		return cached, nil
	}

	queryNow := now.Truncate(time.Second)
	fromTime := queryNow.Add(-resolveAggregateTimeRangeDuration(req.TimeRange))
	from := fromTime.Format(time.RFC3339)
	to := queryNow.Format(time.RFC3339)

	query := repository.BuildESQuery(repository.SearchLogsInput{
		TenantID:            actor.TenantID,
		TenantReadScope:     actor.TenantReadScope,
		AuthorizedTenantIDs: authorizedTenantSet.TenantIDs(),
		Keywords:            req.Keywords,
		TimeRangeFrom:       from,
		TimeRangeTo:         to,
		Filters:             req.Filters,
	})
	if boolQuery, ok := query["bool"].(map[string]any); ok {
		query["bool"] = boolQuery
	}

	var aggField string
	var histogram map[string]any
	switch req.GroupBy {
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
	} else if req.GroupBy == "source" {
		aggs = buildAggregateSourceTermsAggregation()
	} else {
		aggs["by_dim"] = map[string]any{
			"terms": map[string]any{
				"field": aggField,
				"size":  50,
			},
		}
	}

	body := map[string]any{
		"track_total_hits": false,
		"size":             0,
		"query":            query,
		"aggs":             aggs,
	}

	result, err := s.esRepo.SearchWithBody(ctx, body)
	if err != nil {
		if cached, ok := s.getStaleAggregateCache(cacheKey, now); ok {
			return cached, nil
		}
		return nil, fmt.Errorf("es aggregate query: %w", err)
	}

	buckets := []AggregateBucket{}
	if req.GroupBy == "source" {
		buckets = buildAggregateSourceBuckets(result.Aggregations)
	} else if byDim, ok := result.Aggregations["by_dim"].(map[string]any); ok {
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

	aggregateResult := &AggregateResult{Buckets: buckets}
	s.setAggregateCache(cacheKey, aggregateResult, now)
	return aggregateResult, nil
}

func appendTenantFilter(filters []map[string]any, actor RequestActor) []map[string]any {
	authorizedTenantSet, err := resolveAuthorizedTenantSet(actor)
	if err != nil {
		return append(filters, map[string]any{"match_none": map[string]any{}})
	}
	if authorizedTenantSet.AllowsAllTenants() {
		return filters
	}
	tenantIDs := authorizedTenantSet.TenantIDs()
	if len(tenantIDs) == 0 {
		return append(filters, map[string]any{"match_none": map[string]any{}})
	}
	if len(tenantIDs) == 1 {
		tenantID := tenantIDs[0]
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
	return append(filters, map[string]any{
		"bool": map[string]any{
			"should": []any{
				map[string]any{"terms": map[string]any{"tenant_id": tenantIDs}},
				map[string]any{"terms": map[string]any{"nexuslog.governance.tenant_id": tenantIDs}},
			},
			"minimum_should_match": 1,
		},
	})
}
