package metrics

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	cpMiddleware "github.com/nexuslog/control-plane/internal/middleware"
)

const (
	ErrorCodeInvalidParams = "REQ_INVALID_PARAMS"
	ErrorCodeNotFound      = "RES_NOT_FOUND"
	ErrorCodeInternal      = "INTERNAL_ERROR"
)

// Handler handles metrics HTTP endpoints.
type Handler struct {
	svc *Service
}

// NewHandler creates a new metrics handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers metrics routes.
func RegisterRoutes(router gin.IRouter, handler *Handler) {
	RegisterReportRoutes(router, handler)
	RegisterQueryRoutes(router, handler)
}

// RegisterReportRoutes registers agent metrics reporting routes.
func RegisterReportRoutes(router gin.IRouter, handler *Handler) {
	g := router.Group("/api/v1/metrics")
	{
		g.POST("/report", handler.Report)
	}
}

// RegisterQueryRoutes registers operator-facing metrics query routes.
func RegisterQueryRoutes(router gin.IRouter, handler *Handler) {
	g := router.Group("/api/v1/metrics")
	{
		g.GET("/servers/:agent_id", handler.QueryAgentMetrics)
	}
}

// Report handles POST /api/v1/metrics/report.
func (h *Handler) Report(c *gin.Context) {
	tenantID := getTenantID(c)
	if tenantID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": ErrorCodeInvalidParams, "message": "X-Tenant-ID header is required",
		})
		return
	}

	var req ReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": ErrorCodeInvalidParams, "message": "invalid request body",
		})
		return
	}

	if err := h.svc.ValidateMetrics(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": ErrorCodeInvalidParams, "message": sanitizeMetricsValidationError(err),
		})
		return
	}

	if err := h.svc.ReportMetrics(c.Request.Context(), tenantID, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": ErrorCodeInternal, "message": "failed to report metrics",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"accepted": true})
}

// QueryAgentMetrics handles GET /api/v1/metrics/servers/:agent_id.
func (h *Handler) QueryAgentMetrics(c *gin.Context) {
	tenantID := getTenantID(c)
	if tenantID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": ErrorCodeInvalidParams, "message": "X-Tenant-ID header is required",
		})
		return
	}
	agentID := strings.TrimSpace(c.Param("agent_id"))
	if agentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": ErrorCodeInvalidParams, "message": "agent_id is required",
		})
		return
	}

	rangeParam := c.DefaultQuery("range", "24h")
	metricName := c.DefaultQuery("metric_name", "")

	from, to, err := parseRange(rangeParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": ErrorCodeInvalidParams, "message": "range must be one of 1h, 6h, 24h, 7d",
		})
		return
	}

	metrics, err := h.svc.QueryMetrics(c.Request.Context(), tenantID, agentID, from, to)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": ErrorCodeInternal, "message": "failed to query metrics",
		})
		return
	}

	series := buildTimeSeries(metrics, metricName)
	c.JSON(http.StatusOK, gin.H{
		"data":  series,
		"from":  from.Format(time.RFC3339),
		"to":    to.Format(time.RFC3339),
		"range": rangeParam,
	})
}

func parseRange(r string) (from, to time.Time, err error) {
	to = time.Now().UTC()
	var d time.Duration
	switch strings.ToLower(strings.TrimSpace(r)) {
	case "1h":
		d = time.Hour
	case "6h":
		d = 6 * time.Hour
	case "24h":
		d = 24 * time.Hour
	case "7d":
		d = 7 * 24 * time.Hour
	default:
		return from, to, fmt.Errorf("unsupported range")
	}
	from = to.Add(-d)
	return from, to, nil
}

func getTenantID(c *gin.Context) string {
	return cpMiddleware.AuthenticatedTenantID(c)
}

func sanitizeMetricsValidationError(err error) string {
	switch strings.TrimSpace(err.Error()) {
	case "agent_id is required", "server_id is required":
		return strings.TrimSpace(err.Error())
	default:
		return "invalid metrics payload"
	}
}

// TimeSeriesPoint represents a single point in a time series.
type TimeSeriesPoint struct {
	Timestamp string  `json:"timestamp"`
	Value     float64 `json:"value"`
}

func buildTimeSeries(metrics []ServerMetric, metricName string) map[string][]TimeSeriesPoint {
	result := make(map[string][]TimeSeriesPoint)
	names := []string{"cpu_usage_pct", "memory_usage_pct", "disk_usage_pct"}
	if metricName != "" {
		names = []string{metricName}
	}
	for _, n := range names {
		points := make([]TimeSeriesPoint, 0, len(metrics))
		for _, m := range metrics {
			var v float64
			switch n {
			case "cpu_usage_pct":
				if m.CPUUsagePct != nil {
					v = *m.CPUUsagePct
				}
			case "memory_usage_pct":
				if m.MemoryUsagePct != nil {
					v = *m.MemoryUsagePct
				}
			case "disk_usage_pct":
				if m.DiskUsagePct != nil {
					v = *m.DiskUsagePct
				}
			default:
				continue
			}
			points = append(points, TimeSeriesPoint{
				Timestamp: m.CollectedAt.Format(time.RFC3339),
				Value:     v,
			})
		}
		result[n] = points
	}
	return result
}
