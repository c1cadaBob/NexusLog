# 模块十四：协作与任务管理

> **文档版本**: v1.0  
> **创建日期**: 2026-01-29  
> **所属模块**: 模块十四：协作与任务管理 
> **需求编号**: 

---

### 14.1 模块概述

协作与任务管理模块为团队提供了完整的协作工作流和任务管理能力，支持多人协作处理日志问题、任务分配与跟踪、评论与讨论、工作流自动化等功能。该模块通过实时协作、任务看板、工作流引擎等技术，帮助团队高效协作，快速响应和解决日志相关问题。

**核心功能**:
- 多人协作处理日志问题
- 任务分配与跟踪
- 评论与讨论
- 工作流自动化
- 团队协作看板
- 任务优先级管理

**业务价值**:
- 提升团队协作效率，减少沟通成本
- 规范问题处理流程，提高响应速度
- 支持任务优先级管理，合理分配资源
- 提供完整的任务历史记录，便于追溯和审计
- 通过工作流自动化，减少人工干预

**适用场景**:
- 多人协作处理生产环境日志问题
- 团队任务分配与进度跟踪
- 跨部门协作处理复杂问题
- 问题升级与转派
- 工作流自动化与审批



### 14.2 技术栈选型

| 技术类别 | 技术选型 | 用途说明 |
|---------|---------|---------|
| 实时通信 | WebSocket + Socket.io | 实时协作、消息推送、在线状态同步 |
| 任务管理 | PostgreSQL + Redis | 任务存储、状态管理、优先级队列 |
| 工作流引擎 | Temporal / Cadence | 工作流编排、状态机管理、任务调度 |
| 消息队列 | Kafka | 任务事件流、异步处理、事件溯源 |
| 搜索引擎 | Elasticsearch | 任务全文搜索、历史记录查询 |
| 缓存层 | Redis | 在线用户缓存、任务状态缓存、会话管理 |
| 文件存储 | MinIO / S3 | 附件存储、文档管理 |
| 通知服务 | 邮件 + Slack + 钉钉 | 任务通知、提醒、告警 |
| 权限控制 | Casbin | 任务权限、操作权限、数据权限 |
| 前端框架 | React + TypeScript | 任务看板、协作界面 |
| 状态管理 | Zustand | 任务状态、用户状态、协作状态 |
| 实时编辑 | Yjs / Automerge | 协同编辑、冲突解决 |



### 14.3 架构设计图

```
┌─────────────────────────────────────────────────────────────────┐
│                        协作与任务管理层                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  任务管理器   │  │  协作引擎    │  │  工作流引擎   │         │
│  │              │  │              │  │              │         │
│  │ - 任务创建   │  │ - 实时协作   │  │ - 流程编排   │         │
│  │ - 任务分配   │  │ - 评论讨论   │  │ - 状态机     │         │
│  │ - 状态跟踪   │  │ - 在线状态   │  │ - 自动化     │         │
│  │ - 优先级管理 │  │ - 消息推送   │  │ - 审批流程   │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                 │                  │
├─────────┼─────────────────┼─────────────────┼──────────────────┤
│         │                 │                 │                  │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐         │
│  │  任务存储层   │  │  实时通信层   │  │  工作流存储   │         │
│  │              │  │              │  │              │         │
│  │ - PostgreSQL │  │ - WebSocket  │  │ - Temporal   │         │
│  │ - Redis缓存  │  │ - Socket.io  │  │ - 状态持久化 │         │
│  │ - ES搜索     │  │ - 消息队列   │  │ - 事件日志   │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                 │                  │
├─────────┼─────────────────┼─────────────────┼──────────────────┤
│         │                 │                 │                  │
│  ┌──────▼─────────────────▼─────────────────▼───────┐         │
│  │              通知与集成服务层                      │         │
│  │                                                   │         │
│  │  - 邮件通知    - Slack集成    - 钉钉集成          │         │
│  │  - 任务提醒    - 工单系统     - 日历同步          │         │
│  └───────────────────────────────────────────────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**架构说明**:

1. **任务管理器**: 负责任务的创建、分配、状态跟踪和优先级管理
2. **协作引擎**: 提供实时协作能力，包括在线状态、评论讨论、消息推送
3. **工作流引擎**: 基于 Temporal 实现工作流编排、状态机管理和自动化流程
4. **任务存储层**: PostgreSQL 存储任务数据，Redis 缓存热点数据，Elasticsearch 提供全文搜索
5. **实时通信层**: WebSocket + Socket.io 实现实时消息推送和在线状态同步
6. **工作流存储**: Temporal 管理工作流状态和事件日志
7. **通知与集成层**: 集成邮件、Slack、钉钉等通知渠道，支持工单系统和日历同步

**数据流向**:

```
用户操作 → API 网关 → 任务管理器 → PostgreSQL (持久化)
                                  ↓
                              Redis (缓存)
                                  ↓
                          Elasticsearch (索引)
                                  ↓
                          WebSocket (实时推送)
                                  ↓
                          通知服务 (邮件/Slack/钉钉)

工作流触发 → 工作流引擎 → Temporal (状态管理)
                                  ↓
                          节点执行 (任务/审批/通知)
                                  ↓
                          Kafka (事件流)
                                  ↓
                          历史记录 (PostgreSQL)
