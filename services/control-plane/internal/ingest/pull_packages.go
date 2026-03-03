package ingest

import (
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	// ErrorCodePackageInvalidArgument 表示 packages 查询参数非法。
	ErrorCodePackageInvalidArgument = ErrorCodeRequestInvalidParams
	// ErrorCodePackageInternalError 表示 packages 处理过程内部异常。
	ErrorCodePackageInternalError = ErrorCodeInternalError
)

var (
	// allowedPackageStatuses 对齐迁移 000013 与接口扩展约定中的包状态集合。
	allowedPackageStatuses = map[string]struct{}{
		"created":       {},
		"uploading":     {},
		"uploaded":      {},
		"acked":         {},
		"nacked":        {},
		"failed":        {},
		"dead_lettered": {},
	}
)

// PullPackage 定义 GET /ingest/packages 的最小响应骨架。
type PullPackage struct {
	PackageID string `json:"package_id"`
	SourceID  string `json:"source_id,omitempty"`
	AgentID   string `json:"agent_id"`
	SourceRef string `json:"source_ref"`
	PackageNo string `json:"package_no"`
	// BatchID 对应 agent 拉取返回的 batch_id，便于链路追踪（task_id/request_id/batch_id）。
	BatchID string `json:"batch_id,omitempty"`
	// NextCursor 对应 agent 拉取返回的 next_cursor，便于断点续拉。
	NextCursor string `json:"next_cursor,omitempty"`
	// RecordCount 为该包包含的日志条数。
	RecordCount int    `json:"record_count,omitempty"`
	FromOffset  int64  `json:"from_offset"`
	ToOffset    int64  `json:"to_offset"`
	FileCount   int    `json:"file_count"`
	SizeBytes   int64  `json:"size_bytes"`
	Checksum    string `json:"checksum"`
	Status      string `json:"status"`
	// Files 为包内文件级摘要，和 agent_package_files 模型一一对应。
	Files []PullPackageFile `json:"files,omitempty"`
	// Metadata 预留扩展字段（与数据库 jsonb metadata 对齐）。
	Metadata  map[string]string `json:"metadata,omitempty"`
	SentAt    *time.Time        `json:"sent_at,omitempty"`
	AckedAt   *time.Time        `json:"acked_at,omitempty"`
	CreatedAt time.Time         `json:"created_at"`
}

// listPullPackagesQuery 定义 packages 查询参数。
type listPullPackagesQuery struct {
	AgentID   string
	SourceRef string
	Status    string
	Page      int
	PageSize  int
}

// PullPackageStore 提供增量包内存查询能力（6.4 最小可用版本）。
type PullPackageStore struct {
	mu    sync.RWMutex
	items map[string]PullPackage
}

// NewPullPackageStore 创建包查询内存仓储。
func NewPullPackageStore() *PullPackageStore {
	return &PullPackageStore{
		items: make(map[string]PullPackage),
	}
}

// List 按 agent/source_ref/status 过滤并返回分页切片。
func (s *PullPackageStore) List(agentID, sourceRef, status string, page, pageSize int) ([]PullPackage, int) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]PullPackage, 0, len(s.items))
	for _, item := range s.items {
		if agentID != "" && item.AgentID != agentID {
			continue
		}
		if sourceRef != "" && item.SourceRef != sourceRef {
			continue
		}
		if status != "" && item.Status != status {
			continue
		}
		result = append(result, item)
	}

	// 默认按创建时间倒序，方便控制台优先查看最新包。
	sort.Slice(result, func(i, j int) bool {
		if result[i].CreatedAt.Equal(result[j].CreatedAt) {
			return result[i].PackageID > result[j].PackageID
		}
		return result[i].CreatedAt.After(result[j].CreatedAt)
	})

	total := len(result)
	start := (page - 1) * pageSize
	if start >= total {
		return []PullPackage{}, total
	}
	end := start + pageSize
	if end > total {
		end = total
	}
	return result[start:end], total
}

// Get 按 package_id 获取增量包。
func (s *PullPackageStore) Get(packageID string) (PullPackage, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	item, ok := s.items[packageID]
	return item, ok
}

// ApplyReceipt 根据 ACK/NACK 回执更新包状态。
func (s *PullPackageStore) ApplyReceipt(packageID, receiptStatus string, receivedAt time.Time) (PullPackage, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	item, ok := s.items[packageID]
	if !ok {
		return PullPackage{}, false
	}

	switch receiptStatus {
	case "ack":
		item.Status = "acked"
		if receivedAt.IsZero() {
			now := time.Now().UTC()
			receivedAt = now
		}
		item.AckedAt = &receivedAt
	case "nack":
		item.Status = "nacked"
	default:
		return PullPackage{}, false
	}

	s.items[packageID] = item
	return item, true
}

