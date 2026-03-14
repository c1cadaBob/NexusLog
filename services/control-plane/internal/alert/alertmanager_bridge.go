package alert

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/nexuslog/control-plane/internal/httpguard"
)

type alertmanagerEvent struct {
	ID         string
	TenantID   string
	RuleID     string
	Severity   string
	Title      string
	Detail     string
	SourceID   string
	Status     string
	FiredAt    time.Time
	ResolvedAt *time.Time
}

type alertmanagerPayload struct {
	Labels       map[string]string `json:"labels"`
	Annotations  map[string]string `json:"annotations,omitempty"`
	StartsAt     time.Time         `json:"startsAt"`
	EndsAt       *time.Time        `json:"endsAt,omitempty"`
	GeneratorURL string            `json:"generatorURL,omitempty"`
}

type AlertmanagerBridge struct {
	db           *sql.DB
	endpoint     string
	generatorURL string
	interval     time.Duration
	batchSize    int
	client       *http.Client
}

func NewAlertmanagerBridge(db *sql.DB, endpoint, generatorURL string) *AlertmanagerBridge {
	return &AlertmanagerBridge{
		db:           db,
		endpoint:     strings.TrimRight(strings.TrimSpace(endpoint), "/"),
		generatorURL: strings.TrimSpace(generatorURL),
		interval:     10 * time.Second,
		batchSize:    50,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (b *AlertmanagerBridge) WithInterval(interval time.Duration) *AlertmanagerBridge {
	if interval > 0 {
		b.interval = interval
	}
	return b
}

func (b *AlertmanagerBridge) WithBatchSize(batchSize int) *AlertmanagerBridge {
	if batchSize > 0 {
		b.batchSize = batchSize
	}
	return b
}

func (b *AlertmanagerBridge) Run(ctx context.Context) {
	if b == nil || b.db == nil || b.endpoint == "" {
		return
	}

	b.syncOnce(ctx)

	ticker := time.NewTicker(b.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			b.syncOnce(ctx)
		}
	}
}

func (b *AlertmanagerBridge) syncOnce(ctx context.Context) {
	events, err := b.listPendingEvents(ctx)
	if err != nil {
		log.Printf("alertmanager bridge: list pending events failed: %v", err)
		return
	}

	for _, event := range events {
		if err := b.pushEvent(ctx, event); err != nil {
			log.Printf("alertmanager bridge: push event %s failed: %v", event.ID, err)
		}
	}
}

func (b *AlertmanagerBridge) listPendingEvents(ctx context.Context) ([]alertmanagerEvent, error) {
	query := `
SELECT
    id::text,
    COALESCE(tenant_id::text, ''),
    COALESCE(rule_id::text, ''),
    COALESCE(severity, ''),
    COALESCE(title, ''),
    COALESCE(detail, ''),
    COALESCE(source_id, ''),
    COALESCE(status, 'firing'),
    fired_at,
    resolved_at
FROM alert_events
WHERE notified_at IS NULL
   OR (
        status = 'resolved'
        AND resolved_at IS NOT NULL
        AND COALESCE(notification_result->>'alertmanager_last_status', '') <> 'resolved'
   )
ORDER BY fired_at ASC
LIMIT $1
`

	rows, err := b.db.QueryContext(ctx, query, b.batchSize)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	events := make([]alertmanagerEvent, 0, b.batchSize)
	for rows.Next() {
		var event alertmanagerEvent
		var resolvedAt sql.NullTime
		if err := rows.Scan(
			&event.ID,
			&event.TenantID,
			&event.RuleID,
			&event.Severity,
			&event.Title,
			&event.Detail,
			&event.SourceID,
			&event.Status,
			&event.FiredAt,
			&resolvedAt,
		); err != nil {
			return nil, err
		}
		event.FiredAt = event.FiredAt.UTC()
		if resolvedAt.Valid {
			resolved := resolvedAt.Time.UTC()
			event.ResolvedAt = &resolved
		}
		events = append(events, event)
	}
	return events, rows.Err()
}

func (b *AlertmanagerBridge) pushEvent(ctx context.Context, event alertmanagerEvent) error {
	payload := alertmanagerPayload{
		Labels: map[string]string{
			"alertname":      safeAlertLabel(event.Title, event.ID),
			"severity":       strings.ToLower(strings.TrimSpace(event.Severity)),
			"tenant_id":      strings.TrimSpace(event.TenantID),
			"rule_id":        strings.TrimSpace(event.RuleID),
			"source_id":      strings.TrimSpace(event.SourceID),
			"alert_event_id": strings.TrimSpace(event.ID),
			"service":        "nexuslog",
		},
		Annotations: map[string]string{
			"summary":     strings.TrimSpace(event.Title),
			"description": strings.TrimSpace(event.Detail),
		},
		StartsAt:     event.FiredAt,
		GeneratorURL: b.generatorURL,
	}
	if strings.EqualFold(strings.TrimSpace(event.Status), "resolved") {
		resolvedAt := event.FiredAt
		if event.ResolvedAt != nil {
			resolvedAt = *event.ResolvedAt
		}
		payload.EndsAt = &resolvedAt
	}

	body, err := json.Marshal([]alertmanagerPayload{payload})
	if err != nil {
		return err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, b.endpoint+"/api/v2/alerts", bytes.NewReader(body))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")

	response, err := b.client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	responseBody, err := httpguard.ReadLimitedBody(response.Body, 0)
	if err != nil {
		return err
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("status=%d body=%s", response.StatusCode, strings.TrimSpace(string(responseBody)))
	}

	status := "firing"
	if payload.EndsAt != nil {
		status = "resolved"
	}
	return b.markSynced(ctx, event.ID, status)
}

func (b *AlertmanagerBridge) markSynced(ctx context.Context, eventID, status string) error {
	meta, err := json.Marshal(map[string]any{
		"bridge":                    "alertmanager",
		"alertmanager_last_status":  status,
		"alertmanager_last_sync_at": time.Now().UTC().Format(time.RFC3339),
		"alertmanager_endpoint":     b.endpoint,
	})
	if err != nil {
		return err
	}

	_, err = b.db.ExecContext(ctx, `
UPDATE alert_events
SET notified_at = NOW(),
    notification_result = COALESCE(notification_result, '{}'::jsonb) || $2::jsonb
WHERE id = $1::uuid
`, eventID, string(meta))
	return err
}

func safeAlertLabel(title, fallback string) string {
	title = strings.TrimSpace(title)
	if title != "" {
		return title
	}
	fallback = strings.TrimSpace(fallback)
	if fallback != "" {
		return fallback
	}
	return "nexuslog-alert"
}
