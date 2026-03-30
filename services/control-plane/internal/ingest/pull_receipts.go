package ingest

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	// ErrorCodeReceiptInvalidArgument 表示 receipts 请求参数非法。
	ErrorCodeReceiptInvalidArgument = ErrorCodeRequestInvalidParams
	// ErrorCodeReceiptPackageNotFound 表示 package_id 未找到。
	ErrorCodeReceiptPackageNotFound = ErrorCodeResourceNotFound
	// ErrorCodeReceiptChecksumMismatch 表示回执 checksum 与包 checksum 不一致。
	ErrorCodeReceiptChecksumMismatch = ErrorCodeResourceConflict
	// ErrorCodeReceiptInternalError 表示 receipts 处理内部异常。
	ErrorCodeReceiptInternalError = ErrorCodeInternalError
)

var (
	// allowedReceiptStatuses 限定回执状态仅支持 ack / nack。
	allowedReceiptStatuses = map[string]struct{}{
		"ack":  {},
		"nack": {},
	}
)

// ReceiptRequest 定义 POST /api/v1/ingest/receipts 请求体。
type ReceiptRequest struct {
	PackageID string `json:"package_id"`
	Status    string `json:"status"`
	Reason    string `json:"reason"`
	Checksum  string `json:"checksum"`
}

// DeliveryReceipt 定义回执记录结构（6.5 最小闭环）。
type DeliveryReceipt struct {
	ReceiptID  string    `json:"receipt_id"`
	PackageID  string    `json:"package_id"`
	PackageNo  string    `json:"package_no,omitempty"`
	SourceRef  string    `json:"source_ref,omitempty"`
	Status     string    `json:"status"`
	ErrorCode  string    `json:"error_code,omitempty"`
	Reason     string    `json:"reason,omitempty"`
	Checksum   string    `json:"checksum,omitempty"`
	Accepted   bool      `json:"accepted"`
	ReceivedAt time.Time `json:"received_at"`
	CreatedAt  time.Time `json:"created_at"`
}

type listReceiptsQuery struct {
	SourceRef string
	PackageID string
	Status    string
	Page      int
	PageSize  int
}

// ReceiptStore 保存回执记录（内存仓储版本）。
type ReceiptStore struct {
	mu      sync.RWMutex
	items   map[string]DeliveryReceipt
	backend *PGBackend
}

// NewReceiptStore 创建回执内存仓储。
func NewReceiptStore() *ReceiptStore {
	return &ReceiptStore{
		items: make(map[string]DeliveryReceipt),
	}
}

// NewReceiptStoreWithPG 创建回执 PostgreSQL 仓储。
func NewReceiptStoreWithPG(backend *PGBackend) *ReceiptStore {
	return &ReceiptStore{
		items:   make(map[string]DeliveryReceipt),
		backend: backend,
	}
}