// CreateForTest 仅用于测试注入包数据，避免为 6.4 额外增加写接口。
func (s *PullPackageStore) CreateForTest(pkg PullPackage) PullPackage {
	s.mu.Lock()
	defer s.mu.Unlock()

	created := pkg
	if strings.TrimSpace(created.PackageID) == "" {
		created.PackageID = newUUIDLike()
	}
	created.AgentID = strings.TrimSpace(created.AgentID)
	created.SourceRef = strings.TrimSpace(created.SourceRef)
	created.PackageNo = strings.TrimSpace(created.PackageNo)
	created.Checksum = strings.TrimSpace(created.Checksum)
	created.Status = strings.ToLower(strings.TrimSpace(created.Status))
	if created.Status == "" {
		created.Status = "created"
	}
	// 允许测试直接注入 files；如果调用方未填聚合字段，则在此自动回填。
	if len(created.Files) > 0 {
		if created.FileCount <= 0 {
			created.FileCount = len(created.Files)
		}
		if created.RecordCount <= 0 {
			totalLines := 0
			for _, file := range created.Files {
				totalLines += file.LineCount
			}
			created.RecordCount = totalLines
		}
		if created.SizeBytes <= 0 {
			totalBytes := int64(0)
			for _, file := range created.Files {
				totalBytes += file.SizeBytes
			}
			created.SizeBytes = totalBytes
		}
		if created.FromOffset == 0 && created.ToOffset == 0 {
			from := int64(-1)
			to := int64(0)
			for _, file := range created.Files {
				if file.FromOffset > 0 && (from < 0 || file.FromOffset < from) {
					from = file.FromOffset
				}
				if file.ToOffset > to {
					to = file.ToOffset
				}
			}
			if from > 0 {
				created.FromOffset = from
			}
			created.ToOffset = to
		}
	}
	if created.CreatedAt.IsZero() {
		created.CreatedAt = time.Now().UTC()
	}
	s.items[created.PackageID] = created
	return created
}

// PullPackageHandler 实现 packages 查询接口。
type PullPackageHandler struct {
	store *PullPackageStore
}

// NewPullPackageHandler 创建 packages 处理器。
func NewPullPackageHandler(store *PullPackageStore) *PullPackageHandler {
	return &PullPackageHandler{store: store}
}

// RegisterPullPackageRoutes 注册 6.4 所需路由。
func RegisterPullPackageRoutes(router gin.IRouter, store *PullPackageStore) {
	handler := NewPullPackageHandler(store)
	router.GET("/api/v1/ingest/packages", handler.ListPullPackages)
}

// ListPullPackages 处理 GET /api/v1/ingest/packages。
func (h *PullPackageHandler) ListPullPackages(c *gin.Context) {
	query, err := parseListPullPackagesQuery(c)
	if err != nil {
		writeError(c, http.StatusBadRequest, ErrorCodePackageInvalidArgument, err.Error(), gin.H{"field": "query"})
		return
	}

	items, total := h.store.List(query.AgentID, query.SourceRef, query.Status, query.Page, query.PageSize)
	writeSuccess(c, http.StatusOK, gin.H{"items": items}, buildPaginationMeta(query.Page, query.PageSize, total))
}

// parseListPullPackagesQuery 解析 packages 查询参数。
func parseListPullPackagesQuery(c *gin.Context) (listPullPackagesQuery, error) {
	page, err := parsePositiveInt(c.Query("page"), 1)
	if err != nil {
		return listPullPackagesQuery{}, fmt.Errorf("page must be a positive integer")
	}
	pageSize, err := parsePositiveInt(c.Query("page_size"), 20)
	if err != nil {
		return listPullPackagesQuery{}, fmt.Errorf("page_size must be a positive integer")
	}
	if pageSize > 200 {
		pageSize = 200
	}

	agentID := strings.TrimSpace(c.Query("agent_id"))
	sourceRef := strings.TrimSpace(c.Query("source_ref"))
	status := strings.ToLower(strings.TrimSpace(c.Query("status")))
	if status != "" && !isAllowedPackageStatus(status) {
		return listPullPackagesQuery{}, fmt.Errorf("status must be one of created|uploading|uploaded|acked|nacked|failed|dead_lettered")
	}

	return listPullPackagesQuery{
		AgentID:   agentID,
		SourceRef: sourceRef,
		Status:    status,
		Page:      page,
		PageSize:  pageSize,
	}, nil
}

// isAllowedPackageStatus 判断包状态是否在允许集合中。
func isAllowedPackageStatus(status string) bool {
	_, ok := allowedPackageStatuses[status]
	return ok
}