```



### 14.4 需求列表

| 需求编号 | 需求名称 | 优先级 | 开发阶段 | 依赖需求 |
|---------|---------|--------|---------|---------|
| 需求49 | 任务管理与协作 | P0 | MVP | 需求1, 需求21 |
| 需求50 | 工作流自动化 | P1 | Phase 2 | 需求49 |

---


#### 需求 14-49: 任务管理与协作 [MVP]

**用户故事**:

作为运维团队成员，我希望能够创建、分配和跟踪日志相关的任务，并与团队成员实时协作讨论问题，以便快速响应和解决生产环境中的日志问题，提高团队协作效率。

**验收标准**:

1. THE System SHALL 支持创建任务，包含标题、描述、优先级、截止时间、关联日志等信息
2. WHEN 任务被分配给用户时，THE System SHALL 在 1 秒内发送实时通知
3. THE System SHALL 支持任务状态流转（待处理、进行中、已完成、已关闭），并记录状态变更历史
4. THE System SHALL 支持任务评论与讨论，支持 @提及用户、附件上传、Markdown 格式
5. THE System SHALL 显示团队成员的在线状态，并在 5 秒内同步状态变化
6. THE System SHALL 支持任务优先级管理（紧急、高、中、低），并在看板中按优先级排序
7. THE System SHALL 支持任务搜索与过滤，包括按状态、优先级、负责人、标签等维度
8. THE System SHALL 提供任务看板视图（看板、列表、日历），支持拖拽排序和状态变更
9. THE System SHALL 记录任务的完整操作历史，包括创建、分配、状态变更、评论等
10. THE System SHALL 支持任务模板，快速创建常见类型的任务



**实现方向**:

**实现方式**:

```go
// internal/collaboration/task/manager.go
package task

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

// TaskManager 任务管理器
type TaskManager struct {
	db           *sql.DB
	cache        *redis.Client
	notifier     *Notifier
	searchClient *elasticsearch.Client
}

// Task 任务模型
type Task struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Status      string    `json:"status"` // pending, in_progress, completed, closed
	Priority    string    `json:"priority"` // urgent, high, medium, low
	AssigneeID  string    `json:"assignee_id"`
	CreatorID   string    `json:"creator_id"`
	DueDate     time.Time `json:"due_date"`
	Tags        []string  `json:"tags"`
	RelatedLogs []string  `json:"related_logs"` // 关联的日志ID
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// CreateTask 创建任务
func (m *TaskManager) CreateTask(ctx context.Context, task *Task) error {
	task.ID = uuid.New().String()
	task.CreatedAt = time.Now()
	task.UpdatedAt = time.Now()
	task.Status = "pending"

	// 保存到数据库
	query := `
		INSERT INTO tasks (id, title, description, status, priority, 
			assignee_id, creator_id, due_date, tags, related_logs, 
			created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`
	_, err := m.db.ExecContext(ctx, query,
		task.ID, task.Title, task.Description, task.Status, task.Priority,
		task.AssigneeID, task.CreatorID, task.DueDate, pq.Array(task.Tags),
		pq.Array(task.RelatedLogs), task.CreatedAt, task.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("创建任务失败: %w", err)
	}

	// 缓存任务
	if err := m.cacheTask(ctx, task); err != nil {
		// 缓存失败不影响主流程
		log.Warnf("缓存任务失败: %v", err)
	}

	// 索引到 Elasticsearch
	if err := m.indexTask(ctx, task); err != nil {
		log.Warnf("索引任务失败: %v", err)
	}

	// 发送通知
	if task.AssigneeID != "" {
		m.notifier.NotifyTaskAssigned(ctx, task)
	}

	// 记录操作历史
	m.recordHistory(ctx, task.ID, "created", task.CreatorID, nil)

	return nil
}


// AssignTask 分配任务
func (m *TaskManager) AssignTask(ctx context.Context, taskID, assigneeID, operatorID string) error {
	// 获取任务
	task, err := m.GetTask(ctx, taskID)
	if err != nil {
		return err
	}

	oldAssignee := task.AssigneeID
	task.AssigneeID = assigneeID
	task.UpdatedAt = time.Now()

	// 更新数据库
	query := `UPDATE tasks SET assignee_id = $1, updated_at = $2 WHERE id = $3`
	_, err = m.db.ExecContext(ctx, query, assigneeID, task.UpdatedAt, taskID)
	if err != nil {
		return fmt.Errorf("分配任务失败: %w", err)
	}

	// 更新缓存
	m.cacheTask(ctx, task)

	// 发送通知
	m.notifier.NotifyTaskAssigned(ctx, task)

	// 记录历史
	changes := map[string]interface{}{
		"old_assignee": oldAssignee,
		"new_assignee": assigneeID,
	}
	m.recordHistory(ctx, taskID, "assigned", operatorID, changes)

	return nil
}

// UpdateTaskStatus 更新任务状态
func (m *TaskManager) UpdateTaskStatus(ctx context.Context, taskID, status, operatorID string) error {
	// 验证状态转换
	validTransitions := map[string][]string{
		"pending":     {"in_progress", "closed"},
		"in_progress": {"completed", "pending", "closed"},
		"completed":   {"closed", "in_progress"},
		"closed":      {},
	}

	task, err := m.GetTask(ctx, taskID)
	if err != nil {
		return err
	}

	// 检查状态转换是否合法
	allowed := false
	for _, s := range validTransitions[task.Status] {
		if s == status {
			allowed = true
			break
		}
	}
	if !allowed {
		return fmt.Errorf("不允许从 %s 转换到 %s", task.Status, status)
	}

	oldStatus := task.Status
	task.Status = status
	task.UpdatedAt = time.Now()

	// 更新数据库
	query := `UPDATE tasks SET status = $1, updated_at = $2 WHERE id = $3`
	_, err = m.db.ExecContext(ctx, query, status, task.UpdatedAt, taskID)
	if err != nil {
		return fmt.Errorf("更新任务状态失败: %w", err)
	}

	// 更新缓存
	m.cacheTask(ctx, task)

	// 发送通知
	m.notifier.NotifyTaskStatusChanged(ctx, task, oldStatus)

	// 记录历史
	changes := map[string]interface{}{
		"old_status": oldStatus,
		"new_status": status,
	}
	m.recordHistory(ctx, taskID, "status_changed", operatorID, changes)

	return nil
}


