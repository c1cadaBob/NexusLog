package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	_ "github.com/lib/pq"

	"github.com/nexuslog/control-plane/internal/httpguard"
)

const (
	defaultESBaseURL      = "http://localhost:9200"
	defaultAlertsIndex    = "nexuslog-alerts"
	defaultAuditIndex     = "nexuslog-audit"
	defaultPostgresPort   = "5432"
	defaultPostgresDBName = "nexuslog"
	defaultPostgresUser   = "nexuslog"
	defaultPostgresPass   = "nexuslog_dev"
	defaultPostgresSSL    = "disable"
	defaultBatchSize      = 500
)

type config struct {
	targets   []string
	batchSize int
	refresh   bool
}

type esTargetConfig struct {
	name      string
	endpoint  string
	indexName string
	username  string
	password  string
}

type bulkIndexer struct {
	endpoint  string
	indexName string
	username  string
	password  string
	client    *http.Client
}

type bulkDocument struct {
	id  string
	doc map[string]any
}

type backfillStats struct {
	Target  string
	Read    int
	Indexed int
	Failed  int
	Batches int
}

type esBulkResponse struct {
	Errors bool            `json:"errors"`
	Items  []esBulkItemRaw `json:"items"`
}

type esBulkItemRaw map[string]esBulkItem

type esBulkItem struct {
	Status int              `json:"status"`
	Index  string           `json:"_index"`
	ID     string           `json:"_id"`
	Error  *esBulkItemError `json:"error,omitempty"`
}

type esBulkItemError struct {
	Type     string           `json:"type"`
	Reason   string           `json:"reason"`
	CausedBy *esBulkItemError `json:"caused_by,omitempty"`
}

type alertRow struct {
	ID                  string
	TenantID            string
	RuleID              string
	ResourceThresholdID string
	Severity            string
	Status              string
	Title               string
	Detail              string
	AgentID             string
	SourceID            string
	FiredAt             time.Time
	ResolvedAt          sql.NullTime
	NotifiedAt          sql.NullTime
	NotificationRaw     []byte
	CreatedAt           time.Time
}

type auditRow struct {
	ID           string
	TenantID     string
	UserID       string
	Action       string
	ResourceType string
	ResourceID   string
	DetailsRaw   []byte
	IPAddress    string
	UserAgent    string
	CreatedAt    time.Time
}

func main() {
	log.SetFlags(log.LstdFlags | log.Lmicroseconds)

	cfg := loadConfig()
	ctx := context.Background()

	db, err := openDatabaseFromEnv()
	if err != nil {
		log.Fatalf("open postgres failed: %v", err)
	}
	defer db.Close()

	targetConfigs := map[string]esTargetConfig{
		"alerts": alertsTargetConfigFromEnv(),
		"audit":  auditTargetConfigFromEnv(),
	}

	var summaries []backfillStats
	for _, target := range cfg.targets {
		targetCfg, ok := targetConfigs[target]
		if !ok {
			log.Fatalf("unsupported target: %s", target)
		}
		indexer, err := newBulkIndexer(targetCfg)
		if err != nil {
			log.Fatalf("configure %s indexer failed: %v", target, err)
		}
		var stats backfillStats
		switch target {
		case "alerts":
			stats, err = backfillAlerts(ctx, db, indexer, cfg.batchSize)
		case "audit":
			stats, err = backfillAudit(ctx, db, indexer, cfg.batchSize)
		default:
			log.Fatalf("unsupported target: %s", target)
		}
		if err != nil {
			log.Fatalf("backfill %s failed: %v", target, err)
		}
		if cfg.refresh {
			if err := indexer.Refresh(ctx); err != nil {
				log.Fatalf("refresh %s failed: %v", target, err)
			}
		}
		summaries = append(summaries, stats)
	}

	for _, summary := range summaries {
		log.Printf(
			"backfill completed: target=%s read=%d indexed=%d failed=%d batches=%d",
			summary.Target,
			summary.Read,
			summary.Indexed,
			summary.Failed,
			summary.Batches,
		)
	}
}

