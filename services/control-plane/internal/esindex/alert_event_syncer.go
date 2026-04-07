package esindex

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/nexuslog/control-plane/internal/httpguard"
)

const (
	defaultAlertEventsIndex = "nexuslog-alerts"
	defaultESBaseURL        = "http://elasticsearch:9200"
)

type AlertEventSyncer struct {
	db          *sql.DB
	endpoint    string
	endpointErr error
	indexName   string
	username    string
	password    string
	client      *http.Client
}

func NewAlertEventSyncerFromEnv(db *sql.DB) *AlertEventSyncer {
	endpoint := resolveFirstAddress(
		os.Getenv("ALERT_EVENTS_ES_ENDPOINT"),
		os.Getenv("SEARCH_ELASTICSEARCH_ADDRESSES"),
		os.Getenv("DATABASE_ELASTICSEARCH_ADDRESSES"),
		os.Getenv("INGEST_ES_ENDPOINT"),
		os.Getenv("ELASTICSEARCH_URL"),
		defaultESBaseURL,
	)
	normalizedEndpoint, endpointErr := httpguard.NormalizeBaseURL(endpoint, httpguard.BaseURLOptions{
		AllowPrivate:  true,
		AllowLoopback: true,
	})
	return &AlertEventSyncer{
		db:          db,
		endpoint:    normalizedEndpoint,
		endpointErr: endpointErr,
		indexName: strings.TrimSpace(firstNonEmpty(
			os.Getenv("ALERT_EVENTS_ES_INDEX"),
			defaultAlertEventsIndex,
		)),
		username: strings.TrimSpace(firstNonEmpty(
			os.Getenv("ALERT_EVENTS_ES_USERNAME"),
			os.Getenv("ALERT_EVALUATOR_ES_USERNAME"),
			os.Getenv("DATABASE_ELASTICSEARCH_USERNAME"),
			os.Getenv("ELASTICSEARCH_USERNAME"),
		)),
		password: strings.TrimSpace(firstNonEmpty(
			os.Getenv("ALERT_EVENTS_ES_PASSWORD"),
			os.Getenv("ALERT_EVALUATOR_ES_PASSWORD"),
			os.Getenv("DATABASE_ELASTICSEARCH_PASSWORD"),
			os.Getenv("ELASTICSEARCH_PASSWORD"),
		)),
		client: &http.Client{Timeout: 5 * time.Second},
	}
}

func (s *AlertEventSyncer) Enabled() bool {
	return s != nil && s.db != nil && s.client != nil && s.endpointErr == nil && s.endpoint != "" && s.indexName != ""
}

func (s *AlertEventSyncer) SyncByID(ctx context.Context, alertEventID string) error {
	if !s.Enabled() {
		return nil
	}
	alertEventID = strings.TrimSpace(alertEventID)
	if alertEventID == "" {
		return nil
	}
	if ctx == nil {
		ctx = context.Background()
	}
	if _, ok := ctx.Deadline(); !ok {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, 5*time.Second)
		defer cancel()
	}

	doc, err := s.loadDocument(ctx, alertEventID)
	if err != nil {
		return err
	}
	body, err := json.Marshal(doc)
	if err != nil {
		return fmt.Errorf("marshal alert event document: %w", err)
	}

	requestURL := fmt.Sprintf("%s/%s/_doc/%s", s.endpoint, url.PathEscape(s.indexName), url.PathEscape(alertEventID))
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, requestURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build alert event index request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if s.username != "" {
		req.SetBasicAuth(s.username, s.password)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("index alert event: %w", err)
	}
	defer resp.Body.Close()
	raw, err := httpguard.ReadLimitedBody(resp.Body, 0)
	if err != nil {
		return fmt.Errorf("read alert event index response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("index alert event failed: status=%d body=%s", resp.StatusCode, string(raw))
	}
	return nil
}

func (s *AlertEventSyncer) loadDocument(ctx context.Context, alertEventID string) (map[string]any, error) {
	query := `
SELECT
    id::text,
    COALESCE(tenant_id::text, ''),
    COALESCE(rule_id::text, ''),
    COALESCE(resource_threshold_id::text, ''),
    COALESCE(severity, ''),
    COALESCE(status, ''),
    COALESCE(title, ''),
    COALESCE(detail, ''),
    COALESCE(agent_id, ''),
    COALESCE(source_id, ''),
    fired_at,
    resolved_at,
    notified_at,
    COALESCE(notification_result, '{}'::jsonb)
FROM alert_events
WHERE id = $1::uuid
`
	var (
		id                  string
		tenantID            string
		ruleID              string
		resourceThresholdID string
		severity            string
		status              string
		title               string
		detail              string
		agentID             string
		sourceID            string
		firedAt             time.Time
		resolvedAt          sql.NullTime
		notifiedAt          sql.NullTime
		notificationRaw     []byte
	)
	if err := s.db.QueryRowContext(ctx, query, alertEventID).Scan(
		&id,
		&tenantID,
		&ruleID,
		&resourceThresholdID,
		&severity,
		&status,
		&title,
		&detail,
		&agentID,
		&sourceID,
		&firedAt,
		&resolvedAt,
		&notifiedAt,
		&notificationRaw,
	); err != nil {
		return nil, fmt.Errorf("load alert event %s: %w", alertEventID, err)
	}

	notificationResult := map[string]any{}
	if len(notificationRaw) > 0 {
		_ = json.Unmarshal(notificationRaw, &notificationResult)
	}
	doc := map[string]any{
		"@timestamp":            firedAt.UTC().Format(time.RFC3339Nano),
		"id":                    id,
		"alert_id":              id,
		"tenant_id":             tenantID,
		"rule_id":               ruleID,
		"resource_threshold_id": resourceThresholdID,
		"severity":              severity,
		"status":                status,
		"title":                 title,
		"detail":                detail,
		"agent_id":              agentID,
		"source_id":             sourceID,
		"fired_at":              firedAt.UTC().Format(time.RFC3339Nano),
		"count":                 1,
		"notification_result":   notificationResult,
	}
	if resolvedAt.Valid {
		doc["resolved_at"] = resolvedAt.Time.UTC().Format(time.RFC3339Nano)
	}
	if notifiedAt.Valid {
		doc["notified_at"] = notifiedAt.Time.UTC().Format(time.RFC3339Nano)
	}
	return doc, nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func resolveFirstAddress(values ...string) string {
	for _, value := range values {
		for _, part := range strings.Split(value, ",") {
			if trimmed := strings.TrimSpace(part); trimmed != "" {
				return trimmed
			}
		}
	}
	return ""
}
