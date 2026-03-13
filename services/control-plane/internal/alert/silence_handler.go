package alert

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// SilenceHandler handles silence HTTP endpoints.
type SilenceHandler struct {
	svc *SilenceService
}

// NewSilenceHandler creates a new silence handler.
func NewSilenceHandler(svc *SilenceService) *SilenceHandler {
	return &SilenceHandler{svc: svc}
}

// RegisterSilenceRoutes registers silence routes.
func RegisterSilenceRoutes(router gin.IRouter, h *SilenceHandler) {
	g := router.Group("/api/v1/alert/silences")
	{
		g.GET("", h.ListSilences)
		g.POST("", h.CreateSilence)
		g.PUT("/:id", h.UpdateSilence)
		g.DELETE("/:id", h.DeleteSilence)
	}
}

// ListSilences GET /api/v1/alert/silences
func (h *SilenceHandler) ListSilences(c *gin.Context) {
	tenantID := strings.TrimSpace(getTenantID(c))

	silences, err := h.svc.ListActive(c.Request.Context(), tenantID)
	if err != nil {
		setAlertSilenceAuditEvent(c, "alert_silences.list", "", buildSilenceListAuditDetails(0, http.StatusInternalServerError, "failed", ErrorCodeInternalError))
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    ErrorCodeInternalError,
			"message": err.Error(),
		})
		return
	}

	items := make([]gin.H, 0, len(silences))
	for i := range silences {
		items = append(items, mapSilenceToJSON(&silences[i]))
	}

	setAlertSilenceAuditEvent(c, "alert_silences.list", "", buildSilenceListAuditDetails(len(items), http.StatusOK, "success", ""))
	c.JSON(http.StatusOK, gin.H{
		"code":    "OK",
		"message": "success",
		"data":    gin.H{"items": items},
	})
}

// CreateSilenceRequest for POST /api/v1/alert/silences
type CreateSilenceRequest struct {
	Matchers map[string]string `json:"matchers"`
	Reason   string            `json:"reason"`
	StartsAt string            `json:"starts_at"`
	EndsAt   string            `json:"ends_at"`
}

// CreateSilence POST /api/v1/alert/silences
func (h *SilenceHandler) CreateSilence(c *gin.Context) {
	tenantID := strings.TrimSpace(getTenantID(c))
	createdBy := strings.TrimSpace(c.GetHeader("X-User-ID"))

	var req CreateSilenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		setAlertSilenceAuditEvent(c, "alert_silences.create", "", buildSilenceCreateRequestAuditDetails(req, createdBy, http.StatusBadRequest, "failed", ErrorCodeRequestInvalidParams))
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    ErrorCodeRequestInvalidParams,
			"message": "invalid request body",
		})
		return
	}
	if req.Matchers == nil {
		req.Matchers = map[string]string{}
	}

	startsAt, err := parseTime(req.StartsAt)
	if err != nil {
		setAlertSilenceAuditEvent(c, "alert_silences.create", "", buildSilenceCreateRequestAuditDetails(req, createdBy, http.StatusBadRequest, "failed", ErrorCodeRequestInvalidParams))
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    ErrorCodeRequestInvalidParams,
			"message": "starts_at is required and must be RFC3339",
		})
		return
	}
	endsAt, err := parseTime(req.EndsAt)
	if err != nil {
		setAlertSilenceAuditEvent(c, "alert_silences.create", "", buildSilenceCreateRequestAuditDetails(req, createdBy, http.StatusBadRequest, "failed", ErrorCodeRequestInvalidParams))
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    ErrorCodeRequestInvalidParams,
			"message": "ends_at is required and must be RFC3339",
		})
		return
	}

	sil, err := h.svc.Create(c.Request.Context(), tenantID, createdBy, req.Matchers, req.Reason, startsAt, endsAt)
	if err != nil {
		setAlertSilenceAuditEvent(c, "alert_silences.create", "", buildSilenceCreateRequestAuditDetails(req, createdBy, http.StatusInternalServerError, "failed", ErrorCodeInternalError))
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    ErrorCodeInternalError,
			"message": err.Error(),
		})
		return
	}

	setAlertSilenceAuditEvent(c, "alert_silences.create", sil.ID, buildSilenceAuditDetails(sil, http.StatusOK, "success", "", nil))
	c.JSON(http.StatusOK, gin.H{
		"code":    "OK",
		"message": "silence created",
		"data":    mapSilenceToJSON(sil),
	})
}

// UpdateSilenceRequest for PUT /api/v1/alert/silences/:id
type UpdateSilenceRequest struct {
	Matchers map[string]string `json:"matchers,omitempty"`
	Reason   string            `json:"reason,omitempty"`
	StartsAt string            `json:"starts_at,omitempty"`
	EndsAt   string            `json:"ends_at,omitempty"`
}