func loadConfig() config {
	var cfg config
	defaultTargets := firstNonEmpty(os.Getenv("ES_BACKFILL_TARGETS"), "alerts,audit")
	defaultBatch := defaultBatchSize
	if raw := strings.TrimSpace(os.Getenv("ES_BACKFILL_BATCH_SIZE")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			defaultBatch = parsed
		}
	}
	defaultRefresh := parseBoolEnv("ES_BACKFILL_REFRESH", true)

	var targets string
	flag.StringVar(&targets, "targets", defaultTargets, "comma-separated targets: alerts,audit")
	flag.IntVar(&cfg.batchSize, "batch-size", defaultBatch, "documents per batch")
	flag.BoolVar(&cfg.refresh, "refresh", defaultRefresh, "refresh target index after backfill")
	flag.Parse()

	cfg.targets = normalizeTargets(targets)
	if len(cfg.targets) == 0 {
		log.Fatalf("no backfill targets configured")
	}
	if cfg.batchSize <= 0 {
		log.Fatalf("invalid batch size: %d", cfg.batchSize)
	}
	return cfg
}

func normalizeTargets(raw string) []string {
	parts := strings.Split(raw, ",")
	seen := make(map[string]struct{}, len(parts))
	targets := make([]string, 0, len(parts))
	for _, part := range parts {
		target := strings.ToLower(strings.TrimSpace(part))
		if target == "" {
			continue
		}
		if _, exists := seen[target]; exists {
			continue
		}
		seen[target] = struct{}{}
		targets = append(targets, target)
	}
	return targets
}

func parseBoolEnv(key string, fallback bool) bool {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(raw)
	if err != nil {
		return fallback
	}
	return parsed
}

func alertsTargetConfigFromEnv() esTargetConfig {
	return esTargetConfig{
		name: "alerts",
		endpoint: firstNonEmpty(
			os.Getenv("ALERT_EVENTS_ES_ENDPOINT"),
			os.Getenv("SEARCH_ELASTICSEARCH_ADDRESSES"),
			os.Getenv("DATABASE_ELASTICSEARCH_ADDRESSES"),
			os.Getenv("INGEST_ES_ENDPOINT"),
			os.Getenv("ELASTICSEARCH_URL"),
			defaultESBaseURL,
		),
		indexName: firstNonEmpty(os.Getenv("ALERT_EVENTS_ES_INDEX"), defaultAlertsIndex),
		username: firstNonEmpty(
			os.Getenv("ALERT_EVENTS_ES_USERNAME"),
			os.Getenv("ALERT_EVALUATOR_ES_USERNAME"),
			os.Getenv("DATABASE_ELASTICSEARCH_USERNAME"),
			os.Getenv("ELASTICSEARCH_USERNAME"),
		),
		password: firstNonEmpty(
			os.Getenv("ALERT_EVENTS_ES_PASSWORD"),
			os.Getenv("ALERT_EVALUATOR_ES_PASSWORD"),
			os.Getenv("DATABASE_ELASTICSEARCH_PASSWORD"),
			os.Getenv("ELASTICSEARCH_PASSWORD"),
		),
	}
}

func auditTargetConfigFromEnv() esTargetConfig {
	return esTargetConfig{
		name: "audit",
		endpoint: firstNonEmpty(
			os.Getenv("AUDIT_ES_ENDPOINT"),
			os.Getenv("SEARCH_ELASTICSEARCH_ADDRESSES"),
			os.Getenv("DATABASE_ELASTICSEARCH_ADDRESSES"),
			os.Getenv("INGEST_ES_ENDPOINT"),
			os.Getenv("ELASTICSEARCH_URL"),
			defaultESBaseURL,
		),
		indexName: firstNonEmpty(os.Getenv("AUDIT_ES_INDEX"), defaultAuditIndex),
		username: firstNonEmpty(
			os.Getenv("AUDIT_ES_USERNAME"),
			os.Getenv("DATABASE_ELASTICSEARCH_USERNAME"),
			os.Getenv("ELASTICSEARCH_USERNAME"),
		),
		password: firstNonEmpty(
			os.Getenv("AUDIT_ES_PASSWORD"),
			os.Getenv("DATABASE_ELASTICSEARCH_PASSWORD"),
			os.Getenv("ELASTICSEARCH_PASSWORD"),
		),
	}
}

