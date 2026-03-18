package incident

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	cpMiddleware "github.com/nexuslog/control-plane/internal/middleware"
)

const (
	ErrorCodeRequestInvalidParams = "REQ_INVALID_PARAMS"
	ErrorCodeResourceNotFound     = "RES_NOT_FOUND"
	ErrorCodeInvalidTransition    = "INVALID_TRANSITION"
	ErrorCodeInternalError        = "INTERNAL_ERROR"
)

// Handler handles HTTP requests for incidents.
type Handler struct {
	svc *Service
}

// NewHandler creates a new incident handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterIncidentRoutes registers incident routes under /api/v1/incidents.
func RegisterIncidentRoutes(router gin.IRouter, handler *Handler) {
	g := router.Group("/api/v1/incidents")
	{
		g.GET("", handler.ListIncidents)
		g.GET("/sla/summary", handler.GetSLASummary)
		g.GET("/:id", handler.GetIncident)
		g.POST("", handler.CreateIncident)
		g.PUT("/:id", handler.UpdateIncident)
		g.POST("/:id/archive", handler.ArchiveIncident)
		g.POST("/:id/acknowledge", handler.Acknowledge)
		g.POST("/:id/investigate", handler.Investigate)
		g.POST("/:id/resolve", handler.Resolve)
		g.POST("/:id/close", handler.Close)
		g.GET("/:id/timeline", handler.GetTimeline)
	}
}

// RegisterAuthorizedIncidentRoutes registers incident routes with capability guards.
func RegisterAuthorizedIncidentRoutes(router gin.IRouter, db *sql.DB, handler *Handler) {
	g := router.Group("/api/v1/incidents")
	{
		g.GET("", cpMiddleware.RequireCapabilityOrOperatorRole(db, "incident.read"), handler.ListIncidents)
		g.GET("/sla/summary", cpMiddleware.RequireCapabilityOrOperatorRole(db, "incident.sla.read"), handler.GetSLASummary)
		g.GET("/:id", cpMiddleware.RequireCapabilityOrOperatorRole(db, "incident.read"), handler.GetIncident)
		g.POST("", cpMiddleware.RequireCapabilityOrOperatorRole(db, "incident.create"), handler.CreateIncident)
		g.PUT("/:id", cpMiddleware.RequireCapabilityOrOperatorRole(db, "incident.update"), handler.UpdateIncident)
		g.POST("/:id/archive", cpMiddleware.RequireCapabilityOrOperatorRole(db, "incident.archive"), handler.ArchiveIncident)
		g.POST("/:id/acknowledge", cpMiddleware.RequireCapabilityOrOperatorRole(db, "incident.update"), handler.Acknowledge)
		g.POST("/:id/investigate", cpMiddleware.RequireCapabilityOrOperatorRole(db, "incident.update"), handler.Investigate)
		g.POST("/:id/resolve", cpMiddleware.RequireCapabilityOrOperatorRole(db, "incident.update"), handler.Resolve)
		g.POST("/:id/close", cpMiddleware.RequireCapabilityOrOperatorRole(db, "incident.close"), handler.Close)
		g.GET("/:id/timeline", cpMiddleware.RequireCapabilityOrOperatorRole(db, "incident.timeline.read"), handler.GetTimeline)
	}
}

// ListIncidents handles GET /api/v1/incidents.
func (h *Handler) ListIncidents(c *gin.Context) {
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

	filters := &IncidentFilters{
		Status:   strings.TrimSpace(c.Query("status")),
		Severity: strings.TrimSpace(c.Query("severity")),
	}

	items, total, err := h.svc.ListIncidents(c.Request.Context(), tenantID, page, pageSize, filters)
	if err != nil {
		writeError(c, http.StatusInternalServerError, ErrorCodeInternalError, "failed to list incidents", nil)
		return
	}

	writeSuccess(c, http.StatusOK, gin.H{"items": items}, buildPaginationMeta(page, pageSize, total))
}

// GetIncident handles GET /api/v1/incidents/:id.
func (h *Handler) GetIncident(c *gin.Context) {
	tenantID := getTenantID(c)
	if tenantID == "" {
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "X-Tenant-ID header is required", nil)
		return
	}
	incidentID := strings.TrimSpace(c.Param("id"))
	if incidentID == "" {
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "incident id is required", nil)
		return
	}

	inc, err := h.svc.GetIncident(c.Request.Context(), tenantID, incidentID)
	if err != nil {
		if err == ErrIncidentNotFound {
			writeError(c, http.StatusNotFound, ErrorCodeResourceNotFound, "incident not found", nil)
			return
		}
		writeError(c, http.StatusInternalServerError, ErrorCodeInternalError, "failed to get incident", nil)
		return
	}

	writeSuccess(c, http.StatusOK, inc, gin.H{})
}