// UpdateSilence PUT /api/v1/alert/silences/:id
func (h *SilenceHandler) UpdateSilence(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	tenantID := strings.TrimSpace(getTenantID(c))
	if id == "" {
		setAlertSilenceAuditEvent(c, "alert_silences.update", "", buildSilenceUpdateAuditDetails("", UpdateSilenceRequest{}, http.StatusBadRequest, "failed", ErrorCodeRequestInvalidParams))
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    ErrorCodeRequestInvalidParams,
			"message": "id is required",
		})
		return
	}

	var req UpdateSilenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		setAlertSilenceAuditEvent(c, "alert_silences.update", id, buildSilenceUpdateAuditDetails(id, req, http.StatusBadRequest, "failed", ErrorCodeRequestInvalidParams))
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    ErrorCodeRequestInvalidParams,
			"message": "invalid request body",
		})
		return
	}

	startsAt, err := parseTime(req.StartsAt)
	if err != nil {
		setAlertSilenceAuditEvent(c, "alert_silences.update", id, buildSilenceUpdateAuditDetails(id, req, http.StatusBadRequest, "failed", ErrorCodeRequestInvalidParams))
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    ErrorCodeRequestInvalidParams,
			"message": "starts_at is required",
		})
		return
	}
	endsAt, err := parseTime(req.EndsAt)
	if err != nil {
		setAlertSilenceAuditEvent(c, "alert_silences.update", id, buildSilenceUpdateAuditDetails(id, req, http.StatusBadRequest, "failed", ErrorCodeRequestInvalidParams))
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    ErrorCodeRequestInvalidParams,
			"message": "ends_at is required",
		})
		return
	}

	matchers := req.Matchers
	if matchers == nil {
		matchers = map[string]string{}
	}

	sil, err := h.svc.Update(c.Request.Context(), id, tenantID, matchers, req.Reason, startsAt, endsAt)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			setAlertSilenceAuditEvent(c, "alert_silences.update", id, buildSilenceUpdateAuditDetails(id, req, http.StatusNotFound, "failed", ErrorCodeResourceNotFound))
			c.JSON(http.StatusNotFound, gin.H{
				"code":    ErrorCodeResourceNotFound,
				"message": err.Error(),
			})
			return
		}
		setAlertSilenceAuditEvent(c, "alert_silences.update", id, buildSilenceUpdateAuditDetails(id, req, http.StatusInternalServerError, "failed", ErrorCodeInternalError))
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    ErrorCodeInternalError,
			"message": err.Error(),
		})
		return
	}

	setAlertSilenceAuditEvent(c, "alert_silences.update", sil.ID, buildSilenceAuditDetails(sil, http.StatusOK, "success", "", silenceUpdatedFields(req)))
	c.JSON(http.StatusOK, gin.H{
		"code":    "OK",
		"message": "silence updated",
		"data":    mapSilenceToJSON(sil),
	})
}

// DeleteSilence DELETE /api/v1/alert/silences/:id
func (h *SilenceHandler) DeleteSilence(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	tenantID := strings.TrimSpace(getTenantID(c))
	if id == "" {
		setAlertSilenceAuditEvent(c, "alert_silences.delete", "", buildSilenceDeleteAuditDetails("", http.StatusBadRequest, "failed", ErrorCodeRequestInvalidParams))
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    ErrorCodeRequestInvalidParams,
			"message": "id is required",
		})
		return
	}

	if err := h.svc.Delete(c.Request.Context(), id, tenantID); err != nil {
		if strings.Contains(err.Error(), "not found") {
			setAlertSilenceAuditEvent(c, "alert_silences.delete", id, buildSilenceDeleteAuditDetails(id, http.StatusNotFound, "failed", ErrorCodeResourceNotFound))
			c.JSON(http.StatusNotFound, gin.H{
				"code":    ErrorCodeResourceNotFound,
				"message": err.Error(),
			})
			return
		}
		setAlertSilenceAuditEvent(c, "alert_silences.delete", id, buildSilenceDeleteAuditDetails(id, http.StatusInternalServerError, "failed", ErrorCodeInternalError))
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    ErrorCodeInternalError,
			"message": err.Error(),
		})
		return
	}

	setAlertSilenceAuditEvent(c, "alert_silences.delete", id, buildSilenceDeleteAuditDetails(id, http.StatusOK, "success", ""))
	c.JSON(http.StatusOK, gin.H{
		"code":    "OK",
		"message": "silence deleted",
		"data":    gin.H{"id": id},
	})
}

func mapSilenceToJSON(s *Silence) gin.H {
	return gin.H{
		"id":         s.ID,
		"tenant_id":  s.TenantID,
		"matchers":   s.Matchers,
		"reason":     s.Reason,
		"starts_at":  s.StartsAt.UTC().Format(time.RFC3339),
		"ends_at":    s.EndsAt.UTC().Format(time.RFC3339),
		"created_by": s.CreatedBy,
		"created_at": s.CreatedAt.UTC().Format(time.RFC3339),
		"updated_at": s.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

func parseTime(s string) (time.Time, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return time.Time{}, fmt.Errorf("empty time")
	}
	return time.Parse(time.RFC3339, s)
}
