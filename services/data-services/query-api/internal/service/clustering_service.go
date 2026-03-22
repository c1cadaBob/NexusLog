package service

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/nexuslog/data-services/query-api/internal/repository"
)

const (
	clusterQueryTimeout      = 8 * time.Second
	clusterDefaultLimit      = 20
	clusterMaxLimit          = 50
	clusterDefaultSampleSize = 400
	clusterMaxSampleSize     = 1000
	clusterTrendBucketCount  = 8
	clusterSampleLimit       = 3
)

var (
	clusterUUIDPattern         = regexp.MustCompile(`\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b`)
	clusterIPv4Pattern         = regexp.MustCompile(`\b(?:\d{1,3}\.){3}\d{1,3}\b`)
	clusterEmailPattern        = regexp.MustCompile(`[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`)
	clusterPortPattern         = regexp.MustCompile(`(?i)\bport\s+(\d{2,5})\b`)
	clusterDurationPattern     = regexp.MustCompile(`\b\d+(?:\.\d+)?\s?(?:ms|s|sec|secs|seconds?|m|min|mins|minutes?|h|hr|hrs|hours?)\b`)
	clusterUserValuePattern    = regexp.MustCompile(`(?i)\b(user)\s+([A-Za-z0-9._:@-]+)`)
	clusterRequestValuePattern = regexp.MustCompile(`(?i)\b(request)\s+([A-Za-z0-9._:@-]+)`)
	clusterJobValuePattern     = regexp.MustCompile(`(?i)\b(job)\s+([A-Za-z0-9._:@-]+)`)
	clusterIdentifierPattern   = regexp.MustCompile(`\b[a-fA-F0-9]{12,}\b`)
	clusterLongNumberPattern   = regexp.MustCompile(`\b\d{3,}\b`)
	clusterPlaceholderPattern  = regexp.MustCompile(`\{[A-Z_]+\}`)
)

// ClusterRequest defines the payload for POST /api/v1/query/stats/clusters.
type ClusterRequest struct {
	TimeRange  string         `json:"time_range"`
	Keywords   string         `json:"keywords"`
	Filters    map[string]any `json:"filters"`
	Limit      int            `json:"limit"`
	SampleSize int            `json:"sample_size"`
}

// ClusterTrendPoint represents a clustering trend bucket.
type ClusterTrendPoint struct {
	Time  string `json:"time"`
	Count int64  `json:"count"`
}

// ClusterSample represents a sample log for one cluster.
type ClusterSample struct {
	Timestamp string            `json:"timestamp"`
	Message   string            `json:"message"`
	Variables map[string]string `json:"variables,omitempty"`
	Host      string            `json:"host,omitempty"`
	Service   string            `json:"service,omitempty"`
	Level     string            `json:"level,omitempty"`
}

// ClusterPattern describes one normalized pattern.
type ClusterPattern struct {
	ID          string              `json:"id"`
	Template    string              `json:"template"`
	Similarity  int                 `json:"similarity"`
	Occurrences int64               `json:"occurrences"`
	FirstSeen   string              `json:"first_seen"`
	LastSeen    string              `json:"last_seen"`
	Level       string              `json:"level"`
	Trend       []ClusterTrendPoint `json:"trend"`
	Samples     []ClusterSample     `json:"samples"`
}

// ClusterSummary describes the clustering execution result.
type ClusterSummary struct {
	AnalyzedLogsTotal int64 `json:"analyzed_logs_total"`
	SampledLogs       int   `json:"sampled_logs"`
	UniquePatterns    int   `json:"unique_patterns"`
	NewPatternsToday  int   `json:"new_patterns_today"`
}

// ClusterResult contains clustering summary and patterns.
type ClusterResult struct {
	Summary  ClusterSummary   `json:"summary"`
	Patterns []ClusterPattern `json:"patterns"`
}

type clusterAccumulator struct {
	ID          string
	Template    string
	Level       string
	Occurrences int64
	FirstSeen   time.Time
	LastSeen    time.Time
	Trend       []int64
	Samples     []ClusterSample
}