// CreateIncidentRequest defines the request body for creating an incident.
type CreateIncidentRequest struct {
	Title              string  `json:"title"`
	Description        string  `json:"description"`
	Severity           string  `json:"severity"`
	AssignedTo         *string `json:"assigned_to,omitempty"`
	SLAResponseMinutes *int    `json:"sla_response_minutes,omitempty"`
	SLAResolveMinutes  *int    `json:"sla_resolve_minutes,omitempty"`
}

// CreateIncident handles POST /api/v1/incidents.
func (h *Handler) CreateIncident(c *gin.Context) {
	tenantID := getTenantID(c)
	if tenantID == "" {
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "X-Tenant-ID header is required", nil)
		return
	}

	var req CreateIncidentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "invalid request body", nil)
		return
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "title is required", nil)
		return
	}

	inc := &Incident{
		TenantID:           tenantID,
		Title:              title,
		Description:        strings.TrimSpace(req.Description),
		Severity:           strings.TrimSpace(req.Severity),
		AssignedTo:         req.AssignedTo,
		SLAResponseMinutes: req.SLAResponseMinutes,
		SLAResolveMinutes:  req.SLAResolveMinutes,
	}
	inc.CreatedBy = getActorID(c)

	id, err := h.svc.CreateIncident(c.Request.Context(), inc)
	if err != nil {
		if err == ErrInvalidSeverity {
			writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, ErrInvalidSeverity.Error(), nil)
			return
		}
		writeError(c, http.StatusInternalServerError, ErrorCodeInternalError, "failed to create incident", nil)
		return
	}

	writeSuccess(c, http.StatusCreated, gin.H{"id": id}, gin.H{})
}

// UpdateIncidentRequest defines the request body for updating an incident.
type UpdateIncidentRequest struct {
	Title              *string `json:"title,omitempty"`
	Description        *string `json:"description,omitempty"`
	Severity           *string `json:"severity,omitempty"`
	AssignedTo         *string `json:"assigned_to,omitempty"`
	RootCause          *string `json:"root_cause,omitempty"`
	Resolution         *string `json:"resolution,omitempty"`
	SLAResponseMinutes *int    `json:"sla_response_minutes,omitempty"`
	SLAResolveMinutes  *int    `json:"sla_resolve_minutes,omitempty"`
}

// UpdateIncident handles PUT /api/v1/incidents/:id.
func (h *Handler) UpdateIncident(c *gin.Context) {
	tenantID := getTenantID(c)
	if tenantID == "" {
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "X-Tenant-ID header is required", nil)
		return
	}
	incidentID := strings.TrimSpace(c.Param("id"))
	if incidentID == "" {
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "incident id is required", nil)
		return
	}

	var req UpdateIncidentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "invalid request body", nil)
		return
	}

	update := &IncidentUpdate{}
	if req.Title != nil {
		t := strings.TrimSpace(*req.Title)
		if t == "" {
			writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "title cannot be empty", nil)
			return
		}
		update.Title = &t
	}
	if req.Description != nil {
		d := strings.TrimSpace(*req.Description)
		update.Description = &d
	}
	if req.Severity != nil {
		s := strings.TrimSpace(*req.Severity)
		update.Severity = &s
	}
	if req.AssignedTo != nil {
		a := strings.TrimSpace(*req.AssignedTo)
		update.AssignedTo = &a
	}
	if req.RootCause != nil {
		r := strings.TrimSpace(*req.RootCause)
		update.RootCause = &r
	}
	if req.Resolution != nil {
		r := strings.TrimSpace(*req.Resolution)
		update.Resolution = &r
	}
	update.SLAResponseMinutes = req.SLAResponseMinutes
	update.SLAResolveMinutes = req.SLAResolveMinutes

	err := h.svc.UpdateIncident(c.Request.Context(), tenantID, incidentID, update)
	if err != nil {
		if err == ErrIncidentNotFound {
			writeError(c, http.StatusNotFound, ErrorCodeResourceNotFound, "incident not found", nil)
			return
		}
		if err == ErrInvalidSeverity {
			writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, ErrInvalidSeverity.Error(), nil)
			return
		}
		writeError(c, http.StatusInternalServerError, ErrorCodeInternalError, "failed to update incident", nil)
		return
	}

	writeSuccess(c, http.StatusOK, gin.H{"updated": true}, gin.H{})
}

