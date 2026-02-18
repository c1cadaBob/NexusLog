# 模块十四：协作与任务管理 - 技术设计文档

> **文档版本**: v1.0  
> **作者**: 系统架构团队  
> **更新日期**: 2026-01-31  
> **状态**: 已发布  
> **相关需求**: [requirements-module14.md](../requirements/requirements-module14.md)

---

## 1. 文档信息

### 1.1 版本历史
| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| v1.0 | 2026-01-31 | 系统架构团队 | 初稿，完整设计方案 |

### 1.2 文档状态

- **当前状态**: 已发布
- **评审状态**: 已通过
- **实施阶段**: MVP (需求49), Phase 2 (需求50)

### 1.3 相关文档
- [需求文档](../requirements/requirements-module14.md)
- [API设计文档](./api-design.md)
- [项目总体设计](./project-design-overview.md)

---

## 2. 总体架构

### 2.1 系统架构图
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

### 2.2 模块划分
| 子模块 | 职责 | 核心功能 |
|--------|------|----------|
| 任务管理器 | 任务生命周期管理 | 创建、分配、状态跟踪、优先级管理、搜索过滤 |
| 协作引擎 | 实时协作能力 | 在线状态、评论讨论、@提及、消息推送、附件管理 |
| 工作流引擎 | 工作流编排与自动化 | 流程定义、节点执行、状态机、审批流程、超时处理 |
| 任务存储层 | 数据持久化与缓存 | PostgreSQL存储、Redis缓存、Elasticsearch索引 |
| 实时通信层 | 实时消息推送 | WebSocket连接、Socket.io、消息队列、在线状态同步 |
| 工作流存储 | 工作流状态管理 | Temporal状态持久化、事件日志、执行历史 |
| 通知集成层 | 多渠道通知 | 邮件、Slack、钉钉、任务提醒、日历同步 |

### 2.3 关键路径

**任务管理关键路径**:
```
任务创建 → PostgreSQL持久化(50ms) → Redis缓存(10ms) 
  → Elasticsearch索引(100ms) → WebSocket推送(50ms) 
  → 通知发送(200ms)

总延迟: < 500ms (P95)
```

**工作流执行关键路径**:
```
工作流启动 → Temporal工作流创建(100ms) → 节点执行(变量) 
  → 状态更新(50ms) → 事件记录(30ms) → 通知推送(200ms)

启动延迟: < 2秒 (验收标准)
```

---

## 3. 技术选型

### 3.1 核心技术栈
| 技术 | 版本 | 选择理由 |
|------|------|----------|
| WebSocket + Socket.io | 4.6+ | 实时双向通信、自动重连、房间管理、跨浏览器兼容 |
| PostgreSQL | 15+ | 任务数据持久化、ACID事务、JSON字段支持、全文搜索 |
| Redis | 7.2+ | 在线状态缓存、任务缓存、Pub/Sub消息推送、会话管理 |
| Temporal | 1.22+ | 工作流编排、状态持久化、故障恢复、长时间运行支持 |
| Kafka | 3.6+ | 任务事件流、异步处理、事件溯源、高吞吐量 |
| Elasticsearch | 8.11+ | 任务全文搜索、历史记录查询、聚合分析 |
| MinIO | RELEASE.2024+ | 附件存储、S3兼容、分布式存储、高可用 |
| Casbin | 2.82+ | 权限控制、RBAC/ABAC、动态策略、高性能 |
| React | 18+ | 前端UI、组件化、虚拟DOM、生态丰富 |
| Zustand | 4.5+ | 状态管理、轻量级、TypeScript支持、简单易用 |
| Yjs | 13+ | 协同编辑、CRDT算法、冲突解决、离线支持 |

### 3.2 工作流引擎选型对比

| 特性 | Temporal | Cadence | Airflow |
|------|----------|---------|---------|
| 语言支持 | Go/Java/Python/TS | Go/Java | Python |
| 状态持久化 | ✅ 自动 | ✅ 自动 | ❌ 手动 |
| 故障恢复 | ✅ 自动 | ✅ 自动 | ⚠️ 有限 |
| 长时间运行 | ✅ 支持 | ✅ 支持 | ❌ 不适合 |
| 可视化编辑 | ⚠️ 第三方 | ⚠️ 第三方 | ✅ 内置 |
| 学习曲线 | 中等 | 中等 | 较低 |
| 社区活跃度 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 企业支持 | ✅ 商业版 | ✅ Uber | ✅ Apache |

**选择 Temporal 的理由**:
1. 原生支持长时间运行的工作流（适合审批、任务等场景）
2. 自动状态持久化和故障恢复，无需手动管理
3. 强类型工作流定义，减少运行时错误
4. 活跃的社区和完善的文档
5. 支持多语言SDK，便于团队协作

### 3.3 实时通信技术选型

| 特性 | WebSocket + Socket.io | Server-Sent Events | Long Polling |
|------|----------------------|-------------------|--------------|
| 双向通信 | ✅ | ❌ 单向 | ⚠️ 模拟 |
| 实时性 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| 浏览器兼容 | ✅ 优秀 | ✅ 优秀 | ✅ 优秀 |
| 自动重连 | ✅ Socket.io | ⚠️ 手动 | ⚠️ 手动 |
| 房间管理 | ✅ Socket.io | ❌ | ❌ |
| 负载均衡 | ✅ Redis适配器 | ✅ | ✅ |
| 资源占用 | 中等 | 低 | 高 |

**选择 WebSocket + Socket.io 的理由**:
1. 双向实时通信，适合协作场景
2. Socket.io提供自动重连、心跳检测
3. 房间管理功能适合任务协作
4. Redis适配器支持多实例负载均衡
5. 降级策略（自动切换到Long Polling）

---

## 4. 关键流程设计

### 4.1 任务管理主流程

**任务创建流程**:

```
1. 用户提交任务创建请求
2. 验证任务数据（标题、描述、优先级等）
3. 生成任务ID（UUID）
4. 保存到PostgreSQL（事务）
5. 写入Redis缓存（TTL: 1小时）
6. 索引到Elasticsearch（异步）
7. 发送WebSocket通知给负责人
8. 发送邮件/Slack/钉钉通知（异步）
9. 记录操作历史
10. 返回任务ID
```

**任务状态流转**:

```
状态机:
pending (待处理)
  ├─→ in_progress (进行中)
  │     ├─→ completed (已完成)
  │     │     └─→ closed (已关闭)
  │     ├─→ pending (重新打开)
  │     └─→ closed (直接关闭)
  └─→ closed (取消)

状态转换规则:
- pending → in_progress: 任务被接受
- in_progress → completed: 任务完成
- completed → closed: 确认完成
- in_progress → pending: 需要更多信息
- * → closed: 任务取消或无效
```

**时序图**:

```
用户    API    TaskManager    PostgreSQL    Redis    ES    WebSocket    Notifier
 │       │          │              │          │      │        │           │
 │─创建任务→│          │              │          │      │        │           │
 │       │─验证数据→│              │          │      │        │           │
 │       │          │─保存任务────→│          │      │        │           │
 │       │          │              │←确认─────│      │        │           │
 │       │          │─缓存任务─────────────→│      │        │           │
 │       │          │─索引任务──────────────────→│        │           │
 │       │          │─推送通知────────────────────────→│           │
 │       │          │─发送通知───────────────────────────────────→│
 │       │          │              │          │      │        │           │
 │       │←返回ID───│              │          │      │        │           │
 │←成功──│          │              │          │      │        │           │
```

### 4.2 实时协作流程

**在线状态同步流程**:

```
1. 用户建立WebSocket连接
2. 服务器记录连接（userID → connection）
3. 更新Redis在线状态（TTL: 5分钟）
4. 广播在线状态变更给其他用户
5. 启动心跳检测（每30秒）
6. 用户活动时更新last_active_at
7. 连接断开时清理状态
8. 广播离线状态
```

**评论协作流程**:

```
1. 用户提交评论
2. 解析@提及的用户
3. 保存评论到PostgreSQL
4. 发送WebSocket通知给任务参与者
5. 发送@提及通知给被提及用户
6. 更新任务的最后活动时间
7. 记录评论历史
```

### 4.3 工作流执行流程

**工作流启动流程**:

```
1. 用户触发工作流（手动或自动）
2. 获取工作流定义
3. 创建工作流实例
4. 保存实例到PostgreSQL
5. 启动Temporal工作流
6. 查找开始节点
7. 执行节点逻辑
8. 根据边的条件选择下一个节点
9. 继续执行直到结束节点
10. 更新实例状态为completed
```

**工作流节点执行**:

```
节点类型执行逻辑:

1. 任务节点:
   - 创建任务
   - 等待任务完成信号（或超时）
   - 超时后自动升级
   - 继续执行下一个节点

2. 条件节点:
   - 评估所有出边的条件表达式
   - 选择第一个满足条件的分支
   - 执行目标节点

3. 并行节点:
   - 创建多个子工作流
   - 并行执行所有分支
   - 等待所有分支完成
   - 合并结果

4. 审批节点:
   - 创建审批任务
   - 等待审批结果信号（或超时）
   - 审批通过：继续执行
   - 审批拒绝：终止工作流
   - 超时：自动拒绝或升级

5. 通知节点:
   - 发送通知（邮件/Slack/钉钉）
   - 立即继续执行（不等待）
```

**工作流状态机**:

```
工作流实例状态:
running (运行中)
  ├─→ paused (已暂停)
  │     └─→ running (恢复运行)
  ├─→ completed (已完成)
  ├─→ failed (失败)
  └─→ terminated (已终止)

状态转换:
- 启动 → running
- 暂停操作 → paused
- 恢复操作 → running
- 正常结束 → completed
- 异常/错误 → failed
- 手动终止 → terminated
```

### 4.4 异常流程

| 异常类型 | 处理策略 | 恢复机制 |
|----------|----------|----------|
| WebSocket断开 | 客户端自动重连 | 指数退避（1s→30s） |
| PostgreSQL不可用 | 返回503错误 | 健康检查自动恢复 |
| Redis不可用 | 降级到数据库查询 | 缓存预热 |
| Elasticsearch不可用 | 降级到数据库搜索 | 异步重建索引 |
| Temporal不可用 | 工作流启动失败 | 重试队列 |
| 任务超时 | 自动升级或通知 | 人工介入 |
| 审批超时 | 自动拒绝或升级 | 配置策略 |
| 通知发送失败 | 重试3次 | 记录失败日志 |

### 4.5 配置热更新流程

```
1. 用户在Web Console修改任务/工作流配置
2. 配置保存到PostgreSQL（版本化）
3. 配置同步到Redis
4. Redis发布Pub/Sub通知（config:module14:reload）
5. TaskManager/WorkflowEngine订阅通知
6. 加载新配置并验证
7. 使用atomic.Value原子更新配置
8. 记录配置变更审计日志
9. 发送配置更新成功通知
```

**配置验证规则**:
- 超时时间必须 > 0
- 最大任务数必须 > 0
- 通知渠道必须在支持列表中
- 缓存TTL必须 > 0
- 历史保留天数必须 > 0

---

## 5. 接口设计

### 5.1 API列表

详见 [API设计文档](./api-design.md) 模块14部分，共33个接口:

**任务管理接口** (API-14-470 ~ API-14-477):
- POST /api/v1/tasks - 创建任务
- GET /api/v1/tasks - 查询任务列表（支持分页、过滤）
- GET /api/v1/tasks/{id} - 获取任务详情
- PUT /api/v1/tasks/{id} - 更新任务
- DELETE /api/v1/tasks/{id} - 删除任务
- PUT /api/v1/tasks/{id}/assign - 分配任务
- PUT /api/v1/tasks/{id}/status - 更新任务状态
- GET /api/v1/tasks/{id}/history - 获取任务历史

**评论协作接口** (API-14-478 ~ API-14-481):
- POST /api/v1/tasks/{id}/comments - 添加评论
- GET /api/v1/tasks/{id}/comments - 获取评论列表
- PUT /api/v1/comments/{id} - 更新评论
- DELETE /api/v1/comments/{id} - 删除评论

**任务模板接口** (API-14-482 ~ API-14-484):
- GET /api/v1/task-templates - 获取任务模板列表
- GET /api/v1/task-templates/{id} - 获取任务模板详情
- POST /api/v1/tasks/from-template - 从模板创建任务

**在线状态接口** (API-14-485 ~ API-14-486):
- GET /api/v1/presence/online-users - 获取在线用户列表
- PUT /api/v1/presence/status - 更新在线状态

**工作流定义接口** (API-14-487 ~ API-14-491):
- POST /api/v1/workflows - 创建工作流定义
- GET /api/v1/workflows - 获取工作流列表
- GET /api/v1/workflows/{id} - 获取工作流详情
- PUT /api/v1/workflows/{id} - 更新工作流定义
- DELETE /api/v1/workflows/{id} - 删除工作流定义

