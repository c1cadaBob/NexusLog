package backup

import (
	"database/sql"
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	cpMiddleware "github.com/nexuslog/control-plane/internal/middleware"
)

// Handler handles backup HTTP endpoints.
type Handler struct {
	svc *Service
}

// NewHandler creates a new backup handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers backup routes.
func RegisterRoutes(router gin.IRouter, h *Handler) {
	g := router.Group("/api/v1/backup")
	{
		g.GET("/repositories", h.ListRepositories)
		g.POST("/repositories", h.CreateRepository)
		g.GET("/snapshots", h.ListSnapshots)
		g.POST("/snapshots", h.CreateSnapshot)
		g.GET("/snapshots/:name", h.GetSnapshotStatus)
		g.POST("/snapshots/:name/restore", h.RestoreSnapshot)
		g.DELETE("/snapshots/:name", h.DeleteSnapshot)
		g.POST("/snapshots/:name/cancel", h.CancelSnapshot)
	}
}

// RegisterAuthorizedRoutes registers backup routes with capability-first compatibility guards.
func RegisterAuthorizedRoutes(router gin.IRouter, db *sql.DB, h *Handler) {
	g := router.Group("/api/v1/backup")
	{
		g.GET("/repositories", cpMiddleware.RequireCapabilityOrAdminRole(db, "backup.read"), h.ListRepositories)
		g.POST("/repositories", cpMiddleware.RequireCapabilityOrAdminRole(db, "backup.create"), h.CreateRepository)
		g.GET("/snapshots", cpMiddleware.RequireCapabilityOrAdminRole(db, "backup.read"), h.ListSnapshots)
		g.POST("/snapshots", cpMiddleware.RequireCapabilityOrAdminRole(db, "backup.create"), h.CreateSnapshot)
		g.GET("/snapshots/:name", cpMiddleware.RequireCapabilityOrAdminRole(db, "backup.read"), h.GetSnapshotStatus)
		g.POST("/snapshots/:name/restore", cpMiddleware.RequireCapabilityOrAdminRole(db, "backup.restore"), h.RestoreSnapshot)
		g.DELETE("/snapshots/:name", cpMiddleware.RequireCapabilityOrAdminRole(db, "backup.delete"), h.DeleteSnapshot)
		g.POST("/snapshots/:name/cancel", cpMiddleware.RequireCapabilityOrAdminRole(db, "backup.cancel"), h.CancelSnapshot)
	}
}

// ListRepositories GET /api/v1/backup/repositories
func (h *Handler) ListRepositories(c *gin.Context) {
	repos, err := h.svc.ListRepositories(c.Request.Context())
	if err != nil {
		setBackupRepositoryAuditEvent(c, "backup_repositories.list", "", buildBackupRepositoryListAuditDetails(0, http.StatusInternalServerError, "failed", "INTERNAL_ERROR"))
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "INTERNAL_ERROR",
			"message": "failed to list repositories",
		})
		return
	}
	items := make([]gin.H, 0, len(repos))
	for name, info := range repos {
		items = append(items, gin.H{
			"name":     name,
			"type":     info.Type,
			"settings": info.Settings,
		})
	}
	setBackupRepositoryAuditEvent(c, "backup_repositories.list", "", buildBackupRepositoryListAuditDetails(len(items), http.StatusOK, "success", ""))
	c.JSON(http.StatusOK, gin.H{
		"code":    "OK",
		"message": "success",
		"data":    gin.H{"repositories": items},
	})
}

// CreateRepositoryRequest for POST /api/v1/backup/repositories
type CreateRepositoryRequest struct {
	Name     string            `json:"name"`
	Settings map[string]string `json:"settings,omitempty"`
}