// ArchiveIncidentRequest defines the request body for archiving.
type ArchiveIncidentRequest struct {
	Verdict string `json:"verdict"`
}

// ArchiveIncident handles POST /api/v1/incidents/:id/archive.
func (h *Handler) ArchiveIncident(c *gin.Context) {
	tenantID := getTenantID(c)
	if tenantID == "" {
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "X-Tenant-ID header is required", nil)
		return
	}
	incidentID := strings.TrimSpace(c.Param("id"))
	if incidentID == "" {
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "incident id is required", nil)
		return
	}

	var req ArchiveIncidentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "invalid request body", nil)
		return
	}
	if strings.TrimSpace(req.Verdict) == "" {
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "verdict is required", nil)
		return
	}

	err := h.svc.ArchiveIncident(c.Request.Context(), tenantID, incidentID, req.Verdict, getActorID(c))
	if err != nil {
		if err == ErrIncidentNotFound {
			writeError(c, http.StatusNotFound, ErrorCodeResourceNotFound, "incident not found", nil)
			return
		}
		writeError(c, http.StatusInternalServerError, ErrorCodeInternalError, "failed to archive incident", nil)
		return
	}

	writeSuccess(c, http.StatusOK, gin.H{"archived": true}, gin.H{})
}

// Acknowledge handles POST /api/v1/incidents/:id/acknowledge.
func (h *Handler) Acknowledge(c *gin.Context) {
	h.transition(c, StatusAcknowledged)
}

// Investigate handles POST /api/v1/incidents/:id/investigate.
func (h *Handler) Investigate(c *gin.Context) {
	h.transition(c, StatusInvestigating)
}

// ResolveRequest defines optional body for resolve.
type ResolveRequest struct {
	Resolution *string `json:"resolution,omitempty"`
}

// Resolve handles POST /api/v1/incidents/:id/resolve.
func (h *Handler) Resolve(c *gin.Context) {
	tenantID := getTenantID(c)
	if tenantID == "" {
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "X-Tenant-ID header is required", nil)
		return
	}
	incidentID := strings.TrimSpace(c.Param("id"))
	if incidentID == "" {
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "incident id is required", nil)
		return
	}

	var req ResolveRequest
	_ = c.ShouldBindJSON(&req)

	err := h.svc.Transition(c.Request.Context(), tenantID, incidentID, StatusResolved, getActorID(c), req.Resolution)
	if err != nil {
		if err == ErrIncidentNotFound {
			writeError(c, http.StatusNotFound, ErrorCodeResourceNotFound, "incident not found", nil)
			return
		}
		if err == ErrInvalidTransition {
			writeError(c, http.StatusUnprocessableEntity, ErrorCodeInvalidTransition, "invalid state transition", nil)
			return
		}
		writeError(c, http.StatusInternalServerError, ErrorCodeInternalError, "failed to resolve incident", nil)
		return
	}

	writeSuccess(c, http.StatusOK, gin.H{"status": StatusResolved}, gin.H{})
}

// CloseRequest defines optional body for close.
type CloseRequest struct {
	Resolution *string `json:"resolution,omitempty"`
}

// Close handles POST /api/v1/incidents/:id/close.
func (h *Handler) Close(c *gin.Context) {
	tenantID := getTenantID(c)
	if tenantID == "" {
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "X-Tenant-ID header is required", nil)
		return
	}
	incidentID := strings.TrimSpace(c.Param("id"))
	if incidentID == "" {
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "incident id is required", nil)
		return
	}

	var req CloseRequest
	_ = c.ShouldBindJSON(&req)

	err := h.svc.Transition(c.Request.Context(), tenantID, incidentID, StatusClosed, getActorID(c), req.Resolution)
	if err != nil {
		if err == ErrIncidentNotFound {
			writeError(c, http.StatusNotFound, ErrorCodeResourceNotFound, "incident not found", nil)
			return
		}
		if err == ErrInvalidTransition {
			writeError(c, http.StatusUnprocessableEntity, ErrorCodeInvalidTransition, "invalid state transition", nil)
			return
		}
		writeError(c, http.StatusInternalServerError, ErrorCodeInternalError, "failed to close incident", nil)
		return
	}

	writeSuccess(c, http.StatusOK, gin.H{"status": StatusClosed}, gin.H{})
}