**工作流实例接口** (API-14-492 ~ API-14-499):
- POST /api/v1/workflow-instances - 启动工作流实例
- GET /api/v1/workflow-instances - 获取工作流实例列表
- GET /api/v1/workflow-instances/{id} - 获取工作流实例详情
- PUT /api/v1/workflow-instances/{id}/pause - 暂停工作流
- PUT /api/v1/workflow-instances/{id}/resume - 恢复工作流
- PUT /api/v1/workflow-instances/{id}/terminate - 终止工作流
- GET /api/v1/workflow-instances/{id}/status - 获取工作流状态
- GET /api/v1/workflow-instances/{id}/history - 获取工作流执行历史

**审批管理接口** (API-14-500 ~ API-14-502):
- POST /api/v1/approvals/{id}/approve - 审批通过
- POST /api/v1/approvals/{id}/reject - 审批拒绝
- GET /api/v1/approvals/pending - 获取待审批列表

### 5.2 WebSocket接口

**连接建立**:
```javascript
// 客户端连接
const socket = io('wss://api.example.com', {
  auth: {
    token: 'jwt_token'
  }
});
```

**事件订阅**:

| 事件名称 | 方向 | 数据格式 | 说明 |
|---------|------|---------|------|
| task:created | Server→Client | {task_id, title, assignee_id} | 任务创建通知 |
| task:assigned | Server→Client | {task_id, assignee_id, assigner_id} | 任务分配通知 |
| task:status_changed | Server→Client | {task_id, old_status, new_status} | 状态变更通知 |
| comment:added | Server→Client | {task_id, comment_id, user_id, content} | 新评论通知 |
| mention:received | Server→Client | {task_id, comment_id, mentioned_by} | @提及通知 |
| presence:changed | Server→Client | {user_id, status, last_active_at} | 在线状态变更 |
| workflow:started | Server→Client | {instance_id, workflow_id} | 工作流启动通知 |
| workflow:completed | Server→Client | {instance_id, status} | 工作流完成通知 |
| approval:requested | Server→Client | {approval_id, workflow_instance_id} | 审批请求通知 |
| heartbeat | Client→Server | {timestamp} | 心跳检测 |
| join:task | Client→Server | {task_id} | 加入任务房间 |
| leave:task | Client→Server | {task_id} | 离开任务房间 |

### 5.3 内部接口

**任务管理器接口**:

```go
type TaskManager interface {
    // 创建任务
    CreateTask(ctx context.Context, task *Task) error
    
    // 分配任务
    AssignTask(ctx context.Context, taskID, assigneeID, operatorID string) error
    
    // 更新任务状态
    UpdateTaskStatus(ctx context.Context, taskID, status, operatorID string) error
    
    // 添加评论
    AddComment(ctx context.Context, comment *Comment) error
    
    // 搜索任务
    SearchTasks(ctx context.Context, filter *TaskFilter) ([]*Task, int, error)
    
    // 从模板创建任务
    CreateFromTemplate(ctx context.Context, templateID, creatorID string, overrides map[string]interface{}) (*Task, error)
}
```

**工作流引擎接口**:

```go
type WorkflowEngine interface {
    // 启动工作流
    StartWorkflow(ctx context.Context, definitionID string, variables map[string]interface{}, createdBy string) (*WorkflowInstance, error)
    
    // 暂停工作流
    PauseWorkflow(ctx context.Context, instanceID string) error
    
    // 恢复工作流
    ResumeWorkflow(ctx context.Context, instanceID string) error
    
    // 终止工作流
    TerminateWorkflow(ctx context.Context, instanceID, reason string) error
    
    // 获取工作流状态
    GetWorkflowStatus(ctx context.Context, instanceID string) (*WorkflowStatus, error)
}
```

**在线状态管理器接口**:

```go
type PresenceManager interface {
    // 更新在线状态
    UpdatePresence(ctx context.Context, userID, status string) error
    
    // 获取在线用户列表
    GetOnlineUsers(ctx context.Context) ([]*UserPresence, error)
    
    // 广播状态变更
    BroadcastPresenceChange(presence *UserPresence)
}
```

---

## 6. 数据设计

### 6.1 数据模型

**任务模型**:

```go
type Task struct {
    ID          string                 `json:"id" db:"id"`
    Title       string                 `json:"title" db:"title"`
    Description string                 `json:"description" db:"description"`
    Status      string                 `json:"status" db:"status"` // pending, in_progress, completed, closed
    Priority    string                 `json:"priority" db:"priority"` // urgent, high, medium, low
    AssigneeID  string                 `json:"assignee_id" db:"assignee_id"`
    CreatorID   string                 `json:"creator_id" db:"creator_id"`
    DueDate     time.Time              `json:"due_date" db:"due_date"`
    Tags        []string               `json:"tags" db:"tags"`
    RelatedLogs []string               `json:"related_logs" db:"related_logs"` // 关联的日志ID
    Metadata    map[string]interface{} `json:"metadata" db:"metadata"` // 自定义字段
    CreatedAt   time.Time              `json:"created_at" db:"created_at"`
    UpdatedAt   time.Time              `json:"updated_at" db:"updated_at"`
}
```

**评论模型**:

```go
type Comment struct {
    ID          string    `json:"id" db:"id"`
    TaskID      string    `json:"task_id" db:"task_id"`
    UserID      string    `json:"user_id" db:"user_id"`
    Content     string    `json:"content" db:"content"` // Markdown格式
    Mentions    []string  `json:"mentions" db:"mentions"` // @提及的用户ID
    Attachments []string  `json:"attachments" db:"attachments"` // 附件URL
    CreatedAt   time.Time `json:"created_at" db:"created_at"`
    UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}
```

**工作流定义模型**:

```go
type WorkflowDefinition struct {
    ID          string                 `json:"id" db:"id"`
    Name        string                 `json:"name" db:"name"`
    Description string                 `json:"description" db:"description"`
    Version     int                    `json:"version" db:"version"`
    Nodes       []WorkflowNode         `json:"nodes" db:"nodes"` // JSONB
    Edges       []WorkflowEdge         `json:"edges" db:"edges"` // JSONB
    Variables   map[string]interface{} `json:"variables" db:"variables"` // JSONB
    CreatedAt   time.Time              `json:"created_at" db:"created_at"`
    UpdatedAt   time.Time              `json:"updated_at" db:"updated_at"`
}

type WorkflowNode struct {
    ID       string                 `json:"id"`
    Type     string                 `json:"type"` // start, end, task, condition, parallel, approval, notification
    Name     string                 `json:"name"`
    Config   map[string]interface{} `json:"config"`
    Position Position               `json:"position"` // 可视化位置
}

type WorkflowEdge struct {
    ID        string                 `json:"id"`
    Source    string                 `json:"source"`
    Target    string                 `json:"target"`
    Condition string                 `json:"condition"` // 条件表达式
    Config    map[string]interface{} `json:"config"`
}
```

**工作流实例模型**:

```go
type WorkflowInstance struct {
    ID           string                 `json:"id" db:"id"`
    DefinitionID string                 `json:"definition_id" db:"definition_id"`
    Status       string                 `json:"status" db:"status"` // running, paused, completed, failed, terminated
    Variables    map[string]interface{} `json:"variables" db:"variables"` // JSONB
    CurrentNodes []string               `json:"current_nodes" db:"current_nodes"` // 当前执行的节点ID列表
    StartedAt    time.Time              `json:"started_at" db:"started_at"`
    CompletedAt  *time.Time             `json:"completed_at,omitempty" db:"completed_at"`
    CreatedBy    string                 `json:"created_by" db:"created_by"`
}
```

### 6.2 数据库设计

**任务表 (tasks)**:

```sql
CREATE TABLE tasks (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    assignee_id VARCHAR(36),
    creator_id VARCHAR(36) NOT NULL,
    due_date TIMESTAMP,
    tags TEXT[], -- PostgreSQL数组
    related_logs TEXT[],
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_status (status),
    INDEX idx_priority (priority),
    INDEX idx_assignee (assignee_id),
    INDEX idx_creator (creator_id),
    INDEX idx_due_date (due_date),
    INDEX idx_created_at (created_at),
    INDEX idx_tags USING GIN (tags), -- GIN索引支持数组查询
    FOREIGN KEY (assignee_id) REFERENCES users(id),
    FOREIGN KEY (creator_id) REFERENCES users(id)
);
```

**评论表 (task_comments)**:

```sql
CREATE TABLE task_comments (
    id VARCHAR(36) PRIMARY KEY,
    task_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    content TEXT NOT NULL,
    mentions TEXT[],
    attachments TEXT[],
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_task_id (task_id),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**任务历史表 (task_history)**:

```sql
CREATE TABLE task_history (
    id BIGSERIAL PRIMARY KEY,
    task_id VARCHAR(36) NOT NULL,
    action VARCHAR(50) NOT NULL, -- created, assigned, status_changed, commented, etc.
    operator_id VARCHAR(36) NOT NULL,
    changes JSONB, -- 变更内容
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_task_id (task_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (operator_id) REFERENCES users(id)
);
```

**工作流定义表 (workflow_definitions)**:

```sql
CREATE TABLE workflow_definitions (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version INT NOT NULL DEFAULT 1,
    nodes JSONB NOT NULL, -- 节点定义
    edges JSONB NOT NULL, -- 边定义
    variables JSONB, -- 变量定义
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_name (name),
    INDEX idx_version (version),
    UNIQUE (name, version)
);
```

**工作流实例表 (workflow_instances)**:

```sql
CREATE TABLE workflow_instances (
    id VARCHAR(36) PRIMARY KEY,
    definition_id VARCHAR(36) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'running',
    variables JSONB,
    current_nodes TEXT[],
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    created_by VARCHAR(36) NOT NULL,
    
    INDEX idx_definition_id (definition_id),
    INDEX idx_status (status),
    INDEX idx_started_at (started_at),
    INDEX idx_created_by (created_by),
    FOREIGN KEY (definition_id) REFERENCES workflow_definitions(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);
```

**工作流执行历史表 (workflow_execution_history)**:

```sql
CREATE TABLE workflow_execution_history (
    id BIGSERIAL PRIMARY KEY,
    instance_id VARCHAR(36) NOT NULL,
    node_id VARCHAR(36) NOT NULL,
    node_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL, -- started, completed, failed
    input JSONB,
    output JSONB,
    error TEXT,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    
    INDEX idx_instance_id (instance_id),
    INDEX idx_node_id (node_id),
    INDEX idx_status (status),
    INDEX idx_started_at (started_at),
    FOREIGN KEY (instance_id) REFERENCES workflow_instances(id) ON DELETE CASCADE
);
```

**审批表 (approvals)**:

```sql
CREATE TABLE approvals (
    id VARCHAR(36) PRIMARY KEY,
    workflow_instance_id VARCHAR(36) NOT NULL,
    node_id VARCHAR(36) NOT NULL,
    approvers TEXT[] NOT NULL, -- 审批人ID列表
    type VARCHAR(20) NOT NULL, -- single, all, any
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    approved_by TEXT[], -- 已审批的用户ID
    rejected_by TEXT[], -- 已拒绝的用户ID
    comments JSONB, -- 审批意见
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    
    INDEX idx_workflow_instance_id (workflow_instance_id),
    INDEX idx_status (status),
    INDEX idx_approvers USING GIN (approvers),
    FOREIGN KEY (workflow_instance_id) REFERENCES workflow_instances(id) ON DELETE CASCADE
);
```

### 6.3 缓存设计

**任务缓存**:
- Key格式: `task:{task_id}`
- 数据: Task JSON
- TTL: 1小时
- 更新策略: Write-Through（写入时同步更新缓存）

**在线状态缓存**:
- Key格式: `presence:{user_id}`
- 数据: UserPresence JSON
- TTL: 5分钟（自动过期表示离线）
- 更新策略: 用户活动时更新

**任务列表缓存**:
- Key格式: `tasks:list:{filter_hash}`
- 数据: Task ID列表
- TTL: 5分钟
- 更新策略: Cache-Aside（查询时缓存，更新时失效）

**工作流定义缓存**:
- Key格式: `workflow:definition:{workflow_id}`
- 数据: WorkflowDefinition JSON
- TTL: 永久（手动失效）
- 更新策略: Write-Through

**配置缓存**:
- Key格式: `config:module14:{component}`
- 数据: 配置JSON
- TTL: 永久（Pub/Sub更新）
- 更新策略: Pub/Sub通知

### 6.4 Elasticsearch索引设计

**任务索引 (tasks)**:

```json
{
  "mappings": {
    "properties": {
      "id": {"type": "keyword"},
      "title": {"type": "text", "analyzer": "ik_max_word"},
      "description": {"type": "text", "analyzer": "ik_max_word"},
      "status": {"type": "keyword"},
      "priority": {"type": "keyword"},
      "assignee_id": {"type": "keyword"},
      "creator_id": {"type": "keyword"},
      "due_date": {"type": "date"},
      "tags": {"type": "keyword"},
      "related_logs": {"type": "keyword"},
      "created_at": {"type": "date"},
      "updated_at": {"type": "date"}
    }
  },
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1,
    "refresh_interval": "5s"
  }
}
```

**工作流实例索引 (workflow_instances)**:

```json
{
  "mappings": {
    "properties": {
      "id": {"type": "keyword"},
      "definition_id": {"type": "keyword"},
      "status": {"type": "keyword"},
      "started_at": {"type": "date"},
      "completed_at": {"type": "date"},
      "created_by": {"type": "keyword"},
      "variables": {"type": "object", "enabled": false}
    }
  }
}
```

---

## 7. 安全设计

### 7.1 认证与授权

**JWT认证**:
- 令牌有效期: 15分钟（可配置）
- 刷新令牌有效期: 7天
- 令牌包含信息: user_id, roles, permissions
- WebSocket连接需要在握手时提供JWT令牌

**权限控制（基于Casbin）**:

```ini
# 权限策略定义
[policy_definition]
p = sub, obj, act

[role_definition]
g = _, _

[matchers]
m = g(r.sub, p.sub) && r.obj == p.obj && r.act == p.act

# 权限规则示例
p, admin, task, *
p, manager, task, read
p, manager, task, write
p, manager, workflow, *
p, user, task, read
p, user, comment, write

# 角色继承
g, alice, admin
g, bob, manager
g, charlie, user
```

**任务权限控制**:
- 任务创建者拥有所有权限
- 任务负责人可以更新状态、添加评论
- 其他用户只能查看（如果有权限）
- 支持任务级别的访问控制列表（ACL）

**工作流权限控制**:
- 工作流定义的创建者可以编辑和删除
- 工作流实例的创建者可以暂停、恢复、终止
- 审批节点只有指定的审批人可以操作
- 支持基于角色的工作流访问控制

### 7.2 数据安全

**敏感信息保护**:
- 评论中的敏感信息自动脱敏（手机号、邮箱、身份证等）
- 附件上传时进行病毒扫描
- 附件访问需要签名URL（有效期1小时）
- 工作流变量中的密码等敏感信息加密存储

**数据加密**:
- 传输加密: TLS 1.3
- 存储加密: PostgreSQL透明数据加密（TDE）
- 附件加密: MinIO服务端加密（SSE）
- 敏感字段加密: AES-256-GCM

### 7.3 审计日志

**审计事件**:
- 任务创建、更新、删除
- 任务分配、状态变更
- 评论添加、编辑、删除
- 工作流启动、暂停、恢复、终止
- 审批通过、拒绝
- 配置变更

**审计日志格式**:

```json
{
  "timestamp": "2026-01-31T10:30:00Z",
  "event_type": "task.created",
  "user_id": "user-123",
  "user_ip": "192.168.1.100",
  "resource_type": "task",
  "resource_id": "task-456",
  "action": "create",
  "changes": {
    "title": "修复登录问题",
    "priority": "high",
    "assignee_id": "user-789"
  },
  "result": "success"
}
```

**审计日志存储**:
- 存储位置: PostgreSQL + Elasticsearch
- 保留期限: 1年（可配置）
- 访问控制: 仅管理员和审计员可查看
- 不可篡改: 使用数字签名保证完整性

### 7.4 安全最佳实践

**输入验证**:
- 所有用户输入进行严格验证
- 防止SQL注入（使用参数化查询）
- 防止XSS攻击（评论内容转义）
- 防止CSRF攻击（使用CSRF令牌）

**速率限制**:
- API请求: 100次/分钟/用户
- WebSocket连接: 10个/用户
- 评论发布: 20次/分钟/用户
- 工作流启动: 50次/小时/用户

**安全响应头**:
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
Content-Security-Policy: default-src 'self'
```

---

## 8. 性能设计

### 8.1 性能指标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 任务创建延迟 | < 500ms (P95) | API响应时间 |
| 任务查询延迟 | < 200ms (P95) | API响应时间 |
| 实时通知延迟 | < 1秒 | WebSocket推送时间 |
| 工作流启动延迟 | < 2秒 | Temporal工作流创建时间 |
| 在线状态同步延迟 | < 5秒 | Redis更新到广播时间 |
| 并发任务创建 | 1000 TPS | 压力测试 |
| 并发WebSocket连接 | 10000个 | 连接池测试 |
| 任务搜索延迟 | < 300ms (P95) | Elasticsearch查询时间 |
| 数据库查询延迟 | < 50ms (P95) | PostgreSQL慢查询日志 |
| 缓存命中率 | > 80% | Redis监控 |

### 8.2 优化策略

**数据库优化**:

1. **索引优化**:
   - 为常用查询字段创建索引（status, priority, assignee_id等）
   - 使用GIN索引支持数组字段查询（tags, related_logs）
   - 使用部分索引优化特定查询（如只索引未完成的任务）
   
2. **查询优化**:
   - 使用连接池（最大连接数: 100）
   - 批量查询减少数据库往返
   - 使用EXPLAIN分析慢查询
   - 避免N+1查询问题

3. **分区策略**:
   - 按时间分区历史表（按月分区）
   - 自动归档90天前的历史数据
   - 使用表继承实现透明分区

**缓存优化**:

1. **多级缓存**:
   - L1: 本地内存缓存（LRU, 1000条）
   - L2: Redis缓存（分布式共享）
   - L3: PostgreSQL（持久化）

2. **缓存策略**:
   - 热点任务: Write-Through（写入时更新缓存）
   - 任务列表: Cache-Aside（查询时缓存）
   - 在线状态: TTL自动过期
   - 工作流定义: 永久缓存（手动失效）

3. **缓存预热**:
   - 系统启动时加载常用任务模板
   - 加载活跃用户的任务列表
   - 预加载工作流定义

**WebSocket优化**:

1. **连接管理**:
   - 使用连接池复用连接
   - 心跳检测（30秒间隔）
   - 自动清理僵尸连接
   - 支持水平扩展（Redis适配器）

2. **消息优化**:
   - 消息批量发送（100ms窗口）
   - 消息压缩（gzip）
   - 消息去重（5秒窗口）
   - 优先级队列（紧急消息优先）

3. **负载均衡**:
   - 使用Nginx进行WebSocket负载均衡
   - 基于用户ID的一致性哈希
   - 支持跨实例消息广播（Redis Pub/Sub）

**Elasticsearch优化**:

1. **索引优化**:
   - 使用别名实现零停机重建索引
   - 定期合并段（segment）减少碎片
   - 使用ILM策略自动管理索引生命周期
   - 冷热数据分离（热数据SSD，冷数据HDD）

2. **查询优化**:
   - 使用filter context代替query context（可缓存）
   - 限制返回字段（_source filtering）
   - 使用scroll API处理大结果集
   - 避免深度分页（使用search_after）

3. **写入优化**:
   - 批量写入（bulk API, 1000条/批）
   - 调整refresh_interval（5秒）
   - 使用异步写入（不阻塞主流程）

**Temporal优化**:

1. **工作流优化**:
   - 使用Activity批量处理减少往返
   - 合理设置超时时间避免资源浪费
   - 使用Continue-As-New处理长时间运行的工作流
   - 避免在工作流中进行大量计算

2. **资源配置**:
   - Worker数量: 10个（可扩展）
   - 每个Worker的并发Activity: 100个
   - 工作流执行超时: 7天（可配置）
   - Activity执行超时: 1小时（可配置）

### 8.3 容量规划

**存储容量**:

| 数据类型 | 单条大小 | 日增量 | 保留期 | 总容量 |
|---------|---------|--------|--------|--------|
| 任务 | 5KB | 10000条 | 永久 | 50MB/天 |
| 评论 | 2KB | 50000条 | 永久 | 100MB/天 |
| 任务历史 | 1KB | 100000条 | 90天 | 100MB/天 |
| 工作流实例 | 10KB | 1000条 | 90天 | 10MB/天 |
| 工作流历史 | 2KB | 10000条 | 90天 | 20MB/天 |
| 审计日志 | 1KB | 50000条 | 365天 | 50MB/天 |

**总存储需求**: 约330MB/天，年增长约120GB

**计算资源**:

| 组件 | CPU | 内存 | 副本数 | 说明 |
|------|-----|------|--------|------|
| API Server | 2核 | 4GB | 3 | 处理HTTP/WebSocket请求 |
| Temporal Worker | 4核 | 8GB | 2 | 执行工作流任务 |
| PostgreSQL | 8核 | 16GB | 1主2从 | 主数据库 |
| Redis | 2核 | 8GB | 1主2从 | 缓存和Pub/Sub |
| Elasticsearch | 4核 | 16GB | 3 | 搜索引擎 |
| Kafka | 4核 | 8GB | 3 | 消息队列 |
| MinIO | 2核 | 4GB | 4 | 对象存储 |

**网络带宽**:
- 入站: 100Mbps（峰值）
- 出站: 200Mbps（峰值，包括WebSocket推送）
- WebSocket连接: 10000个 × 1KB/s = 10MB/s

### 8.4 性能监控

**关键指标**:

```prometheus
# API延迟
histogram_quantile(0.95, 
  rate(http_request_duration_seconds_bucket{module="collaboration"}[5m])
)

# 任务创建速率
rate(task_created_total[5m])

# WebSocket连接数
websocket_connections_active

# 工作流执行时间
histogram_quantile(0.95, 
  rate(workflow_execution_duration_seconds_bucket[5m])
)

# 缓存命中率
rate(cache_hits_total[5m]) / rate(cache_requests_total[5m])

# 数据库连接池使用率
db_connection_pool_used / db_connection_pool_max
```

**告警规则**:
- API延迟 > 1秒（P95）持续5分钟
- WebSocket连接数 > 8000
- 缓存命中率 < 70%
- 数据库连接池使用率 > 80%
- 工作流执行失败率 > 5%

---

## 9. 部署方案

### 9.1 部署架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         Kubernetes集群                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Ingress (Nginx)                                        │   │
│  │  - TLS终止                                              │   │
│  │  - WebSocket支持                                        │   │
│  │  - 负载均衡                                             │   │
│  └────────────────┬────────────────────────────────────────┘   │
│                   │                                             │
│  ┌────────────────▼────────────────────────────────────────┐   │
│  │  API Server (Deployment, 3 replicas)                   │   │
│  │  - 任务管理                                             │   │
│  │  - WebSocket服务                                        │   │
│  │  - 协作引擎                                             │   │
│  └────────────────┬────────────────────────────────────────┘   │
│                   │                                             │
│  ┌────────────────▼────────────────────────────────────────┐   │
│  │  Temporal Worker (Deployment, 2 replicas)              │   │
│  │  - 工作流执行                                           │   │
│  │  - Activity处理                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  数据层 (StatefulSet)                                   │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐             │   │
│  │  │PostgreSQL│  │  Redis   │  │Elasticsearch│           │   │
│  │  │ 1主2从   │  │ 1主2从   │  │   3节点   │             │   │
│  │  └──────────┘  └──────────┘  └──────────┘             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  消息队列 (StatefulSet)                                 │   │
│  │  ┌──────────┐  ┌──────────┐                            │   │
│  │  │  Kafka   │  │ Temporal │                            │   │
│  │  │  3节点   │  │  Server  │                            │   │
│  │  └──────────┘  └──────────┘                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  对象存储 (StatefulSet)                                 │   │
│  │  ┌──────────────────────────────────────┐              │   │
│  │  │  MinIO (4节点)                       │              │   │
│  │  └──────────────────────────────────────┘              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 资源配置

**API Server**:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: collaboration-api
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: api
        image: log-management/collaboration-api:v1.0
        resources:
          requests:
            cpu: 1000m
            memory: 2Gi
          limits:
            cpu: 2000m
            memory: 4Gi
        env:
        - name: DB_HOST
          value: postgres-service
        - name: REDIS_HOST
          value: redis-service
        - name: TEMPORAL_HOST
          value: temporal-service
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
```

**Temporal Worker**:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: temporal-worker
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: worker
        image: log-management/temporal-worker:v1.0
        resources:
          requests:
            cpu: 2000m
            memory: 4Gi
          limits:
            cpu: 4000m
            memory: 8Gi
        env:
        - name: TEMPORAL_HOST
          value: temporal-service
        - name: WORKER_CONCURRENCY
          value: "100"
```

**PostgreSQL**:

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: postgres
        image: postgres:15
        resources:
          requests:
            cpu: 4000m
            memory: 8Gi
          limits:
            cpu: 8000m
            memory: 16Gi
        volumeMounts:
        - name: data
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 500Gi
```

**Redis**:

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: redis
        image: redis:7.2
        resources:
          requests:
            cpu: 1000m
            memory: 4Gi
          limits:
            cpu: 2000m
            memory: 8Gi
        volumeMounts:
        - name: data
          mountPath: /data
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 100Gi
```

**Elasticsearch**:

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: elasticsearch
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: elasticsearch
        image: elasticsearch:8.11.0
        resources:
          requests:
            cpu: 2000m
            memory: 8Gi
          limits:
            cpu: 4000m
            memory: 16Gi
        env:
        - name: ES_JAVA_OPTS
          value: "-Xms8g -Xmx8g"
        volumeMounts:
        - name: data
          mountPath: /usr/share/elasticsearch/data
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 1Ti
```

### 9.3 发布策略

**滚动更新**:

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1        # 最多额外创建1个Pod
    maxUnavailable: 0  # 更新期间保持所有Pod可用
```

**金丝雀发布**:

```yaml
# 使用Istio实现金丝雀发布
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: collaboration-api
spec:
  hosts:
  - collaboration-api
  http:
  - match:
    - headers:
        canary:
          exact: "true"
    route:
    - destination:
        host: collaboration-api
        subset: v2
  - route:
    - destination:
        host: collaboration-api
        subset: v1
      weight: 90
    - destination:
        host: collaboration-api
        subset: v2
      weight: 10
```

**蓝绿部署**:

1. 部署新版本（绿）到独立的Deployment
2. 验证新版本功能正常
3. 切换Service指向新版本
4. 保留旧版本（蓝）一段时间用于快速回滚
5. 确认无问题后删除旧版本

### 9.4 配置管理

**配置热更新（推荐方式）**:

模块14的配置支持通过Redis Pub/Sub实现热更新，无需重启服务。详细设计见第11节"配置热更新详细设计"。

**热更新流程**:
1. 用户通过API或Web Console修改配置
2. 配置保存到PostgreSQL（版本化）
3. 配置同步到Redis缓存
4. Redis发布Pub/Sub通知（`config:module14:reload`）
5. 所有服务实例订阅到通知
6. 重新加载配置并验证
7. 使用atomic.Value原子更新配置
8. 记录配置变更审计日志
9. 配置在3-5秒内生效

**ConfigMap（备选方式）**:

当热更新机制不可用时，可以通过修改ConfigMap并重启Pod来更新配置：

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: collaboration-config
data:
  config.yaml: |
    task:
      enabled: true
      max_tasks_per_user: 50
      cache_ttl: 1h
    workflow:
      enabled: true
      max_concurrent_workflows: 100
      default_task_timeout: 3600
    notification:
      enabled: true
      channels:
        - email
        - slack
        - dingtalk
```

**更新ConfigMap后重启Pod**:
```bash
# 编辑ConfigMap
kubectl edit configmap collaboration-config -n log-management

# 重启Pod使配置生效
kubectl rollout restart deployment collaboration-api -n log-management
```

**Secret**:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: collaboration-secret
type: Opaque
data:
  db-password: <base64-encoded>
  redis-password: <base64-encoded>
  jwt-secret: <base64-encoded>
```

**注意**: Secret中的敏感信息（数据库密码、JWT密钥等）不推荐热更新，建议通过Secret更新并重启服务。

### 9.5 服务发现

**服务发现支持热更新**:

Kubernetes的Service和Ingress配置变更会自动生效，无需重启应用Pod：

- **Service变更**: kube-proxy自动更新iptables规则，新连接立即使用新配置
- **Ingress变更**: Ingress Controller（如Nginx）自动重载配置，通常在10秒内生效
- **Endpoints变更**: Pod增删时，Service的Endpoints自动更新，客户端通过服务发现获取最新列表

**Service定义**:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: collaboration-api
spec:
  type: ClusterIP
  ports:
  - name: http
    port: 8080
    targetPort: 8080
  - name: websocket
    port: 8081
    targetPort: 8081
  selector:
    app: collaboration-api
```

**Ingress配置**:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: collaboration-ingress
  annotations:
    nginx.ingress.kubernetes.io/websocket-services: collaboration-api
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
spec:
  tls:
  - hosts:
    - api.example.com
    secretName: tls-secret
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /api/v1/tasks
        pathType: Prefix
        backend:
          service:
            name: collaboration-api
            port:
              number: 8080
      - path: /ws
        pathType: Prefix
        backend:
          service:
            name: collaboration-api
            port:
              number: 8081
```

**动态服务发现**:

应用内部使用Kubernetes服务发现机制，支持动态感知服务变化：

```go
// 使用Kubernetes Informer监听Service变化
informer := cache.NewSharedIndexInformer(
    &cache.ListWatch{
        ListFunc: func(options metav1.ListOptions) (runtime.Object, error) {
            return clientset.CoreV1().Services(namespace).List(context.TODO(), options)
        },
        WatchFunc: func(options metav1.ListOptions) (watch.Interface, error) {
            return clientset.CoreV1().Services(namespace).Watch(context.TODO(), options)
        },
    },
    &corev1.Service{},
    0,
    cache.Indexers{},
)

// 监听Service变更事件
informer.AddEventHandler(cache.ResourceEventHandlerFuncs{
    AddFunc: func(obj interface{}) {
        service := obj.(*corev1.Service)
        log.Info("服务已添加", "name", service.Name)
        // 更新服务列表
    },
    UpdateFunc: func(oldObj, newObj interface{}) {
        service := newObj.(*corev1.Service)
        log.Info("服务已更新", "name", service.Name)
        // 更新服务列表
    },
    DeleteFunc: func(obj interface{}) {
        service := obj.(*corev1.Service)
        log.Info("服务已删除", "name", service.Name)
        // 从服务列表移除
    },
})
```

---

## 10. 监控与运维

### 10.1 监控指标

**业务指标**:

```prometheus
# 任务相关指标
task_created_total                          # 任务创建总数
task_completed_total                        # 任务完成总数
task_duration_seconds                       # 任务处理时长
task_by_status{status="pending|in_progress|completed|closed"}  # 按状态统计任务数
task_by_priority{priority="urgent|high|medium|low"}            # 按优先级统计任务数

# 评论相关指标
comment_added_total                         # 评论添加总数
mention_sent_total                          # @提及发送总数

# 工作流相关指标
workflow_started_total                      # 工作流启动总数
workflow_completed_total                    # 工作流完成总数
workflow_failed_total                       # 工作流失败总数
workflow_duration_seconds                   # 工作流执行时长
workflow_node_execution_duration_seconds{node_type}  # 节点执行时长

# 审批相关指标
approval_requested_total                    # 审批请求总数
approval_approved_total                     # 审批通过总数
approval_rejected_total                     # 审批拒绝总数
approval_timeout_total                      # 审批超时总数

# WebSocket相关指标
websocket_connections_active                # 活跃WebSocket连接数
websocket_messages_sent_total               # 发送的消息总数
websocket_messages_received_total           # 接收的消息总数
```

**系统指标**:

```prometheus
# API性能指标
http_request_duration_seconds{method,path,status}  # HTTP请求延迟
http_requests_total{method,path,status}            # HTTP请求总数
http_request_size_bytes                            # 请求大小
http_response_size_bytes                           # 响应大小

# 数据库指标
db_connection_pool_used                     # 数据库连接池使用数
db_connection_pool_max                      # 数据库连接池最大数
db_query_duration_seconds{query_type}       # 数据库查询延迟
db_slow_queries_total                       # 慢查询总数

# 缓存指标
cache_hits_total                            # 缓存命中总数
cache_misses_total                          # 缓存未命中总数
cache_evictions_total                       # 缓存驱逐总数
cache_size_bytes                            # 缓存大小

# Temporal指标
temporal_workflow_execution_latency         # 工作流执行延迟
temporal_activity_execution_latency         # Activity执行延迟
temporal_workflow_task_queue_latency        # 任务队列延迟
temporal_worker_task_slots_available        # Worker可用任务槽
```

### 10.2 告警规则

**告警规则热更新设计**:

告警规则支持两种更新方式：
1. **热更新（优先）**: 通过API/Web Console动态更新，无需重启服务，5秒内生效
2. **YAML文件更新（备选）**: 修改配置文件后重启服务生效

**告警规则数据模型**:

```go
// AlertRule 告警规则
type AlertRule struct {
    ID          string            `json:"id" db:"id"`
    Name        string            `json:"name" db:"name"`
    Category    string            `json:"category" db:"category"` // system, business, custom
    Metric      string            `json:"metric" db:"metric"` // 指标名称
    Condition   string            `json:"condition" db:"condition"` // 条件表达式
    Threshold   float64           `json:"threshold" db:"threshold"` // 阈值
    Duration    int               `json:"duration" db:"duration"` // 持续时间（秒）
    Severity    string            `json:"severity" db:"severity"` // critical, warning, info
    Enabled     bool              `json:"enabled" db:"enabled"`
    Labels      map[string]string `json:"labels" db:"labels"` // JSONB
    Annotations map[string]string `json:"annotations" db:"annotations"` // JSONB
    NotifyChannels []string       `json:"notify_channels" db:"notify_channels"` // 通知渠道
    CreatedBy   string            `json:"created_by" db:"created_by"`
    CreatedAt   time.Time         `json:"created_at" db:"created_at"`
    UpdatedAt   time.Time         `json:"updated_at" db:"updated_at"`
}
```

**告警规则表设计**:

```sql
CREATE TABLE alert_rules (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(20) NOT NULL, -- system, business, custom
    metric VARCHAR(255) NOT NULL,
    condition VARCHAR(50) NOT NULL, -- gt, lt, gte, lte, eq, ne
    threshold DECIMAL(20,4) NOT NULL,
    duration INT NOT NULL DEFAULT 300, -- 持续时间（秒）
    severity VARCHAR(20) NOT NULL, -- critical, warning, info
    enabled BOOLEAN NOT NULL DEFAULT true,
    labels JSONB,
    annotations JSONB,
    notify_channels TEXT[], -- 通知渠道数组
    created_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_category (category),
    INDEX idx_enabled (enabled),
    INDEX idx_severity (severity),
    FOREIGN KEY (created_by) REFERENCES users(id)
);
```

**内置告警规则（系统级）**:

```go
// 系统启动时加载的默认告警规则
var DefaultAlertRules = []AlertRule{
    {
        ID:       "alert-001",
        Name:     "API延迟过高",
        Category: "system",
        Metric:   "http_request_duration_seconds_p95",
        Condition: "gt",
        Threshold: 1.0,
        Duration: 300,
        Severity: "critical",
        Enabled:  true,
        Labels: map[string]string{
            "module": "collaboration",
        },
        Annotations: map[string]string{
            "summary":     "API延迟过高",
            "description": "P95延迟超过1秒阈值",
        },
        NotifyChannels: []string{"email", "slack"},
    },
    {
        ID:       "alert-002",
        Name:     "WebSocket连接数过高",
        Category: "system",
        Metric:   "websocket_connections_active",
        Condition: "gt",
        Threshold: 8000,
        Duration: 300,
        Severity: "warning",
        Enabled:  true,
        Annotations: map[string]string{
            "summary":     "WebSocket连接数过高",
            "description": "当前连接数接近上限10000",
        },
        NotifyChannels: []string{"email"},
    },
    {
        ID:       "alert-003",
        Name:     "工作流失败率过高",
        Category: "system",
        Metric:   "workflow_failure_rate",
        Condition: "gt",
        Threshold: 0.05,
        Duration: 300,
        Severity: "critical",
        Enabled:  true,
        Annotations: map[string]string{
            "summary":     "工作流失败率过高",
            "description": "失败率超过5%阈值",
        },
        NotifyChannels: []string{"email", "slack", "dingtalk"},
    },
    {
        ID:       "alert-004",
        Name:     "数据库连接池使用率过高",
        Category: "system",
        Metric:   "db_connection_pool_usage",
        Condition: "gt",
        Threshold: 0.8,
        Duration: 300,
        Severity: "warning",
        Enabled:  true,
        Annotations: map[string]string{
            "summary":     "数据库连接池使用率过高",
            "description": "使用率超过80%",
        },
        NotifyChannels: []string{"email"},
    },
    {
        ID:       "alert-005",
        Name:     "缓存命中率过低",
        Category: "system",
        Metric:   "cache_hit_rate",
        Condition: "lt",
        Threshold: 0.7,
        Duration: 600,
        Severity: "warning",
        Enabled:  true,
        Annotations: map[string]string{
            "summary":     "缓存命中率过低",
            "description": "命中率低于70%",
        },
        NotifyChannels: []string{"email"},
    },
    {
        ID:       "alert-006",
        Name:     "待处理任务积压",
        Category: "business",
        Metric:   "task_pending_count",
        Condition: "gt",
        Threshold: 1000,
        Duration: 1800,
        Severity: "warning",
        Enabled:  true,
        Annotations: map[string]string{
            "summary":     "待处理任务积压",
            "description": "待处理任务数超过1000",
        },
        NotifyChannels: []string{"email"},
    },
    {
        ID:       "alert-007",
        Name:     "审批超时频繁",
        Category: "business",
        Metric:   "approval_timeout_rate",
        Condition: "gt",
        Threshold: 10,
        Duration: 3600,
        Severity: "warning",
        Enabled:  true,
        Annotations: map[string]string{
            "summary":     "审批超时频繁",
            "description": "每小时超时次数超过10次",
        },
        NotifyChannels: []string{"email", "slack"},
    },
}
```

**告警规则管理器实现**:

```go
// internal/collaboration/alert/rule_manager.go
package alert

import (
    "context"
    "encoding/json"
    "sync"
    "sync/atomic"
    "time"
)

// RuleManager 告警规则管理器
type RuleManager struct {
    db     *sql.DB
    cache  *redis.Client
    rules  atomic.Value // 存储当前生效的规则列表
    mu     sync.RWMutex
}

// NewRuleManager 创建告警规则管理器
func NewRuleManager(db *sql.DB, cache *redis.Client) *RuleManager {
    m := &RuleManager{
        db:    db,
        cache: cache,
    }
    
    // 加载初始规则
    if err := m.loadRules(); err != nil {
        log.Fatalf("加载告警规则失败: %v", err)
    }
    
    // 订阅规则变更通知
    go m.subscribeRuleChanges()
    
    // 启动规则评估器
    go m.startRuleEvaluator()
    
    return m
}

// GetRules 获取当前生效的规则
func (m *RuleManager) GetRules() []AlertRule {
    return m.rules.Load().([]AlertRule)
}

// CreateRule 创建告警规则（热更新）
func (m *RuleManager) CreateRule(ctx context.Context, rule *AlertRule) error {
    rule.ID = uuid.New().String()
    rule.CreatedAt = time.Now()
    rule.UpdatedAt = time.Now()
    
    // 验证规则
    if err := m.validateRule(rule); err != nil {
        return fmt.Errorf("规则验证失败: %w", err)
    }
    
    // 保存到数据库
    query := `
        INSERT INTO alert_rules (id, name, category, metric, condition, threshold, 
            duration, severity, enabled, labels, annotations, notify_channels, 
            created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `
    labelsJSON, _ := json.Marshal(rule.Labels)
    annotationsJSON, _ := json.Marshal(rule.Annotations)
    
    _, err := m.db.ExecContext(ctx, query,
        rule.ID, rule.Name, rule.Category, rule.Metric, rule.Condition,
        rule.Threshold, rule.Duration, rule.Severity, rule.Enabled,
        labelsJSON, annotationsJSON, pq.Array(rule.NotifyChannels),
        rule.CreatedBy, rule.CreatedAt, rule.UpdatedAt,
    )
    if err != nil {
        return fmt.Errorf("保存告警规则失败: %w", err)
    }
    
    // 同步到Redis
    cacheKey := fmt.Sprintf("alert:rule:%s", rule.ID)
    ruleJSON, _ := json.Marshal(rule)
    if err := m.cache.Set(ctx, cacheKey, ruleJSON, 0).Err(); err != nil {
        log.Warnf("同步规则到Redis失败: %v", err)
    }
    
    // 发布规则变更通知
    if err := m.publishRuleChange(ctx, "created", rule.ID); err != nil {
        log.Warnf("发布规则变更通知失败: %v", err)
    }
    
    // 记录审计日志
    m.auditLog(ctx, "alert_rule.created", rule.CreatedBy, map[string]interface{}{
        "rule_id":   rule.ID,
        "rule_name": rule.Name,
        "category":  rule.Category,
    })
    
    return nil
}

// UpdateRule 更新告警规则（热更新）
func (m *RuleManager) UpdateRule(ctx context.Context, ruleID string, updates map[string]interface{}) error {
    // 验证更新内容
    if err := m.validateRuleUpdates(updates); err != nil {
        return fmt.Errorf("更新内容验证失败: %w", err)
    }
    
    // 构建更新SQL
    setClauses := []string{"updated_at = $1"}
    args := []interface{}{time.Now()}
    argIndex := 2
    
    for key, value := range updates {
        setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, argIndex))
        args = append(args, value)
        argIndex++
    }
    
    args = append(args, ruleID)
    query := fmt.Sprintf(`
        UPDATE alert_rules 
        SET %s
        WHERE id = $%d
    `, strings.Join(setClauses, ", "), argIndex)
    
    _, err := m.db.ExecContext(ctx, query, args...)
    if err != nil {
        return fmt.Errorf("更新告警规则失败: %w", err)
    }
    
    // 清除Redis缓存
    cacheKey := fmt.Sprintf("alert:rule:%s", ruleID)
    m.cache.Del(ctx, cacheKey)
    
    // 发布规则变更通知
    if err := m.publishRuleChange(ctx, "updated", ruleID); err != nil {
        log.Warnf("发布规则变更通知失败: %v", err)
    }
    
    return nil
}

// DeleteRule 删除告警规则（热更新）
func (m *RuleManager) DeleteRule(ctx context.Context, ruleID string) error {
    // 检查是否为系统规则
    var category string
    err := m.db.QueryRowContext(ctx, "SELECT category FROM alert_rules WHERE id = $1", ruleID).Scan(&category)
    if err != nil {
        return err
    }
    
    if category == "system" {
        return fmt.Errorf("系统规则不能删除，只能禁用")
    }
    
    // 删除规则
    _, err = m.db.ExecContext(ctx, "DELETE FROM alert_rules WHERE id = $1", ruleID)
    if err != nil {
        return fmt.Errorf("删除告警规则失败: %w", err)
    }
    
    // 清除Redis缓存
    cacheKey := fmt.Sprintf("alert:rule:%s", ruleID)
    m.cache.Del(ctx, cacheKey)
    
    // 发布规则变更通知
    if err := m.publishRuleChange(ctx, "deleted", ruleID); err != nil {
        log.Warnf("发布规则变更通知失败: %v", err)
    }
    
    return nil
}

// EnableRule 启用告警规则（热更新）
func (m *RuleManager) EnableRule(ctx context.Context, ruleID string) error {
    return m.UpdateRule(ctx, ruleID, map[string]interface{}{"enabled": true})
}

// DisableRule 禁用告警规则（热更新）
func (m *RuleManager) DisableRule(ctx context.Context, ruleID string) error {
    return m.UpdateRule(ctx, ruleID, map[string]interface{}{"enabled": false})
}

// loadRules 从数据库加载规则
func (m *RuleManager) loadRules() error {
    ctx := context.Background()
    
    rows, err := m.db.QueryContext(ctx, `
        SELECT id, name, category, metric, condition, threshold, duration, 
            severity, enabled, labels, annotations, notify_channels, 
            created_by, created_at, updated_at
        FROM alert_rules
        WHERE enabled = true
        ORDER BY severity DESC, created_at ASC
    `)
    if err != nil {
        return err
    }
    defer rows.Close()
    
    var rules []AlertRule
    for rows.Next() {
        var rule AlertRule
        var labelsJSON, annotationsJSON []byte
        
        err := rows.Scan(
            &rule.ID, &rule.Name, &rule.Category, &rule.Metric, &rule.Condition,
            &rule.Threshold, &rule.Duration, &rule.Severity, &rule.Enabled,
            &labelsJSON, &annotationsJSON, pq.Array(&rule.NotifyChannels),
            &rule.CreatedBy, &rule.CreatedAt, &rule.UpdatedAt,
        )
        if err != nil {
            return err
        }
        
        json.Unmarshal(labelsJSON, &rule.Labels)
        json.Unmarshal(annotationsJSON, &rule.Annotations)
        
        rules = append(rules, rule)
    }
    
    // 原子更新规则列表
    m.rules.Store(rules)
    
    log.Infof("加载了 %d 条告警规则", len(rules))
    return nil
}

// subscribeRuleChanges 订阅规则变更通知
func (m *RuleManager) subscribeRuleChanges() {
    ctx := context.Background()
    pubsub := m.cache.Subscribe(ctx, "alert:rules:reload")
    defer pubsub.Close()
    
    log.Info("开始订阅告警规则变更通知")
    
    for msg := range pubsub.Channel() {
        log.Infof("收到告警规则变更通知: %s", msg.Payload)
        
        // 重新加载规则
        if err := m.loadRules(); err != nil {
            log.Errorf("重新加载告警规则失败: %v", err)
            continue
        }
        
        log.Info("告警规则已更新")
    }
}

// publishRuleChange 发布规则变更通知
func (m *RuleManager) publishRuleChange(ctx context.Context, action, ruleID string) error {
    notification := map[string]interface{}{
        "action":    action,
        "rule_id":   ruleID,
        "timestamp": time.Now().Unix(),
    }
    notificationJSON, _ := json.Marshal(notification)
    return m.cache.Publish(ctx, "alert:rules:reload", notificationJSON).Err()
}

// validateRule 验证告警规则
func (m *RuleManager) validateRule(rule *AlertRule) error {
    if rule.Name == "" {
        return fmt.Errorf("规则名称不能为空")
    }
    
    if rule.Metric == "" {
        return fmt.Errorf("指标名称不能为空")
    }
    
    validConditions := map[string]bool{"gt": true, "lt": true, "gte": true, "lte": true, "eq": true, "ne": true}
    if !validConditions[rule.Condition] {
        return fmt.Errorf("无效的条件: %s", rule.Condition)
    }
    
    if rule.Duration < 0 {
        return fmt.Errorf("持续时间不能为负数")
    }
    
    validSeverities := map[string]bool{"critical": true, "warning": true, "info": true}
    if !validSeverities[rule.Severity] {
        return fmt.Errorf("无效的严重级别: %s", rule.Severity)
    }
    
    validCategories := map[string]bool{"system": true, "business": true, "custom": true}
    if !validCategories[rule.Category] {
        return fmt.Errorf("无效的分类: %s", rule.Category)
    }
    
    return nil
}

// startRuleEvaluator 启动规则评估器
func (m *RuleManager) startRuleEvaluator() {
    ticker := time.NewTicker(30 * time.Second)
    defer ticker.Stop()
    
    for range ticker.C {
        rules := m.GetRules()
        for _, rule := range rules {
            if rule.Enabled {
                go m.evaluateRule(&rule)
            }
        }
    }
}

// evaluateRule 评估单个规则
func (m *RuleManager) evaluateRule(rule *AlertRule) {
    // 从Prometheus查询指标值
    value, err := m.queryMetric(rule.Metric, rule.Labels)
    if err != nil {
        log.Warnf("查询指标失败: %v", err)
        return
    }
    
    // 评估条件
    triggered := m.evaluateCondition(value, rule.Condition, rule.Threshold)
    
    if triggered {
        // 检查是否已经在告警状态
        alertKey := fmt.Sprintf("alert:firing:%s", rule.ID)
        exists, _ := m.cache.Exists(context.Background(), alertKey).Result()
        
        if exists == 0 {
            // 首次触发，记录开始时间
            m.cache.Set(context.Background(), alertKey, time.Now().Unix(), time.Duration(rule.Duration)*time.Second)
        } else {
            // 检查是否超过持续时间
            startTime, _ := m.cache.Get(context.Background(), alertKey).Int64()
            if time.Now().Unix()-startTime >= int64(rule.Duration) {
                // 触发告警
                m.fireAlert(rule, value)
            }
        }
    } else {
        // 清除告警状态
        alertKey := fmt.Sprintf("alert:firing:%s", rule.ID)
        m.cache.Del(context.Background(), alertKey)
    }
}
```

**告警规则API**:

```go
// API: 创建自定义告警规则
// POST /api/v1/alert-rules
type CreateAlertRuleRequest struct {
    Name           string            `json:"name"`
    Metric         string            `json:"metric"`
    Condition      string            `json:"condition"` // gt, lt, gte, lte, eq, ne
    Threshold      float64           `json:"threshold"`
    Duration       int               `json:"duration"` // 秒
    Severity       string            `json:"severity"` // critical, warning, info
    Labels         map[string]string `json:"labels"`
    Annotations    map[string]string `json:"annotations"`
    NotifyChannels []string          `json:"notify_channels"`
}

// API: 查询告警规则列表
// GET /api/v1/alert-rules?category=custom&enabled=true
type ListAlertRulesResponse struct {
    Items []AlertRule `json:"items"`
    Total int         `json:"total"`
}

// API: 更新告警规则
// PUT /api/v1/alert-rules/{id}
type UpdateAlertRuleRequest struct {
    Name           *string            `json:"name,omitempty"`
    Threshold      *float64           `json:"threshold,omitempty"`
    Duration       *int               `json:"duration,omitempty"`
    Enabled        *bool              `json:"enabled,omitempty"`
    NotifyChannels *[]string          `json:"notify_channels,omitempty"`
}

// API: 删除告警规则
// DELETE /api/v1/alert-rules/{id}

// API: 启用/禁用告警规则
// PUT /api/v1/alert-rules/{id}/enable
// PUT /api/v1/alert-rules/{id}/disable
```

**YAML配置文件（备选方式）**:

```yaml
# configs/alert_rules.yaml
alert_rules:
  # 系统级告警
  - id: alert-001
    name: "API延迟过高"
    category: system
    metric: http_request_duration_seconds_p95
    condition: gt
    threshold: 1.0
    duration: 300
    severity: critical
    enabled: true
    labels:
      module: collaboration
    annotations:
      summary: "API延迟过高"
      description: "P95延迟超过1秒阈值"
    notify_channels:
      - email
      - slack
  
  # 业务级告警
  - id: alert-006
    name: "待处理任务积压"
    category: business
    metric: task_pending_count
    condition: gt
    threshold: 1000
    duration: 1800
    severity: warning
    enabled: true
    annotations:
      summary: "待处理任务积压"
      description: "待处理任务数超过1000"
    notify_channels:
      - email
  
  # 自定义告警（用户创建）
  - id: alert-custom-001
    name: "特定项目任务超时"
    category: custom
    metric: task_overdue_count
    condition: gt
    threshold: 50
    duration: 600
    severity: warning
    enabled: true
    labels:
      project_id: "proj-123"
    annotations:
      summary: "项目任务超时"
      description: "项目 {{ .project_id }} 有超过50个任务超时"
    notify_channels:
      - email
      - slack
```

**热更新流程**:

```
1. 用户在Web Console创建/修改告警规则
   ↓
2. API Server接收请求并验证规则
   ↓
3. 保存到PostgreSQL（事务）
   ↓
4. 同步到Redis缓存
   ↓
5. 发布Pub/Sub通知（alert:rules:reload）
   ↓
6. 所有实例订阅到通知
   ↓
7. 重新从数据库加载规则
   ↓
8. 使用atomic.Value原子更新规则列表
   ↓
9. 规则评估器自动使用新规则
   ↓
10. 返回更新成功响应

生效时间: < 5秒
```

### 10.3 日志规范

**日志级别**:
- ERROR: 错误事件，需要立即处理
- WARN: 警告事件，可能影响功能
- INFO: 重要业务事件
- DEBUG: 调试信息（生产环境关闭）

**日志格式**:

```json
{
  "timestamp": "2026-01-31T10:30:00.123Z",
  "level": "INFO",
  "module": "collaboration",
  "component": "task_manager",
  "trace_id": "abc123",
  "span_id": "def456",
  "user_id": "user-123",
  "message": "任务创建成功",
  "task_id": "task-456",
  "duration_ms": 123,
  "error": null
}
```

**关键日志事件**:
- 任务创建、更新、删除
- 工作流启动、完成、失败
- 审批请求、通过、拒绝
- WebSocket连接建立、断开
- 配置热更新
- 错误和异常

### 10.4 运维手册

**日常运维任务**:

1. **健康检查**:
   ```bash
   # 检查API服务健康状态
   curl http://api.example.com/health
   
   # 检查WebSocket连接数
   kubectl exec -it collaboration-api-0 -- redis-cli INFO clients
   
   # 检查工作流执行状态
   kubectl logs -f temporal-worker-0
   ```

2. **数据备份**:
   ```bash
   # PostgreSQL备份
   kubectl exec postgres-0 -- pg_dump -U postgres collaboration > backup.sql
   
   # Redis备份
   kubectl exec redis-0 -- redis-cli BGSAVE
   
   # Elasticsearch快照
   curl -X PUT "localhost:9200/_snapshot/backup/snapshot_1?wait_for_completion=true"
   ```

3. **性能优化**:
   ```bash
   # 查看慢查询
   kubectl exec postgres-0 -- psql -U postgres -c "SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
   
   # 清理缓存
   kubectl exec redis-0 -- redis-cli FLUSHDB
   
   # 重建Elasticsearch索引
   curl -X POST "localhost:9200/tasks/_reindex"
   ```

**故障处理**:

| 故障类型 | 症状 | 处理步骤 |
|---------|------|---------|
| API响应慢 | P95延迟>1秒 | 1. 检查数据库慢查询<br>2. 检查缓存命中率<br>3. 扩容API Server |
| WebSocket断连 | 用户频繁掉线 | 1. 检查Nginx配置<br>2. 检查心跳设置<br>3. 检查网络稳定性 |
| 工作流卡住 | 工作流长时间未完成 | 1. 查看Temporal日志<br>2. 检查Activity超时<br>3. 手动终止工作流 |
| 数据库连接耗尽 | 连接池满 | 1. 检查慢查询<br>2. 检查连接泄漏<br>3. 增加连接池大小 |
| 缓存雪崩 | 缓存大量失效 | 1. 启用缓存预热<br>2. 设置随机TTL<br>3. 启用降级策略 |

**扩容操作**:

```bash
# 扩容API Server
kubectl scale deployment collaboration-api --replicas=5

# 扩容Temporal Worker
kubectl scale deployment temporal-worker --replicas=4

# 扩容Elasticsearch
kubectl scale statefulset elasticsearch --replicas=5

# 扩容Redis（需要重新配置主从）
kubectl scale statefulset redis --replicas=5
```

**回滚操作**:

```bash
# 查看发布历史
kubectl rollout history deployment collaboration-api

# 回滚到上一个版本
kubectl rollout undo deployment collaboration-api

# 回滚到指定版本
kubectl rollout undo deployment collaboration-api --to-revision=2

# 查看回滚状态
kubectl rollout status deployment collaboration-api
```

**配置热更新操作**:

```bash
# 更新ConfigMap
kubectl edit configmap collaboration-config

# 触发配置重载（通过Redis Pub/Sub）
kubectl exec redis-0 -- redis-cli PUBLISH config:module14:reload '{"component":"task","version":"v2"}'

# 验证配置生效
curl http://api.example.com/api/v1/config/current
```

---

## 11. 配置热更新详细设计

### 11.1 可热更新配置项

**任务管理配置**:

| 配置项 | 类型 | 默认值 | 说明 | 更新方式 | 生效时间 | 是否推荐热更新 |
|--------|------|--------|------|----------|----------|---------------|
| task_enabled | bool | true | 是否启用任务管理 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| max_tasks_per_user | int | 50 | 每个用户最大任务数 | Redis Pub/Sub | 下次创建 | ✅ 推荐 |
| task_cache_ttl | duration | 1h | 任务缓存过期时间 | Redis Pub/Sub | 下次缓存 | ✅ 推荐 |
| presence_ttl | duration | 5m | 在线状态过期时间 | Redis Pub/Sub | 下次更新 | ✅ 推荐 |
| notification_enabled | bool | true | 是否启用任务通知 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| comment_max_length | int | 10000 | 评论最大长度 | Redis Pub/Sub | 下次评论 | ✅ 推荐 |
| attachment_max_size | int | 10485760 | 附件最大大小（字节） | Redis Pub/Sub | 下次上传 | ✅ 推荐 |
| template_enabled | bool | true | 是否启用任务模板 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| history_retention_days | int | 90 | 历史记录保留天数 | Redis Pub/Sub | 下次清理 | ✅ 推荐 |

**工作流配置**:

| 配置项 | 类型 | 默认值 | 说明 | 更新方式 | 生效时间 | 是否推荐热更新 |
|--------|------|--------|------|----------|----------|---------------|
| workflow_enabled | bool | true | 是否启用工作流引擎 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| max_concurrent_workflows | int | 100 | 最大并发工作流数 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| default_task_timeout | int | 3600 | 默认任务超时时间（秒） | Redis Pub/Sub | 新工作流 | ✅ 推荐 |
| default_approval_timeout | int | 86400 | 默认审批超时时间（秒） | Redis Pub/Sub | 新工作流 | ✅ 推荐 |
| workflow_history_retention_days | int | 90 | 工作流历史保留天数 | Redis Pub/Sub | 下次清理 | ✅ 推荐 |
| enable_workflow_templates | bool | true | 是否启用工作流模板 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| notification_channels | array | ["email","slack","dingtalk"] | 支持的通知渠道 | Redis Pub/Sub | 下次通知 | ✅ 推荐 |
| max_parallel_branches | int | 10 | 最大并行分支数 | Redis Pub/Sub | 新工作流 | ✅ 推荐 |
| workflow_execution_timeout | int | 604800 | 工作流执行超时时间（秒） | Redis Pub/Sub | 新工作流 | ✅ 推荐 |
| enable_auto_escalation | bool | true | 是否启用自动升级 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| escalation_delay_seconds | int | 7200 | 升级延迟时间（秒） | Redis Pub/Sub | 下次升级 | ✅ 推荐 |

**告警规则配置**:

| 配置项 | 类型 | 默认值 | 说明 | 更新方式 | 生效时间 | 是否推荐热更新 |
|--------|------|--------|------|----------|----------|---------------|
| alert_enabled | bool | true | 是否启用告警功能 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| alert_evaluation_interval | int | 30 | 告警评估间隔（秒） | Redis Pub/Sub | 下次评估 | ✅ 推荐 |
| alert_default_notify_channels | array | ["email"] | 默认通知渠道 | Redis Pub/Sub | 下次通知 | ✅ 推荐 |
| alert_max_custom_rules | int | 100 | 每个用户最大自定义规则数 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| alert_history_retention_days | int | 30 | 告警历史保留天数 | Redis Pub/Sub | 下次清理 | ✅ 推荐 |

**不推荐热更新的配置**:

| 配置项 | 类型 | 默认值 | 说明 | 更新方式 | 生效时间 | 是否推荐热更新 |
|--------|------|--------|------|----------|----------|---------------|
| postgresql_host | string | "postgres" | PostgreSQL主机 | YAML + 重启 | 重启后 | ⚠️ 不推荐(需要重建连接池) |
| postgresql_port | int | 5432 | PostgreSQL端口 | YAML + 重启 | 重启后 | ⚠️ 不推荐(需要重建连接池) |
| redis_address | string | "redis:6379" | Redis地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐(需要重建连接) |
| temporal_host | string | "temporal:7233" | Temporal服务地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐(需要重建gRPC连接) |
| server_port | int | 8080 | 服务端口 | YAML + 重启 | 重启后 | ⚠️ 不推荐(需要重启服务) |

### 11.2 热更新实现

**配置存储结构**:

```sql
-- 配置表
CREATE TABLE module_configs (
    id BIGSERIAL PRIMARY KEY,
    module VARCHAR(50) NOT NULL,
    component VARCHAR(50) NOT NULL,
    config_key VARCHAR(100) NOT NULL,
    config_value TEXT NOT NULL,
    value_type VARCHAR(20) NOT NULL, -- bool, int, string, duration, array
    version INT NOT NULL DEFAULT 1,
    created_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE (module, component, config_key),
    INDEX idx_module_component (module, component)
);

-- 配置变更历史表
CREATE TABLE config_change_history (
    id BIGSERIAL PRIMARY KEY,
    config_id BIGINT NOT NULL,
    old_value TEXT,
    new_value TEXT NOT NULL,
    changed_by VARCHAR(36) NOT NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reason TEXT,
    
    FOREIGN KEY (config_id) REFERENCES module_configs(id)
);
```

**配置管理器实现**:

```go
// internal/collaboration/config/manager.go
package config

import (
    "context"
    "encoding/json"
    "sync/atomic"
    "time"
)

// ConfigManager 配置管理器
type ConfigManager struct {
    db     *sql.DB
    cache  *redis.Client
    config atomic.Value // 存储当前配置
}

// TaskConfig 任务管理配置
type TaskConfig struct {
    Enabled              bool          `json:"enabled"`
    MaxTasksPerUser      int           `json:"max_tasks_per_user"`
    TaskCacheTTL         time.Duration `json:"task_cache_ttl"`
    PresenceTTL          time.Duration `json:"presence_ttl"`
    NotificationEnabled  bool          `json:"notification_enabled"`
    CommentMaxLength     int           `json:"comment_max_length"`
    AttachmentMaxSize    int           `json:"attachment_max_size"`
    TemplateEnabled      bool          `json:"template_enabled"`
    HistoryRetentionDays int           `json:"history_retention_days"`
}

// WorkflowConfig 工作流配置
type WorkflowConfig struct {
    Enabled                    bool          `json:"enabled"`
    MaxConcurrentWorkflows     int           `json:"max_concurrent_workflows"`
    DefaultTaskTimeout         int           `json:"default_task_timeout"`
    DefaultApprovalTimeout     int           `json:"default_approval_timeout"`
    WorkflowHistoryRetentionDays int         `json:"workflow_history_retention_days"`
    EnableWorkflowTemplates    bool          `json:"enable_workflow_templates"`
    NotificationChannels       []string      `json:"notification_channels"`
    MaxParallelBranches        int           `json:"max_parallel_branches"`
    WorkflowExecutionTimeout   int           `json:"workflow_execution_timeout"`
    EnableAutoEscalation       bool          `json:"enable_auto_escalation"`
    EscalationDelaySeconds     int           `json:"escalation_delay_seconds"`
}

// Config 模块配置
type Config struct {
    Task     TaskConfig     `json:"task"`
    Workflow WorkflowConfig `json:"workflow"`
    Version  int            `json:"version"`
}

// NewConfigManager 创建配置管理器
func NewConfigManager(db *sql.DB, cache *redis.Client) *ConfigManager {
    m := &ConfigManager{
        db:    db,
        cache: cache,
    }
    
    // 加载初始配置
    if err := m.loadConfig(); err != nil {
        log.Fatalf("加载配置失败: %v", err)
    }
    
    // 订阅配置变更通知
    go m.subscribeConfigChanges()
    
    return m
}

// GetConfig 获取当前配置
func (m *ConfigManager) GetConfig() *Config {
    return m.config.Load().(*Config)
}

// UpdateConfig 更新配置
func (m *ConfigManager) UpdateConfig(ctx context.Context, component, key string, value interface{}, changedBy, reason string) error {
    // 1. 验证配置值
    if err := m.validateConfig(component, key, value); err != nil {
        return fmt.Errorf("配置验证失败: %w", err)
    }
    
    // 2. 保存到数据库
    tx, err := m.db.BeginTx(ctx, nil)
    if err != nil {
        return err
    }
    defer tx.Rollback()
    
    // 获取旧值
    var oldValue string
    var configID int64
    err = tx.QueryRowContext(ctx, `
        SELECT id, config_value FROM module_configs 
        WHERE module = 'collaboration' AND component = $1 AND config_key = $2
    `, component, key).Scan(&configID, &oldValue)
    if err != nil {
        return err
    }
    
    // 更新配置
    newValue, _ := json.Marshal(value)
    _, err = tx.ExecContext(ctx, `
        UPDATE module_configs 
        SET config_value = $1, version = version + 1, updated_at = $2
        WHERE id = $3
    `, string(newValue), time.Now(), configID)
    if err != nil {
        return err
    }
    
    // 记录变更历史
    _, err = tx.ExecContext(ctx, `
        INSERT INTO config_change_history (config_id, old_value, new_value, changed_by, reason)
        VALUES ($1, $2, $3, $4, $5)
    `, configID, oldValue, string(newValue), changedBy, reason)
    if err != nil {
        return err
    }
    
    if err := tx.Commit(); err != nil {
        return err
    }
    
    // 3. 同步到Redis
    cacheKey := fmt.Sprintf("config:module14:%s:%s", component, key)
    if err := m.cache.Set(ctx, cacheKey, newValue, 0).Err(); err != nil {
        log.Warnf("同步配置到Redis失败: %v", err)
    }
    
    // 4. 发布配置变更通知
    notification := map[string]interface{}{
        "component": component,
        "key":       key,
        "value":     value,
        "version":   time.Now().Unix(),
    }
    notificationJSON, _ := json.Marshal(notification)
    if err := m.cache.Publish(ctx, "config:module14:reload", notificationJSON).Err(); err != nil {
        log.Warnf("发布配置变更通知失败: %v", err)
    }
    
    // 5. 记录审计日志
    m.auditLog(ctx, "config.updated", changedBy, map[string]interface{}{
        "component": component,
        "key":       key,
        "old_value": oldValue,
        "new_value": string(newValue),
        "reason":    reason,
    })
    
    return nil
}

// loadConfig 从数据库加载配置
func (m *ConfigManager) loadConfig() error {
    ctx := context.Background()
    
    // 查询所有配置
    rows, err := m.db.QueryContext(ctx, `
        SELECT component, config_key, config_value, value_type
        FROM module_configs
        WHERE module = 'collaboration'
    `)
    if err != nil {
        return err
    }
    defer rows.Close()
    
    config := &Config{
        Task:     m.getDefaultTaskConfig(),
        Workflow: m.getDefaultWorkflowConfig(),
    }
    
    // 解析配置
    for rows.Next() {
        var component, key, value, valueType string
        if err := rows.Scan(&component, &key, &value, &valueType); err != nil {
            return err
        }
        
        // 根据组件和键设置配置值
        m.setConfigValue(config, component, key, value, valueType)
    }
    
    // 原子更新配置
    m.config.Store(config)
    
    log.Info("配置加载成功")
    return nil
}

// subscribeConfigChanges 订阅配置变更通知
func (m *ConfigManager) subscribeConfigChanges() {
    ctx := context.Background()
    pubsub := m.cache.Subscribe(ctx, "config:module14:reload")
    defer pubsub.Close()
    
    log.Info("开始订阅配置变更通知")
    
    for msg := range pubsub.Channel() {
        log.Infof("收到配置变更通知: %s", msg.Payload)
        
        // 重新加载配置
        if err := m.loadConfig(); err != nil {
            log.Errorf("重新加载配置失败: %v", err)
            continue
        }
        
        log.Info("配置已更新")
    }
}

// validateConfig 验证配置值
func (m *ConfigManager) validateConfig(component, key string, value interface{}) error {
    switch component {
    case "task":
        return m.validateTaskConfig(key, value)
    case "workflow":
        return m.validateWorkflowConfig(key, value)
    default:
        return fmt.Errorf("未知的组件: %s", component)
    }
}

// validateTaskConfig 验证任务配置
func (m *ConfigManager) validateTaskConfig(key string, value interface{}) error {
    switch key {
    case "max_tasks_per_user":
        v := value.(int)
        if v <= 0 || v > 1000 {
            return fmt.Errorf("max_tasks_per_user必须在1-1000之间")
        }
    case "task_cache_ttl":
        v := value.(time.Duration)
        if v < 5*time.Minute || v > 24*time.Hour {
            return fmt.Errorf("task_cache_ttl必须在5分钟-24小时之间")
        }
    case "comment_max_length":
        v := value.(int)
        if v < 100 || v > 50000 {
            return fmt.Errorf("comment_max_length必须在100-50000之间")
        }
    case "attachment_max_size":
        v := value.(int)
        if v < 1024*1024 || v > 100*1024*1024 {
            return fmt.Errorf("attachment_max_size必须在1MB-100MB之间")
        }
    case "history_retention_days":
        v := value.(int)
        if v < 30 || v > 365 {
            return fmt.Errorf("history_retention_days必须在30-365之间")
        }
    }
    return nil
}

// validateWorkflowConfig 验证工作流配置
func (m *ConfigManager) validateWorkflowConfig(key string, value interface{}) error {
    switch key {
    case "max_concurrent_workflows":
        v := value.(int)
        if v <= 0 || v > 1000 {
            return fmt.Errorf("max_concurrent_workflows必须在1-1000之间")
        }
    case "default_task_timeout":
        v := value.(int)
        if v < 60 || v > 86400 {
            return fmt.Errorf("default_task_timeout必须在60-86400秒之间")
        }
    case "default_approval_timeout":
        v := value.(int)
        if v < 3600 || v > 604800 {
            return fmt.Errorf("default_approval_timeout必须在3600-604800秒之间")
        }
    case "max_parallel_branches":
        v := value.(int)
        if v <= 0 || v > 50 {
            return fmt.Errorf("max_parallel_branches必须在1-50之间")
        }
    case "notification_channels":
        v := value.([]string)
        if len(v) == 0 {
            return fmt.Errorf("notification_channels不能为空")
        }
        validChannels := map[string]bool{"email": true, "slack": true, "dingtalk": true}
        for _, ch := range v {
            if !validChannels[ch] {
                return fmt.Errorf("不支持的通知渠道: %s", ch)
            }
        }
    }
    return nil
}
```

### 11.3 热更新流程

```
1. 用户在Web Console修改配置
   ↓
2. API Server接收配置更新请求
   ↓
3. ConfigManager验证配置值
   ↓
4. 保存到PostgreSQL（事务）
   - 更新module_configs表
   - 记录config_change_history
   ↓
5. 同步到Redis缓存
   ↓
6. 发布Pub/Sub通知（config:module14:reload）
   ↓
7. 所有API Server实例订阅到通知
   ↓
8. 重新从数据库加载配置
   ↓
9. 使用atomic.Value原子更新内存配置
   ↓
10. 记录审计日志
   ↓
11. 返回更新成功响应
```

### 11.4 热更新验收标准

1. **生效时间**: THE System SHALL 在配置变更后 5 秒内应用新配置到所有实例
2. **配置验证**: WHEN 配置值不合法时，THE System SHALL 拒绝更新并返回详细错误信息
3. **原子更新**: THE System SHALL 使用atomic.Value确保配置读取的原子性和一致性
4. **审计日志**: THE System SHALL 记录所有配置变更的审计日志，包括变更人、变更时间、变更原因
5. **回滚支持**: THE System SHALL 支持通过配置历史快速回滚到之前的版本
6. **零停机**: WHEN 配置更新时，THE System SHALL 不中断正在处理的请求和工作流
7. **配置查询**: THE System SHALL 提供API查询当前生效的配置和配置变更历史
8. **通知确认**: WHEN 配置更新成功时，THE System SHALL 发送通知给操作人员
9. **降级策略**: WHEN Redis不可用时，THE System SHALL 降级到数据库查询配置
10. **版本管理**: THE System SHALL 为每次配置变更生成版本号，支持版本对比

### 11.5 配置热更新API

```go
// API: 更新配置
// POST /api/v1/config/update
type UpdateConfigRequest struct {
    Component string      `json:"component"` // task, workflow
    Key       string      `json:"key"`
    Value     interface{} `json:"value"`
    Reason    string      `json:"reason"`
}

// API: 查询当前配置
// GET /api/v1/config/current
type GetConfigResponse struct {
    Task     TaskConfig     `json:"task"`
    Workflow WorkflowConfig `json:"workflow"`
    Version  int            `json:"version"`
}

// API: 查询配置历史
// GET /api/v1/config/history?component=task&key=max_tasks_per_user
type ConfigHistoryResponse struct {
    Items []ConfigHistory `json:"items"`
    Total int             `json:"total"`
}

type ConfigHistory struct {
    OldValue  string    `json:"old_value"`
    NewValue  string    `json:"new_value"`
    ChangedBy string    `json:"changed_by"`
    ChangedAt time.Time `json:"changed_at"`
    Reason    string    `json:"reason"`
}

// API: 回滚配置
// POST /api/v1/config/rollback
type RollbackConfigRequest struct {
    Component string `json:"component"`
    Key       string `json:"key"`
    Version   int    `json:"version"` // 回滚到的版本
    Reason    string `json:"reason"`
}
```

---

## 12. 风险与回滚

### 12.1 风险识别

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| WebSocket连接数过多导致服务器资源耗尽 | 中 | 高 | 1. 设置连接数上限（10000）<br>2. 实施连接限流<br>3. 自动清理僵尸连接<br>4. 水平扩展支持 |
| Temporal工作流执行失败导致业务中断 | 中 | 高 | 1. 实施重试机制<br>2. 设置合理的超时时间<br>3. 提供手动干预接口<br>4. 完善的错误日志 |
| PostgreSQL主库故障导致数据不可用 | 低 | 高 | 1. 主从复制（1主2从）<br>2. 自动故障转移<br>3. 定期备份<br>4. 读写分离 |
| Redis缓存失效导致数据库压力激增 | 中 | 中 | 1. 缓存预热<br>2. 降级到数据库查询<br>3. 限流保护<br>4. 多级缓存 |
| Elasticsearch索引损坏导致搜索不可用 | 低 | 中 | 1. 定期快照备份<br>2. 降级到数据库搜索<br>3. 自动重建索引<br>4. 副本保护 |
| 工作流定义错误导致执行异常 | 中 | 中 | 1. 工作流定义验证<br>2. 沙箱测试环境<br>3. 版本管理<br>4. 快速回滚 |
| 审批超时导致工作流阻塞 | 高 | 中 | 1. 设置合理的超时时间<br>2. 自动升级机制<br>3. 超时通知<br>4. 手动干预接口 |
| 配置热更新失败导致服务异常 | 低 | 中 | 1. 配置验证<br>2. 原子更新<br>3. 快速回滚<br>4. 降级策略 |
| 消息队列积压导致通知延迟 | 中 | 低 | 1. 监控队列深度<br>2. 自动扩容消费者<br>3. 优先级队列<br>4. 消息过期策略 |
| 附件存储空间不足 | 低 | 低 | 1. 容量监控<br>2. 自动清理过期附件<br>3. 压缩存储<br>4. 扩容预警 |

### 12.2 回滚方案

**应用回滚**:

```bash
# 1. 查看部署历史
kubectl rollout history deployment collaboration-api

# 2. 回滚到上一个版本
kubectl rollout undo deployment collaboration-api

# 3. 验证回滚状态
kubectl rollout status deployment collaboration-api

# 4. 检查Pod状态
kubectl get pods -l app=collaboration-api

# 5. 查看日志确认
kubectl logs -f collaboration-api-xxx
```

**数据库回滚**:

```sql
-- 1. 查看最近的备份
SELECT * FROM pg_backup_list ORDER BY backup_time DESC LIMIT 5;

-- 2. 恢复到指定时间点（PITR）
pg_restore -d collaboration -t "2026-01-31 10:00:00" backup.dump

-- 3. 验证数据完整性
SELECT COUNT(*) FROM tasks;
SELECT COUNT(*) FROM workflow_instances;
```

**配置回滚**:

```bash
# 1. 查看配置历史
curl -X GET "http://api.example.com/api/v1/config/history?component=task&key=max_tasks_per_user"

# 2. 回滚到指定版本
curl -X POST "http://api.example.com/api/v1/config/rollback" \
  -H "Content-Type: application/json" \
  -d '{
    "component": "task",
    "key": "max_tasks_per_user",
    "version": 5,
    "reason": "回滚到稳定版本"
  }'

# 3. 验证配置生效
curl -X GET "http://api.example.com/api/v1/config/current"
```

**工作流回滚**:

```bash
# 1. 终止异常的工作流实例
curl -X PUT "http://api.example.com/api/v1/workflow-instances/{id}/terminate" \
  -H "Content-Type: application/json" \
  -d '{"reason": "工作流定义错误"}'

# 2. 回滚工作流定义到上一个版本
UPDATE workflow_definitions 
SET nodes = (SELECT nodes FROM workflow_definitions WHERE id = 'xxx' AND version = 1)
WHERE id = 'xxx' AND version = 2;

# 3. 重新启动工作流
curl -X POST "http://api.example.com/api/v1/workflow-instances" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "xxx",
    "params": {...}
  }'
```

### 12.3 应急预案

**场景1: API服务不可用**

```
症状: API请求返回502/503错误

应急步骤:
1. 检查Pod状态: kubectl get pods -l app=collaboration-api
2. 查看Pod日志: kubectl logs -f collaboration-api-xxx
3. 检查资源使用: kubectl top pods
4. 如果是资源不足，立即扩容: kubectl scale deployment collaboration-api --replicas=5
5. 如果是代码问题，回滚到上一个版本
6. 通知相关人员

恢复时间目标(RTO): 5分钟
恢复点目标(RPO): 0（无数据丢失）
```

**场景2: WebSocket大量断连**

```
症状: 用户反馈频繁掉线，在线状态不准确

应急步骤:
1. 检查WebSocket连接数: kubectl exec redis-0 -- redis-cli INFO clients
2. 检查Nginx配置: kubectl logs -f nginx-ingress-controller-xxx
3. 检查网络延迟: ping api.example.com
4. 增加心跳频率（临时措施）
5. 重启Nginx Ingress Controller（如果配置问题）
6. 扩容API Server增加连接容量

恢复时间目标(RTO): 10分钟
恢复点目标(RPO): 0（无数据丢失）
```

**场景3: 工作流大量失败**

```
症状: 工作流失败率突然升高

应急步骤:
1. 查看Temporal日志: kubectl logs -f temporal-worker-xxx
2. 检查工作流定义是否有变更
3. 检查依赖服务状态（数据库、Redis、Kafka）
4. 暂停新工作流启动（临时措施）
5. 回滚工作流定义到稳定版本
6. 手动重试失败的工作流实例

恢复时间目标(RTO): 15分钟
恢复点目标(RPO): 0（工作流状态已持久化）
```

**场景4: 数据库主库故障**

```
症状: 数据库连接失败，写入操作失败

应急步骤:
1. 确认主库状态: kubectl exec postgres-0 -- pg_isready
2. 检查从库状态: kubectl exec postgres-1 -- pg_isready
3. 触发自动故障转移（如果配置了）
4. 手动提升从库为主库（如果自动转移失败）:
   kubectl exec postgres-1 -- pg_ctl promote
5. 更新应用配置指向新主库
6. 验证数据一致性
7. 修复原主库并重新加入集群

恢复时间目标(RTO): 5分钟
恢复点目标(RPO): < 1分钟（异步复制延迟）
```

**场景5: 缓存雪崩**

```
症状: Redis大量key同时过期，数据库压力激增

应急步骤:
1. 检查Redis状态: kubectl exec redis-0 -- redis-cli INFO stats
2. 检查数据库连接数: kubectl exec postgres-0 -- psql -c "SELECT count(*) FROM pg_stat_activity"
3. 启用限流保护数据库
4. 手动预热热点数据到缓存
5. 调整缓存TTL为随机值（避免同时过期）
6. 扩容数据库连接池
7. 增加Redis内存（如果内存不足）

恢复时间目标(RTO): 10分钟
恢复点目标(RPO): 0（无数据丢失）
```

### 12.4 灾难恢复

**备份策略**:

| 数据类型 | 备份频率 | 保留期限 | 备份方式 |
|---------|---------|---------|---------|
| PostgreSQL | 每天全量 + 每小时增量 | 30天 | pg_dump + WAL归档 |
| Redis | 每6小时 | 7天 | RDB快照 |
| Elasticsearch | 每天 | 14天 | Snapshot API |
| MinIO | 实时复制 | 永久 | 跨区域复制 |
| 配置文件 | 每次变更 | 永久 | Git版本控制 |

**灾难恢复演练**:

```
演练频率: 每季度一次

演练内容:
1. 模拟主数据中心故障
2. 切换到备用数据中心
3. 验证数据完整性
4. 验证服务可用性
5. 测试回切流程
6. 记录演练结果和改进点

演练目标:
- RTO < 30分钟
- RPO < 5分钟
- 数据完整性 100%
- 服务可用性 > 99.9%
```

---

## 13. 附录

### 13.1 术语表

| 术语 | 说明 |
|------|------|
| 任务 (Task) | 需要完成的工作项，包含标题、描述、负责人、优先级等信息 |
| 工作流 (Workflow) | 由多个节点组成的自动化流程，用于编排复杂的业务逻辑 |
| 工作流定义 (Workflow Definition) | 工作流的模板，定义了节点、边、变量等信息 |
| 工作流实例 (Workflow Instance) | 工作流定义的具体执行实例 |
| 节点 (Node) | 工作流中的执行单元，如任务节点、审批节点、通知节点等 |
| 边 (Edge) | 连接工作流节点的有向边，可以包含条件表达式 |
| 审批 (Approval) | 工作流中需要人工确认的环节 |
| 会签 (All Approval) | 所有审批人都同意才能通过 |
| 或签 (Any Approval) | 任意一个审批人同意即可通过 |
| 在线状态 (Presence) | 用户的在线/离线/忙碌等状态 |
| @提及 (Mention) | 在评论中使用@符号提及其他用户 |
| WebSocket | 全双工通信协议，用于实时消息推送 |
| Temporal | 开源的工作流编排引擎 |
| Activity | Temporal中的执行单元，代表一个具体的操作 |
| Signal | Temporal中的信号机制，用于外部事件通知工作流 |
| CRDT | 无冲突复制数据类型，用于协同编辑 |
| 热更新 (Hot Reload) | 在不重启服务的情况下更新配置 |
| 原子操作 (Atomic Operation) | 不可分割的操作，要么全部成功要么全部失败 |
| 幂等性 (Idempotency) | 多次执行相同操作的结果与执行一次相同 |
| 背压 (Backpressure) | 当下游处理速度慢于上游时的流量控制机制 |

### 13.2 参考文档

**官方文档**:
- [Temporal官方文档](https://docs.temporal.io/)
- [Socket.io官方文档](https://socket.io/docs/)
- [PostgreSQL官方文档](https://www.postgresql.org/docs/)
- [Redis官方文档](https://redis.io/documentation)
- [Elasticsearch官方文档](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
- [Casbin官方文档](https://casbin.org/docs/overview)
- [Yjs官方文档](https://docs.yjs.dev/)

**技术文章**:
- [Building Real-Time Collaboration Features](https://www.ably.com/blog/building-real-time-collaboration-features)
- [Workflow Orchestration with Temporal](https://temporal.io/blog/workflow-orchestration)
- [WebSocket Load Balancing](https://www.nginx.com/blog/websocket-nginx/)
- [PostgreSQL High Availability](https://www.postgresql.org/docs/current/high-availability.html)
- [Redis Pub/Sub Best Practices](https://redis.io/docs/manual/pubsub/)

**开源项目**:
- [Temporal Samples](https://github.com/temporalio/samples-go)
- [Socket.io Examples](https://github.com/socketio/socket.io/tree/main/examples)
- [Casbin Examples](https://github.com/casbin/casbin/tree/master/examples)

### 13.3 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-01-31 | v1.0 | 初稿，完成完整设计方案 | 系统架构团队 |
| - | - | - | - |

### 13.4 设计决策记录

**决策1: 选择Temporal作为工作流引擎**

- 日期: 2026-01-31
- 背景: 需要一个可靠的工作流编排引擎支持长时间运行的工作流
- 决策: 选择Temporal而不是Airflow或Cadence
- 理由:
  1. 原生支持长时间运行的工作流（适合审批场景）
  2. 自动状态持久化和故障恢复
  3. 强类型工作流定义，减少运行时错误
  4. 活跃的社区和完善的文档
- 影响: 需要学习Temporal的编程模型，但长期收益大于成本
- 状态: 已接受

**决策2: 使用WebSocket + Socket.io实现实时通信**

- 日期: 2026-01-31
- 背景: 需要实时推送任务通知和在线状态
- 决策: 使用WebSocket + Socket.io而不是Server-Sent Events或Long Polling
- 理由:
  1. 双向实时通信，适合协作场景
  2. Socket.io提供自动重连、心跳检测
  3. 房间管理功能适合任务协作
  4. Redis适配器支持多实例负载均衡
- 影响: 需要处理WebSocket连接管理和负载均衡
- 状态: 已接受

**决策3: 使用PostgreSQL JSONB存储工作流定义**

- 日期: 2026-01-31
- 背景: 工作流定义是复杂的嵌套结构
- 决策: 使用PostgreSQL JSONB字段而不是关系表
- 理由:
  1. 灵活的schema，支持动态节点类型
  2. JSONB支持索引和查询
  3. 简化数据模型，减少JOIN操作
  4. 便于版本管理和回滚
- 影响: 需要在应用层处理JSON序列化和验证
- 状态: 已接受

**决策4: 配置热更新使用Redis Pub/Sub**

- 日期: 2026-01-31
- 背景: 需要在不重启服务的情况下更新配置
- 决策: 使用Redis Pub/Sub通知配置变更
- 理由:
  1. 实时性好，延迟低
  2. 支持多实例广播
  3. 实现简单，维护成本低
  4. Redis已经是系统依赖
- 影响: 需要处理Redis不可用的降级场景
- 状态: 已接受

### 13.5 未来优化方向

**短期优化（3个月内）**:
1. 实现任务看板的拖拽排序功能
2. 支持任务批量操作（批量分配、批量关闭）
3. 增加任务模板的自定义字段
4. 优化Elasticsearch查询性能
5. 实现工作流可视化编辑器

**中期优化（6个月内）**:
1. 支持任务依赖关系（前置任务、后置任务）
2. 实现任务时间跟踪（工时统计）
3. 支持工作流子流程（嵌套工作流）
4. 增加工作流调试功能
5. 实现协同编辑功能（基于Yjs）

**长期优化（1年内）**:
1. 支持任务甘特图视图
2. 实现智能任务分配（基于负载和技能）
3. 支持工作流版本管理和A/B测试
4. 增加工作流性能分析和优化建议
5. 实现跨组织的任务协作

### 13.6 常见问题FAQ

**Q1: 如何处理WebSocket连接断开？**

A: 客户端使用Socket.io的自动重连机制，服务端保存连接状态到Redis，重连后自动恢复订阅。

**Q2: 工作流执行失败后如何恢复？**

A: Temporal会自动重试失败的Activity，如果重试次数耗尽，可以通过API手动重试或终止工作流。

**Q3: 如何保证任务分配的公平性？**

A: 可以通过配置任务分配策略，如轮询、负载均衡、技能匹配等，未来会支持智能分配。

**Q4: 如何处理审批超时？**

A: 可以配置超时策略，如自动拒绝、自动升级、通知管理员等，默认是自动拒绝。

**Q5: 如何扩展工作流节点类型？**

A: 工作流引擎支持插件化扩展，可以通过实现NodeExecutor接口添加自定义节点类型。

**Q6: 如何监控工作流执行性能？**

A: Temporal提供了丰富的监控指标，可以通过Prometheus采集并在Grafana中可视化。

**Q7: 如何实现跨组织的任务协作？**

A: 当前版本支持单组织内的任务协作，跨组织协作需要实现租户隔离和权限控制，计划在长期优化中实现。

**Q8: 如何处理大量历史数据？**

A: 使用PostgreSQL分区表按时间分区，定期归档90天前的历史数据到冷存储。

**Q9: 如何保证配置热更新的一致性？**

A: 使用PostgreSQL事务保证配置更新的原子性，使用atomic.Value保证配置读取的一致性。

**Q10: 如何测试工作流定义？**

A: 提供沙箱测试环境，可以在不影响生产数据的情况下测试工作流定义，未来会支持工作流调试功能。

---

**文档结束**