// CreateRepository POST /api/v1/backup/repositories
func (h *Handler) CreateRepository(c *gin.Context) {
	var req CreateRepositoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		setBackupRepositoryAuditEvent(c, "backup_repositories.create", "", buildBackupRepositoryAuditDetails("", "", http.StatusBadRequest, "failed", "REQ_INVALID_PARAMS"))
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "REQ_INVALID_PARAMS",
			"message": "invalid request body",
		})
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		setBackupRepositoryAuditEvent(c, "backup_repositories.create", "", buildBackupRepositoryAuditDetails(req.Name, "", http.StatusBadRequest, "failed", "REQ_INVALID_PARAMS"))
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "REQ_INVALID_PARAMS",
			"message": "name is required",
		})
		return
	}
	settings := make(map[string]interface{})
	if req.Settings != nil {
		for k, v := range req.Settings {
			settings[k] = v
		}
	}
	location, err := resolveRepositoryLocation(settings)
	if err != nil {
		setBackupRepositoryAuditEvent(c, "backup_repositories.create", req.Name, buildBackupRepositoryAuditDetails(req.Name, "", http.StatusBadRequest, "failed", "REQ_INVALID_PARAMS"))
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "REQ_INVALID_PARAMS",
			"message": "invalid repository location",
		})
		return
	}
	settings["location"] = location
	if err := h.svc.CreateRepository(c.Request.Context(), req.Name, settings); err != nil {
		if errors.Is(err, ErrInvalidRepositoryLocation) {
			setBackupRepositoryAuditEvent(c, "backup_repositories.create", req.Name, buildBackupRepositoryAuditDetails(req.Name, location, http.StatusBadRequest, "failed", "REQ_INVALID_PARAMS"))
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    "REQ_INVALID_PARAMS",
				"message": "invalid repository location",
			})
			return
		}
		if errors.Is(err, ErrInvalidBackupName) {
			setBackupRepositoryAuditEvent(c, "backup_repositories.create", req.Name, buildBackupRepositoryAuditDetails(req.Name, location, http.StatusBadRequest, "failed", "REQ_INVALID_PARAMS"))
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    "REQ_INVALID_PARAMS",
				"message": "invalid repository name",
			})
			return
		}
		setBackupRepositoryAuditEvent(c, "backup_repositories.create", req.Name, buildBackupRepositoryAuditDetails(req.Name, location, http.StatusInternalServerError, "failed", "INTERNAL_ERROR"))
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "INTERNAL_ERROR",
			"message": "failed to create repository",
		})
		return
	}
	setBackupRepositoryAuditEvent(c, "backup_repositories.create", req.Name, buildBackupRepositoryAuditDetails(req.Name, location, http.StatusOK, "success", ""))
	c.JSON(http.StatusOK, gin.H{
		"code":    "OK",
		"message": "repository created",
		"data":    gin.H{"name": req.Name},
	})
}

// ListSnapshots GET /api/v1/backup/snapshots
func (h *Handler) ListSnapshots(c *gin.Context) {
	repo := strings.TrimSpace(c.Query("repository"))
	if repo == "" {
		setBackupSnapshotAuditEvent(c, "backup_snapshots.list", "", buildBackupSnapshotListAuditDetails("", 0, http.StatusBadRequest, "failed", "REQ_INVALID_PARAMS"))
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "REQ_INVALID_PARAMS",
			"message": "repository query param is required",
		})
		return
	}
	snapshots, err := h.svc.ListSnapshots(c.Request.Context(), repo)
	if err != nil {
		if errors.Is(err, ErrInvalidBackupName) {
			setBackupSnapshotAuditEvent(c, "backup_snapshots.list", "", buildBackupSnapshotListAuditDetails(repo, 0, http.StatusBadRequest, "failed", "REQ_INVALID_PARAMS"))
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    "REQ_INVALID_PARAMS",
				"message": "invalid repository name",
			})
			return
		}
		if strings.Contains(strings.ToLower(err.Error()), "disabled to prevent data corruption") {
			setBackupSnapshotAuditEvent(c, "backup_snapshots.list", "", buildBackupSnapshotListAuditDetails(repo, 0, http.StatusConflict, "failed", "BACKUP_REPOSITORY_UNAVAILABLE"))
			c.JSON(http.StatusConflict, gin.H{
				"code":    "BACKUP_REPOSITORY_UNAVAILABLE",
				"message": "当前仓库已被 Elasticsearch 禁用，请切换仓库或重新注册仓库后再试",
			})
			return
		}
		setBackupSnapshotAuditEvent(c, "backup_snapshots.list", "", buildBackupSnapshotListAuditDetails(repo, 0, http.StatusInternalServerError, "failed", "INTERNAL_ERROR"))
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "INTERNAL_ERROR",
			"message": "failed to list snapshots",
		})
		return
	}
	items := make([]gin.H, 0, len(snapshots))
	for _, s := range snapshots {
		items = append(items, gin.H{
			"snapshot":   s.Snapshot,
			"state":      s.State,
			"indices":    s.Indices,
			"start_time": s.StartTime,
			"end_time":   s.EndTime,
			"metadata":   s.Metadata,
		})
	}
	setBackupSnapshotAuditEvent(c, "backup_snapshots.list", "", buildBackupSnapshotListAuditDetails(repo, len(items), http.StatusOK, "success", ""))
	c.JSON(http.StatusOK, gin.H{
		"code":    "OK",
		"message": "success",
		"data":    gin.H{"snapshots": items, "repository": repo},
	})
}