// Create 写入回执记录并返回最终实体。
func (s *ReceiptStore) Create(receipt DeliveryReceipt) (DeliveryReceipt, error) {
	if s.backend != nil {
		return s.createFromDB(context.Background(), receipt)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	created := receipt
	if strings.TrimSpace(created.ReceiptID) == "" {
		created.ReceiptID = newUUIDLike()
	}
	created.PackageID = strings.TrimSpace(created.PackageID)
	created.PackageNo = strings.TrimSpace(created.PackageNo)
	created.SourceRef = strings.TrimSpace(created.SourceRef)
	created.Status = strings.ToLower(strings.TrimSpace(created.Status))
	if created.Status == "" {
		created.Status = "ack"
	}
	created.ErrorCode = strings.TrimSpace(created.ErrorCode)
	created.Reason = strings.TrimSpace(created.Reason)
	created.Checksum = strings.TrimSpace(created.Checksum)
	created.Accepted = true
	if created.ReceivedAt.IsZero() {
		created.ReceivedAt = time.Now().UTC()
	}
	if created.CreatedAt.IsZero() {
		created.CreatedAt = created.ReceivedAt
	}
	s.items[created.ReceiptID] = created
	return created, nil
}

// List 按 source_ref / package_id / status 过滤回执并返回分页切片。
func (s *ReceiptStore) List(sourceRef, packageID, status string, page, pageSize int) ([]DeliveryReceipt, int) {
	if s.backend != nil {
		return s.listFromDB(context.Background(), sourceRef, packageID, status, page, pageSize)
	}

	sourceRef = strings.TrimSpace(sourceRef)
	packageID = strings.TrimSpace(packageID)
	status = strings.ToLower(strings.TrimSpace(status))

	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]DeliveryReceipt, 0, len(s.items))
	for _, item := range s.items {
		if sourceRef != "" && item.SourceRef != sourceRef {
			continue
		}
		if packageID != "" && item.PackageID != packageID {
			continue
		}
		if status != "" && item.Status != status {
			continue
		}
		result = append(result, item)
	}

	sort.Slice(result, func(i, j int) bool {
		if result[i].ReceivedAt.Equal(result[j].ReceivedAt) {
			return result[i].ReceiptID > result[j].ReceiptID
		}
		return result[i].ReceivedAt.After(result[j].ReceivedAt)
	})

	total := len(result)
	start := (page - 1) * pageSize
	if start >= total {
		return []DeliveryReceipt{}, total
	}
	end := start + pageSize
	if end > total {
		end = total
	}
	return result[start:end], total
}

// ReceiptHandler 实现 receipts 写入与读取接口。
type ReceiptHandler struct {
	packageStore    *PullPackageStore
	receiptStore    *ReceiptStore
	deadLetterStore *DeadLetterStore
}

// NewReceiptHandler 创建 receipts 处理器。
func NewReceiptHandler(packageStore *PullPackageStore, receiptStore *ReceiptStore, deadLetterStore *DeadLetterStore) *ReceiptHandler {
	return &ReceiptHandler{
		packageStore:    packageStore,
		receiptStore:    receiptStore,
		deadLetterStore: deadLetterStore,
	}
}

// RegisterReceiptRoutes 注册 6.5 所需路由。
func RegisterReceiptRoutes(router gin.IRouter, packageStore *PullPackageStore, receiptStore *ReceiptStore, deadLetterStore *DeadLetterStore) {
	handler := NewReceiptHandler(packageStore, receiptStore, deadLetterStore)
	router.GET("/api/v1/ingest/receipts", handler.ListReceipts)
	router.POST("/api/v1/ingest/receipts", handler.CreateReceipt)
}

// ListReceipts 处理 GET /api/v1/ingest/receipts。
func (h *ReceiptHandler) ListReceipts(c *gin.Context) {
	query, err := parseListReceiptsQuery(c)
	if err != nil {
		writeError(c, http.StatusBadRequest, ErrorCodeReceiptInvalidArgument, sanitizeIngestValidationError(err, "invalid query parameters"), gin.H{"field": "query"})
		return
	}

	items, total := h.receiptStore.List(query.SourceRef, query.PackageID, query.Status, query.Page, query.PageSize)
	writeSuccess(c, http.StatusOK, gin.H{"items": items}, buildPaginationMeta(query.Page, query.PageSize, total))
}

