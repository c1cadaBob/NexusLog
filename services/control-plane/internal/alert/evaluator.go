package alert

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// ESSearchClient performs Elasticsearch search queries.
type ESSearchClient interface {
	Search(ctx context.Context, index string, body []byte) (int64, error)
}

// httpESSearchClient implements ESSearchClient via HTTP.
type httpESSearchClient struct {
	endpoint string
	username string
	password string
	client   *http.Client
}

// NewHTTPESSearchClient creates an ES search client.
func NewHTTPESSearchClient(endpoint, username, password string, timeout time.Duration) *httpESSearchClient {
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	return &httpESSearchClient{
		endpoint: strings.TrimRight(strings.TrimSpace(endpoint), "/"),
		username: strings.TrimSpace(username),
		password: strings.TrimSpace(password),
		client:   &http.Client{Timeout: timeout},
	}
}

// Search executes a search and returns the total hit count.
func (c *httpESSearchClient) Search(ctx context.Context, index string, body []byte) (int64, error) {
	if c.endpoint == "" || index == "" {
		return 0, fmt.Errorf("es endpoint and index are required")
	}
	url := c.endpoint + "/" + index + "/_search"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.username != "" {
		req.SetBasicAuth(c.username, c.password)
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return 0, fmt.Errorf("es search failed: status=%d body=%s", resp.StatusCode, string(raw))
	}
	var result struct {
		Hits struct {
			Total struct {
				Value int64 `json:"value"`
			} `json:"total"`
		} `json:"hits"`
	}
	if err := json.Unmarshal(raw, &result); err != nil {
		return 0, fmt.Errorf("decode es response: %w", err)
	}
	return result.Hits.Total.Value, nil
}

// IncidentCreator creates incidents from critical alerts.
type IncidentCreator interface {
	CreateFromAlert(ctx context.Context, tenantID, ruleID, alertEventID, title, detail, severity string) error
}

// SilenceChecker checks if an alert should be silenced (no notification).
type SilenceChecker interface {
	IsSilenced(ctx context.Context, tenantID, ruleID, severity, sourceID string) (bool, error)
}

// Evaluator runs the alert evaluation loop.
type Evaluator struct {
	ruleRepo        RuleRepository
	esClient        ESSearchClient
	db              *sql.DB
	indexName       string
	interval        time.Duration
	stopCh          chan struct{}
	suppressor      *Suppressor
	incidentCreator IncidentCreator
	silenceChecker  SilenceChecker
}

// NewEvaluator creates a new evaluator.
func NewEvaluator(ruleRepo RuleRepository, esClient ESSearchClient, db *sql.DB, indexName string) *Evaluator {
	return &Evaluator{
		ruleRepo:        ruleRepo,
		esClient:        esClient,
		db:              db,
		indexName:       indexName,
		interval:        30 * time.Second,
		stopCh:          make(chan struct{}),
		suppressor:      NewSuppressor(5 * time.Minute),
		incidentCreator: nil,
	}
}

// WithIncidentCreator sets the incident creator for auto-creating incidents from critical alerts.
func (e *Evaluator) WithIncidentCreator(ic IncidentCreator) *Evaluator {
	e.incidentCreator = ic
	return e
}

// WithSilenceChecker sets the silence checker; when alert matches, skip notification but still record.
func (e *Evaluator) WithSilenceChecker(sc SilenceChecker) *Evaluator {
	e.silenceChecker = sc
	return e
}

// WithInterval sets the evaluation interval.
func (e *Evaluator) WithInterval(d time.Duration) *Evaluator {
	return &Evaluator{
		ruleRepo:        e.ruleRepo,
		esClient:        e.esClient,
		db:              e.db,
		indexName:       e.indexName,
		interval:        d,
		stopCh:          e.stopCh,
		suppressor:      e.suppressor,
		incidentCreator: e.incidentCreator,
		silenceChecker:  e.silenceChecker,
	}
}

// WithSuppressor sets the suppressor.
func (e *Evaluator) WithSuppressor(s *Suppressor) *Evaluator {
	return &Evaluator{
		ruleRepo:        e.ruleRepo,
		esClient:        e.esClient,
		db:              e.db,
		indexName:       e.indexName,
		interval:        e.interval,
		stopCh:          e.stopCh,
		suppressor:      s,
		incidentCreator: e.incidentCreator,
		silenceChecker:  e.silenceChecker,
	}
}

// Start begins the evaluation loop.
func (e *Evaluator) Start() {
	ticker := time.NewTicker(e.interval)
	defer ticker.Stop()
	for {
		select {
		case <-e.stopCh:
			return
		case <-ticker.C:
			e.runOnce(context.Background())
		}
	}
}