// CreateSnapshotRequest for POST /api/v1/backup/snapshots
type CreateSnapshotRequest struct {
	Repository  string `json:"repository"`
	Name        string `json:"name"`
	Indices     string `json:"indices"`
	Description string `json:"description"`
}

// CreateSnapshot POST /api/v1/backup/snapshots
func (h *Handler) CreateSnapshot(c *gin.Context) {
	var req CreateSnapshotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		setBackupSnapshotAuditEvent(c, "backup_snapshots.create", "", buildBackupSnapshotAuditDetails("", "", "create", nil, "", "", http.StatusBadRequest, "failed", "REQ_INVALID_PARAMS"))
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "REQ_INVALID_PARAMS",
			"message": "invalid request body",
		})
		return
	}
	req.Repository = strings.TrimSpace(req.Repository)
	req.Name = strings.TrimSpace(req.Name)
	if req.Repository == "" || req.Name == "" {
		setBackupSnapshotAuditEvent(c, "backup_snapshots.create", req.Name, buildBackupSnapshotAuditDetails(req.Repository, req.Name, "create", req.Indices, "", req.Description, http.StatusBadRequest, "failed", "REQ_INVALID_PARAMS"))
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "REQ_INVALID_PARAMS",
			"message": "repository and name are required",
		})
		return
	}
	if req.Indices == "" {
		req.Indices = "nexuslog-*"
	}
	if err := h.svc.CreateSnapshot(c.Request.Context(), req.Repository, req.Name, req.Indices, req.Description); err != nil {
		if errors.Is(err, ErrInvalidBackupName) {
			setBackupSnapshotAuditEvent(c, "backup_snapshots.create", req.Name, buildBackupSnapshotAuditDetails(req.Repository, req.Name, "create", req.Indices, "", req.Description, http.StatusBadRequest, "failed", "REQ_INVALID_PARAMS"))
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    "REQ_INVALID_PARAMS",
				"message": "invalid repository or snapshot name",
			})
			return
		}
		setBackupSnapshotAuditEvent(c, "backup_snapshots.create", req.Name, buildBackupSnapshotAuditDetails(req.Repository, req.Name, "create", req.Indices, "", req.Description, http.StatusInternalServerError, "failed", "INTERNAL_ERROR"))
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "INTERNAL_ERROR",
			"message": "failed to create snapshot",
		})
		return
	}
	setBackupSnapshotAuditEvent(c, "backup_snapshots.create", req.Name, buildBackupSnapshotAuditDetails(req.Repository, req.Name, "create", req.Indices, "", req.Description, http.StatusOK, "success", ""))
	c.JSON(http.StatusOK, gin.H{
		"code":    "OK",
		"message": "snapshot created",
		"data": gin.H{
			"repository": req.Repository,
			"snapshot":   req.Name,
			"indices":    req.Indices,
		},
	})
}

