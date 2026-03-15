package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/nexuslog/data-services/query-api/internal/service"
)

// StatsHandler handles stats HTTP endpoints.
type StatsHandler struct {
	svc *service.StatsService
}

// NewStatsHandler creates a new stats handler.
func NewStatsHandler(svc *service.StatsService) *StatsHandler {
	return &StatsHandler{svc: svc}
}

// GetOverviewStats GET /api/v1/query/stats/overview
func (h *StatsHandler) GetOverviewStats(c *gin.Context) {
	actor := resolveActor(c)
	if actor.TenantID == "" {
		writeError(c, http.StatusUnauthorized, CodeQueryUnauthorized, "tenant context is required")
		return
	}

	stats, err := h.svc.GetOverviewStats(c.Request.Context(), actor)
	if err != nil {
		writeError(c, http.StatusInternalServerError, CodeQueryInternalError, "internal error")
		return
	}

	writeSuccess(c, http.StatusOK, stats, nil)
}

// Aggregate POST /api/v1/query/stats/aggregate
func (h *StatsHandler) Aggregate(c *gin.Context) {
	actor := resolveActor(c)
	if actor.TenantID == "" {
		writeError(c, http.StatusUnauthorized, CodeQueryUnauthorized, "tenant context is required")
		return
	}

	var req service.AggregateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, CodeQueryInvalidParams, "invalid request body")
		return
	}

	result, err := h.svc.Aggregate(c.Request.Context(), actor, req)
	if err != nil {
		writeError(c, http.StatusInternalServerError, CodeQueryInternalError, "internal error")
		return
	}

	writeSuccess(c, http.StatusOK, result, nil)
}
