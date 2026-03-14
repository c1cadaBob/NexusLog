package ingest

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	// ErrorCodePullTaskInvalidArgument 表示 pull-task 请求参数非法。
	ErrorCodePullTaskInvalidArgument = ErrorCodeRequestInvalidParams
	// ErrorCodePullTaskSourceNotFound 表示触发任务时 source 不存在。
	ErrorCodePullTaskSourceNotFound = ErrorCodeResourceNotFound
	// ErrorCodePullTaskInternalError 表示 pull-task 内部异常。
	ErrorCodePullTaskInternalError = ErrorCodeInternalError
)

var (
	// allowedTriggerTypes 限制触发类型，避免写入不可识别的任务来源。
	allowedTriggerTypes = map[string]struct{}{
		"manual":    {},
		"schedule":  {},
		"scheduled": {},
		"replay":    {},
	}
	// allowedTaskStatuses 对齐迁移 000013 的 ingest_pull_tasks.status 约束。
	allowedTaskStatuses = map[string]struct{}{
		"pending":  {},
		"running":  {},
		"success":  {},
		"failed":   {},
		"canceled": {},
	}
)

// PullTask 定义 pull-task 任务骨架（对齐迁移 000013 的关键字段）。
type PullTask struct {
	TaskID       string         `json:"task_id"`
	SourceID     string         `json:"source_id"`
	TriggerType  string         `json:"trigger_type"`
	Options      map[string]any `json:"options"`
	Status       string         `json:"status"`
	RequestID    string         `json:"request_id,omitempty"`
	BatchID      string         `json:"batch_id,omitempty"`
	RetryCount   int            `json:"retry_count,omitempty"`
	LastCursor   string         `json:"last_cursor,omitempty"`
	ScheduledAt  time.Time      `json:"scheduled_at"`
	StartedAt    *time.Time     `json:"started_at,omitempty"`
	FinishedAt   *time.Time     `json:"finished_at,omitempty"`
	ErrorCode    string         `json:"error_code,omitempty"`
	ErrorMessage string         `json:"error_message,omitempty"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
}

// RunPullTaskRequest 定义 POST /pull-tasks/run 请求体。
type RunPullTaskRequest struct {
	SourceID    string         `json:"source_id"`
	TriggerType string         `json:"trigger_type"`
	Options     map[string]any `json:"options"`
}

// listPullTasksQuery 定义任务查询参数（source_id/status + 分页）。
type listPullTasksQuery struct {
	SourceID string
	Status   string
	Page     int
	PageSize int
}

// PullTaskStore 提供任务内存存储，支持任务创建与后续状态流转扩展。
type PullTaskStore struct {
	mu       sync.RWMutex
	items    map[string]PullTask
	backend  *PGBackend
	executor func(PullTask)
}

// NewPullTaskStore 创建 pull-task 内存仓储。
func NewPullTaskStore() *PullTaskStore {
	return &PullTaskStore{
		items: make(map[string]PullTask),
	}
}

// NewPullTaskStoreWithPG 创建 PostgreSQL 仓储版本。
func NewPullTaskStoreWithPG(backend *PGBackend) *PullTaskStore {
	return &PullTaskStore{
		items:   make(map[string]PullTask),
		backend: backend,
	}
}

// SetExecutor 设置任务执行回调。
func (s *PullTaskStore) SetExecutor(executor func(PullTask)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.executor = executor
}

// CreatePending 创建 pending 状态任务，供 run 接口触发。
func (s *PullTaskStore) CreatePending(req RunPullTaskRequest) PullTask {
	if s.backend != nil {
		task, err := s.createPendingFromDB(context.Background(), req)
		if err != nil {
			return PullTask{}
		}
		s.triggerExecution(task)
		return task
	}

	s.mu.Lock()
	now := time.Now().UTC()
	task := PullTask{
		TaskID:      newUUIDLike(),
		SourceID:    req.SourceID,
		TriggerType: req.TriggerType,
		Options:     req.Options,
		Status:      "pending",
		ScheduledAt: now,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	s.items[task.TaskID] = task
	executor := s.executor
	s.mu.Unlock()
	triggerExecution(task, executor)
	return task
}

func (s *PullTaskStore) triggerExecution(task PullTask) {
	s.mu.RLock()
	executor := s.executor
	s.mu.RUnlock()
	triggerExecution(task, executor)
}

func triggerExecution(task PullTask, executor func(PullTask)) {
	if task.TaskID == "" || executor == nil {
		return
	}
	go executor(task)
}

// List 按 source_id、status 与分页返回任务列表。
func (s *PullTaskStore) List(sourceID, status string, page, pageSize int) ([]PullTask, int) {
	if s.backend != nil {
		return s.listFromDB(context.Background(), sourceID, status, page, pageSize)
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]PullTask, 0, len(s.items))
	for _, item := range s.items {
		if sourceID != "" && item.SourceID != sourceID {
			continue
		}
		if status != "" && item.Status != status {
			continue
		}
		result = append(result, item)
	}

	// 默认按调度时间倒序，最新任务优先展示。
	sort.Slice(result, func(i, j int) bool {
		if result[i].ScheduledAt.Equal(result[j].ScheduledAt) {
			return result[i].TaskID > result[j].TaskID
		}
		return result[i].ScheduledAt.After(result[j].ScheduledAt)
	})

	total := len(result)
	start := (page - 1) * pageSize
	if start >= total {
		return []PullTask{}, total
	}
	end := start + pageSize
	if end > total {
		end = total
	}
	return result[start:end], total
}

// GetByID 查询任务详情。
func (s *PullTaskStore) GetByID(taskID string) (PullTask, bool) {
	if s.backend != nil {
		return s.getByIDFromDB(context.Background(), taskID)
	}

	s.mu.RLock()
	defer s.mu.RUnlock()
	task, ok := s.items[taskID]
	return task, ok
}

// HasInFlight 判断指定 source 是否存在 pending/running 任务。
// 调度器依赖该方法避免同 source 并发重入拉取。
func (s *PullTaskStore) HasInFlight(sourceID string) bool {
	sourceID = strings.TrimSpace(sourceID)
	if sourceID == "" {
		return false
	}
	if s.backend != nil {
		return s.hasInFlightFromDB(context.Background(), sourceID)
	}

	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, task := range s.items {
		if task.SourceID != sourceID {
			continue
		}
		if task.Status == "pending" || task.Status == "running" {
			return true
		}
	}
	return false
}

// LatestBySource 返回指定 source 最近一次任务（按 scheduled_at 倒序）。
func (s *PullTaskStore) LatestBySource(sourceID string) (PullTask, bool) {
	sourceID = strings.TrimSpace(sourceID)
	if sourceID == "" {
		return PullTask{}, false
	}
	if s.backend != nil {
		return s.latestBySourceFromDB(context.Background(), sourceID)
	}
	items, _ := s.List(sourceID, "", 1, 1)
	if len(items) == 0 {
		return PullTask{}, false
	}
	return items[0], true
}

// MarkRunning 将任务状态更新为 running。
func (s *PullTaskStore) MarkRunning(taskID string) bool {
	if s.backend != nil {
		return s.markRunningFromDB(context.Background(), taskID)
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	task, ok := s.items[taskID]
	if !ok {
		return false
	}
	now := time.Now().UTC()
	task.Status = "running"
	task.StartedAt = &now
	task.UpdatedAt = now
	s.items[taskID] = task
	return true
}

// MarkSuccess 将任务状态更新为 success。
func (s *PullTaskStore) MarkSuccess(taskID, batchID, lastCursor string) bool {
	if s.backend != nil {
		return s.markSuccessFromDB(context.Background(), taskID, batchID, lastCursor)
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	task, ok := s.items[taskID]
	if !ok {
		return false
	}
	now := time.Now().UTC()
	task.Status = "success"
	task.BatchID = strings.TrimSpace(batchID)
	task.LastCursor = strings.TrimSpace(lastCursor)
	task.FinishedAt = &now
	task.UpdatedAt = now
	s.items[taskID] = task
	return true
}

// MarkFailed 将任务状态更新为 failed。
func (s *PullTaskStore) MarkFailed(taskID, code, message string, retryCount int) bool {
	if s.backend != nil {
		return s.markFailedFromDB(context.Background(), taskID, code, message, retryCount)
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	task, ok := s.items[taskID]
	if !ok {
		return false
	}
	now := time.Now().UTC()
	task.Status = "failed"
	task.ErrorCode = strings.TrimSpace(code)
	task.ErrorMessage = strings.TrimSpace(message)
	task.RetryCount = retryCount
	task.FinishedAt = &now
	task.UpdatedAt = now
	s.items[taskID] = task
	return true
}

// PullTaskHandler 实现 pull-task run 接口处理。
type PullTaskHandler struct {
	sourceStore *PullSourceStore
	taskStore   *PullTaskStore
}

// NewPullTaskHandler 创建 pull-task 处理器。
func NewPullTaskHandler(sourceStore *PullSourceStore, taskStore *PullTaskStore) *PullTaskHandler {
	return &PullTaskHandler{
		sourceStore: sourceStore,
		taskStore:   taskStore,
	}
}

// RegisterPullTaskRoutes 注册 6.2 所需路由。
func RegisterPullTaskRoutes(router gin.IRouter, sourceStore *PullSourceStore, taskStore *PullTaskStore) {
	handler := NewPullTaskHandler(sourceStore, taskStore)
	router.GET("/api/v1/ingest/pull-tasks", handler.ListPullTasks)
	router.POST("/api/v1/ingest/pull-tasks/run", handler.RunPullTask)
}

// ListPullTasks 处理 GET /api/v1/ingest/pull-tasks。
func (h *PullTaskHandler) ListPullTasks(c *gin.Context) {
	query, err := parseListPullTasksQuery(c)
	if err != nil {
		writeError(c, http.StatusBadRequest, ErrorCodePullTaskInvalidArgument, sanitizeIngestValidationError(err, "invalid query parameters"), gin.H{"field": "query"})
		return
	}

	items, total := h.taskStore.List(query.SourceID, query.Status, query.Page, query.PageSize)
	writeSuccess(c, http.StatusOK, gin.H{"items": items}, buildPaginationMeta(query.Page, query.PageSize, total))
}

// RunPullTask 处理 POST /api/v1/ingest/pull-tasks/run。
func (h *PullTaskHandler) RunPullTask(c *gin.Context) {
	var req RunPullTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, ErrorCodePullTaskInvalidArgument, "invalid request body", nil)
		return
	}

	normalized, err := normalizeRunPullTaskRequest(req)
	if err != nil {
		writeError(c, http.StatusBadRequest, ErrorCodePullTaskInvalidArgument, sanitizeIngestValidationError(err, "invalid pull task payload"), nil)
		return
	}

	if !h.sourceStore.Exists(normalized.SourceID) {
		writeError(c, http.StatusNotFound, ErrorCodePullTaskSourceNotFound, "pull source not found", gin.H{"source_id": normalized.SourceID})
		return
	}

	task := h.taskStore.CreatePending(normalized)
	if task.TaskID == "" {
		writeError(c, http.StatusInternalServerError, ErrorCodePullTaskInternalError, "failed to create pull task", nil)
		return
	}
	writeSuccess(c, http.StatusAccepted, gin.H{
		"task_id":      task.TaskID,
		"source_id":    task.SourceID,
		"trigger_type": task.TriggerType,
		"status":       task.Status,
		"request_id":   task.RequestID,
	}, gin.H{})
}

// normalizeRunPullTaskRequest 校验并规范化 run 请求。
func normalizeRunPullTaskRequest(req RunPullTaskRequest) (RunPullTaskRequest, error) {
	normalized := RunPullTaskRequest{
		SourceID:    strings.TrimSpace(req.SourceID),
		TriggerType: strings.ToLower(strings.TrimSpace(req.TriggerType)),
		Options:     req.Options,
	}

	if normalized.SourceID == "" {
		return RunPullTaskRequest{}, fmt.Errorf("source_id is required")
	}
	if normalized.TriggerType == "" {
		normalized.TriggerType = "manual"
	}
	if !isAllowedTriggerType(normalized.TriggerType) {
		return RunPullTaskRequest{}, fmt.Errorf("trigger_type must be one of manual|schedule|scheduled|replay")
	}
	if normalized.Options == nil {
		normalized.Options = map[string]any{}
	}
	return normalized, nil
}

// isAllowedTriggerType 判断触发类型是否合法。
func isAllowedTriggerType(triggerType string) bool {
	_, ok := allowedTriggerTypes[triggerType]
	return ok
}

// parseListPullTasksQuery 解析 GET /pull-tasks 查询参数。
func parseListPullTasksQuery(c *gin.Context) (listPullTasksQuery, error) {
	page, err := parsePositiveInt(c.Query("page"), 1)
	if err != nil {
		return listPullTasksQuery{}, fmt.Errorf("page must be a positive integer")
	}
	pageSize, err := parsePositiveInt(c.Query("page_size"), 20)
	if err != nil {
		return listPullTasksQuery{}, fmt.Errorf("page_size must be a positive integer")
	}
	if pageSize > 200 {
		pageSize = 200
	}

	sourceID := strings.TrimSpace(c.Query("source_id"))
	status := strings.ToLower(strings.TrimSpace(c.Query("status")))
	if status != "" && !isAllowedTaskStatus(status) {
		return listPullTasksQuery{}, fmt.Errorf("status must be one of pending|running|success|failed|canceled")
	}

	return listPullTasksQuery{
		SourceID: sourceID,
		Status:   status,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

// isAllowedTaskStatus 判断任务状态是否合法。
func isAllowedTaskStatus(status string) bool {
	_, ok := allowedTaskStatuses[status]
	return ok
}

// normalizeTaskStatus 用于测试场景注入任务状态。
func normalizeTaskStatus(status string) (string, bool) {
	status = strings.ToLower(strings.TrimSpace(status))
	if isAllowedTaskStatus(status) {
		return status, true
	}
	return "", false
}

// SetStatusForTest 仅用于测试场景模拟状态机，便于验证状态筛选。
func (s *PullTaskStore) SetStatusForTest(taskID, status string) bool {
	if s.backend != nil {
		return s.setStatusForTestFromDB(context.Background(), taskID, status)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	task, ok := s.items[taskID]
	if !ok {
		return false
	}
	normalized, ok := normalizeTaskStatus(status)
	if !ok {
		return false
	}
	task.Status = normalized
	task.UpdatedAt = time.Now().UTC()
	if normalized == "running" {
		started := task.UpdatedAt
		task.StartedAt = &started
	}
	if normalized == "success" || normalized == "failed" || normalized == "canceled" {
		finished := task.UpdatedAt
		task.FinishedAt = &finished
	}
	s.items[taskID] = task
	return true
}

// Count 返回任务总数，便于测试验证。
func (s *PullTaskStore) Count() int {
	if s.backend != nil {
		return s.countFromDB(context.Background())
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.items)
}

func mustMarshalJSONOrEmpty(v map[string]any) []byte {
	if v == nil {
		return []byte("{}")
	}
	raw, err := json.Marshal(v)
	if err != nil {
		return []byte("{}")
	}
	return raw
}

func parseTaskOptions(raw []byte) map[string]any {
	if len(raw) == 0 {
		return map[string]any{}
	}
	result := make(map[string]any)
	if err := json.Unmarshal(raw, &result); err != nil {
		return map[string]any{}
	}
	return result
}

func buildTaskPointers(startedAt, finishedAt sql.NullTime) (*time.Time, *time.Time) {
	return parseOptionalTime(startedAt), parseOptionalTime(finishedAt)
}