// GetSnapshotStatus GET /api/v1/backup/snapshots/:name
func (h *Handler) GetSnapshotStatus(c *gin.Context) {
	name := strings.TrimSpace(c.Param("name"))
	repo := strings.TrimSpace(c.Query("repository"))
	if name == "" || repo == "" {
		setBackupSnapshotAuditEvent(c, "backup_snapshots.read", name, buildBackupSnapshotAuditDetails(repo, name, "read", nil, "", "", http.StatusBadRequest, "failed", "REQ_INVALID_PARAMS"))
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "REQ_INVALID_PARAMS",
			"message": "name is required and repository query param is required",
		})
		return
	}
	status, err := h.svc.GetSnapshotStatus(c.Request.Context(), repo, name)
	if err != nil {
		if errors.Is(err, ErrInvalidBackupName) {
			setBackupSnapshotAuditEvent(c, "backup_snapshots.read", name, buildBackupSnapshotAuditDetails(repo, name, "read", nil, "", "", http.StatusBadRequest, "failed", "REQ_INVALID_PARAMS"))
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    "REQ_INVALID_PARAMS",
				"message": "invalid repository or snapshot name",
			})
			return
		}
		if strings.Contains(err.Error(), "not found") {
			setBackupSnapshotAuditEvent(c, "backup_snapshots.read", name, buildBackupSnapshotAuditDetails(repo, name, "read", nil, "", "", http.StatusNotFound, "failed", "RES_NOT_FOUND"))
			c.JSON(http.StatusNotFound, gin.H{
				"code":    "RES_NOT_FOUND",
				"message": "snapshot not found",
			})
			return
		}
		setBackupSnapshotAuditEvent(c, "backup_snapshots.read", name, buildBackupSnapshotAuditDetails(repo, name, "read", nil, "", "", http.StatusInternalServerError, "failed", "INTERNAL_ERROR"))
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "INTERNAL_ERROR",
			"message": "failed to get snapshot status",
		})
		return
	}
	setBackupSnapshotAuditEvent(c, "backup_snapshots.read", name, buildBackupSnapshotAuditDetails(repo, status.Snapshot, "read", status.Indices, status.State, "", http.StatusOK, "success", ""))
	c.JSON(http.StatusOK, gin.H{
		"code":    "OK",
		"message": "success",
		"data": gin.H{
			"snapshot":   status.Snapshot,
			"state":      status.State,
			"indices":    status.Indices,
			"start_time": status.StartTime,
			"end_time":   status.EndTime,
			"metadata":   status.Metadata,
		},
	})
}

// RestoreSnapshotRequest for POST /api/v1/backup/snapshots/:name/restore
type RestoreSnapshotRequest struct {
	Repository string   `json:"repository"`
	Indices    []string `json:"indices,omitempty"`
}

// RestoreSnapshot POST /api/v1/backup/snapshots/:name/restore
func (h *Handler) RestoreSnapshot(c *gin.Context) {
	name := strings.TrimSpace(c.Param("name"))
	if name == "" {
		setBackupSnapshotAuditEvent(c, "backup_snapshots.restore", "", buildBackupSnapshotAuditDetails("", "", "restore", nil, "", "", http.StatusBadRequest, "failed", "REQ_INVALID_PARAMS"))
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "REQ_INVALID_PARAMS",
			"message": "name is required",
		})
		return
	}
	var req RestoreSnapshotRequest
	_ = c.ShouldBindJSON(&req)
	req.Repository = strings.TrimSpace(req.Repository)
	if req.Repository == "" {
		req.Repository = strings.TrimSpace(c.Query("repository"))
	}
	if req.Repository == "" {
		setBackupSnapshotAuditEvent(c, "backup_snapshots.restore", name, buildBackupSnapshotAuditDetails(req.Repository, name, "restore", req.Indices, "", "", http.StatusBadRequest, "failed", "REQ_INVALID_PARAMS"))
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "REQ_INVALID_PARAMS",
			"message": "repository is required (query or body)",
		})
		return
	}
	if err := h.svc.RestoreSnapshot(c.Request.Context(), req.Repository, name, req.Indices); err != nil {
		if errors.Is(err, ErrInvalidBackupName) {
			setBackupSnapshotAuditEvent(c, "backup_snapshots.restore", name, buildBackupSnapshotAuditDetails(req.Repository, name, "restore", req.Indices, "", "", http.StatusBadRequest, "failed", "REQ_INVALID_PARAMS"))
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    "REQ_INVALID_PARAMS",
				"message": "invalid repository or snapshot name",
			})
			return
		}
		setBackupSnapshotAuditEvent(c, "backup_snapshots.restore", name, buildBackupSnapshotAuditDetails(req.Repository, name, "restore", req.Indices, "", "", http.StatusInternalServerError, "failed", "INTERNAL_ERROR"))
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "INTERNAL_ERROR",
			"message": "failed to restore snapshot",
		})
		return
	}
	setBackupSnapshotAuditEvent(c, "backup_snapshots.restore", name, buildBackupSnapshotAuditDetails(req.Repository, name, "restore", req.Indices, "", "", http.StatusOK, "success", ""))
	c.JSON(http.StatusOK, gin.H{
		"code":    "OK",
		"message": "restore started",
		"data":    gin.H{"repository": req.Repository, "snapshot": name},
	})
}

