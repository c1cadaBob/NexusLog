package ingest

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// PullLatencyHandler 提供拉取链路延迟快照查询。
type PullLatencyHandler struct {
	monitor *PullLatencyMonitor
}

// NewPullLatencyHandler 创建延迟处理器。
func NewPullLatencyHandler(monitor *PullLatencyMonitor) *PullLatencyHandler {
	return &PullLatencyHandler{monitor: monitor}
}

// RegisterPullLatencyRoutes 注册拉取延迟查询接口。
func RegisterPullLatencyRoutes(router gin.IRouter, monitor *PullLatencyMonitor) {
	handler := NewPullLatencyHandler(monitor)
	router.GET("/api/v1/ingest/metrics/latency", handler.GetPullLatency)
}

// GetPullLatency 处理 GET /api/v1/ingest/metrics/latency。
func (h *PullLatencyHandler) GetPullLatency(c *gin.Context) {
	snapshot := PullLatencySnapshot{}
	if h != nil && h.monitor != nil {
		snapshot = h.monitor.Snapshot()
	}
	writeSuccess(c, http.StatusOK, gin.H{"snapshot": snapshot}, gin.H{})
}