// Stop stops the evaluator.
func (e *Evaluator) Stop() {
	close(e.stopCh)
}

// runOnce runs a single evaluation cycle.
func (e *Evaluator) runOnce(ctx context.Context) {
	start := time.Now()
	defer func() {
		alertEvalDurationSeconds.Observe(time.Since(start).Seconds())
	}()

	rules, err := e.ruleRepo.ListEnabledRules(ctx)
	if err != nil {
		return
	}
	for _, rule := range rules {
		if err := e.evaluateRule(ctx, &rule); err != nil {
			// log but continue
		}
	}
}

// evaluateRule evaluates a single rule and creates an alert_event if condition is met.
func (e *Evaluator) evaluateRule(ctx context.Context, rule *AlertRule) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	matched, sourceID, err := e.checkCondition(ctx, rule)
	if err != nil {
		return err
	}
	if !matched {
		return nil
	}

	if e.suppressor != nil && e.suppressor.ShouldSuppress(rule.ID, sourceID) {
		return nil
	}

	if e.suppressor != nil {
		e.suppressor.Record(rule.ID, sourceID)
	}

	title := rule.Name
	if title == "" {
		title = "Alert: " + rule.ID
	}
	detail := rule.Description

	query := `
INSERT INTO alert_events (tenant_id, rule_id, severity, title, detail, source_id, status, fired_at)
VALUES ($1::uuid, $2::uuid, $3, $4, NULLIF($5,''), NULLIF($6,''), 'firing', NOW())
RETURNING id::text
`
	var alertEventID string
	err = e.db.QueryRowContext(ctx, query, rule.TenantID, rule.ID, rule.Severity, title, detail, sourceID).Scan(&alertEventID)
	if err != nil {
		return err
	}
	alertEventsTotal.Inc()

	// Auto-create incident for critical alerts (skip if silenced)
	if e.incidentCreator != nil {
		if e.silenceChecker != nil {
			silenced, err := e.silenceChecker.IsSilenced(ctx, rule.TenantID, rule.ID, rule.Severity, sourceID)
			if err == nil && silenced {
				return nil // notification suppressed, alert_event already recorded
			}
		}
		_ = e.incidentCreator.CreateFromAlert(ctx, rule.TenantID, rule.ID, alertEventID, title, detail, rule.Severity)
	}
	return nil
}

// checkCondition evaluates the rule condition and returns (matched, sourceID, error).
func (e *Evaluator) checkCondition(ctx context.Context, rule *AlertRule) (bool, string, error) {
	var m map[string]interface{}
	if err := json.Unmarshal(rule.Condition, &m); err != nil {
		return false, "", err
	}
	typ, ok := m["type"].(string)
	if !ok || typ == "" {
		return false, "", nil
	}
	typ = strings.ToLower(strings.TrimSpace(typ))

	switch typ {
	case RuleTypeKeyword:
		return e.checkKeyword(ctx, rule, m)
	case RuleTypeLevelCount:
		return e.checkLevelCount(ctx, rule, m)
	case RuleTypeThreshold:
		return e.checkThreshold(ctx, rule, m)
	default:
		return false, "", nil
	}
}

func (e *Evaluator) checkKeyword(ctx context.Context, rule *AlertRule, m map[string]interface{}) (bool, string, error) {
	keyword, ok := m["keyword"].(string)
	if !ok || strings.TrimSpace(keyword) == "" {
		return false, "", nil
	}
	field, _ := m["field"].(string)
	if field == "" {
		field = "message"
	}
	windowSec := 300
	if v, ok := m["window_seconds"]; ok {
		switch w := v.(type) {
		case float64:
			windowSec = int(w)
		case int:
			windowSec = w
		}
	}
	if windowSec <= 0 {
		windowSec = 300
	}

	from := time.Now().Add(-time.Duration(windowSec) * time.Second).UTC().Format(time.RFC3339)
	filters := []interface{}{
		map[string]interface{}{
			"range": map[string]interface{}{
				"@timestamp": map[string]interface{}{"gte": from},
			},
		},
		map[string]interface{}{
			"match": map[string]interface{}{field: keyword},
		},
	}
	filters = appendTenantFilter(filters, rule.TenantID)
	query := map[string]interface{}{
		"query": map[string]interface{}{
			"bool": map[string]interface{}{"filter": filters},
		},
		"size": 0,
	}
	body, _ := json.Marshal(query)
	count, err := e.esClient.Search(ctx, e.indexName, body)
	if err != nil {
		return false, "", err
	}
	return count > 0, "", nil
}

