package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const defaultAuditIndex = "nexuslog-audit"

type auditIndexDocument struct {
	ID           string
	TenantID     string
	UserID       string
	Action       string
	ResourceType string
	ResourceID   string
	Details      map[string]any
	IPAddress    string
	UserAgent    string
	CreatedAt    time.Time
}

type auditIndexer struct {
	endpoint    string
	endpointErr error
	indexName   string
	username    string
	password    string
	client      *http.Client
}

func newAuditIndexerFromEnv() *auditIndexer {
	endpoint, endpointErr := normalizeBaseURL(resolveFirstAddress(
		os.Getenv("AUDIT_ES_ENDPOINT"),
		os.Getenv("SEARCH_ELASTICSEARCH_ADDRESSES"),
		os.Getenv("DATABASE_ELASTICSEARCH_ADDRESSES"),
		os.Getenv("ELASTICSEARCH_URL"),
	))
	return &auditIndexer{
		endpoint:    endpoint,
		endpointErr: endpointErr,
		indexName:   strings.TrimSpace(firstNonEmpty(os.Getenv("AUDIT_ES_INDEX"), defaultAuditIndex)),
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

func (i *auditIndexer) Enabled() bool {
	return i != nil && i.client != nil && i.endpointErr == nil && i.endpoint != "" && i.indexName != ""
}

func (i *auditIndexer) Index(ctx context.Context, doc auditIndexDocument) error {
	if !i.Enabled() {
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
	payload := map[string]any{
		"@timestamp":    doc.CreatedAt.UTC().Format(time.RFC3339Nano),
		"created_at":    doc.CreatedAt.UTC().Format(time.RFC3339Nano),
		"id":            doc.ID,
		"audit_id":      doc.ID,
		"tenant_id":     doc.TenantID,
		"user_id":       doc.UserID,
		"action":        doc.Action,
		"resource_type": doc.ResourceType,
		"resource_id":   doc.ResourceID,
		"details":       cloneMap(doc.Details),
		"ip_address":    doc.IPAddress,
		"user_agent":    doc.UserAgent,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal audit document: %w", err)
	}

	requestURL := fmt.Sprintf("%s/%s/_doc/%s", i.endpoint, url.PathEscape(i.indexName), url.PathEscape(strings.TrimSpace(doc.ID)))
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, requestURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build audit index request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if i.username != "" {
		req.SetBasicAuth(i.username, i.password)
	}
	resp, err := i.client.Do(req)
	if err != nil {
		return fmt.Errorf("index audit log: %w", err)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return fmt.Errorf("read audit index response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("index audit log failed: status=%d body=%s", resp.StatusCode, string(raw))
	}
	return nil
}

func cloneMap(value map[string]any) map[string]any {
	if len(value) == 0 {
		return map[string]any{}
	}
	cloned := make(map[string]any, len(value))
	for key, item := range value {
		cloned[key] = item
	}
	return cloned
}

func normalizeBaseURL(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", nil
	}
	parsed, err := url.Parse(trimmed)
	if err != nil {
		return "", err
	}
	if parsed.Scheme == "" || parsed.Host == "" {
		return "", fmt.Errorf("invalid base url: %s", raw)
	}
	return strings.TrimRight(parsed.String(), "/"), nil
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