func newBulkIndexer(cfg esTargetConfig) (*bulkIndexer, error) {
	endpoint, err := httpguard.NormalizeBaseURL(cfg.endpoint, httpguard.BaseURLOptions{
		AllowPrivate:  true,
		AllowLoopback: true,
	})
	if err != nil {
		return nil, fmt.Errorf("normalize endpoint: %w", err)
	}
	if endpoint == "" {
		return nil, fmt.Errorf("empty endpoint")
	}
	if strings.TrimSpace(cfg.indexName) == "" {
		return nil, fmt.Errorf("empty index name")
	}
	return &bulkIndexer{
		endpoint:  endpoint,
		indexName: strings.TrimSpace(cfg.indexName),
		username:  strings.TrimSpace(cfg.username),
		password:  strings.TrimSpace(cfg.password),
		client:    &http.Client{Timeout: 30 * time.Second},
	}, nil
}

func (b *bulkIndexer) BulkIndex(ctx context.Context, docs []bulkDocument) (int, int, error) {
	if len(docs) == 0 {
		return 0, 0, nil
	}
	var payload bytes.Buffer
	for _, item := range docs {
		action, err := json.Marshal(map[string]any{
			"index": map[string]any{
				"_index": b.indexName,
				"_id":    item.id,
			},
		})
		if err != nil {
			return 0, len(docs), fmt.Errorf("marshal bulk action for %s: %w", item.id, err)
		}
		docRaw, err := json.Marshal(item.doc)
		if err != nil {
			return 0, len(docs), fmt.Errorf("marshal bulk doc for %s: %w", item.id, err)
		}
		payload.Write(action)
		payload.WriteByte('\n')
		payload.Write(docRaw)
		payload.WriteByte('\n')
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, b.endpoint+"/_bulk", &payload)
	if err != nil {
		return 0, len(docs), fmt.Errorf("build bulk request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-ndjson")
	if b.username != "" {
		req.SetBasicAuth(b.username, b.password)
	}

	resp, err := b.client.Do(req)
	if err != nil {
		return 0, len(docs), fmt.Errorf("execute bulk request: %w", err)
	}
	defer resp.Body.Close()

	raw, err := httpguard.ReadLimitedBody(resp.Body, 0)
	if err != nil {
		return 0, len(docs), fmt.Errorf("read bulk response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return 0, len(docs), fmt.Errorf("bulk request failed: status=%d body=%s", resp.StatusCode, string(raw))
	}

	bulkResp := esBulkResponse{}
	if err := json.Unmarshal(raw, &bulkResp); err != nil {
		return 0, len(docs), fmt.Errorf("decode bulk response: %w", err)
	}

	indexed := 0
	failed := 0
	for _, itemRaw := range bulkResp.Items {
		for action, item := range itemRaw {
			if item.Status >= 200 && item.Status < 300 {
				indexed++
				continue
			}
			failed++
			return indexed, failed, fmt.Errorf(
				"bulk item failed: action=%s index=%s id=%s status=%d error_type=%s reason=%s",
				action,
				firstNonEmpty(item.Index, b.indexName),
				item.ID,
				item.Status,
				firstBulkErrorType(item.Error),
				firstBulkErrorReason(item.Error),
			)
		}
	}
	if bulkResp.Errors {
		return indexed, failed, fmt.Errorf("bulk response contains errors without item details")
	}
	return indexed, failed, nil
}

func (b *bulkIndexer) Refresh(ctx context.Context) error {
	requestURL := fmt.Sprintf("%s/%s/_refresh", b.endpoint, url.PathEscape(b.indexName))
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, requestURL, nil)
	if err != nil {
		return fmt.Errorf("build refresh request: %w", err)
	}
	if b.username != "" {
		req.SetBasicAuth(b.username, b.password)
	}
	resp, err := b.client.Do(req)
	if err != nil {
		return fmt.Errorf("execute refresh request: %w", err)
	}
	defer resp.Body.Close()
	raw, err := httpguard.ReadLimitedBody(resp.Body, 0)
	if err != nil {
		return fmt.Errorf("read refresh response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("refresh request failed: status=%d body=%s", resp.StatusCode, string(raw))
	}
	return nil
}

func backfillAlerts(ctx context.Context, db *sql.DB, indexer *bulkIndexer, batchSize int) (backfillStats, error) {
	stats := backfillStats{Target: "alerts"}
	var lastCreatedAt any
	var lastID any

	for {
		rows, err := db.QueryContext(ctx, `
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
    COALESCE(notification_result, '{}'::jsonb),
    created_at
FROM alert_events
WHERE (
    $1::timestamptz IS NULL
    OR created_at > $1::timestamptz
    OR (created_at = $1::timestamptz AND id > $2::uuid)
)
ORDER BY created_at ASC, id ASC
LIMIT $3
`, lastCreatedAt, lastID, batchSize)
		if err != nil {
			return stats, fmt.Errorf("query alert_events: %w", err)
		}

		docs := make([]bulkDocument, 0, batchSize)
		for rows.Next() {
			var row alertRow
			if err := rows.Scan(
				&row.ID,
				&row.TenantID,
				&row.RuleID,
				&row.ResourceThresholdID,
				&row.Severity,
				&row.Status,
				&row.Title,
				&row.Detail,
				&row.AgentID,
				&row.SourceID,
				&row.FiredAt,
				&row.ResolvedAt,
				&row.NotifiedAt,
				&row.NotificationRaw,
				&row.CreatedAt,
			); err != nil {
				rows.Close()
				return stats, fmt.Errorf("scan alert_event row: %w", err)
			}
			docs = append(docs, bulkDocument{id: row.ID, doc: buildAlertDocument(row)})
			stats.Read++
			lastCreatedAt = row.CreatedAt
			lastID = row.ID
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return stats, fmt.Errorf("iterate alert_events: %w", err)
		}
		rows.Close()
		if len(docs) == 0 {
			break
		}
		indexed, failed, err := indexer.BulkIndex(ctx, docs)
		stats.Indexed += indexed
		stats.Failed += failed
		stats.Batches++
		if err != nil {
			return stats, fmt.Errorf("bulk index alert_events batch %d: %w", stats.Batches, err)
		}
		log.Printf("backfill progress: target=alerts batch=%d indexed=%d total_read=%d", stats.Batches, indexed, stats.Read)
	}

	return stats, nil
}

func backfillAudit(ctx context.Context, db *sql.DB, indexer *bulkIndexer, batchSize int) (backfillStats, error) {
	stats := backfillStats{Target: "audit"}
	var lastCreatedAt any
	var lastID any

	for {
		rows, err := db.QueryContext(ctx, `
SELECT
    id::text,
    COALESCE(tenant_id::text, ''),
    COALESCE(user_id::text, ''),
    COALESCE(action, ''),
    COALESCE(resource_type, ''),
    COALESCE(resource_id, ''),
    COALESCE(details, '{}'::jsonb),
    COALESCE(ip_address::text, ''),
    COALESCE(user_agent, ''),
    created_at
FROM audit_logs
WHERE (
    $1::timestamptz IS NULL
    OR created_at > $1::timestamptz
    OR (created_at = $1::timestamptz AND id > $2::uuid)
)
ORDER BY created_at ASC, id ASC
LIMIT $3
`, lastCreatedAt, lastID, batchSize)
		if err != nil {
			return stats, fmt.Errorf("query audit_logs: %w", err)
		}

		docs := make([]bulkDocument, 0, batchSize)
		for rows.Next() {
			var row auditRow
			if err := rows.Scan(
				&row.ID,
				&row.TenantID,
				&row.UserID,
				&row.Action,
				&row.ResourceType,
				&row.ResourceID,
				&row.DetailsRaw,
				&row.IPAddress,
				&row.UserAgent,
				&row.CreatedAt,
			); err != nil {
				rows.Close()
				return stats, fmt.Errorf("scan audit_logs row: %w", err)
			}
			docs = append(docs, bulkDocument{id: row.ID, doc: buildAuditDocument(row)})
			stats.Read++
			lastCreatedAt = row.CreatedAt
			lastID = row.ID
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return stats, fmt.Errorf("iterate audit_logs: %w", err)
		}
		rows.Close()
		if len(docs) == 0 {
			break
		}
		indexed, failed, err := indexer.BulkIndex(ctx, docs)
		stats.Indexed += indexed
		stats.Failed += failed
		stats.Batches++
		if err != nil {
			return stats, fmt.Errorf("bulk index audit_logs batch %d: %w", stats.Batches, err)
		}
		log.Printf("backfill progress: target=audit batch=%d indexed=%d total_read=%d", stats.Batches, indexed, stats.Read)
	}

	return stats, nil
}

func buildAlertDocument(row alertRow) map[string]any {
	doc := map[string]any{
		"@timestamp":            row.FiredAt.UTC().Format(time.RFC3339Nano),
		"id":                    row.ID,
		"alert_id":              row.ID,
		"tenant_id":             row.TenantID,
		"rule_id":               row.RuleID,
		"resource_threshold_id": row.ResourceThresholdID,
		"severity":              row.Severity,
		"status":                row.Status,
		"title":                 row.Title,
		"detail":                row.Detail,
		"agent_id":              row.AgentID,
		"source_id":             row.SourceID,
		"fired_at":              row.FiredAt.UTC().Format(time.RFC3339Nano),
		"count":                 1,
		"notification_result":   decodeJSONObject(row.NotificationRaw),
	}
	if row.ResolvedAt.Valid {
		doc["resolved_at"] = row.ResolvedAt.Time.UTC().Format(time.RFC3339Nano)
	}
	if row.NotifiedAt.Valid {
		doc["notified_at"] = row.NotifiedAt.Time.UTC().Format(time.RFC3339Nano)
	}
	return doc
}

func buildAuditDocument(row auditRow) map[string]any {
	return map[string]any{
		"@timestamp":    row.CreatedAt.UTC().Format(time.RFC3339Nano),
		"created_at":    row.CreatedAt.UTC().Format(time.RFC3339Nano),
		"id":            row.ID,
		"audit_id":      row.ID,
		"tenant_id":     row.TenantID,
		"user_id":       row.UserID,
		"action":        row.Action,
		"resource_type": row.ResourceType,
		"resource_id":   row.ResourceID,
		"details":       decodeJSONObject(row.DetailsRaw),
		"ip_address":    row.IPAddress,
		"user_agent":    row.UserAgent,
	}
}

func decodeJSONObject(raw []byte) map[string]any {
	if len(bytes.TrimSpace(raw)) == 0 {
		return map[string]any{}
	}
	decoded := make(map[string]any)
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return map[string]any{
			"_raw": string(raw),
		}
	}
	return decoded
}

func openDatabaseFromEnv() (*sql.DB, error) {
	if dsn := firstNonEmpty(os.Getenv("DB_DSN"), os.Getenv("DATABASE_URL")); dsn != "" {
		return openAndPing(strings.TrimSpace(dsn))
	}

	host := firstNonEmpty(os.Getenv("DATABASE_POSTGRESQL_HOST"), "localhost")
	port := firstNonEmpty(os.Getenv("DATABASE_POSTGRESQL_PORT"), defaultPostgresPort)
	dbname := firstNonEmpty(os.Getenv("DATABASE_POSTGRESQL_DBNAME"), defaultPostgresDBName)
	user := firstNonEmpty(os.Getenv("DATABASE_POSTGRESQL_USER"), defaultPostgresUser)
	password := firstNonEmpty(os.Getenv("DATABASE_POSTGRESQL_PASSWORD"), defaultPostgresPass)
	sslmode := firstNonEmpty(os.Getenv("DATABASE_POSTGRESQL_SSLMODE"), defaultPostgresSSL)

	dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s", user, password, host, port, dbname, sslmode)
	return openAndPing(dsn)
}

func openAndPing(dsn string) (*sql.DB, error) {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, err
	}
	return db, nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func firstBulkErrorType(err *esBulkItemError) string {
	if err == nil {
		return ""
	}
	if trimmed := strings.TrimSpace(err.Type); trimmed != "" {
		return trimmed
	}
	return firstBulkErrorType(err.CausedBy)
}

func firstBulkErrorReason(err *esBulkItemError) string {
	if err == nil {
		return ""
	}
	reason := strings.TrimSpace(err.Reason)
	child := strings.TrimSpace(firstBulkErrorReason(err.CausedBy))
	if reason == "" {
		return child
	}
	if child == "" {
		return reason
	}
	return reason + ": " + child
}