// Comment 评论模型
type Comment struct {
	ID        string    `json:"id"`
	TaskID    string    `json:"task_id"`
	UserID    string    `json:"user_id"`
	Content   string    `json:"content"`
	Mentions  []string  `json:"mentions"` // @提及的用户ID
	Attachments []string `json:"attachments"` // 附件URL
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// AddComment 添加评论
func (m *TaskManager) AddComment(ctx context.Context, comment *Comment) error {
	comment.ID = uuid.New().String()
	comment.CreatedAt = time.Now()
	comment.UpdatedAt = time.Now()

	// 保存到数据库
	query := `
		INSERT INTO task_comments (id, task_id, user_id, content, mentions, attachments, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err := m.db.ExecContext(ctx, query,
		comment.ID, comment.TaskID, comment.UserID, comment.Content,
		pq.Array(comment.Mentions), pq.Array(comment.Attachments),
		comment.CreatedAt, comment.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("添加评论失败: %w", err)
	}

	// 发送通知给被@的用户
	for _, userID := range comment.Mentions {
		m.notifier.NotifyMention(ctx, comment.TaskID, userID, comment.UserID)
	}

	// 通知任务负责人
	task, _ := m.GetTask(ctx, comment.TaskID)
	if task != nil && task.AssigneeID != comment.UserID {
		m.notifier.NotifyNewComment(ctx, task, comment)
	}

	return nil
}

// SearchTasks 搜索任务
func (m *TaskManager) SearchTasks(ctx context.Context, filter *TaskFilter) ([]*Task, int, error) {
	// 构建查询条件
	conditions := []string{"1=1"}
	args := []interface{}{}
	argIndex := 1

	if filter.Status != "" {
		conditions = append(conditions, fmt.Sprintf("status = $%d", argIndex))
		args = append(args, filter.Status)
		argIndex++
	}

	if filter.Priority != "" {
		conditions = append(conditions, fmt.Sprintf("priority = $%d", argIndex))
		args = append(args, filter.Priority)
		argIndex++
	}

	if filter.AssigneeID != "" {
		conditions = append(conditions, fmt.Sprintf("assignee_id = $%d", argIndex))
		args = append(args, filter.AssigneeID)
		argIndex++
	}

	if len(filter.Tags) > 0 {
		conditions = append(conditions, fmt.Sprintf("tags && $%d", argIndex))
		args = append(args, pq.Array(filter.Tags))
		argIndex++
	}

	// 查询总数
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM tasks WHERE %s", 
		strings.Join(conditions, " AND "))
	var total int
	err := m.db.QueryRowContext(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// 查询任务列表
	query := fmt.Sprintf(`
		SELECT id, title, description, status, priority, assignee_id, creator_id, 
			due_date, tags, related_logs, created_at, updated_at
		FROM tasks
		WHERE %s
		ORDER BY priority DESC, created_at DESC
		LIMIT $%d OFFSET $%d
	`, strings.Join(conditions, " AND "), argIndex, argIndex+1)

	args = append(args, filter.Limit, filter.Offset)

	rows, err := m.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	tasks := []*Task{}
	for rows.Next() {
		task := &Task{}
		err := rows.Scan(
			&task.ID, &task.Title, &task.Description, &task.Status, &task.Priority,
			&task.AssigneeID, &task.CreatorID, &task.DueDate,
			pq.Array(&task.Tags), pq.Array(&task.RelatedLogs),
			&task.CreatedAt, &task.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		tasks = append(tasks, task)
	}

	return tasks, total, nil
}


// internal/collaboration/realtime/presence.go
package realtime

import (
	"context"
	"encoding/json"
	"time"

	"github.com/gorilla/websocket"
)

// PresenceManager 在线状态管理器
type PresenceManager struct {
	cache       *redis.Client
	connections map[string]*websocket.Conn // userID -> connection
	mu          sync.RWMutex
}

// UserPresence 用户在线状态
type UserPresence struct {
	UserID       string    `json:"user_id"`
	Status       string    `json:"status"` // online, away, busy, offline
	LastActiveAt time.Time `json:"last_active_at"`
	CurrentTask  string    `json:"current_task"` // 当前正在处理的任务ID
}

// UpdatePresence 更新用户在线状态
func (m *PresenceManager) UpdatePresence(ctx context.Context, userID, status string) error {
	presence := &UserPresence{
		UserID:       userID,
		Status:       status,
		LastActiveAt: time.Now(),
	}

	// 保存到 Redis，设置 5 分钟过期
	key := fmt.Sprintf("presence:%s", userID)
	data, _ := json.Marshal(presence)
	err := m.cache.Set(ctx, key, data, 5*time.Minute).Err()
	if err != nil {
		return err
	}

	// 广播状态变更
	m.broadcastPresenceChange(presence)

	return nil
}

// GetOnlineUsers 获取在线用户列表
func (m *PresenceManager) GetOnlineUsers(ctx context.Context) ([]*UserPresence, error) {
	// 扫描所有在线用户
	keys, err := m.cache.Keys(ctx, "presence:*").Result()
	if err != nil {
		return nil, err
	}

	users := []*UserPresence{}
	for _, key := range keys {
		data, err := m.cache.Get(ctx, key).Bytes()
		if err != nil {
			continue
		}

		var presence UserPresence
		if err := json.Unmarshal(data, &presence); err != nil {
			continue
		}

		users = append(users, &presence)
	}

	return users, nil
}

// broadcastPresenceChange 广播状态变更
func (m *PresenceManager) broadcastPresenceChange(presence *UserPresence) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	message := map[string]interface{}{
		"type":     "presence_change",
		"presence": presence,
	}
	data, _ := json.Marshal(message)

	// 向所有连接的客户端广播
	for _, conn := range m.connections {
		conn.WriteMessage(websocket.TextMessage, data)
	}
}


// internal/collaboration/task/template.go
package task

// TaskTemplate 任务模板
type TaskTemplate struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Priority    string            `json:"priority"`
	Tags        []string          `json:"tags"`
	Checklist   []string          `json:"checklist"` // 检查清单
	Fields      map[string]string `json:"fields"`    // 自定义字段
}

// CreateFromTemplate 从模板创建任务
func (m *TaskManager) CreateFromTemplate(ctx context.Context, templateID, creatorID string, overrides map[string]interface{}) (*Task, error) {
	// 获取模板
	template, err := m.getTemplate(ctx, templateID)
	if err != nil {
		return nil, err
	}

	// 创建任务
	task := &Task{
		Title:       template.Name,
		Description: template.Description,
		Priority:    template.Priority,
		Tags:        template.Tags,
		CreatorID:   creatorID,
	}

	// 应用覆盖参数
	if title, ok := overrides["title"].(string); ok {
		task.Title = title
	}
	if assigneeID, ok := overrides["assignee_id"].(string); ok {
		task.AssigneeID = assigneeID
	}
	if dueDate, ok := overrides["due_date"].(time.Time); ok {
		task.DueDate = dueDate
	}

	// 创建任务
	if err := m.CreateTask(ctx, task); err != nil {
		return nil, err
	}

	// 创建检查清单
	for _, item := range template.Checklist {
		m.addChecklistItem(ctx, task.ID, item)
	}

	return task, nil
}

// 辅助方法
func (m *TaskManager) cacheTask(ctx context.Context, task *Task) error {
	key := fmt.Sprintf("task:%s", task.ID)
	data, _ := json.Marshal(task)
	return m.cache.Set(ctx, key, data, 1*time.Hour).Err()
}

func (m *TaskManager) indexTask(ctx context.Context, task *Task) error {
	body, _ := json.Marshal(task)
	_, err := m.searchClient.Index(
		"tasks",
		bytes.NewReader(body),
		m.searchClient.Index.WithDocumentID(task.ID),
		m.searchClient.Index.WithContext(ctx),
	)
	return err
}

func (m *TaskManager) recordHistory(ctx context.Context, taskID, action, operatorID string, changes map[string]interface{}) error {
	history := map[string]interface{}{
		"task_id":    taskID,
		"action":     action,
		"operator_id": operatorID,
		"changes":    changes,
		"timestamp":  time.Now(),
	}

	query := `
		INSERT INTO task_history (task_id, action, operator_id, changes, created_at)
		VALUES ($1, $2, $3, $4, $5)
	`
	changesJSON, _ := json.Marshal(changes)
	_, err := m.db.ExecContext(ctx, query, taskID, action, operatorID, changesJSON, time.Now())
	return err
}
```



**关键实现点**:

1. 任务数据存储在 PostgreSQL，使用 Redis 缓存热点任务，Elasticsearch 提供全文搜索
2. 任务状态流转使用状态机模式，确保状态转换的合法性和一致性
3. 实时通知通过 WebSocket 推送，确保任务分配、状态变更等事件在 1 秒内送达
4. 评论支持 Markdown 格式、@提及、附件上传，提供丰富的协作体验
5. 在线状态使用 Redis 存储，设置 5 分钟过期时间，自动清理离线用户
6. 任务历史记录完整保存所有操作，包括创建、分配、状态变更、评论等
7. 任务模板支持快速创建常见类型的任务，提高工作效率



**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| task_enabled | bool | true | 是否启用任务管理 |
| max_tasks_per_user | int | 50 | 每个用户最大任务数 |
| task_cache_ttl | duration | 1h | 任务缓存过期时间 |
| presence_ttl | duration | 5m | 在线状态过期时间 |
| notification_enabled | bool | true | 是否启用任务通知 |
| comment_max_length | int | 10000 | 评论最大长度 |
| attachment_max_size | int | 10485760 | 附件最大大小（10MB） |
| template_enabled | bool | true | 是否启用任务模板 |
| history_retention_days | int | 90 | 历史记录保留天数 |

**热更新机制**:

- 更新方式: PostgreSQL 配置表 + Redis 发布订阅
- 生效时间: 配置变更后 5 秒内生效
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后 5 秒内应用新的任务管理配置
2. WHEN 任务缓存 TTL 变更时，THE System SHALL 对新创建的缓存生效
3. THE System SHALL 支持通过 API 查询当前生效的任务管理配置
4. THE System SHALL 记录所有任务配置变更的审计日志
5. WHEN 通知配置禁用时，THE System SHALL 停止发送任务通知但保留任务功能

---



#### 需求 14-50: 工作流自动化 [Phase 2]

**用户故事**:

作为运维团队负责人，我希望能够定义和自动化日志问题处理的工作流程，包括自动分配、升级、审批等环节，以便规范团队的工作流程，减少人工干预，提高问题处理的效率和一致性。

**验收标准**:

1. THE System SHALL 支持可视化工作流编辑器，通过拖拽方式定义工作流节点和连接
2. THE System SHALL 支持多种工作流节点类型（开始、结束、任务、条件判断、并行、审批、通知）
3. WHEN 工作流触发时，THE System SHALL 在 2 秒内启动工作流实例
4. THE System SHALL 支持工作流变量和表达式，实现动态路由和条件判断
5. THE System SHALL 支持工作流审批节点，支持单人审批、多人会签、多人或签
6. THE System SHALL 记录工作流执行历史，包括每个节点的执行时间、执行人、执行结果
7. THE System SHALL 支持工作流超时处理，自动升级或通知相关人员
8. THE System SHALL 支持工作流暂停、恢复、终止操作
9. THE System SHALL 提供工作流执行监控面板，实时显示工作流状态和进度
10. THE System SHALL 支持工作流模板库，提供常见场景的预定义工作流



**实现方向**:

**实现方式**:

```go
// internal/collaboration/workflow/engine.go
package workflow

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/workflow"
)

// WorkflowEngine 工作流引擎
type WorkflowEngine struct {
	temporalClient client.Client
	db             *sql.DB
	cache          *redis.Client
	notifier       *Notifier
}

// WorkflowDefinition 工作流定义
type WorkflowDefinition struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Version     int                    `json:"version"`
	Nodes       []WorkflowNode         `json:"nodes"`
	Edges       []WorkflowEdge         `json:"edges"`
	Variables   map[string]interface{} `json:"variables"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

// WorkflowNode 工作流节点
type WorkflowNode struct {
	ID       string                 `json:"id"`
	Type     string                 `json:"type"` // start, end, task, condition, parallel, approval, notification
	Name     string                 `json:"name"`
	Config   map[string]interface{} `json:"config"`
	Position Position               `json:"position"` // 节点位置（用于可视化）
}

// WorkflowEdge 工作流边
type WorkflowEdge struct {
	ID        string                 `json:"id"`
	Source    string                 `json:"source"`    // 源节点ID
	Target    string                 `json:"target"`    // 目标节点ID
	Condition string                 `json:"condition"` // 条件表达式
	Config    map[string]interface{} `json:"config"`
}

// WorkflowInstance 工作流实例
type WorkflowInstance struct {
	ID           string                 `json:"id"`
	DefinitionID string                 `json:"definition_id"`
	Status       string                 `json:"status"` // running, paused, completed, failed, terminated
	Variables    map[string]interface{} `json:"variables"`
	CurrentNodes []string               `json:"current_nodes"` // 当前执行的节点ID列表
	StartedAt    time.Time              `json:"started_at"`
	CompletedAt  *time.Time             `json:"completed_at,omitempty"`
	CreatedBy    string                 `json:"created_by"`
}

// StartWorkflow 启动工作流
func (e *WorkflowEngine) StartWorkflow(ctx context.Context, definitionID string, variables map[string]interface{}, createdBy string) (*WorkflowInstance, error) {
	// 获取工作流定义
	definition, err := e.getDefinition(ctx, definitionID)
	if err != nil {
		return nil, fmt.Errorf("获取工作流定义失败: %w", err)
	}

	// 创建工作流实例
	instance := &WorkflowInstance{
		ID:           uuid.New().String(),
		DefinitionID: definitionID,
		Status:       "running",
		Variables:    variables,
		StartedAt:    time.Now(),
		CreatedBy:    createdBy,
	}

	// 保存实例到数据库
	if err := e.saveInstance(ctx, instance); err != nil {
		return nil, err
	}

	// 启动 Temporal 工作流
	workflowOptions := client.StartWorkflowOptions{
		ID:        instance.ID,
		TaskQueue: "workflow-task-queue",
	}

	we, err := e.temporalClient.ExecuteWorkflow(ctx, workflowOptions, e.executeWorkflow, definition, instance)
	if err != nil {
		return nil, fmt.Errorf("启动 Temporal 工作流失败: %w", err)
	}

	log.Infof("工作流已启动: %s, Temporal WorkflowID: %s", instance.ID, we.GetID())

	return instance, nil
}


// executeWorkflow Temporal 工作流执行函数
func (e *WorkflowEngine) executeWorkflow(ctx workflow.Context, definition *WorkflowDefinition, instance *WorkflowInstance) error {
	// 查找开始节点
	startNode := e.findNodeByType(definition, "start")
	if startNode == nil {
		return fmt.Errorf("未找到开始节点")
	}

	// 执行工作流
	return e.executeNode(ctx, definition, instance, startNode)
}

// executeNode 执行工作流节点
func (e *WorkflowEngine) executeNode(ctx workflow.Context, definition *WorkflowDefinition, instance *WorkflowInstance, node *WorkflowNode) error {
	// 记录节点执行
	e.recordNodeExecution(ctx, instance.ID, node.ID, "started")

	// 根据节点类型执行
	switch node.Type {
	case "start":
		// 开始节点，直接执行下一个节点
		return e.executeNextNodes(ctx, definition, instance, node)

	case "task":
		// 任务节点
		if err := e.executeTaskNode(ctx, instance, node); err != nil {
			e.recordNodeExecution(ctx, instance.ID, node.ID, "failed")
			return err
		}
		e.recordNodeExecution(ctx, instance.ID, node.ID, "completed")
		return e.executeNextNodes(ctx, definition, instance, node)

	case "condition":
		// 条件判断节点
		return e.executeConditionNode(ctx, definition, instance, node)

	case "parallel":
		// 并行节点
		return e.executeParallelNode(ctx, definition, instance, node)

	case "approval":
		// 审批节点
		if err := e.executeApprovalNode(ctx, instance, node); err != nil {
			e.recordNodeExecution(ctx, instance.ID, node.ID, "failed")
			return err
		}
		e.recordNodeExecution(ctx, instance.ID, node.ID, "completed")
		return e.executeNextNodes(ctx, definition, instance, node)

	case "notification":
		// 通知节点
		e.executeNotificationNode(ctx, instance, node)
		e.recordNodeExecution(ctx, instance.ID, node.ID, "completed")
		return e.executeNextNodes(ctx, definition, instance, node)

	case "end":
		// 结束节点
		e.recordNodeExecution(ctx, instance.ID, node.ID, "completed")
		return e.completeWorkflow(ctx, instance)

	default:
		return fmt.Errorf("未知的节点类型: %s", node.Type)
	}
}

// executeTaskNode 执行任务节点
func (e *WorkflowEngine) executeTaskNode(ctx workflow.Context, instance *WorkflowInstance, node *WorkflowNode) error {
	// 从配置中获取任务信息
	taskTitle := node.Config["title"].(string)
	assigneeID := node.Config["assignee_id"].(string)
	timeout := node.Config["timeout"].(int) // 超时时间（秒）

	// 创建任务
	task := &Task{
		Title:       taskTitle,
		Description: fmt.Sprintf("工作流任务: %s", instance.ID),
		AssigneeID:  assigneeID,
		Priority:    "high",
		DueDate:     time.Now().Add(time.Duration(timeout) * time.Second),
	}

	// 使用 Temporal Activity 创建任务
	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: time.Duration(timeout) * time.Second,
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	var taskID string
	err := workflow.ExecuteActivity(ctx, e.createTaskActivity, task).Get(ctx, &taskID)
	if err != nil {
		return err
	}

	// 等待任务完成
	selector := workflow.NewSelector(ctx)
	
	// 设置超时
	timer := workflow.NewTimer(ctx, time.Duration(timeout)*time.Second)
	selector.AddFuture(timer, func(f workflow.Future) {
		// 超时处理：自动升级
		e.escalateTask(ctx, taskID)
	})

	// 等待任务完成信号
	channel := workflow.GetSignalChannel(ctx, fmt.Sprintf("task-completed-%s", taskID))
	selector.AddReceive(channel, func(c workflow.ReceiveChannel, more bool) {
		var result map[string]interface{}
		c.Receive(ctx, &result)
		// 任务完成，更新工作流变量
		instance.Variables["task_result"] = result
	})

	selector.Select(ctx)

	return nil
}


// executeConditionNode 执行条件判断节点
func (e *WorkflowEngine) executeConditionNode(ctx workflow.Context, definition *WorkflowDefinition, instance *WorkflowInstance, node *WorkflowNode) error {
	// 获取所有出边
	edges := e.getOutgoingEdges(definition, node.ID)

	// 评估每条边的条件
	for _, edge := range edges {
		if e.evaluateCondition(edge.Condition, instance.Variables) {
			// 条件满足，执行目标节点
			targetNode := e.findNodeByID(definition, edge.Target)
			if targetNode != nil {
				return e.executeNode(ctx, definition, instance, targetNode)
			}
		}
	}

	return fmt.Errorf("没有满足条件的分支")
}

// executeParallelNode 执行并行节点
func (e *WorkflowEngine) executeParallelNode(ctx workflow.Context, definition *WorkflowDefinition, instance *WorkflowInstance, node *WorkflowNode) error {
	// 获取所有出边
	edges := e.getOutgoingEdges(definition, node.ID)

	// 并行执行所有分支
	var futures []workflow.Future
	for _, edge := range edges {
		targetNode := e.findNodeByID(definition, edge.Target)
		if targetNode != nil {
			// 创建子工作流
			childCtx := workflow.WithChildOptions(ctx, workflow.ChildWorkflowOptions{
				WorkflowID: fmt.Sprintf("%s-parallel-%s", instance.ID, targetNode.ID),
			})
			future := workflow.ExecuteChildWorkflow(childCtx, e.executeNode, definition, instance, targetNode)
			futures = append(futures, future)
		}
	}

	// 等待所有分支完成
	for _, future := range futures {
		if err := future.Get(ctx, nil); err != nil {
			return err
		}
	}

	return nil
}

// executeApprovalNode 执行审批节点
func (e *WorkflowEngine) executeApprovalNode(ctx workflow.Context, instance *WorkflowInstance, node *WorkflowNode) error {
	approvers := node.Config["approvers"].([]string)
	approvalType := node.Config["type"].(string) // single, all, any
	timeout := node.Config["timeout"].(int)

	// 创建审批任务
	approval := &Approval{
		WorkflowInstanceID: instance.ID,
		NodeID:             node.ID,
		Approvers:          approvers,
		Type:               approvalType,
		Status:             "pending",
		CreatedAt:          time.Now(),
	}

	// 保存审批记录
	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: time.Duration(timeout) * time.Second,
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	var approvalID string
	err := workflow.ExecuteActivity(ctx, e.createApprovalActivity, approval).Get(ctx, &approvalID)
	if err != nil {
		return err
	}

	// 等待审批结果
	selector := workflow.NewSelector(ctx)

	// 设置超时
	timer := workflow.NewTimer(ctx, time.Duration(timeout)*time.Second)
	selector.AddFuture(timer, func(f workflow.Future) {
		// 超时处理：自动拒绝或升级
		e.handleApprovalTimeout(ctx, approvalID)
	})

	// 等待审批完成信号
	channel := workflow.GetSignalChannel(ctx, fmt.Sprintf("approval-completed-%s", approvalID))
	selector.AddReceive(channel, func(c workflow.ReceiveChannel, more bool) {
		var result ApprovalResult
		c.Receive(ctx, &result)
		
		if result.Approved {
			// 审批通过
			instance.Variables["approval_result"] = "approved"
		} else {
			// 审批拒绝，终止工作流
			workflow.GetLogger(ctx).Info("审批被拒绝，终止工作流")
			e.terminateWorkflow(ctx, instance)
		}
	})

	selector.Select(ctx)

	return nil
}

// executeNotificationNode 执行通知节点
func (e *WorkflowEngine) executeNotificationNode(ctx workflow.Context, instance *WorkflowInstance, node *WorkflowNode) error {
	recipients := node.Config["recipients"].([]string)
	message := node.Config["message"].(string)
	channel := node.Config["channel"].(string) // email, slack, dingtalk

	// 发送通知
	notification := &Notification{
		Recipients: recipients,
		Message:    message,
		Channel:    channel,
	}

	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 30 * time.Second,
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	return workflow.ExecuteActivity(ctx, e.sendNotificationActivity, notification).Get(ctx, nil)
}


// PauseWorkflow 暂停工作流
func (e *WorkflowEngine) PauseWorkflow(ctx context.Context, instanceID string) error {
	// 更新实例状态
	query := `UPDATE workflow_instances SET status = 'paused', updated_at = $1 WHERE id = $2`
	_, err := e.db.ExecContext(ctx, query, time.Now(), instanceID)
	if err != nil {
		return fmt.Errorf("暂停工作流失败: %w", err)
	}

	// 发送暂停信号到 Temporal
	err = e.temporalClient.SignalWorkflow(ctx, instanceID, "", "pause", nil)
	if err != nil {
		return fmt.Errorf("发送暂停信号失败: %w", err)
	}

	return nil
}

// ResumeWorkflow 恢复工作流
func (e *WorkflowEngine) ResumeWorkflow(ctx context.Context, instanceID string) error {
	// 更新实例状态
	query := `UPDATE workflow_instances SET status = 'running', updated_at = $1 WHERE id = $2`
	_, err := e.db.ExecContext(ctx, query, time.Now(), instanceID)
	if err != nil {
		return fmt.Errorf("恢复工作流失败: %w", err)
	}

	// 发送恢复信号到 Temporal
	err = e.temporalClient.SignalWorkflow(ctx, instanceID, "", "resume", nil)
	if err != nil {
		return fmt.Errorf("发送恢复信号失败: %w", err)
	}

	return nil
}

// TerminateWorkflow 终止工作流
func (e *WorkflowEngine) TerminateWorkflow(ctx context.Context, instanceID, reason string) error {
	// 更新实例状态
	query := `UPDATE workflow_instances SET status = 'terminated', completed_at = $1, updated_at = $1 WHERE id = $2`
	_, err := e.db.ExecContext(ctx, query, time.Now(), instanceID)
	if err != nil {
		return fmt.Errorf("终止工作流失败: %w", err)
	}

	// 终止 Temporal 工作流
	err = e.temporalClient.TerminateWorkflow(ctx, instanceID, "", reason)
	if err != nil {
		return fmt.Errorf("终止 Temporal 工作流失败: %w", err)
	}

	return nil
}

// GetWorkflowStatus 获取工作流状态
func (e *WorkflowEngine) GetWorkflowStatus(ctx context.Context, instanceID string) (*WorkflowStatus, error) {
	// 从数据库获取实例
	instance, err := e.getInstance(ctx, instanceID)
	if err != nil {
		return nil, err
	}

	// 获取执行历史
	history, err := e.getExecutionHistory(ctx, instanceID)
	if err != nil {
		return nil, err
	}

	// 计算进度
	totalNodes := len(history)
	completedNodes := 0
	for _, h := range history {
		if h.Status == "completed" {
			completedNodes++
		}
	}

	progress := 0.0
	if totalNodes > 0 {
		progress = float64(completedNodes) / float64(totalNodes) * 100
	}

	status := &WorkflowStatus{
		InstanceID:     instanceID,
		Status:         instance.Status,
		Progress:       progress,
		CurrentNodes:   instance.CurrentNodes,
		ExecutionHistory: history,
		StartedAt:      instance.StartedAt,
		CompletedAt:    instance.CompletedAt,
	}

	return status, nil
}

// 辅助方法
func (e *WorkflowEngine) evaluateCondition(condition string, variables map[string]interface{}) bool {
	// 使用表达式引擎评估条件
	// 这里简化处理，实际应使用 govaluate 或类似库
	// 示例: "priority == 'high' && status == 'error'"
	
	// TODO: 实现完整的表达式评估
	return true
}

func (e *WorkflowEngine) findNodeByType(definition *WorkflowDefinition, nodeType string) *WorkflowNode {
	for _, node := range definition.Nodes {
		if node.Type == nodeType {
			return &node
		}
	}
	return nil
}

func (e *WorkflowEngine) findNodeByID(definition *WorkflowDefinition, nodeID string) *WorkflowNode {
	for _, node := range definition.Nodes {
		if node.ID == nodeID {
			return &node
		}
	}
	return nil
}

func (e *WorkflowEngine) getOutgoingEdges(definition *WorkflowDefinition, nodeID string) []WorkflowEdge {
	edges := []WorkflowEdge{}
	for _, edge := range definition.Edges {
		if edge.Source == nodeID {
			edges = append(edges, edge)
		}
	}
	return edges
}

func (e *WorkflowEngine) executeNextNodes(ctx workflow.Context, definition *WorkflowDefinition, instance *WorkflowInstance, currentNode *WorkflowNode) error {
	edges := e.getOutgoingEdges(definition, currentNode.ID)
	
	for _, edge := range edges {
		targetNode := e.findNodeByID(definition, edge.Target)
		if targetNode != nil {
			if err := e.executeNode(ctx, definition, instance, targetNode); err != nil {
				return err
			}
		}
	}
	
	return nil
}
```



**关键实现点**:

1. 使用 Temporal 工作流引擎实现工作流编排，支持长时间运行、状态持久化、故障恢复
2. 工作流定义支持多种节点类型（任务、条件、并行、审批、通知），满足复杂业务场景
3. 条件判断节点支持表达式评估，实现动态路由和分支选择
4. 并行节点使用 Temporal 子工作流实现，支持多分支并发执行
5. 审批节点支持多种审批模式（单人、会签、或签），并设置超时自动处理
6. 工作流执行历史完整记录每个节点的执行状态，便于监控和审计
7. 支持工作流暂停、恢复、终止操作，提供灵活的流程控制能力



**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| workflow_enabled | bool | true | 是否启用工作流引擎 |
| max_concurrent_workflows | int | 100 | 最大并发工作流数 |
| default_task_timeout | int | 3600 | 默认任务超时时间（秒） |
| default_approval_timeout | int | 86400 | 默认审批超时时间（秒） |
| workflow_history_retention_days | int | 90 | 工作流历史保留天数 |
| enable_workflow_templates | bool | true | 是否启用工作流模板 |
| notification_channels | array | ["email","slack","dingtalk"] | 支持的通知渠道 |
| max_parallel_branches | int | 10 | 最大并行分支数 |
| workflow_execution_timeout | int | 604800 | 工作流执行超时时间（秒，默认7天） |
| enable_auto_escalation | bool | true | 是否启用自动升级 |
| escalation_delay_seconds | int | 7200 | 升级延迟时间（秒，默认2小时） |

**热更新机制**:

- 更新方式: PostgreSQL 配置表 + Redis 发布订阅
- 生效时间: 配置变更后 5 秒内生效（对新启动的工作流生效）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志并发送告警

**热更新验收标准**:

1. THE System SHALL 在配置变更后 5 秒内应用新的工作流配置
2. WHEN 超时时间配置变更时，THE System SHALL 对新启动的工作流生效，不影响运行中的工作流
3. THE System SHALL 支持通过 API 查询当前生效的工作流配置
4. THE System SHALL 记录所有工作流配置变更的审计日志
5. WHEN 工作流引擎禁用时，THE System SHALL 停止接受新的工作流启动请求，但保持运行中的工作流继续执行
6. WHEN 通知渠道配置变更时，THE System SHALL 验证渠道的可用性后再应用配置

---



### 14.5 API 接口汇总

模块十四提供以下 API 接口：

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-14-470 | 创建任务 | Task | POST | /api/v1/tasks | task.write | Body: task_data | {code:0,data:{id:"task-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-14-471 | 查询任务列表 | Task | GET | /api/v1/tasks | task.read | Query: page, size, status | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | - | 支持分页 |
| API-14-472 | 获取任务详情 | Task | GET | /api/v1/tasks/{id} | task.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-14-473 | 更新任务 | Task | PUT | /api/v1/tasks/{id} | task.write | Body: task_data | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-474 | 删除任务 | Task | DELETE | /api/v1/tasks/{id} | task.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-475 | 分配任务 | Task | PUT | /api/v1/tasks/{id}/assign | task.write | Body: {assignee_id} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-476 | 更新任务状态 | Task | PUT | /api/v1/tasks/{id}/status | task.write | Body: {status} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-477 | 获取任务历史 | Task | GET | /api/v1/tasks/{id}/history | task.read | 无 | {code:0,data:[...]} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-478 | 添加评论 | Task | POST | /api/v1/tasks/{id}/comments | task.write | Body: {content} | {code:0,data:{id:"comment-1"}} | 200/400/401/403/404/500 | v1 | 否 | 否 | - | - |
| API-14-479 | 获取评论列表 | Task | GET | /api/v1/tasks/{id}/comments | task.read | 无 | {code:0,data:[...]} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-480 | 更新评论 | Task | PUT | /api/v1/comments/{id} | task.write | Body: {content} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-481 | 删除评论 | Task | DELETE | /api/v1/comments/{id} | task.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-482 | 获取任务模板列表 | Task | GET | /api/v1/task-templates | task.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-14-483 | 获取任务模板详情 | Task | GET | /api/v1/task-templates/{id} | task.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-14-484 | 从模板创建任务 | Task | POST | /api/v1/tasks/from-template | task.write | Body: {template_id} | {code:0,data:{id:"task-2"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-14-485 | 获取在线用户列表 | Presence | GET | /api/v1/presence/online-users | presence.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-14-486 | 更新在线状态 | Presence | PUT | /api/v1/presence/status | presence.write | Body: {status} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-14-487 | 创建工作流定义 | Workflow | POST | /api/v1/workflows | workflow.write | Body: workflow_definition | {code:0,data:{id:"wf-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-14-488 | 获取工作流列表 | Workflow | GET | /api/v1/workflows | workflow.read | Query: page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 是 | - | 支持分页 |
| API-14-489 | 获取工作流详情 | Workflow | GET | /api/v1/workflows/{id} | workflow.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-14-490 | 更新工作流定义 | Workflow | PUT | /api/v1/workflows/{id} | workflow.write | Body: workflow_definition | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-491 | 删除工作流定义 | Workflow | DELETE | /api/v1/workflows/{id} | workflow.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-492 | 启动工作流实例 | Workflow | POST | /api/v1/workflow-instances | workflow.write | Body: {workflow_id,params} | {code:0,data:{instance_id:"..."}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-14-493 | 获取工作流实例列表 | Workflow | GET | /api/v1/workflow-instances | workflow.read | Query: page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | - | 支持分页 |
| API-14-494 | 获取工作流实例详情 | Workflow | GET | /api/v1/workflow-instances/{id} | workflow.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-495 | 暂停工作流 | Workflow | PUT | /api/v1/workflow-instances/{id}/pause | workflow.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-496 | 恢复工作流 | Workflow | PUT | /api/v1/workflow-instances/{id}/resume | workflow.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-497 | 终止工作流 | Workflow | PUT | /api/v1/workflow-instances/{id}/terminate | workflow.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-498 | 获取工作流状态 | Workflow | GET | /api/v1/workflow-instances/{id}/status | workflow.read | 无 | {code:0,data:{status:"running"}} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-499 | 获取工作流执行历史 | Workflow | GET | /api/v1/workflow-instances/{id}/history | workflow.read | 无 | {code:0,data:[...]} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-500 | 审批通过 | Approval | POST | /api/v1/approvals/{id}/approve | approval.write | Body: {comment} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-501 | 审批拒绝 | Approval | POST | /api/v1/approvals/{id}/reject | approval.write | Body: {comment} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-502 | 获取待审批列表 | Approval | GET | /api/v1/approvals/pending | approval.read | Query: page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | - | 支持分页 |

**接口分类说明**:

1. **任务管理接口** (API-14-01 ~ API-14-08): 提供任务的 CRUD 操作、分配、状态管理和历史查询
2. **评论协作接口** (API-14-09 ~ API-14-12): 支持任务评论、讨论和协作
3. **任务模板接口** (API-14-13 ~ API-14-15): 提供任务模板管理和快速创建
4. **在线状态接口** (API-14-16 ~ API-14-17): 管理用户在线状态和实时协作
5. **工作流定义接口** (API-14-18 ~ API-14-22): 管理工作流定义的 CRUD 操作
6. **工作流实例接口** (API-14-23 ~ API-14-30): 管理工作流实例的生命周期和状态
7. **审批管理接口** (API-14-31 ~ API-14-33): 处理工作流中的审批节点

**接口认证**:
- 所有接口均需要 JWT 令牌认证
- 使用 Bearer Token 方式传递令牌
- 令牌有效期：15 分钟（可配置）
- 支持令牌刷新机制

**接口限流**:
- 默认限流：100 请求/分钟/用户
- 批量操作接口：10 请求/分钟/用户
- 查询接口：200 请求/分钟/用户
- 使用 Redis 令牌桶算法实现

**接口版本管理**:
- 当前版本：v1
- 版本策略：URL 路径版本控制
- 向后兼容：至少支持 2 个主版本
- 废弃通知：提前 6 个月通知

---