func normalizeClusterRequest(req ClusterRequest) ClusterRequest {
	normalized := ClusterRequest{
		TimeRange:  normalizeClusterTimeRange(req.TimeRange),
		Keywords:   strings.TrimSpace(req.Keywords),
		Filters:    make(map[string]any, len(req.Filters)),
		Limit:      req.Limit,
		SampleSize: req.SampleSize,
	}
	if normalized.Limit <= 0 {
		normalized.Limit = clusterDefaultLimit
	}
	if normalized.Limit > clusterMaxLimit {
		normalized.Limit = clusterMaxLimit
	}
	if normalized.SampleSize <= 0 {
		normalized.SampleSize = clusterDefaultSampleSize
	}
	if normalized.SampleSize > clusterMaxSampleSize {
		normalized.SampleSize = clusterMaxSampleSize
	}
	for key, value := range req.Filters {
		trimmedKey := strings.TrimSpace(key)
		if trimmedKey == "" {
			continue
		}
		normalized.Filters[trimmedKey] = value
	}
	return normalized
}

func normalizeClusterTimeRange(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "30m":
		return "30m"
	case "1h":
		return "1h"
	case "6h":
		return "6h"
	case "7d":
		return "7d"
	case "24h":
		fallthrough
	default:
		return "24h"
	}
}

func resolveClusterTimeRangeDuration(timeRange string) time.Duration {
	switch normalizeClusterTimeRange(timeRange) {
	case "30m":
		return 30 * time.Minute
	case "1h":
		return time.Hour
	case "6h":
		return 6 * time.Hour
	case "7d":
		return 7 * 24 * time.Hour
	default:
		return 24 * time.Hour
	}
}

// ClusterLogs clusters real logs into normalized patterns.
func (s *StatsService) ClusterLogs(ctx context.Context, actor RequestActor, req ClusterRequest) (*ClusterResult, error) {
	ctx, cancel := context.WithTimeout(ctx, clusterQueryTimeout)
	defer cancel()

	actor = normalizeActor(actor)
	authorizedTenantSet, err := resolveAuthorizedTenantSet(actor)
	if err != nil {
		return nil, err
	}

	req = normalizeClusterRequest(req)
	now := time.Now().UTC().Truncate(time.Second)
	fromTime := now.Add(-resolveClusterTimeRangeDuration(req.TimeRange))
	from := fromTime.Format(time.RFC3339)
	to := now.Format(time.RFC3339)

	query := repository.BuildESQuery(repository.SearchLogsInput{
		TenantID:            actor.TenantID,
		TenantReadScope:     actor.TenantReadScope,
		AuthorizedTenantIDs: authorizedTenantSet.TenantIDs(),
		Keywords:            req.Keywords,
		TimeRangeFrom:       from,
		TimeRangeTo:         to,
		Filters:             req.Filters,
	})

	body := map[string]any{
		"track_total_hits": true,
		"size":             req.SampleSize,
		"sort": []map[string]any{
			{"@timestamp": map[string]any{"order": "desc"}},
		},
		"_source": []string{
			"@timestamp",
			"message",
			"event.original",
			"raw_log",
			"raw_message",
			"log.level",
			"level",
			"service.name",
			"service_name",
			"service",
			"app",
			"container.name",
			"service.instance.id",
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
		},
		"query": query,
	}

	searchResult, err := s.esRepo.SearchWithBody(ctx, body)
	if err != nil {
		return nil, fmt.Errorf("es cluster query: %w", err)
	}

	accumulators := make(map[string]*clusterAccumulator)
	sampledLogs := 0
	for _, hit := range searchResult.Hits {
		timestamp := firstPathString(hit.Source, "@timestamp", "collect_time")
		rawMessage := firstPathString(hit.Source, "message", "event.original", "raw_log", "raw_message", "error.message")
		displayMessage := normalizeDisplayMessage(rawMessage)
		if strings.TrimSpace(displayMessage) == "" {
			continue
		}
		sampledLogs++

		level := normalizeLevel(firstPathString(hit.Source, "log.level", "level"), displayMessage)
		host := resolveDisplayHost(hit.Source, displayMessage, rawMessage)
		serviceName := resolveDisplayService(hit.Source)
		template, variables := normalizeClusterTemplate(displayMessage)
		clusterKey := buildClusterAggregationKey(level, template)

		parsedTime := parseClusterTimestamp(timestamp)
		accumulator, exists := accumulators[clusterKey]
		if !exists {
			accumulator = &clusterAccumulator{
				ID:        buildClusterPatternID(level, template),
				Template:  template,
				Level:     level,
				FirstSeen: parsedTime,
				LastSeen:  parsedTime,
				Trend:     make([]int64, clusterTrendBucketCount),
				Samples:   make([]ClusterSample, 0, clusterSampleLimit),
			}
			accumulators[clusterKey] = accumulator
		}

		accumulator.Occurrences++
		if parsedTime.IsZero() {
			parsedTime = now
		}
		if accumulator.FirstSeen.IsZero() || parsedTime.Before(accumulator.FirstSeen) {
			accumulator.FirstSeen = parsedTime
		}
		if accumulator.LastSeen.IsZero() || parsedTime.After(accumulator.LastSeen) {
			accumulator.LastSeen = parsedTime
		}
		bucketIndex := resolveClusterTrendBucket(parsedTime, fromTime, now)
		accumulator.Trend[bucketIndex]++
		if len(accumulator.Samples) < clusterSampleLimit {
			accumulator.Samples = append(accumulator.Samples, ClusterSample{
				Timestamp: timestamp,
				Message:   displayMessage,
				Variables: variables,
				Host:      host,
				Service:   serviceName,
				Level:     level,
			})
		}
	}

	patterns := make([]ClusterPattern, 0, len(accumulators))
	newPatternCutoff := now.Add(-24 * time.Hour)
	newPatternsToday := 0
	for _, accumulator := range accumulators {
		if !accumulator.FirstSeen.IsZero() && accumulator.FirstSeen.After(newPatternCutoff) {
			newPatternsToday++
		}
		patterns = append(patterns, ClusterPattern{
			ID:          accumulator.ID,
			Template:    accumulator.Template,
			Similarity:  estimateClusterSimilarity(accumulator.Template),
			Occurrences: accumulator.Occurrences,
			FirstSeen:   accumulator.FirstSeen.UTC().Format(time.RFC3339),
			LastSeen:    accumulator.LastSeen.UTC().Format(time.RFC3339),
			Level:       accumulator.Level,
			Trend:       buildClusterTrendPoints(accumulator.Trend, fromTime, now),
			Samples:     accumulator.Samples,
		})
	}

	sort.Slice(patterns, func(i, j int) bool {
		if patterns[i].Occurrences != patterns[j].Occurrences {
			return patterns[i].Occurrences > patterns[j].Occurrences
		}
		if patterns[i].LastSeen != patterns[j].LastSeen {
			return patterns[i].LastSeen > patterns[j].LastSeen
		}
		return patterns[i].Template < patterns[j].Template
	})
	if len(patterns) > req.Limit {
		patterns = patterns[:req.Limit]
	}

	return &ClusterResult{
		Summary: ClusterSummary{
			AnalyzedLogsTotal: searchResult.Total,
			SampledLogs:       sampledLogs,
			UniquePatterns:    len(accumulators),
			NewPatternsToday:  newPatternsToday,
		},
		Patterns: patterns,
	}, nil
}

