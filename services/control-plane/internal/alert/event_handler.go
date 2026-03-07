package alert

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type AlertEvent struct {
	ID         string     `json:"id"`
	RuleID     string     `json:"rule_id,omitempty"`
	Severity   string     `json:"severity"`
	Status     string     `json:"status"`
	Title      string     `json:"title"`
	Detail     string     `json:"detail,omitempty"`
	SourceID   string     `json:"source_id,omitempty"`
	FiredAt    time.Time  `json:"fired_at"`
	ResolvedAt *time.Time `json:"resolved_at,omitempty"`
	Count      int        `json:"count"`
}

type EventHandler struct {
	db *sql.DB
}

func NewEventHandler(db *sql.DB) *EventHandler {
	return &EventHandler{db: db}
}

func RegisterAlertEventRoutes(router gin.IRouter, handler *EventHandler) {
	if handler == nil || handler.db == nil {
		return
	}
	g := router.Group("/api/v1/alert/events")
	{
		g.GET("", handler.ListEvents)
	}
}

func (h *EventHandler) ListEvents(c *gin.Context) {
	tenantID := getTenantID(c)
	if tenantID == "" {
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "X-Tenant-ID header is required", nil)
		return
	}

	page, err := parsePositiveInt(c.Query("page"), 1)
	if err != nil {
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "page must be a positive integer", nil)
		return
	}
	pageSize, err := parsePositiveInt(c.Query("page_size"), 20)
	if err != nil {
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "page_size must be a positive integer", nil)
		return
	}
	if pageSize > 200 {
		pageSize = 200
	}

	status := strings.ToLower(strings.TrimSpace(c.Query("status")))
	if status != "" {
		switch status {
		case "firing", "acknowledged", "resolved", "silenced":
		default:
			writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "status must be one of firing|acknowledged|resolved|silenced", nil)
			return
		}
	}

	var total int
	countQuery := `
SELECT COUNT(1)
FROM alert_events
WHERE tenant_id = $1::uuid
  AND ($2 = '' OR status = $2)
`
	if err := h.db.QueryRowContext(c.Request.Context(), countQuery, tenantID, status).Scan(&total); err != nil {
		writeError(c, http.StatusInternalServerError, ErrorCodeInternalError, "failed to list alert events", nil)
		return
	}

	query := `
SELECT
    id::text,
    COALESCE(rule_id::text, ''),
    severity,
    status,
    title,
    COALESCE(detail, ''),
    COALESCE(source_id, ''),
    fired_at,
    resolved_at
FROM alert_events
WHERE tenant_id = $1::uuid
  AND ($2 = '' OR status = $2)
ORDER BY fired_at DESC
OFFSET $3
LIMIT $4
`
	offset := (page - 1) * pageSize
	rows, err := h.db.QueryContext(c.Request.Context(), query, tenantID, status, offset, pageSize)
	if err != nil {
		writeError(c, http.StatusInternalServerError, ErrorCodeInternalError, "failed to list alert events", nil)
		return
	}
	defer rows.Close()

	items := make([]AlertEvent, 0, pageSize)
	for rows.Next() {
		var item AlertEvent
		var resolvedAt sql.NullTime
		if err := rows.Scan(
			&item.ID,
			&item.RuleID,
			&item.Severity,
			&item.Status,
			&item.Title,
			&item.Detail,
			&item.SourceID,
			&item.FiredAt,
			&resolvedAt,
		); err != nil {
			writeError(c, http.StatusInternalServerError, ErrorCodeInternalError, "failed to decode alert events", nil)
			return
		}
		item.Count = 1
		item.FiredAt = item.FiredAt.UTC()
		if resolvedAt.Valid {
			t := resolvedAt.Time.UTC()
			item.ResolvedAt = &t
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		writeError(c, http.StatusInternalServerError, ErrorCodeInternalError, "failed to iterate alert events", nil)
		return
	}

	writeSuccess(c, http.StatusOK, gin.H{"items": items}, buildPaginationMeta(page, pageSize, total))
}