// DeleteSnapshot DELETE /api/v1/backup/snapshots/:name
func (h *Handler) DeleteSnapshot(c *gin.Context) {
	name := strings.TrimSpace(c.Param("name"))
	repo := strings.TrimSpace(c.Query("repository"))
	if name == "" || repo == "" {
		setBackupSnapshotAuditEvent(c, "backup_snapshots.delete", name, buildBackupSnapshotAuditDetails(repo, name, "delete", nil, "", "", http.StatusBadRequest, "failed", "REQ_INVALID_PARAMS"))
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "REQ_INVALID_PARAMS",
			"message": "name and repository query param are required",
		})
		return
	}
	if err := h.svc.DeleteSnapshot(c.Request.Context(), repo, name); err != nil {
		if errors.Is(err, ErrInvalidBackupName) {
			setBackupSnapshotAuditEvent(c, "backup_snapshots.delete", name, buildBackupSnapshotAuditDetails(repo, name, "delete", nil, "", "", http.StatusBadRequest, "failed", "REQ_INVALID_PARAMS"))
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    "REQ_INVALID_PARAMS",
				"message": "invalid repository or snapshot name",
			})
			return
		}
		setBackupSnapshotAuditEvent(c, "backup_snapshots.delete", name, buildBackupSnapshotAuditDetails(repo, name, "delete", nil, "", "", http.StatusInternalServerError, "failed", "INTERNAL_ERROR"))
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "INTERNAL_ERROR",
			"message": "failed to delete snapshot",
		})
		return
	}
	setBackupSnapshotAuditEvent(c, "backup_snapshots.delete", name, buildBackupSnapshotAuditDetails(repo, name, "delete", nil, "", "", http.StatusOK, "success", ""))
	c.JSON(http.StatusOK, gin.H{
		"code":    "OK",
		"message": "snapshot deleted",
		"data":    gin.H{"snapshot": name},
	})
}

// CancelSnapshot POST /api/v1/backup/snapshots/:name/cancel
func (h *Handler) CancelSnapshot(c *gin.Context) {
	name := strings.TrimSpace(c.Param("name"))
	repo := strings.TrimSpace(c.Query("repository"))
	if name == "" || repo == "" {
		setBackupSnapshotAuditEvent(c, "backup_snapshots.cancel", name, buildBackupSnapshotAuditDetails(repo, name, "cancel", nil, "", "", http.StatusBadRequest, "failed", "REQ_INVALID_PARAMS"))
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "REQ_INVALID_PARAMS",
			"message": "name and repository query param are required",
		})
		return
	}
	if err := h.svc.CancelSnapshot(c.Request.Context(), repo, name); err != nil {
		if errors.Is(err, ErrInvalidBackupName) {
			setBackupSnapshotAuditEvent(c, "backup_snapshots.cancel", name, buildBackupSnapshotAuditDetails(repo, name, "cancel", nil, "", "", http.StatusBadRequest, "failed", "REQ_INVALID_PARAMS"))
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    "REQ_INVALID_PARAMS",
				"message": "invalid repository or snapshot name",
			})
			return
		}
		setBackupSnapshotAuditEvent(c, "backup_snapshots.cancel", name, buildBackupSnapshotAuditDetails(repo, name, "cancel", nil, "", "", http.StatusInternalServerError, "failed", "INTERNAL_ERROR"))
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "INTERNAL_ERROR",
			"message": "failed to cancel snapshot",
		})
		return
	}
	setBackupSnapshotAuditEvent(c, "backup_snapshots.cancel", name, buildBackupSnapshotAuditDetails(repo, name, "cancel", nil, "", "", http.StatusOK, "success", ""))
	c.JSON(http.StatusOK, gin.H{
		"code":    "OK",
		"message": "snapshot cancel requested",
		"data":    gin.H{"snapshot": name},
	})
}