func normalizeClusterTemplate(message string) (string, map[string]string) {
	normalized := strings.TrimSpace(message)
	variables := make(map[string]string)
	if normalized == "" {
		return "", variables
	}

	normalized = replaceClusterKeywordValuePattern(normalized, clusterUserValuePattern, "USER_ID", variables)
	normalized = replaceClusterKeywordValuePattern(normalized, clusterRequestValuePattern, "REQUEST_ID", variables)
	normalized = replaceClusterKeywordValuePattern(normalized, clusterJobValuePattern, "JOB_ID", variables)
	normalized = clusterPortPattern.ReplaceAllStringFunc(normalized, func(match string) string {
		groups := clusterPortPattern.FindStringSubmatch(match)
		if len(groups) >= 2 && variables["PORT"] == "" {
			variables["PORT"] = strings.TrimSpace(groups[1])
		}
		return "port {PORT}"
	})
	normalized = replaceClusterSimplePattern(normalized, clusterDurationPattern, "DURATION", variables)
	normalized = replaceClusterSimplePattern(normalized, clusterUUIDPattern, "UUID", variables)
	normalized = replaceClusterSimplePattern(normalized, clusterIPv4Pattern, "IP_ADDRESS", variables)
	normalized = replaceClusterSimplePattern(normalized, clusterEmailPattern, "EMAIL", variables)
	normalized = replaceClusterSimplePattern(normalized, clusterIdentifierPattern, "IDENTIFIER", variables)
	normalized = replaceClusterSimplePattern(normalized, clusterLongNumberPattern, "NUMBER", variables)
	normalized = strings.Join(strings.Fields(normalized), " ")
	if normalized == "" {
		normalized = message
	}
	return normalized, variables
}

