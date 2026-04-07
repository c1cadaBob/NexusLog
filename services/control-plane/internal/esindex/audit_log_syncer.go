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

const defaultAuditIndex = "nexuslog-audit"

type AuditLogSyncer struct {
	db          *sql.DB
	endpoint    string
	endpointErr error
	indexName   string
	username    string
	password    string
	client      *http.Client
}

func NewAuditLogSyncerFromEnv(db *sql.DB) *AuditLogSyncer {
	endpoint := resolveFirstAddress(
		os.Getenv("AUDIT_ES_ENDPOINT"),
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
	return &AuditLogSyncer{
		db:          db,
		endpoint:    normalizedEndpoint,
		endpointErr: endpointErr,
		indexName: strings.TrimSpace(firstNonEmpty(
			os.Getenv("AUDIT_ES_INDEX"),
			defaultAuditIndex,
		)),
		username: strings.TrimSpace(firstNonEmpty(
			os.Getenv("AUDIT_ES_USERNAME"),
			os.Getenv("DATABASE_ELASTICSEARCH_USERNAME"),
			os.Getenv("ELASTICSEARCH_USERNAME"),
		)),
		password: strings.TrimSpace(firstNonEmpty(
			os.Getenv("AUDIT_ES_PASSWORD"),
			os.Getenv("DATABASE_ELASTICSEARCH_PASSWORD"),
			os.Getenv("ELASTICSEARCH_PASSWORD"),
		)),
		client: &http.Client{Timeout: 5 * time.Second},
	}
}

func (s *AuditLogSyncer) Enabled() bool {
	return s != nil && s.db != nil && s.client != nil && s.endpointErr == nil && s.endpoint != "" && s.indexName != ""
}

func (s *AuditLogSyncer) SyncByID(ctx context.Context, auditLogID string) error {
	if !s.Enabled() {
		return nil
	}
	auditLogID = strings.TrimSpace(auditLogID)
	if auditLogID == "" {
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

	doc, err := s.loadDocument(ctx, auditLogID)
	if err != nil {
		return err
	}
	body, err := json.Marshal(doc)
	if err != nil {
		return fmt.Errorf("marshal audit log document: %w", err)
	}

	requestURL := fmt.Sprintf("%s/%s/_doc/%s", s.endpoint, url.PathEscape(s.indexName), url.PathEscape(auditLogID))
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, requestURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build audit log index request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if s.username != "" {
		req.SetBasicAuth(s.username, s.password)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("index audit log: %w", err)
	}
	defer resp.Body.Close()
	raw, err := httpguard.ReadLimitedBody(resp.Body, 0)
	if err != nil {
		return fmt.Errorf("read audit log index response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("index audit log failed: status=%d body=%s", resp.StatusCode, string(raw))
	}
	return nil
}

func (s *AuditLogSyncer) loadDocument(ctx context.Context, auditLogID string) (map[string]any, error) {
	query := `
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
WHERE id = $1::uuid
`
	var (
		id           string
		tenantID     string
		userID       string
		action       string
		resourceType string
		resourceID   string
		detailsRaw   []byte
		ipAddress    string
		userAgent    string
		createdAt    time.Time
	)
	if err := s.db.QueryRowContext(ctx, query, auditLogID).Scan(
		&id,
		&tenantID,
		&userID,
		&action,
		&resourceType,
		&resourceID,
		&detailsRaw,
		&ipAddress,
		&userAgent,
		&createdAt,
	); err != nil {
		return nil, fmt.Errorf("load audit log %s: %w", auditLogID, err)
	}

	details := map[string]any{}
	if len(detailsRaw) > 0 {
		_ = json.Unmarshal(detailsRaw, &details)
	}
	return map[string]any{
		"@timestamp":    createdAt.UTC().Format(time.RFC3339Nano),
		"created_at":    createdAt.UTC().Format(time.RFC3339Nano),
		"id":            id,
		"audit_id":      id,
		"tenant_id":     tenantID,
		"user_id":       userID,
		"action":        action,
		"resource_type": resourceType,
		"resource_id":   resourceID,
		"details":       details,
		"ip_address":    ipAddress,
		"user_agent":    userAgent,
	}, nil
}
