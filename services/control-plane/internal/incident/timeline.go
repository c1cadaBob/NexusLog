package incident

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"
)

// TimelineEntry represents a single timeline event.
type TimelineEntry struct {
	ID         string     `json:"id"`
	IncidentID string     `json:"incident_id"`
	Action     string     `json:"action"`
	ActorID    *string    `json:"actor_id,omitempty"`
	Detail     string     `json:"detail"`
	CreatedAt  time.Time  `json:"created_at"`
}

// TimelineStore defines the interface for incident timeline persistence.
type TimelineStore interface {
	AddTimelineEntry(ctx context.Context, incidentID, action string, actorID *string, detail string) error
	GetTimeline(ctx context.Context, incidentID string) ([]TimelineEntry, error)
}

// TimelineStorePG implements TimelineStore using PostgreSQL.
type TimelineStorePG struct {
	db *sql.DB
}

// NewTimelineStorePG creates a new PostgreSQL-backed timeline store.
func NewTimelineStorePG(db *sql.DB) *TimelineStorePG {
	return &TimelineStorePG{db: db}
}

// AddTimelineEntry inserts a timeline entry.
func (t *TimelineStorePG) AddTimelineEntry(ctx context.Context, incidentID, action string, actorID *string, detail string) error {
	incidentID = strings.TrimSpace(incidentID)
	action = strings.TrimSpace(action)
	if incidentID == "" || action == "" {
		return fmt.Errorf("incident_id and action are required")
	}

	query := `
INSERT INTO incident_timeline (incident_id, action, actor_id, detail, created_at)
VALUES ($1::uuid, $2, NULLIF(TRIM($3), '')::uuid, NULLIF(TRIM($4), ''), NOW())
`
	var actor interface{}
	if actorID != nil && *actorID != "" {
		actor = *actorID
	} else {
		actor = nil
	}
	_, err := t.db.ExecContext(ctx, query, incidentID, action, actor, detail)
	if err != nil {
		return fmt.Errorf("add timeline entry: %w", err)
	}
	return nil
}

// GetTimeline returns all timeline entries for an incident, ordered by created_at.
func (t *TimelineStorePG) GetTimeline(ctx context.Context, incidentID string) ([]TimelineEntry, error) {
	incidentID = strings.TrimSpace(incidentID)
	if incidentID == "" {
		return nil, fmt.Errorf("incident_id is required")
	}

	query := `
SELECT id::text, incident_id::text, action, actor_id::text, COALESCE(detail, ''), created_at
FROM incident_timeline
WHERE incident_id = $1::uuid
ORDER BY created_at ASC
`
	rows, err := t.db.QueryContext(ctx, query, incidentID)
	if err != nil {
		return nil, fmt.Errorf("get timeline: %w", err)
	}
	defer rows.Close()

	var entries []TimelineEntry
	for rows.Next() {
		var e TimelineEntry
		var actorID sql.NullString
		if err := rows.Scan(&e.ID, &e.IncidentID, &e.Action, &actorID, &e.Detail, &e.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan timeline entry: %w", err)
		}
		if actorID.Valid {
			e.ActorID = &actorID.String
		}
		e.CreatedAt = e.CreatedAt.UTC()
		entries = append(entries, e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate timeline: %w", err)
	}
	return entries, nil
}

// Ensure TimelineStorePG implements TimelineStore.
var _ TimelineStore = (*TimelineStorePG)(nil)