func replaceClusterKeywordValuePattern(source string, pattern *regexp.Regexp, placeholder string, variables map[string]string) string {
	return replaceClusterSubmatchFunc(pattern, source, func(groups []string) string {
		if len(groups) < 3 {
			return groups[0]
		}
		keyword := strings.TrimSpace(groups[1])
		value := strings.TrimSpace(groups[2])
		if value != "" && variables[placeholder] == "" {
			variables[placeholder] = value
		}
		if keyword == "" {
			keyword = strings.ToLower(strings.TrimSuffix(placeholder, "_ID"))
		}
		return keyword + " {" + placeholder + "}"
	})
}

func replaceClusterSimplePattern(source string, pattern *regexp.Regexp, placeholder string, variables map[string]string) string {
	return pattern.ReplaceAllStringFunc(source, func(match string) string {
		value := strings.TrimSpace(match)
		if value != "" && variables[placeholder] == "" {
			variables[placeholder] = value
		}
		return "{" + placeholder + "}"
	})
}

func replaceClusterSubmatchFunc(pattern *regexp.Regexp, source string, replacer func(groups []string) string) string {
	indexes := pattern.FindAllStringSubmatchIndex(source, -1)
	if len(indexes) == 0 {
		return source
	}
	var builder strings.Builder
	lastIndex := 0
	for _, groupIndexes := range indexes {
		start := groupIndexes[0]
		end := groupIndexes[1]
		builder.WriteString(source[lastIndex:start])
		groups := make([]string, len(groupIndexes)/2)
		for groupIndex := 0; groupIndex < len(groupIndexes); groupIndex += 2 {
			from := groupIndexes[groupIndex]
			to := groupIndexes[groupIndex+1]
			if from >= 0 && to >= 0 {
				groups[groupIndex/2] = source[from:to]
			}
		}
		builder.WriteString(replacer(groups))
		lastIndex = end
	}
	builder.WriteString(source[lastIndex:])
	return builder.String()
}

func buildClusterAggregationKey(level, template string) string {
	return strings.ToLower(strings.TrimSpace(level)) + "\u0000" + strings.ToLower(strings.TrimSpace(template))
}

func buildClusterPatternID(level, template string) string {
	hasher := sha1.New()
	_, _ = hasher.Write([]byte(strings.ToLower(strings.TrimSpace(level))))
	_, _ = hasher.Write([]byte("\u0000"))
	_, _ = hasher.Write([]byte(strings.ToLower(strings.TrimSpace(template))))
	return hex.EncodeToString(hasher.Sum(nil))
}

func parseClusterTimestamp(raw string) time.Time {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return time.Time{}
	}
	parsed, err := time.Parse(time.RFC3339Nano, trimmed)
	if err == nil {
		return parsed.UTC()
	}
	parsed, err = time.Parse(time.RFC3339, trimmed)
	if err == nil {
		return parsed.UTC()
	}
	return time.Time{}
}

func resolveClusterTrendBucket(ts time.Time, from, to time.Time) int {
	if ts.IsZero() {
		return clusterTrendBucketCount - 1
	}
	if !ts.After(from) {
		return 0
	}
	if !ts.Before(to) {
		return clusterTrendBucketCount - 1
	}
	window := to.Sub(from)
	if window <= 0 {
		return clusterTrendBucketCount - 1
	}
	offset := ts.Sub(from)
	index := int((offset * clusterTrendBucketCount) / window)
	if index < 0 {
		return 0
	}
	if index >= clusterTrendBucketCount {
		return clusterTrendBucketCount - 1
	}
	return index
}

func buildClusterTrendPoints(counts []int64, from, to time.Time) []ClusterTrendPoint {
	points := make([]ClusterTrendPoint, 0, clusterTrendBucketCount)
	window := to.Sub(from)
	if window <= 0 {
		window = time.Minute
	}
	bucketWidth := window / clusterTrendBucketCount
	if bucketWidth <= 0 {
		bucketWidth = time.Minute
	}
	for index := 0; index < clusterTrendBucketCount; index++ {
		pointTime := from.Add(time.Duration(index) * bucketWidth).UTC().Format(time.RFC3339)
		count := int64(0)
		if index < len(counts) {
			count = counts[index]
		}
		points = append(points, ClusterTrendPoint{Time: pointTime, Count: count})
	}
	return points
}

func estimateClusterSimilarity(template string) int {
	placeholderCount := len(clusterPlaceholderPattern.FindAllString(template, -1))
	wordCount := len(strings.Fields(template))
	if wordCount == 0 {
		return 100
	}
	density := float64(placeholderCount) / float64(wordCount)
	score := int(100 - density*45)
	if placeholderCount == 0 {
		score = 100
	}
	if score < 72 {
		score = 72
	}
	if score > 100 {
		score = 100
	}
	return score
}
