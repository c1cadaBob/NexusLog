package main

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/nexuslog/control-plane/internal/ingestv3"
)

type resolvePullPlansRequest struct {
	SourceID  string   `json:"source_id"`
	FilePaths []string `json:"file_paths"`
}

type commitPullCursorsRequest struct {
	SourceID string                `json:"source_id"`
	Files    []ingestv3.PulledFile `json:"files"`
}

func registerIngestV3Routes(router *gin.Engine, lookup ingestv3.CursorLookup, writer ingestv3.CursorWriter) {
	if router == nil {
		return
	}

	v2 := router.Group("/api/v2/ingest")
	v2.POST("/plans/resolve", func(c *gin.Context) {
		var req resolvePullPlansRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"code":       "REQ_INVALID_PARAMS",
				"message":    "invalid request body",
				"request_id": resolveRequestID(c),
				"data":       gin.H{},
				"meta":       gin.H{},
			})
			return
		}
		sourceID := strings.TrimSpace(req.SourceID)
		if sourceID == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"code":       "REQ_INVALID_PARAMS",
				"message":    "source_id is required",
				"request_id": resolveRequestID(c),
				"data":       gin.H{},
				"meta":       gin.H{},
			})
			return
		}
		plans := ingestv3.BuildPullPlans(sourceID, req.FilePaths, lookup)
		c.JSON(http.StatusOK, gin.H{
			"code":       "OK",
			"message":    "success",
			"request_id": resolveRequestID(c),
			"data": gin.H{
				"plans": plans,
			},
			"meta": gin.H{
				"count": len(plans),
			},
		})
	})

	v2.POST("/cursors/commit", func(c *gin.Context) {
		var req commitPullCursorsRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"code":       "REQ_INVALID_PARAMS",
				"message":    "invalid request body",
				"request_id": resolveRequestID(c),
				"data":       gin.H{},
				"meta":       gin.H{},
			})
			return
		}
		sourceID := strings.TrimSpace(req.SourceID)
		if sourceID == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"code":       "REQ_INVALID_PARAMS",
				"message":    "source_id is required",
				"request_id": resolveRequestID(c),
				"data":       gin.H{},
				"meta":       gin.H{},
			})
			return
		}
		if err := ingestv3.CommitPulledFiles(sourceID, req.Files, writer); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":       "INTERNAL_ERROR",
				"message":    "failed to commit pulled files",
				"request_id": resolveRequestID(c),
				"data":       gin.H{},
				"meta":       gin.H{},
			})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"code":       "OK",
			"message":    "success",
			"request_id": resolveRequestID(c),
			"data": gin.H{
				"committed": len(req.Files),
			},
			"meta": gin.H{
				"count": len(req.Files),
			},
		})
	})
}