func (e *Evaluator) checkLevelCount(ctx context.Context, rule *AlertRule, m map[string]interface{}) (bool, string, error) {
	level, ok := m["level"].(string)
	if !ok || strings.TrimSpace(level) == "" {
		return false, "", nil
	}
	threshold := 1
	if v, ok := m["threshold"]; ok {
		switch t := v.(type) {
		case float64:
			threshold = int(t)
		case int:
			threshold = t
		}
	}
	windowSec := 300
	if v, ok := m["window_seconds"]; ok {
		switch w := v.(type) {
		case float64:
			windowSec = int(w)
		case int:
			windowSec = w
		}
	}
	if windowSec <= 0 {
		windowSec = 300
	}

	from := time.Now().Add(-time.Duration(windowSec) * time.Second).UTC().Format(time.RFC3339)
	filters := []interface{}{
		map[string]interface{}{
			"range": map[string]interface{}{
				"@timestamp": map[string]interface{}{"gte": from},
			},
		},
		buildLevelFilter(strings.ToLower(level)),
	}
	filters = appendTenantFilter(filters, rule.TenantID)
	query := map[string]interface{}{
		"query": map[string]interface{}{
			"bool": map[string]interface{}{"filter": filters},
		},
		"size": 0,
	}
	body, _ := json.Marshal(query)
	count, err := e.esClient.Search(ctx, e.indexName, body)
	if err != nil {
		return false, "", err
	}
	return count >= int64(threshold), "", nil
}

func (e *Evaluator) checkThreshold(ctx context.Context, rule *AlertRule, m map[string]interface{}) (bool, string, error) {
	metric, ok := m["metric"].(string)
	if !ok || strings.TrimSpace(metric) == "" {
		return false, "", nil
	}
	op, ok := m["operator"].(string)
	if !ok || strings.TrimSpace(op) == "" {
		return false, "", nil
	}
	op = strings.TrimSpace(op)
	value, ok := m["value"]
	if !ok {
		return false, "", nil
	}
	var threshold float64
	switch v := value.(type) {
	case float64:
		threshold = v
	case int:
		threshold = float64(v)
	default:
		return false, "", nil
	}

	// For metric "count", count documents in window
	windowSec := 300
	if v, ok := m["window_seconds"]; ok {
		switch w := v.(type) {
		case float64:
			windowSec = int(w)
		case int:
			windowSec = w
		}
	}
	if windowSec <= 0 {
		windowSec = 300
	}

	from := time.Now().Add(-time.Duration(windowSec) * time.Second).UTC().Format(time.RFC3339)
	filters := []interface{}{
		map[string]interface{}{
			"range": map[string]interface{}{
				"@timestamp": map[string]interface{}{"gte": from},
			},
		},
	}
	filters = appendTenantFilter(filters, rule.TenantID)
	query := map[string]interface{}{
		"query": map[string]interface{}{
			"bool": map[string]interface{}{"filter": filters},
		},
		"size": 0,
	}
	body, _ := json.Marshal(query)
	count, err := e.esClient.Search(ctx, e.indexName, body)
	if err != nil {
		return false, "", err
	}
	actual := float64(count)

	matched := false
	switch op {
	case ">":
		matched = actual > threshold
	case "<":
		matched = actual < threshold
	case ">=":
		matched = actual >= threshold
	case "<=":
		matched = actual <= threshold
	case "==":
		matched = actual == threshold
	case "!=":
		matched = actual != threshold
	}
	_ = metric
	return matched, "", nil
}

func appendTenantFilter(filters []interface{}, tenantID string) []interface{} {
	tenantID = strings.TrimSpace(tenantID)
	if tenantID == "" {
		return filters
	}
	return append(filters, map[string]interface{}{
		"bool": map[string]interface{}{
			"should": []interface{}{
				map[string]interface{}{"term": map[string]interface{}{"tenant_id": tenantID}},
				map[string]interface{}{"term": map[string]interface{}{"nexuslog.governance.tenant_id": tenantID}},
			},
			"minimum_should_match": 1,
		},
	})
}

func buildLevelFilter(level string) map[string]interface{} {
	return map[string]interface{}{
		"bool": map[string]interface{}{
			"should": []interface{}{
				map[string]interface{}{"term": map[string]interface{}{"level": level}},
				map[string]interface{}{"term": map[string]interface{}{"log.level": level}},
			},
			"minimum_should_match": 1,
		},
	}
}
