package service

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/nexuslog/data-services/query-api/internal/repository"
)

const (
	anomalyQueryTimeout = 8 * time.Second
	anomalyMaxItems     = 20
)

var anomalyErrorLevels = []string{"error", "fatal", "panic", "warn", "warning"}

// AnomalyRequest defines the payload for POST /api/v1/query/stats/anomalies.
type AnomalyRequest struct {
	TimeRange string         `json:"time_range"`
	Keywords  string         `json:"keywords"`
	Filters   map[string]any `json:"filters"`
}

// AnomalyTrendPoint represents one bucket in the anomaly trend view.
type AnomalyTrendPoint struct {
	Time       string  `json:"time"`
	Actual     int64   `json:"actual"`
	Expected   float64 `json:"expected"`
	LowerBound float64 `json:"lower_bound"`
	UpperBound float64 `json:"upper_bound"`
	IsAnomaly  bool    `json:"is_anomaly"`
	ErrorRate  float64 `json:"error_rate"`
}

// DetectedAnomaly describes one generated anomaly event.
type DetectedAnomaly struct {
	ID            string  `json:"id"`
	Title         string  `json:"title"`
	Description   string  `json:"description"`
	Severity      string  `json:"severity"`
	Status        string  `json:"status"`
	Timestamp     string  `json:"timestamp"`
	Service       string  `json:"service"`
	Confidence    int     `json:"confidence"`
	Metric        string  `json:"metric"`
	ExpectedValue float64 `json:"expected_value"`
	ActualValue   float64 `json:"actual_value"`
	RootCause     string  `json:"root_cause,omitempty"`
}

// AnomalySummary summarizes anomaly detection results.
type AnomalySummary struct {
	TotalAnomalies   int `json:"total_anomalies"`
	CriticalCount    int `json:"critical_count"`
	HealthScore      int `json:"health_score"`
	AnomalousBuckets int `json:"anomalous_buckets"`
	AffectedServices int `json:"affected_services"`
}

// AnomalyResult contains trend and anomaly list.
type AnomalyResult struct {
	Summary   AnomalySummary      `json:"summary"`
	Trend     []AnomalyTrendPoint `json:"trend"`
	Anomalies []DetectedAnomaly   `json:"anomalies"`
}

type anomalyTimelineBucket struct {
	Time       time.Time
	Actual     int64
	ErrorCount int64
}

