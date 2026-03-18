package alert

import (
	"database/sql"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	cpMiddleware "github.com/nexuslog/control-plane/internal/middleware"
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

type alertEventActionRequest struct {
	Reason          string `json:"reason"`
	DurationSeconds int    `json:"duration_seconds"`
}

type alertEventMutationTarget struct {
	ID         string
	RuleID     string
	Severity   string
	Status     string
	Title      string
	Detail     string
	SourceID   string
	FiredAt    time.Time
	ResolvedAt *time.Time
}

type EventHandler struct {
	db         *sql.DB
	silenceSvc *SilenceService
}

func NewEventHandler(db *sql.DB) *EventHandler {
	return &EventHandler{db: db, silenceSvc: NewSilenceService(db)}
}

func RegisterAlertEventRoutes(router gin.IRouter, handler *EventHandler) {
	if handler == nil || handler.db == nil {
		return
	}
	g := router.Group("/api/v1/alert/events")
	{
		g.GET("", handler.ListEvents)
		g.POST("/:id/acknowledge", handler.AcknowledgeEvent)
		g.POST("/:id/resolve", handler.ResolveEvent)
		g.POST("/:id/silence", handler.SilenceEvent)
	}
}

func RegisterAuthorizedAlertEventRoutes(router gin.IRouter, db *sql.DB, handler *EventHandler) {
	if handler == nil || handler.db == nil {
		return
	}
	g := router.Group("/api/v1/alert/events")
	{
		g.GET("", cpMiddleware.RequireCapabilityOrOperatorRole(db, "alert.event.read"), handler.ListEvents)
		g.POST("/:id/acknowledge", cpMiddleware.RequireCapabilityOrOperatorRole(db, "incident.update"), handler.AcknowledgeEvent)
		g.POST("/:id/resolve", cpMiddleware.RequireCapabilityOrOperatorRole(db, "incident.update"), handler.ResolveEvent)
		g.POST("/:id/silence", cpMiddleware.RequireCapabilityOrOperatorRole(db, "alert.silence.create"), handler.SilenceEvent)
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

	tenantScope := tenantID
	allowed, err := cpMiddleware.HasGlobalTenantReadAccess(c.Request.Context(), h.db, tenantID, getActorID(c))
	if err != nil {
		writeError(c, http.StatusInternalServerError, ErrorCodeInternalError, "failed to authorize request", nil)
		return
	}
	if allowed {
		tenantScope = ""
	}

	var (
		total int
		rows  *sql.Rows
	)
	offset := (page - 1) * pageSize
	if tenantScope == "" {
		countQuery := `
SELECT COUNT(1)
FROM alert_events
WHERE ($1 = '' OR status = $1)
`
		if err := h.db.QueryRowContext(c.Request.Context(), countQuery, status).Scan(&total); err != nil {
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
WHERE ($1 = '' OR status = $1)
ORDER BY fired_at DESC
OFFSET $2
LIMIT $3
`
		rows, err = h.db.QueryContext(c.Request.Context(), query, status, offset, pageSize)
	} else {
		countQuery := `
SELECT COUNT(1)
FROM alert_events
WHERE tenant_id = $1::uuid
  AND ($2 = '' OR status = $2)
`
		if err := h.db.QueryRowContext(c.Request.Context(), countQuery, tenantScope, status).Scan(&total); err != nil {
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
		rows, err = h.db.QueryContext(c.Request.Context(), query, tenantScope, status, offset, pageSize)
	}
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

func (h *EventHandler) AcknowledgeEvent(c *gin.Context) {
	h.transitionEvent(c, "acknowledged")
}

func (h *EventHandler) ResolveEvent(c *gin.Context) {
	h.transitionEvent(c, "resolved")
}

func (h *EventHandler) SilenceEvent(c *gin.Context) {
	tenantID := getTenantID(c)
	if tenantID == "" {
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "X-Tenant-ID header is required", nil)
		return
	}
	eventID := strings.TrimSpace(c.Param("id"))
	if eventID == "" {
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "event id is required", nil)
		return
	}

	target, err := h.getEventMutationTarget(c, tenantID, eventID)
	if err != nil {
		h.writeMutationLoadError(c, err)
		return
	}
	if target.Status == "resolved" {
		writeError(c, http.StatusConflict, ErrorCodeRequestInvalidParams, "resolved alert event cannot be silenced", nil)
		return
	}
	if target.Status == "silenced" {
		writeSuccess(c, http.StatusOK, h.toAlertEvent(target), gin.H{"updated": false})
		return
	}

	var req alertEventActionRequest
	if err := c.ShouldBindJSON(&req); err != nil && !strings.Contains(strings.ToLower(err.Error()), "eof") {
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "invalid request body", nil)
		return
	}
	if req.DurationSeconds <= 0 {
		req.DurationSeconds = 3600
	}

	if h.silenceSvc != nil {
		matchers := map[string]string{
			"severity": target.Severity,
		}
		if target.RuleID != "" {
			matchers["rule_id"] = target.RuleID
		}
		if target.SourceID != "" {
			matchers["source_id"] = target.SourceID
		}
		createdBy := getActorID(c)
		_, err := h.silenceSvc.Create(
			c.Request.Context(),
			tenantID,
			createdBy,
			matchers,
			strings.TrimSpace(req.Reason),
			time.Now().UTC(),
			time.Now().UTC().Add(time.Duration(req.DurationSeconds)*time.Second),
		)
		if err != nil {
			writeError(c, http.StatusInternalServerError, ErrorCodeInternalError, "failed to create silence policy", nil)
			return
		}
	}

	updated, err := h.updateEventStatus(c, tenantID, eventID, "silenced")
	if err != nil {
		h.writeMutationPersistError(c, err, "failed to silence alert event")
		return
	}
	writeSuccess(c, http.StatusOK, h.toAlertEvent(updated), gin.H{"updated": true})
}

func (h *EventHandler) transitionEvent(c *gin.Context, nextStatus string) {
	tenantID := getTenantID(c)
	if tenantID == "" {
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "X-Tenant-ID header is required", nil)
		return
	}
	eventID := strings.TrimSpace(c.Param("id"))
	if eventID == "" {
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "event id is required", nil)
		return
	}

	target, err := h.getEventMutationTarget(c, tenantID, eventID)
	if err != nil {
		h.writeMutationLoadError(c, err)
		return
	}
	if !isAlertEventTransitionAllowed(target.Status, nextStatus) {
		writeError(c, http.StatusConflict, ErrorCodeRequestInvalidParams, "invalid alert event status transition", gin.H{"from": target.Status, "to": nextStatus})
		return
	}
	if target.Status == nextStatus {
		writeSuccess(c, http.StatusOK, h.toAlertEvent(target), gin.H{"updated": false})
		return
	}

	updated, err := h.updateEventStatus(c, tenantID, eventID, nextStatus)
	if err != nil {
		h.writeMutationPersistError(c, err, "failed to update alert event")
		return
	}
	writeSuccess(c, http.StatusOK, h.toAlertEvent(updated), gin.H{"updated": true})
}

func isAlertEventTransitionAllowed(currentStatus, nextStatus string) bool {
	currentStatus = strings.ToLower(strings.TrimSpace(currentStatus))
	nextStatus = strings.ToLower(strings.TrimSpace(nextStatus))
	if currentStatus == nextStatus {
		return true
	}
	switch nextStatus {
	case "acknowledged":
		return currentStatus == "firing"
	case "resolved":
		return currentStatus == "firing" || currentStatus == "acknowledged" || currentStatus == "silenced"
	case "silenced":
		return currentStatus == "firing" || currentStatus == "acknowledged"
	default:
		return false
	}
}

func (h *EventHandler) getEventMutationTarget(c *gin.Context, tenantID, eventID string) (alertEventMutationTarget, error) {
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
  AND id = $2::uuid
`
	var target alertEventMutationTarget
	var resolvedAt sql.NullTime
	if err := h.db.QueryRowContext(c.Request.Context(), query, tenantID, eventID).Scan(
		&target.ID,
		&target.RuleID,
		&target.Severity,
		&target.Status,
		&target.Title,
		&target.Detail,
		&target.SourceID,
		&target.FiredAt,
		&resolvedAt,
	); err != nil {
		return alertEventMutationTarget{}, err
	}
	if resolvedAt.Valid {
		resolved := resolvedAt.Time.UTC()
		target.ResolvedAt = &resolved
	}
	target.FiredAt = target.FiredAt.UTC()
	return target, nil
}

func (h *EventHandler) updateEventStatus(c *gin.Context, tenantID, eventID, nextStatus string) (alertEventMutationTarget, error) {
	query := `
UPDATE alert_events
SET
    status = $3::varchar(20),
    resolved_at = CASE WHEN $3::text = 'resolved' THEN NOW() ELSE resolved_at END
WHERE tenant_id = $1::uuid
  AND id = $2::uuid
RETURNING
    id::text,
    COALESCE(rule_id::text, ''),
    severity,
    status,
    title,
    COALESCE(detail, ''),
    COALESCE(source_id, ''),
    fired_at,
    resolved_at
`
	var updated alertEventMutationTarget
	var resolvedAt sql.NullTime
	if err := h.db.QueryRowContext(c.Request.Context(), query, tenantID, eventID, nextStatus).Scan(
		&updated.ID,
		&updated.RuleID,
		&updated.Severity,
		&updated.Status,
		&updated.Title,
		&updated.Detail,
		&updated.SourceID,
		&updated.FiredAt,
		&resolvedAt,
	); err != nil {
		return alertEventMutationTarget{}, err
	}
	if resolvedAt.Valid {
		resolved := resolvedAt.Time.UTC()
		updated.ResolvedAt = &resolved
	}
	updated.FiredAt = updated.FiredAt.UTC()
	return updated, nil
}

func (h *EventHandler) toAlertEvent(target alertEventMutationTarget) AlertEvent {
	return AlertEvent{
		ID:         target.ID,
		RuleID:     target.RuleID,
		Severity:   target.Severity,
		Status:     target.Status,
		Title:      target.Title,
		Detail:     target.Detail,
		SourceID:   target.SourceID,
		FiredAt:    target.FiredAt,
		ResolvedAt: target.ResolvedAt,
		Count:      1,
	}
}

func (h *EventHandler) writeMutationLoadError(c *gin.Context, err error) {
	if err == sql.ErrNoRows {
		writeError(c, http.StatusNotFound, ErrorCodeResourceNotFound, "alert event not found", nil)
		return
	}
	log.Printf("alert event load failed: %v", err)
	writeError(c, http.StatusInternalServerError, ErrorCodeInternalError, "failed to load alert event", nil)
}

func (h *EventHandler) writeMutationPersistError(c *gin.Context, err error, message string) {
	if err == sql.ErrNoRows {
		writeError(c, http.StatusNotFound, ErrorCodeResourceNotFound, "alert event not found", nil)
		return
	}
	log.Printf("alert event persist failed: %v", err)
	writeError(c, http.StatusInternalServerError, ErrorCodeInternalError, message, nil)
}