// CreateReceipt 处理 POST /api/v1/ingest/receipts。
func (h *ReceiptHandler) CreateReceipt(c *gin.Context) {
	var req ReceiptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, ErrorCodeReceiptInvalidArgument, "invalid request body", nil)
		return
	}

	normalized, err := normalizeReceiptRequest(req)
	if err != nil {
		writeError(c, http.StatusBadRequest, ErrorCodeReceiptInvalidArgument, sanitizeIngestValidationError(err, "invalid receipt payload"), nil)
		return
	}

	pkg, ok := h.packageStore.Get(normalized.PackageID)
	if !ok {
		writeError(c, http.StatusNotFound, ErrorCodeReceiptPackageNotFound, "package not found", gin.H{"package_id": normalized.PackageID})
		return
	}

	if normalized.Checksum != "" && normalized.Checksum != pkg.Checksum {
		writeError(c, http.StatusConflict, ErrorCodeReceiptChecksumMismatch, "checksum does not match package", gin.H{
			"package_id": normalized.PackageID,
		})
		return
	}
	if normalized.Checksum == "" {
		normalized.Checksum = pkg.Checksum
	}

	receivedAt := time.Now().UTC()
	if _, ok := h.packageStore.ApplyReceipt(normalized.PackageID, normalized.Status, receivedAt); !ok {
		writeError(c, http.StatusInternalServerError, ErrorCodeReceiptInternalError, "failed to apply receipt", nil)
		return
	}

	created, err := h.receiptStore.Create(DeliveryReceipt{
		PackageID:  normalized.PackageID,
		PackageNo:  pkg.PackageNo,
		SourceRef:  pkg.SourceRef,
		Status:     normalized.Status,
		ErrorCode:  buildReceiptErrorCode(normalized.Status),
		Reason:     normalized.Reason,
		Checksum:   normalized.Checksum,
		Accepted:   true,
		ReceivedAt: receivedAt,
	})
	if err != nil || created.ReceiptID == "" {
		writeError(c, http.StatusInternalServerError, ErrorCodeReceiptInternalError, "failed to persist receipt", nil)
		return
	}

	// NACK 回执写入死信，供 6.6 重放接口消费。
	if normalized.Status == "nack" && h.deadLetterStore != nil {
		if _, dlErr := h.deadLetterStore.CreateFromReceipt(pkg, normalized.Reason); dlErr != nil {
			writeError(c, http.StatusInternalServerError, ErrorCodeReceiptInternalError, "failed to write dead letter", nil)
			return
		}
	}

	writeSuccess(c, http.StatusCreated, gin.H{
		"receipt_id": created.ReceiptID,
		"accepted":   created.Accepted,
	}, gin.H{})
}

func parseListReceiptsQuery(c *gin.Context) (listReceiptsQuery, error) {
	page, err := parsePositiveInt(c.Query("page"), 1)
	if err != nil {
		return listReceiptsQuery{}, fmt.Errorf("page must be a positive integer")
	}
	pageSize, err := parsePositiveInt(c.Query("page_size"), 20)
	if err != nil {
		return listReceiptsQuery{}, fmt.Errorf("page_size must be a positive integer")
	}
	if pageSize > 200 {
		pageSize = 200
	}

	sourceRef := strings.TrimSpace(c.Query("source_ref"))
	packageID := strings.TrimSpace(c.Query("package_id"))
	status := strings.ToLower(strings.TrimSpace(c.Query("status")))
	if status != "" && !isAllowedReceiptStatus(status) {
		return listReceiptsQuery{}, fmt.Errorf("status must be ack or nack")
	}

	return listReceiptsQuery{
		SourceRef: sourceRef,
		PackageID: packageID,
		Status:    status,
		Page:      page,
		PageSize:  pageSize,
	}, nil
}

// normalizeReceiptRequest 校验并规范化 receipts 请求。
func normalizeReceiptRequest(req ReceiptRequest) (ReceiptRequest, error) {
	normalized := ReceiptRequest{
		PackageID: strings.TrimSpace(req.PackageID),
		Status:    strings.ToLower(strings.TrimSpace(req.Status)),
		Reason:    strings.TrimSpace(req.Reason),
		Checksum:  strings.TrimSpace(req.Checksum),
	}

	if normalized.PackageID == "" {
		return ReceiptRequest{}, fmt.Errorf("package_id is required")
	}
	if !isAllowedReceiptStatus(normalized.Status) {
		return ReceiptRequest{}, fmt.Errorf("status must be ack or nack")
	}
	if normalized.Status == "nack" && normalized.Reason == "" {
		return ReceiptRequest{}, fmt.Errorf("reason is required when status is nack")
	}
	return normalized, nil
}

// isAllowedReceiptStatus 判断回执状态是否合法。
func isAllowedReceiptStatus(status string) bool {
	_, ok := allowedReceiptStatuses[status]
	return ok
}