func normalizeAnomalyRequest(req AnomalyRequest) AnomalyRequest {
	normalized := AnomalyRequest{
		TimeRange: normalizeAnomalyTimeRange(req.TimeRange),
		Keywords:  strings.TrimSpace(req.Keywords),
		Filters:   make(map[string]any, len(req.Filters)),
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

func normalizeAnomalyTimeRange(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
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

func resolveAnomalyTimeRangeDuration(timeRange string) time.Duration {
	switch normalizeAnomalyTimeRange(timeRange) {
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

func resolveAnomalyHistogram(timeRange string) (string, string) {
	switch normalizeAnomalyTimeRange(timeRange) {
	case "1h":
		return "fixed_interval", "5m"
	case "6h":
		return "fixed_interval", "30m"
	case "7d":
		return "fixed_interval", "12h"
	default:
		return "fixed_interval", "2h"
	}
}

// DetectAnomalies detects anomaly candidates from log volume and error-rate trends.
func (s *StatsService) DetectAnomalies(ctx context.Context, actor RequestActor, req AnomalyRequest) (*AnomalyResult, error) {
	ctx, cancel := context.WithTimeout(ctx, anomalyQueryTimeout)
	defer cancel()

	actor = normalizeActor(actor)
	authorizedTenantSet, err := resolveAuthorizedTenantSet(actor)
	if err != nil {
		return nil, err
	}

	req = normalizeAnomalyRequest(req)
	now := time.Now().UTC().Truncate(time.Second)
	fromTime := now.Add(-resolveAnomalyTimeRangeDuration(req.TimeRange))
	from := fromTime.Format(time.RFC3339)
	to := now.Format(time.RFC3339)
	histogramType, interval := resolveAnomalyHistogram(req.TimeRange)

	query := repository.BuildESQuery(repository.SearchLogsInput{
		TenantID:            actor.TenantID,
		TenantReadScope:     actor.TenantReadScope,
		AuthorizedTenantIDs: authorizedTenantSet.TenantIDs(),
		Keywords:            req.Keywords,
		TimeRangeFrom:       from,
		TimeRangeTo:         to,
		Filters:             req.Filters,
	})

	dateHistogram := map[string]any{
		"field":         "@timestamp",
		"min_doc_count": 0,
		"extended_bounds": map[string]any{
			"min": from,
			"max": to,
		},
		histogramType: interval,
	}

	aggs := map[string]any{
		"timeline": map[string]any{
			"date_histogram": dateHistogram,
			"aggs": map[string]any{
				"error_logs": map[string]any{
					"filter": map[string]any{
						"terms": map[string]any{
							"log.level": anomalyErrorLevels,
						},
					},
				},
			},
		},
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
		return nil, fmt.Errorf("es anomaly query: %w", err)
	}

	timelineBuckets := parseAnomalyTimelineBuckets(result.Aggregations)
	topSources := buildOverviewTopSources(result.Aggregations)
	dominantService := resolveAnomalyService(topSources)
	trend, anomalies := detectAnomaliesFromTimeline(timelineBuckets, dominantService)
	if len(anomalies) > anomalyMaxItems {
		anomalies = anomalies[:anomalyMaxItems]
	}

	criticalCount := 0
	anomalousBuckets := 0
	for _, anomaly := range anomalies {
		if anomaly.Severity == "critical" {
			criticalCount++
		}
	}
	for _, point := range trend {
		if point.IsAnomaly {
			anomalousBuckets++
		}
	}
	healthPenalty := len(anomalies)*8 + criticalCount*10
	healthScore := 100 - healthPenalty
	if healthScore < 0 {
		healthScore = 0
	}
	affectedServiceSet := make(map[string]struct{})
	for _, anomaly := range anomalies {
		service := strings.TrimSpace(anomaly.Service)
		if service == "" {
			continue
		}
		affectedServiceSet[service] = struct{}{}
	}
	if len(affectedServiceSet) == 0 && strings.TrimSpace(dominantService) != "" {
		affectedServiceSet[dominantService] = struct{}{}
	}

	return &AnomalyResult{
		Summary: AnomalySummary{
			TotalAnomalies:   len(anomalies),
			CriticalCount:    criticalCount,
			HealthScore:      healthScore,
			AnomalousBuckets: anomalousBuckets,
			AffectedServices: len(affectedServiceSet),
		},
		Trend:     trend,
		Anomalies: anomalies,
	}, nil
}

func parseAnomalyTimelineBuckets(aggregations map[string]any) []anomalyTimelineBucket {
	parsed := make([]anomalyTimelineBucket, 0)
	timeline, ok := aggregations["timeline"].(map[string]any)
	if !ok {
		return parsed
	}
	buckets, ok := timeline["buckets"].([]any)
	if !ok {
		return parsed
	}
	for _, item := range buckets {
		bucket, ok := item.(map[string]any)
		if !ok {
			continue
		}
		parsedTime := parseAnomalyBucketTime(bucket)
		count := int64(0)
		if value, ok := bucket["doc_count"].(float64); ok {
			count = int64(value)
		}
		errorCount := int64(0)
		if errorAgg, ok := bucket["error_logs"].(map[string]any); ok {
			if value, ok := errorAgg["doc_count"].(float64); ok {
				errorCount = int64(value)
			}
		}
		parsed = append(parsed, anomalyTimelineBucket{Time: parsedTime, Actual: count, ErrorCount: errorCount})
	}
	return parsed
}

func parseAnomalyBucketTime(bucket map[string]any) time.Time {
	if keyAsString, ok := bucket["key_as_string"].(string); ok {
		if parsed, err := time.Parse(time.RFC3339Nano, strings.TrimSpace(keyAsString)); err == nil {
			return parsed.UTC()
		}
		if parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(keyAsString)); err == nil {
			return parsed.UTC()
		}
	}
	if key, ok := bucket["key"].(float64); ok {
		return time.UnixMilli(int64(key)).UTC()
	}
	return time.Time{}
}

func resolveAnomalyService(topSources []SourceCount) string {
	if len(topSources) == 0 {
		return "全局"
	}
	service := strings.TrimSpace(topSources[0].Service)
	if service == "" || service == aggregateUnknownService {
		service = strings.TrimSpace(topSources[0].Host)
	}
	if service == "" || service == aggregateUnknownHost {
		return "全局"
	}
	return service
}

func detectAnomaliesFromTimeline(buckets []anomalyTimelineBucket, service string) ([]AnomalyTrendPoint, []DetectedAnomaly) {
	if len(buckets) == 0 {
		return []AnomalyTrendPoint{}, []DetectedAnomaly{}
	}
	actualValues := make([]float64, 0, len(buckets))
	errorRates := make([]float64, 0, len(buckets))
	for _, bucket := range buckets {
		actualValues = append(actualValues, float64(bucket.Actual))
		if bucket.Actual <= 0 {
			errorRates = append(errorRates, 0)
			continue
		}
		errorRates = append(errorRates, (float64(bucket.ErrorCount)/float64(bucket.Actual))*100)
	}
	globalActualMean, globalActualStd := computeFloatStats(actualValues)
	globalErrorMean, globalErrorStd := computeFloatStats(errorRates)
	if globalActualMean <= 0 {
		globalActualMean = 0
	}
	if globalErrorMean < 0 {
		globalErrorMean = 0
	}

	trend := make([]AnomalyTrendPoint, 0, len(buckets))
	anomalies := make([]DetectedAnomaly, 0)
	for index, bucket := range buckets {
		actual := float64(bucket.Actual)
		expected, expectedStd := rollingExpectation(actualValues, index, 4)
		if expected <= 0 {
			expected = globalActualMean
			expectedStd = globalActualStd
		}
		margin := maxFloat(5, expected*0.25, expectedStd*2)
		lowerBound := maxFloat(0, expected-margin)
		upperBound := expected + margin
		isVolumeAnomaly := actual > upperBound || actual < lowerBound
		errorRate := errorRates[index]
		expectedErrorRate, errorStd := rollingExpectation(errorRates, index, 4)
		if expectedErrorRate < 0 {
			expectedErrorRate = globalErrorMean
			errorStd = globalErrorStd
		}
		errorMargin := maxFloat(1.5, expectedErrorRate*0.5, errorStd*2)
		isErrorRateAnomaly := bucket.Actual >= 20 && errorRate > expectedErrorRate+errorMargin

		trend = append(trend, AnomalyTrendPoint{
			Time:       bucket.Time.UTC().Format(time.RFC3339),
			Actual:     bucket.Actual,
			Expected:   roundFloat(expected, 2),
			LowerBound: roundFloat(lowerBound, 2),
			UpperBound: roundFloat(upperBound, 2),
			IsAnomaly:  isVolumeAnomaly || isErrorRateAnomaly,
			ErrorRate:  roundFloat(errorRate, 2),
		})

		if isVolumeAnomaly && (actual > 0 || expected > 0) {
			changeRatio := 0.0
			if expected > 0 {
				changeRatio = math.Abs(actual-expected) / expected
			}
			title := "日志量异常波动"
			description := fmt.Sprintf("%s 时间桶的日志量为 %.0f，基线约为 %.0f。", bucket.Time.Local().Format("2006-01-02 15:04"), actual, expected)
			rootCause := "当前时间桶日志量显著偏离历史基线，建议检查服务流量变化、采集链路状态或异常重试。"
			if actual < lowerBound {
				title = "流量突降"
				rootCause = "当前时间桶日志量显著低于历史基线，建议检查 Agent 在线状态、采集任务和上游服务流量。"
			} else if actual > upperBound {
				title = "日志量激增"
			}
			anomalies = append(anomalies, buildDetectedAnomaly(bucket.Time, service, title, description, "log_volume", expected, actual, changeRatio, rootCause))
		}

		if isErrorRateAnomaly {
			changeRatio := 0.0
			if expectedErrorRate > 0 {
				changeRatio = math.Abs(errorRate-expectedErrorRate) / expectedErrorRate
			} else if errorRate > 0 {
				changeRatio = errorRate / 5
			}
			description := fmt.Sprintf("%s 时间桶的错误级别日志占比达到 %.2f%%，高于基线 %.2f%%。", bucket.Time.Local().Format("2006-01-02 15:04"), errorRate, expectedErrorRate)
			rootCause := "错误级别日志占比显著升高，建议结合聚类分析查看高频报错模板，并排查最近配置或发布变更。"
			anomalies = append(anomalies, buildDetectedAnomaly(bucket.Time, service, "异常错误率", description, "error_rate", expectedErrorRate, errorRate, changeRatio, rootCause))
		}
	}

	sort.Slice(anomalies, func(i, j int) bool {
		left := anomalySeverityRank(anomalies[i].Severity)
		right := anomalySeverityRank(anomalies[j].Severity)
		if left != right {
			return left > right
		}
		if anomalies[i].Timestamp != anomalies[j].Timestamp {
			return anomalies[i].Timestamp > anomalies[j].Timestamp
		}
		return anomalies[i].Title < anomalies[j].Title
	})
	return trend, anomalies
}

func rollingExpectation(values []float64, index, lookback int) (float64, float64) {
	if index <= 0 || len(values) == 0 {
		return 0, 0
	}
	start := index - lookback
	if start < 0 {
		start = 0
	}
	window := make([]float64, 0, index-start)
	for cursor := start; cursor < index; cursor++ {
		window = append(window, values[cursor])
	}
	if len(window) == 0 {
		return 0, 0
	}
	return computeFloatStats(window)
}

func computeFloatStats(values []float64) (float64, float64) {
	if len(values) == 0 {
		return 0, 0
	}
	sum := 0.0
	for _, value := range values {
		sum += value
	}
	mean := sum / float64(len(values))
	variance := 0.0
	for _, value := range values {
		delta := value - mean
		variance += delta * delta
	}
	variance /= float64(len(values))
	return mean, math.Sqrt(variance)
}

func buildDetectedAnomaly(ts time.Time, service, title, description, metric string, expectedValue, actualValue, changeRatio float64, rootCause string) DetectedAnomaly {
	severity := classifyDetectedAnomalySeverity(changeRatio)
	confidence := classifyDetectedAnomalyConfidence(changeRatio)
	status := "investigating"
	if time.Since(ts) <= 2*time.Hour {
		status = "active"
	}
	return DetectedAnomaly{
		ID:            buildDetectedAnomalyID(service, title, metric, ts),
		Title:         title,
		Description:   description,
		Severity:      severity,
		Status:        status,
		Timestamp:     ts.UTC().Format(time.RFC3339),
		Service:       service,
		Confidence:    confidence,
		Metric:        metric,
		ExpectedValue: roundFloat(expectedValue, 2),
		ActualValue:   roundFloat(actualValue, 2),
		RootCause:     rootCause,
	}
}

func buildDetectedAnomalyID(service, title, metric string, ts time.Time) string {
	hasher := sha1.New()
	_, _ = hasher.Write([]byte(strings.TrimSpace(service)))
	_, _ = hasher.Write([]byte("\u0000"))
	_, _ = hasher.Write([]byte(strings.TrimSpace(title)))
	_, _ = hasher.Write([]byte("\u0000"))
	_, _ = hasher.Write([]byte(strings.TrimSpace(metric)))
	_, _ = hasher.Write([]byte("\u0000"))
	_, _ = hasher.Write([]byte(ts.UTC().Format(time.RFC3339)))
	return hex.EncodeToString(hasher.Sum(nil))
}

func classifyDetectedAnomalySeverity(changeRatio float64) string {
	switch {
	case changeRatio >= 2:
		return "critical"
	case changeRatio >= 1.2:
		return "high"
	case changeRatio >= 0.6:
		return "medium"
	default:
		return "low"
	}
}

func classifyDetectedAnomalyConfidence(changeRatio float64) int {
	score := 65 + int(changeRatio*20)
	if score > 99 {
		return 99
	}
	if score < 55 {
		return 55
	}
	return score
}

func anomalySeverityRank(severity string) int {
	switch strings.ToLower(strings.TrimSpace(severity)) {
	case "critical":
		return 4
	case "high":
		return 3
	case "medium":
		return 2
	default:
		return 1
	}
}

func roundFloat(value float64, digits int) float64 {
	if digits <= 0 {
		return math.Round(value)
	}
	factor := math.Pow10(digits)
	return math.Round(value*factor) / factor
}

func maxFloat(base float64, candidates ...float64) float64 {
	result := base
	for _, candidate := range candidates {
		if candidate > result {
			result = candidate
		}
	}
	return result
}