// transition handles acknowledge and investigate (no body).
func (h *Handler) transition(c *gin.Context, toStatus string) {
	tenantID := getTenantID(c)
	if tenantID == "" {
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "X-Tenant-ID header is required", nil)
		return
	}
	incidentID := strings.TrimSpace(c.Param("id"))
	if incidentID == "" {
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "incident id is required", nil)
		return
	}

	err := h.svc.Transition(c.Request.Context(), tenantID, incidentID, toStatus, getActorID(c), nil)
	if err != nil {
		if err == ErrIncidentNotFound {
			writeError(c, http.StatusNotFound, ErrorCodeResourceNotFound, "incident not found", nil)
			return
		}
		if err == ErrInvalidTransition {
			writeError(c, http.StatusUnprocessableEntity, ErrorCodeInvalidTransition, "invalid state transition", nil)
			return
		}
		writeError(c, http.StatusInternalServerError, ErrorCodeInternalError, "failed to transition incident", nil)
		return
	}

	writeSuccess(c, http.StatusOK, gin.H{"status": toStatus}, gin.H{})
}

// GetTimeline handles GET /api/v1/incidents/:id/timeline.
func (h *Handler) GetTimeline(c *gin.Context) {
	tenantID := getTenantID(c)
	if tenantID == "" {
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "X-Tenant-ID header is required", nil)
		return
	}
	incidentID := strings.TrimSpace(c.Param("id"))
	if incidentID == "" {
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "incident id is required", nil)
		return
	}

	entries, err := h.svc.GetTimeline(c.Request.Context(), tenantID, incidentID)
	if err != nil {
		if err == ErrIncidentNotFound {
			writeError(c, http.StatusNotFound, ErrorCodeResourceNotFound, "incident not found", nil)
			return
		}
		writeError(c, http.StatusInternalServerError, ErrorCodeInternalError, "failed to get timeline", nil)
		return
	}

	writeSuccess(c, http.StatusOK, gin.H{"items": entries}, gin.H{})
}

// GetSLASummary handles GET /api/v1/incidents/sla/summary.
// Must be registered before /:id to avoid "sla" being matched as id.
func (h *Handler) GetSLASummary(c *gin.Context) {
	tenantID := getTenantID(c)
	if tenantID == "" {
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "X-Tenant-ID header is required", nil)
		return
	}

	summary, err := h.svc.GetSLASummary(c.Request.Context(), tenantID)
	if err != nil {
		writeError(c, http.StatusInternalServerError, ErrorCodeInternalError, "failed to get SLA summary", nil)
		return
	}

	writeSuccess(c, http.StatusOK, summary, gin.H{})
}

func getTenantID(c *gin.Context) string {
	return cpMiddleware.AuthenticatedTenantID(c)
}

func getActorID(c *gin.Context) *string {
	return cpMiddleware.AuthenticatedUserIDPtr(c)
}

func parsePositiveInt(raw string, fallback int) (int, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return fallback, nil
	}
	v, err := strconv.Atoi(raw)
	if err != nil || v <= 0 {
		return 0, fmt.Errorf("invalid positive integer")
	}
	return v, nil
}

func buildPaginationMeta(page, pageSize, total int) gin.H {
	return gin.H{
		"page":      page,
		"page_size": pageSize,
		"total":     total,
		"has_next":  page*pageSize < total,
	}
}

func writeSuccess(c *gin.Context, status int, data any, meta gin.H) {
	if meta == nil {
		meta = gin.H{}
	}
	c.JSON(status, gin.H{
		"code":       "OK",
		"message":    "success",
		"request_id": requestID(c),
		"data":       data,
		"meta":       meta,
	})
}

func writeError(c *gin.Context, status int, code, message string, details any) {
	if code == "" {
		code = ErrorCodeInternalError
	}
	if message == "" {
		message = "internal error"
	}
	c.JSON(status, gin.H{
		"code":       code,
		"message":    message,
		"request_id": requestID(c),
		"details":    details,
	})
}

func requestID(c *gin.Context) string {
	if existing := strings.TrimSpace(c.GetHeader("X-Request-ID")); existing != "" {
		c.Header("X-Request-ID", existing)
		return existing
	}
	generated := fmt.Sprintf("cp-%d-%s", time.Now().Unix(), shortRandomHex(6))
	c.Header("X-Request-ID", generated)
	return generated
}

func shortRandomHex(n int) string {
	if n <= 0 {
		return ""
	}
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return strconv.FormatInt(time.Now().UnixNano(), 16)
	}
	return hex.EncodeToString(buf)
}
