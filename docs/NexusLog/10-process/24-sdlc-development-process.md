# NexusLog 开发流程规范（SDLC）

> 版本：v1.0
> 基线日期：2026-03-06
> 适用对象：AI Agent（主执行者）+ 人类审查者
> 配套文档：`23-project-master-plan-and-task-registry.md`（整体规划）、`25-full-lifecycle-task-registry.md`（任务清单）

---

## 1. 文档目的与术语

### 1.1 文档目的

本文档定义 NexusLog 项目全生命周期的**开发过程规范**，包括开发流程、代码约束、质量门禁、测试策略、部署管理和验收标准。所有任务执行——无论由 AI Agent 还是人类开发者完成——均必须遵循本规范。

### 1.2 文档关系

```text
┌────────────────────────────────────────────┐
│  doc23: 项目整体规划与任务登记表              │
│  定义 "做什么"（25 模块/4 Phase/API/DB）      │
└────────────────┬───────────────────────────┘
                 │
    ┌────────────┴────────────┐
    │                         │
    ▼                         ▼
┌──────────────────┐  ┌───────────────────────┐
│  doc24: 本文档     │  │  doc25: 任务清单        │
│  定义 "怎么做"     │  │  定义 "具体做什么"      │
│  流程/约束/门禁    │  │  每张卡片引用本文档     │
└──────────────────┘  └───────────────────────┘
    │                         │
    └────────────┬────────────┘
                 ▼
         doc20/21/22
         独立技术规范
```

### 1.3 术语定义

| 术语 | 全称 | 说明 |
|------|------|------|
| DoR | Definition of Ready | 任务准入条件——满足后方可开始开发 |
| DoD | Definition of Done | 任务完成条件——满足后方可标记完成 |
| QG | Quality Gate | 质量门禁——阻止不合格产物流入下一环节 |
| SLA | Service Level Agreement | 服务等级协议——可用性/延迟/吞吐等指标承诺 |
| SDLC | Software Development Life Cycle | 软件开发生命周期 |
| E2E | End-to-End | 端到端测试 |
| Mock | Mock Data | 模拟数据——前端页面中硬编码的假数据 |
| Fallback | Fallback | 降级逻辑——本项目禁止 mock fallback，API 出错时统一弹窗提示 |
| WAL | Write-Ahead Log | 预写日志——Agent 断线缓冲机制 |

---

## 2. 任务生命周期状态机

### 2.1 状态定义

```text
                          ┌──────────┐
                          │ Backlog  │ 需求已识别但未满足准入条件
                          └────┬─────┘
                               │ 满足 DoR
                          ┌────▼─────┐
                          │  Ready   │ 准入条件已满足，等待领取
                          └────┬─────┘
                               │ Agent 领取
                          ┌────▼─────┐
                ┌────────►│InProgress│◄────────┐
                │         └────┬─────┘         │
                │              │ 编码完成        │ 阻塞解除
                │         ┌────▼──────┐   ┌────┴────┐
                │         │CodeComplete│   │ Blocked │
                │         └────┬──────┘   └─────────┘
                │              │ 单元测试通过
                │         ┌────▼──────┐
                │         │UnitTested │
                │         └────┬──────┘
                │              │ 接口联调通过
                │         ┌────▼─────┐
                │         │ APIReady │
                │         └────┬─────┘
                │              │ 前端接入完成
                │         ┌────▼──────────────┐
                │         │FrontendIntegrated │
                │         └────┬──────────────┘
                │              │ 部署到 dev
                │         ┌────▼─────┐
                │         │ Deployed │
                │         └────┬─────┘
                │              │ E2E + 前端调试通过
                │         ┌────▼───────┐
                │         │E2EVerified │
     E2E失败    │         └────┬───────┘
     回退至      │              │ 合并到 develop
     CodeComplete│         ┌────▼─────┐
                └──────────│  Merged  │
                           └──────────┘
```

### 2.2 准入条件（DoR）

任务从 Backlog 进入 Ready 状态前必须满足：

- [ ] 任务 ID 和标题已定义（见 doc25）
- [ ] 前置依赖任务已完成或无依赖
- [ ] 验收标准已明确（至少包含功能验证 + 测试要求）
- [ ] 涉及服务和变更范围已识别
- [ ] 如涉及数据库变更，DDL 已在 doc22 或 doc23 中定义

### 2.3 完成条件（DoD）

任务从 E2EVerified 进入 Merged 状态前必须满足：

- [ ] 所有验收标准的检查项已勾选
- [ ] `make lint` 通过（零错误）
- [ ] `make test` 通过（零失败）
- [ ] 如涉及迁移：`make db-migrate-up` + `make db-migrate-down` 双向成功
- [ ] 如涉及前端：浏览器 Console 无新增错误
- [ ] 代码已提交至 feature 分支，commit message 符合规范
- [ ] 不引入新的 linter 警告

### 2.4 状态回退规则

| 当前状态 | 触发条件 | 回退至 | 处理方式 |
|---------|---------|--------|---------|
| E2EVerified | E2E 测试失败 | CodeComplete | 修复 bug 后重新走 UnitTested→...→E2EVerified |
| Deployed | 服务启动失败 | CodeComplete | 检查配置/依赖后重新部署 |
| FrontendIntegrated | API 响应格式不匹配 | APIReady | 修正前端调用或后端响应后重试 |
| UnitTested | 接口联调发现设计缺陷 | InProgress | 调整设计后重新编码 |
| InProgress | 发现前置依赖未完成 | Blocked | 等待依赖完成后恢复 |

---

## 3. 标准开发流程（7 步）

### 3.1 流程概览

```text
 ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
 │ 1.需求   │──►│ 2.后端   │──►│ 3.后端   │──►│ 4.接口   │
 │   理解   │   │   开发   │   │   测试   │   │   联调   │
 └─────────┘   └─────────┘   └─────────┘   └─────────┘
                                                  │
 ┌─────────┐   ┌─────────┐   ┌─────────┐         │
 │ 7.前端   │◄──│ 6.部署   │◄──│ 5.前端   │◄────────┘
 │   调试   │   │   验证   │   │   接入   │
 └─────────┘   └─────────┘   └─────────┘
```

### 3.2 各步骤详情

#### 步骤 1：需求理解

| 项 | 说明 |
|---|------|
| 输入 | 任务卡片（doc25）+ 关联的 doc23 Spec 映射 |
| 动作 | 阅读任务卡片的验收标准、约束规则、变更范围；确认前置依赖已完成 |
| 输出 | 对任务范围和验收标准的理解 |
| 门禁 | 确认理解所有验收标准项 |

#### 步骤 2：后端开发

| 项 | 说明 |
|---|------|
| 输入 | 任务卡片中的变更范围 |
| 动作 | 按照 4.1 节 Go 约束编写代码；如有数据库变更，创建迁移脚本 |
| 输出 | Go 源代码 + 迁移脚本（如需要） |
| 门禁 | `make backend-lint` 通过 |
| 命令 | `make backend-lint` |

#### 步骤 3：后端测试

| 项 | 说明 |
|---|------|
| 输入 | 步骤 2 的 Go 源代码 |
| 动作 | 编写单元测试，确保核心逻辑覆盖 |
| 输出 | 测试文件 `*_test.go` + 测试通过 |
| 门禁 | `make backend-test` 通过，核心模块覆盖率 >= 60% |
| 命令 | `make backend-test` |

#### 步骤 4：接口联调

| 项 | 说明 |
|---|------|
| 输入 | 后端 API 已就绪 |
| 动作 | 启动服务，使用 curl/httpie 验证 API 的请求/响应 |
| 输出 | API 返回正确的状态码和响应体 |
| 门禁 | HTTP 状态码正确 + 响应体符合统一格式 |
| 命令 | `make dev-up` 后手动验证 |

验证示例：
```bash
# 检查服务健康
curl -s http://localhost:8080/healthz | jq .

# 验证 API 响应格式（受保护接口需携带 Bearer Token 与租户头）
curl -s -X POST http://localhost:8080/api/v1/xxx \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "X-Tenant-ID: ${TENANT_ID}" \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}' | jq .
```

#### 步骤 5：前端接入

| 项 | 说明 |
|---|------|
| 输入 | 步骤 4 确认的 API |
| 动作 | 创建/更新 `src/api/` 下的 API 文件；**完全删除**页面中的 mock 数据；接入真实 API 调用；API 出错时使用 `message.error()` 弹窗提示错误原因 |
| 输出 | 前端页面接入真实 API，所有数据均为真实数据 |
| 门禁 | `make frontend-lint` 通过 + TypeScript 编译通过 |
| 命令 | `cd apps/frontend-console && pnpm lint && pnpm build` |

#### 步骤 6：部署验证

| 项 | 说明 |
|---|------|
| 输入 | 前后端代码均已完成 |
| 动作 | 使用 `make dev-up` 启动完整环境，执行冒烟测试 |
| 输出 | 所有服务正常运行 |
| 门禁 | `make dev-test-smoke` 通过 |
| 命令 | `make dev-up && make dev-test-smoke` |

#### 步骤 7：前端调试（chrome-devtools MCP 全功能测试）

| 项 | 说明 |
|---|------|
| 输入 | 步骤 6 的运行环境 |
| 动作 | 使用 `chrome-devtools` MCP 工具对页面进行**全功能测试**，收集四类证据（见第 12 章） |
| 输出 | 页面功能正常 + 四类证据齐全 |
| 门禁 | Console 无新增错误 + Network 请求返回 2xx + 所有交互流程验证通过 |
| 工具 | `chrome-devtools` MCP（配置见 `.mcp.json`，连接 `http://127.0.0.1:9222`） |
| 测试范围 | 页面渲染、所有交互操作（增删改查）、路由跳转、API 联调、错误弹窗验证 |

### 3.3 步骤适用性

不同类型的任务适用不同步骤子集：

| 任务类型 | 适用步骤 | 示例 |
|---------|---------|------|
| 全栈任务 | 1→2→3→4→5→6→7 | W1-B5 ES 结构化日志 v2 + W1-F2 日志详情 |
| 纯后端任务 | 1→2→3→4→6 | W1-B4 加密传输 |
| 纯前端任务 | 1→5→6→7 | W1-F2 日志详情展开 |
| 数据库任务 | 1→2→6 | W1-D1 迁移 000018 |
| 测试任务 | 1→3→6→7 | W5-T1 采集链路 E2E 测试 |
| 文档任务 | 1→6 | W6-D1 部署手册 |
| 基础设施任务 | 1→2→6 | W1-INFRA-01 网关路由 |

---

## 4. 代码约束规则

### 4.1 后端 Go 约束

#### 4.1.1 服务边界

每个服务有明确的职责范围，**禁止将代码写入错误的服务**：

| 服务 | 目录 | 职责范围 | 禁止 |
|------|------|---------|------|
| api-service | `services/api-service/` | 认证（注册/登录/刷新/登出/密码重置） | 不写业务逻辑 |
| control-plane | `services/control-plane/` | 采集控制、告警、事件、通知、资源监控、备份 | 服务端校验 Bearer JWT，并以令牌 claims 覆盖 `X-Tenant-ID` / `X-User-ID` |
| query-api | `services/data-services/query-api/` | 日志检索、Dashboard 统计、聚合分析 | 服务端校验 Bearer JWT，并以令牌 claims 覆盖 `X-Tenant-ID` / `X-User-ID` |
| audit-api | `services/data-services/audit-api/` | 审计日志查询与导出 | 服务端校验 Bearer JWT，并以令牌 claims 覆盖 `X-Tenant-ID` / `X-User-ID` |
| export-api | `services/data-services/export-api/` | 导出任务管理与文件下载 | 服务端校验 Bearer JWT，并以令牌 claims 覆盖 `X-Tenant-ID` / `X-User-ID` |
| health-worker | `services/health-worker/` | 服务健康检查与调度 | 不写 HTTP API |
| collector-agent | `agents/collector-agent/` | 日志采集、checkpoint、Pull API、系统指标 | 不写服务端逻辑 |

#### 4.1.2 分层架构

每个服务内部遵循三层架构：

```text
  HTTP Request
       │
  ┌────▼────┐
  │ handler │  接收请求、参数校验、调用 service、返回响应
  └────┬────┘
       │
  ┌────▼────┐
  │ service │  业务逻辑、编排、事务管理
  └────┬────┘
       │
  ┌────▼──────┐
  │repository │  数据访问、SQL 执行、外部存储调用
  └───────────┘
```

**约束规则**：
- handler 禁止直接调用 repository
- repository 禁止包含业务逻辑
- service 通过接口注入 repository（便于测试 mock）
- 目录结构：`internal/handler/`、`internal/service/`、`internal/repository/`

#### 4.1.3 错误处理

统一使用 `httpx.Response` 格式（参考 `services/api-service/internal/httpx/response.go`）：

```go
// 成功响应
httpx.Success(c, data)

// 错误响应 — 使用预定义错误码
httpx.Error(c, http.StatusBadRequest, "INVALID_PARAMS", "参数校验失败")
```

响应体结构：
```json
{
  "code": 0,
  "message": "success",
  "data": {},
  "timestamp": "2026-03-06T10:00:00Z",
  "request_id": "req-xxx"
}
```

#### 4.1.4 配置管理

使用 YAML 配置文件 + file watcher 模式（参考各服务的 `internal/config/watcher.go`）：
- 配置文件路径：`configs/config.yaml`（每个服务独立）
- 支持热更新的字段标注 `change_level: hot`
- 需重启的字段标注 `change_level: restart`

#### 4.1.5 数据库访问

- 使用 `database/sql` + 原生 SQL，不使用 ORM
- 连接获取：通过 `sql.DB` 连接池，`max_open_conns=25`
- SQL 语句：使用参数化查询，禁止字符串拼接
- 事务：使用 `tx.Begin()` / `tx.Commit()` / `tx.Rollback()`，defer rollback

#### 4.1.6 Go 代码风格

- 遵循 `golangci-lint` 默认规则集
- 函数长度：建议不超过 80 行
- 错误处理：`if err != nil { return }` 模式，禁止忽略错误
- 日志：使用 `log/slog` 结构化日志
- 并发：使用 `context.Context` 传递取消信号和超时

### 4.2 前端 React 约束

#### 4.2.1 Mock 替换规则

**核心原则：每完成一个功能，必须完全去除对应的 mock 数据，保证页面展示的所有数据均来自真实 API。API 出错时通过弹窗（Ant Design `message` 或 `notification`）向用户说明错误原因，而非静默降级到 mock。**

前端页面去 mock 时遵循以下规则：

```typescript
import { message } from 'antd';
import { fetchXxxData } from '@/api/xxx';

// 完全移除 mock 数据常量，使用空数组作为初始值
const [data, setData] = useState<DataType[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  setLoading(true);
  fetchXxxData()
    .then(setData)
    .catch((err) => {
      message.error(`数据加载失败：${err.message || '服务不可用，请稍后重试'}`);
    })
    .finally(() => setLoading(false));
}, []);
```

**关键原则**：
- **完全删除** mock 数据常量，不保留任何 mock fallback
- API 文件在 `src/api/` 下按模块组织
- 网络错误或 API 异常时通过 `message.error()` 弹窗提示用户错误原因
- 页面在无数据时展示空状态组件（`Empty`），而非 mock 数据
- 加载中展示 `Spin` 或 `Skeleton` 组件

#### 4.2.2 状态管理

使用 Zustand（参考已有的 `src/stores/authStore.ts` 模式）：
- 全局状态放入 `src/stores/xxxStore.ts`
- 页面局部状态使用 React `useState`
- 需要持久化的状态使用 `zustand/middleware` 的 `persist`

#### 4.2.3 API 调用层

在 `src/api/` 下按模块创建 API 文件：

```text
src/api/
├── query.ts          # 已有 - 日志检索
├── auth.ts           # 认证相关
├── alert.ts          # 告警管理
├── incident.ts       # 事件管理
├── ingest.ts         # 采集控制
├── metrics.ts        # 资源监控
├── export.ts         # 导出与备份
├── audit.ts          # 审计日志
├── user.ts           # 用户管理
└── notification.ts   # 通知渠道
```

每个 API 文件使用统一的请求封装：
```typescript
const API_BASE = '/api/v1';

export async function fetchAlertRules(): Promise<AlertRule[]> {
  const res = await fetch(`${API_BASE}/alert/rules`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.data;
}
```

#### 4.2.4 类型定义

在 `src/types/` 下维护类型文件，与后端 API 响应结构对齐：
- 文件名与业务模块对应（`alert.ts`、`incident.ts` 等）
- 类型命名使用 PascalCase：`AlertRule`、`IncidentDetail`
- 通过 `src/types/index.ts` 统一导出

#### 4.2.5 组件组织

- `src/components/` 按功能域组织公共组件
- `src/pages/` 按业务模块组织页面组件
- 页面级组件禁止被其他页面引用
- 可复用逻辑抽取到 `src/hooks/`（待创建）

### 4.3 数据库约束

#### 4.3.1 迁移文件管理

| 项 | 规则 |
|---|------|
| 路径 | `storage/postgresql/migrations/` |
| 命名 | `{6位版本}_{snake_case描述}.up.sql` / `.down.sql` |
| 版本号 | 从 000018 递增（000001~000017 已存在） |
| 双向 | 每个 `.up.sql` 必须有对应的 `.down.sql` |
| 创建命令 | `make db-migrate-create NAME=descriptive_name` |
| 验证命令 | `make db-migrate-up STEPS=1 && make db-migrate-down STEPS=1` |

#### 4.3.2 SQL 规范

- 表名：`snake_case`，复数形式（`alert_rules`、`incidents`）
- 字段名：`snake_case`（`created_at`、`updated_by`）
- 主键：使用 `BIGSERIAL` 或 `UUID`，字段名 `id`
- 时间字段：`TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- 索引：为查询条件中频繁使用的字段创建索引
- 外键：明确声明 `ON DELETE` 行为（`CASCADE` / `SET NULL` / `RESTRICT`）
- 约束：使用 `CHECK` 约束验证枚举值

#### 4.3.3 种子数据

- 种子数据通过迁移脚本 `INSERT` 插入（如 000018 的角色种子数据）
- 使用 `ON CONFLICT DO NOTHING` 保证幂等性
- 禁止在迁移脚本中插入测试数据

### 4.4 API 约束

#### 4.4.1 路径规范

遵循 doc23 第 9 章定义的路径前缀：

| 服务 | 路径前缀 | 网关路由 |
|------|---------|---------|
| api-service（认证） | `/api/v1/auth/*`, `/api/v1/users/*` | → api_service |
| control-plane（采集） | `/api/v1/ingest/*` | → control_plane |
| control-plane（告警） | `/api/v1/alert/*` | → control_plane |
| control-plane（通知） | `/api/v1/notification/*` | → control_plane |
| control-plane（事件） | `/api/v1/incidents/*` | → control_plane |
| control-plane（资源） | `/api/v1/metrics/*`, `/api/v1/resource/*` | → control_plane |
| control-plane（备份） | `/api/v1/backup/*` | → control_plane |
| query-api（检索） | `/api/v1/query/*` | → query_api |
| audit-api（审计） | `/api/v1/audit/*` | → audit_api |
| export-api（导出） | `/api/v1/export/*` | → export_api |
| collector-agent | `/agent/v1/*` | 不经过网关 |

#### 4.4.2 响应格式

所有 API 统一使用以下响应结构：

```json
{
  "code": 0,
  "message": "success",
  "data": {},
  "timestamp": "2026-03-06T10:00:00Z",
  "request_id": "req-uuid"
}
```

错误响应：
```json
{
  "code": 400,
  "message": "INVALID_PARAMS",
  "data": null,
  "timestamp": "2026-03-06T10:00:00Z",
  "request_id": "req-uuid"
}
```

#### 4.4.3 HTTP 方法语义

| 方法 | 语义 | 幂等 | 成功码 |
|------|------|------|--------|
| GET | 查询 | 是 | 200 |
| POST | 创建 | 否 | 201 |
| PUT | 全量更新 | 是 | 200 |
| PATCH | 部分更新 | 是 | 200 |
| DELETE | 删除/禁用 | 是 | 200 或 204 |

#### 4.4.4 分页规范

列表接口统一使用 offset+limit 分页：
- 请求参数：`page`（默认 1）、`page_size`（默认 20，最大 100）
- 响应 data 结构：`{ "items": [], "total": 100, "page": 1, "page_size": 20 }`

#### 4.4.5 错误码体系

参考 `services/api-service/internal/model/api_error_catalog.go`：

| HTTP 状态码 | 业务码前缀 | 说明 |
|------------|-----------|------|
| 400 | INVALID_* | 参数校验失败 |
| 401 | AUTH_* | 认证失败（未登录/token 过期） |
| 403 | FORBIDDEN_* | 权限不足 |
| 404 | NOT_FOUND_* | 资源不存在 |
| 409 | CONFLICT_* | 资源冲突（重复创建） |
| 422 | UNPROCESSABLE_* | 语义校验失败 |
| 429 | RATE_LIMIT_* | 限流 |
| 500 | INTERNAL_* | 服务器内部错误 |
| 503 | UNAVAILABLE_* | 服务不可用 |

### 4.5 Agent 上下文边界约束

AI Agent 执行任务时必须遵守以下边界规则：

#### 4.5.1 单次任务修改范围

| 约束 | 说明 |
|------|------|
| 后端服务数量 | 最多涉及 **1 个** 后端服务的代码修改 |
| 前端页面数量 | 最多涉及同一任务卡片中列出的前端页面 |
| 迁移文件数量 | 最多创建 **1 个** 迁移脚本（1 对 up/down） |
| 配置文件 | 仅修改涉及服务的 `configs/` 下的文件 |

#### 4.5.2 禁止修改的文件（除非任务卡片明确要求）

| 文件/目录 | 例外条件 |
|----------|---------|
| `go.mod` / `go.sum` | 需要添加新的第三方依赖时可修改 |
| `docker-compose.yml` / `docker-compose.override.yml` | 添加新服务或修改端口映射时可修改 |
| `.github/workflows/*.yml` | 专门的 CI/CD 任务时可修改 |
| `gateway/openresty/` | 专门的网关路由任务（如 W1-INFRA-01）时可修改 |
| `Makefile` | 添加新的构建/测试 target 时可修改 |
| `package.json` | 需要添加新的 npm 依赖时可修改 |
| 其他服务的代码 | 禁止跨服务修改 |

#### 4.5.3 任务完成自检清单

每个任务完成后，Agent 必须执行以下自检：

```bash
# 1. 后端 lint
make backend-lint

# 2. 后端测试
make backend-test

# 3. 前端 lint（如果修改了前端）
make frontend-lint

# 4. 前端构建（如果修改了前端）
cd apps/frontend-console && pnpm build

# 5. 迁移测试（如果创建了迁移）
make db-migrate-up STEPS=1
make db-migrate-down STEPS=1
```

---

## 5. 质量门禁定义

### 5.1 门禁等级

| 门禁 ID | 名称 | 检查项 | 执行命令 | 阻塞级别 | 适用步骤 |
|---------|------|--------|---------|---------|---------|
| G1 | 编译门禁 | Go 编译成功 | `make backend-build` | 硬阻塞 | 步骤 2 |
| G2 | Lint 门禁 | 静态分析零错误 | `make lint` | 硬阻塞 | 步骤 2, 5 |
| G3 | 单元测试 | 测试通过 + 覆盖率 | `make test` | 硬阻塞 | 步骤 3 |
| G4 | 迁移门禁 | up/down 双向成功 | `make db-migrate-up && make db-migrate-down` | 硬阻塞 | 步骤 2 |
| G5 | TS 类型检查 | TypeScript 编译通过 | `cd apps/frontend-console && pnpm build` | 硬阻塞 | 步骤 5 |
| G6 | 冒烟测试 | 服务启动正常 | `make dev-up && make dev-test-smoke` | 软阻塞 | 步骤 6 |
| G7 | 前端全功能测试 | Console 无新增错误 + Network 2xx + 交互流程通过 | `chrome-devtools` MCP 全功能测试 | **硬阻塞** | 步骤 7 |

### 5.2 阻塞级别说明

- **硬阻塞**：未通过则**禁止**进入下一步骤，必须修复后重新检查
- **软阻塞**：未通过时**警告**但可继续，需记录到任务卡片的备注中，在后续迭代修复

### 5.3 门禁失败处理流程

```text
门禁失败
  │
  ├── 硬阻塞？
  │     ├── 是 → 回退到上一步骤 → 修复 → 重新检查
  │     └── 否 → 记录警告 → 继续下一步骤
  │
  └── 连续 3 次失败？
        ├── 是 → 任务状态 → Blocked → 人工介入
        └── 否 → 继续尝试修复
```

---

## 6. 测试策略细则

### 6.1 测试文件位置

| 测试类型 | 文件位置 | 命名规则 | 运行命令 |
|---------|---------|---------|---------|
| Go 单元测试 | 与源码同目录 | `xxx_test.go` | `make backend-test` |
| Go 集成测试 | `tests/integration/` | `xxx_integration_test.go` | `tests/integration/run.sh` |
| TS 单元测试 | `apps/frontend-console/tests/` | `xxx.test.ts(x)` | `cd apps/frontend-console && pnpm test` |
| E2E 测试 | `tests/e2e/tests/` | `xxx.spec.js` | `cd tests/e2e && npx playwright test` |
| 冒烟测试 | Makefile target | - | `make dev-test-smoke` |

### 6.2 单元测试要求

| 模块类型 | 最低覆盖率 | 必须覆盖的场景 |
|---------|-----------|-------------|
| 加密/解密 | 80% | 正常加解密、密钥不匹配、数据篡改检测 |
| 去重逻辑 | 80% | 重复检测、窗口滑动、边界批次 |
| 级别检测 | 80% | 三种格式识别 + UNKNOWN 默认值 |
| 告警评估 | 70% | 规则匹配、阈值边界、静默过滤 |
| 权限中间件 | 70% | 三角色隔离、token 过期、无 token |
| Handler 层 | 60% | 参数校验、错误响应格式 |
| Service 层 | 60% | 核心业务逻辑分支 |
| Repository 层 | 按需 | SQL 正确性（可用集成测试替代） |

### 6.3 集成测试环境

使用 `tests/integration/docker-compose.test.yml` 提供隔离的测试基础设施：
- PostgreSQL（端口 15432，数据库 `nexuslog_test`）
- Redis（端口 16379）

### 6.4 E2E 测试要求

Phase 1 必须覆盖的 E2E 场景（Week 5 执行）：

| 场景 | 验证内容 | 相关任务 |
|------|---------|---------|
| 采集链路 | 多源多文件、轮转、压力（10000 条/min） | W1-B1~B8 |
| 告警通知 | 规则触发 → 通知送达（30s 内） | W2-B4~B7 |
| 事件管理 | 7 步闭环 + 时间线完整 | W3-B1~B4 |
| 权限隔离 | admin/operator/viewer 三角色 | W2-B1~B3 |
| 备份恢复 | 备份 → 删除 → 恢复 → 数据可查 | W4-B3 |

---

## 7. 部署与环境管理

### 7.1 环境定义

| 环境 | 启动方式 | 用途 | 数据 |
|------|---------|------|------|
| dev | `make dev-up` | 日常开发 + 联调 | 种子数据 + 测试数据 |
| integration-test | `tests/integration/run.sh` | 集成测试 | 自动生成/清理 |
| staging | Docker Compose（远程） | 预发布验证 | 脱敏后的生产子集 |
| prod | Docker Compose / K8s | 生产环境 | 真实数据 |

### 7.2 dev 环境服务清单

使用 `make dev-up` 启动的服务（base + override）：

| 服务 | 端口 | 健康检查 |
|------|------|---------|
| frontend-console | 3000 | `curl http://localhost:3000` |
| api-service | 8085 | `curl http://localhost:8085/healthz` |
| control-plane | 8080 | `curl http://localhost:8080/healthz` |
| query-api | 8082 | `curl http://localhost:8082/healthz` |
| audit-api | 8083 | `curl http://localhost:8083/healthz` |
| export-api | 8084 | `curl http://localhost:8084/healthz` |
| health-worker | 8081 | `curl http://localhost:8081/healthz` |
| collector-agent | 9091 | `curl http://localhost:9091/healthz` |
| postgres | 5432 | `pg_isready -h localhost -p 5432` |
| redis | 6379 | `redis-cli -p 6379 ping` |
| elasticsearch | 9200 | `curl http://localhost:9200/_cluster/health` |

### 7.3 部署验证清单

每次 `make dev-up` 后执行以下验证：

```bash
# 1. 基础设施健康
curl -s http://localhost:9200/_cluster/health | jq .status
curl -s http://localhost:5432 2>&1 | head -1  # 或 pg_isready

# 2. 后端服务健康
for port in 8080 8082 8083 8084 8085; do
  echo "Port $port: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:$port/healthz)"
done

# 3. 前端可访问
curl -s -o /dev/null -w '%{http_code}' http://localhost:3000

# 4. 数据库迁移状态
make db-migrate-version
```

### 7.4 回滚流程

| 场景 | 回滚步骤 |
|------|---------|
| 代码变更导致服务崩溃 | `make dev-down` → `git stash` → `make dev-up` |
| 迁移脚本错误 | `make db-migrate-down STEPS=1` → 修复脚本 → `make db-migrate-up STEPS=1` |
| 前端构建失败 | 恢复 `package.json` → `pnpm install` → `pnpm build` |
| 配置变更导致问题 | `git checkout -- configs/` → 重启服务 |

---

## 8. Git 工作流

### 8.1 分支策略

引用 doc23 第 11.8 节，本节补充 Agent 执行细节。

```text
main ────────────────── 发布分支（tag: v1.0.0, v1.1.0, ...）
  │
  └── develop ───────── 开发主分支（CI 自动构建）
        │
        ├── feature/W1-B1-level-detect ── 功能分支
        ├── fix/W2-B5-alert-scan ──────── 修复分支
        └── release/v1.0 ─────────────── 发布准备分支
```

### 8.2 分支命名规则

| 分支类型 | 命名格式 | 示例 |
|---------|---------|------|
| 功能分支 | `feature/{周次}-{任务号}-{描述}` | `feature/W1-B1-level-detect` |
| 修复分支 | `fix/{周次}-{任务号}-{描述}` | `fix/W2-B5-alert-scan-timeout` |
| 发布分支 | `release/v{版本}` | `release/v1.0` |
| 热修复 | `hotfix/{描述}` | `hotfix/auth-token-expire` |

### 8.3 Commit Message 规范

格式：`{type}({scope}): {task-id} {description}`

| 字段 | 说明 | 示例值 |
|------|------|--------|
| type | 变更类型 | `feat` / `fix` / `refactor` / `test` / `docs` / `chore` |
| scope | 涉及服务 | `control-plane` / `agent` / `frontend` / `db` / `gateway` |
| task-id | 任务编号 | `W1-B1` / `P2-M3-01` |
| description | 简要描述 | `implement log level detection` |

示例：
```
feat(agent): W1-B1 implement three-layer log level detection
fix(control-plane): W2-B5 fix alert scan query timeout
test(integration): W5-T1 add ingest e2e test
docs(process): W6-D1 add deployment manual
chore(db): W1-D1 add migration 000018 roles seed data
```

### 8.4 PR 模板

```markdown
## 任务信息
- 任务 ID：W1-B1
- 关联文档：doc25 Phase 1 / Week 1

## 变更内容
- 简要说明本次变更的内容和目的

## 验收标准检查
- [ ] 功能验证通过
- [ ] 单元测试通过（覆盖率 >= 60%）
- [ ] `make lint` 通过
- [ ] `make test` 通过

## 测试步骤
1. 如何验证本次变更

## 截图/日志
（如涉及前端页面变更，附上截图）
```

### 8.5 合并规则

| 合并方向 | 合并策略 | 条件 |
|---------|---------|------|
| feature → develop | Squash Merge | CI 通过 + DoD 满足 |
| release → main | Merge Commit | 全部 E2E 通过 + 验收确认 |
| hotfix → main + develop | Cherry-pick | 紧急修复 + 最小变更 |

---

## 9. 验收标准编写规范

### 9.1 标准模板

每个任务的验收标准必须包含以下 6 类检查项（按需选择，至少包含前 2 项）：

```markdown
**验收标准**:
- [ ] **功能**：[预期行为的具体描述，包含输入→输出]
- [ ] **边界**：[异常输入/极端场景的处理预期]
- [ ] **性能**：[响应时间/资源消耗上限]
- [ ] **安全**：[权限校验/数据脱敏/加密要求]
- [ ] **可观测**：[日志输出/指标暴露/错误码定义]
- [ ] **回归**：[确认未破坏的现有功能]
```

### 9.2 编写规则

| 规则 | 说明 | 好的示例 | 差的示例 |
|------|------|---------|---------|
| 可验证 | 每个标准必须能被客观验证 | ES 中 `level` 字段有值 | 级别检测正常工作 |
| 有边界 | 包含具体的数值或阈值 | 响应时间 < 3s | 响应速度快 |
| 有输入输出 | 描述触发条件和预期结果 | 输入 `[ERROR]` 格式 → `level=ERROR` | 能识别错误 |
| 可回归 | 指出可能被影响的现有功能 | 现有日志检索 API 返回不变 | 不影响其他功能 |

### 9.3 示例

以 W1-B1（Agent 日志级别检测）为例：

```markdown
**验收标准**:
- [ ] **功能**：ES 中 `level` 有值且准确覆盖三种格式：
  - `[ERROR] xxx` → `level=ERROR`
  - `{"level":"error"}` → `level=ERROR`
  - 独立关键字 `ERROR xxx` → `level=ERROR`
  - 未识别 → `level=UNKNOWN`
- [ ] **边界**：空行/二进制内容不 panic，返回 `level=UNKNOWN`
- [ ] **性能**：级别检测 CPU 增量 < 2%（相比未启用）
- [ ] **可观测**：`level_detect_total` 和 `level_detect_unknown_total` 指标可查
- [ ] **回归**：现有 checkpoint/pull API 功能不受影响
```

---

## 10. Mock 清除追踪表

### 10.1 概述

前端共 59 个页面，当前约 90% 使用内联 mock 数据。本表追踪每个页面的 mock 状态和去 mock 计划。

### 10.2 状态定义

| 状态 | 说明 |
|------|------|
| REAL | 已接入真实 API，mock 数据已完全删除，错误时弹窗提示 |
| PARTIAL | 部分接口已接入（mock 已删除），部分接口尚未开发 |
| MOCK | 仍使用内联 mock 数据（对应后端 API 尚未开发） |
| STATIC | 静态内容页面，无需 API（如帮助文档） |
| N/A | Phase 2+ 才开发 API，当前阶段保持 mock |

### 10.3 追踪矩阵

#### 认证模块

| # | 页面 | 文件 | 当前状态 | 目标状态 | 去 mock 阶段 | 关联任务 |
|---|------|------|---------|---------|-------------|---------|
| 1 | 登录 | `auth/LoginPage.tsx` | PARTIAL | REAL | Phase 1 W2 | W2-B1 |
| 2 | 注册 | `auth/RegisterPage.tsx` | PARTIAL | REAL | Phase 1 W2 | W2-B1 |
| 3 | 忘记密码 | `auth/ForgotPasswordPage.tsx` | PARTIAL | REAL | Phase 1 W2 | W2-B1 |

#### 日志检索模块

| # | 页面 | 文件 | 当前状态 | 目标状态 | 去 mock 阶段 | 关联任务 |
|---|------|------|---------|---------|-------------|---------|
| 4 | 实时搜索 | `search/RealtimeSearch.tsx` | PARTIAL | REAL | Phase 1 W1 | W1-F1 |
| 5 | 保存查询 | `search/SavedQueries.tsx` | PARTIAL | REAL | Phase 1 W5 | W5-F1 |
| 6 | 搜索历史 | `search/SearchHistory.tsx` | PARTIAL | REAL | Phase 1 W5 | W5-F1 |

#### 告警模块

| # | 页面 | 文件 | 当前状态 | 目标状态 | 去 mock 阶段 | 关联任务 |
|---|------|------|---------|---------|-------------|---------|
| 7 | 告警规则 | `alerts/AlertRules.tsx` | MOCK | REAL | Phase 1 W2 | W2-F4 |
| 8 | 告警列表 | `alerts/AlertList.tsx` | MOCK | REAL | Phase 1 W2 | W2-F5 |
| 9 | 通知配置 | `alerts/NotificationConfig.tsx` | MOCK | REAL | Phase 1 W2 | W2-F6 |
| 10 | 静默策略 | `alerts/SilencePolicy.tsx` | MOCK | REAL | Phase 1 W4 | W4-F6 |

#### 事件管理模块

| # | 页面 | 文件 | 当前状态 | 目标状态 | 去 mock 阶段 | 关联任务 |
|---|------|------|---------|---------|-------------|---------|
| 11 | 事件列表 | `incidents/IncidentList.tsx` | MOCK | REAL | Phase 1 W3 | W3-F1 |
| 12 | 事件详情 | `incidents/IncidentDetail.tsx` | MOCK | REAL | Phase 1 W3 | W3-F2 |
| 13 | 事件时间线 | `incidents/IncidentTimeline.tsx` | MOCK | REAL | Phase 1 W3 | W3-F3 |
| 14 | 事件 SLA | `incidents/IncidentSLA.tsx` | MOCK | REAL | Phase 1 W5 | W5-F1 |
| 15 | 事件分析 | `incidents/IncidentAnalysis.tsx` | MOCK | N/A | Phase 2 | P2-M3-04 |
| 16 | 事件归档 | `incidents/IncidentArchive.tsx` | MOCK | REAL | Phase 1 W3 | W3-F4 |

#### 采集与接入模块

| # | 页面 | 文件 | 当前状态 | 目标状态 | 去 mock 阶段 | 关联任务 |
|---|------|------|---------|---------|-------------|---------|
| 17 | 采集源管理 | `ingestion/SourceManagement.tsx` | PARTIAL | REAL | Phase 1 W1 | W1-F3 |
| 18 | Agent 管理 | `ingestion/AgentManagement.tsx` | PARTIAL | REAL | Phase 1 W1 | W1-F4 |
| 19 | 接入向导 | `ingestion/AccessWizard.tsx` | MOCK | N/A | Phase 2 | P2-AGT-01 |
| 20 | 采集源状态 | `ingestion/SourceStatus.tsx` | MOCK | REAL | Phase 1 W5 | W5-F1 |

#### 解析与字段模块

| # | 页面 | 文件 | 当前状态 | 目标状态 | 去 mock 阶段 | 关联任务 |
|---|------|------|---------|---------|-------------|---------|
| 21 | 解析规则 | `parsing/ParsingRules.tsx` | MOCK | N/A | Phase 2 | P2-PARSE-05 |
| 22 | 字段映射 | `parsing/FieldMapping.tsx` | MOCK | N/A | Phase 2 | P2-PARSE-05 |
| 23 | 脱敏规则 | `parsing/MaskingRules.tsx` | MOCK | N/A | Phase 2 | P2-PARSE-05 |
| 24 | 字段字典 | `parsing/FieldDictionary.tsx` | MOCK | N/A | Phase 2 | P2-PARSE-05 |

#### 索引与存储模块

| # | 页面 | 文件 | 当前状态 | 目标状态 | 去 mock 阶段 | 关联任务 |
|---|------|------|---------|---------|-------------|---------|
| 25 | 索引管理 | `storage/IndexManagement.tsx` | MOCK | N/A | Phase 2 | P2-PERF-05 |
| 26 | 容量监控 | `storage/CapacityMonitoring.tsx` | MOCK | N/A | Phase 2 | P2-PERF-05 |
| 27 | 生命周期策略 | `storage/LifecyclePolicy.tsx` | MOCK | N/A | Phase 2 | P2-PERF-05 |
| 28 | 备份恢复 | `storage/BackupRecovery.tsx` | MOCK | REAL | Phase 1 W4 | W4-F2 |

#### 性能与高可用模块

| # | 页面 | 文件 | 当前状态 | 目标状态 | 去 mock 阶段 | 关联任务 |
|---|------|------|---------|---------|-------------|---------|
| 29 | 性能监控 | `performance/PerformanceMonitoring.tsx` | MOCK | REAL | Phase 1 W3 | W3-F5 |
| 30 | 健康检查 | `performance/HealthCheck.tsx` | MOCK | REAL | Phase 1 W3 | W3-F6 |
| 31 | 自动扩缩容 | `performance/AutoScaling.tsx` | MOCK | N/A | Phase 3 | P3-OPS-01 |
| 32 | 灾难恢复 | `performance/DisasterRecovery.tsx` | MOCK | N/A | Phase 3 | P3-HA-05 |

#### 分布式追踪模块

| # | 页面 | 文件 | 当前状态 | 目标状态 | 去 mock 阶段 | 关联任务 |
|---|------|------|---------|---------|-------------|---------|
| 33 | 追踪搜索 | `tracing/TraceSearch.tsx` | MOCK | N/A | Phase 3 | P3-TRACE-03 |
| 34 | 追踪分析 | `tracing/TraceAnalysis.tsx` | MOCK | N/A | Phase 3 | P3-TRACE-03 |
| 35 | 服务拓扑 | `tracing/ServiceTopology.tsx` | MOCK | N/A | Phase 3 | P3-TRACE-04 |

#### 报表中心模块

| # | 页面 | 文件 | 当前状态 | 目标状态 | 去 mock 阶段 | 关联任务 |
|---|------|------|---------|---------|-------------|---------|
| 36 | 报表管理 | `reports/ReportManagement.tsx` | MOCK | N/A | Phase 2 | P2-GAP-05 |
| 37 | 定时任务 | `reports/ScheduledTasks.tsx` | MOCK | N/A | Phase 2 | P2-GAP-05 |
| 38 | 下载记录 | `reports/DownloadRecords.tsx` | MOCK | REAL | Phase 1 W4 | W4-F1 |

#### 安全与审计模块

| # | 页面 | 文件 | 当前状态 | 目标状态 | 去 mock 阶段 | 关联任务 |
|---|------|------|---------|---------|-------------|---------|
| 39 | 用户管理 | `security/UserManagement.tsx` | MOCK | REAL | Phase 1 W2 | W2-F1 |
| 40 | 角色权限 | `security/RolePermissions.tsx` | MOCK | REAL | Phase 1 W2 | W2-F2 |
| 41 | 审计日志 | `security/AuditLogs.tsx` | MOCK | REAL | Phase 1 W4 | W4-F5 |
| 42 | 登录策略 | `security/LoginPolicy.tsx` | MOCK | N/A | Phase 2 | P2-M8-04 |

#### 集成与开放平台模块

| # | 页面 | 文件 | 当前状态 | 目标状态 | 去 mock 阶段 | 关联任务 |
|---|------|------|---------|---------|-------------|---------|
| 43 | API 文档 | `integration/ApiDocs.tsx` | MOCK | N/A | Phase 2 | P2-API-05 |
| 44 | Webhook | `integration/WebhookManagement.tsx` | MOCK | N/A | Phase 3 | P3-COLLAB-03 |
| 45 | SDK 下载 | `integration/SdkDownload.tsx` | MOCK | STATIC | Phase 2 | - |
| 46 | 插件市场 | `integration/PluginMarket.tsx` | MOCK | N/A | Phase 4 | - |

#### 成本管理模块

| # | 页面 | 文件 | 当前状态 | 目标状态 | 去 mock 阶段 | 关联任务 |
|---|------|------|---------|---------|-------------|---------|
| 47 | 成本概览 | `cost/CostOverview.tsx` | MOCK | N/A | Phase 4 | - |
| 48 | 预算告警 | `cost/BudgetAlerts.tsx` | MOCK | N/A | Phase 4 | - |
| 49 | 优化建议 | `cost/OptimizationSuggestions.tsx` | MOCK | N/A | Phase 4 | - |

#### 系统设置模块

| # | 页面 | 文件 | 当前状态 | 目标状态 | 去 mock 阶段 | 关联任务 |
|---|------|------|---------|---------|-------------|---------|
| 50 | 全局配置 | `settings/GlobalConfig.tsx` | MOCK | N/A | Phase 2 | P2-SYS-03 |
| 51 | 系统参数 | `settings/SystemParameters.tsx` | MOCK | N/A | Phase 2 | P2-SYS-03 |
| 52 | 配置版本 | `settings/ConfigVersions.tsx` | MOCK | N/A | Phase 3 | P3-OPS-03 |

#### 日志分析模块

| # | 页面 | 文件 | 当前状态 | 目标状态 | 去 mock 阶段 | 关联任务 |
|---|------|------|---------|---------|-------------|---------|
| 53 | 日志聚类 | `analysis/LogClustering.tsx` | MOCK | N/A | Phase 2 | P2-M3-04 |
| 54 | 异常检测 | `analysis/AnomalyDetection.tsx` | MOCK | N/A | Phase 2 | P2-M3-04 |
| 55 | 聚合分析 | `analysis/AggregateAnalysis.tsx` | MOCK | REAL | Phase 1 W4 | W4-F4 |

#### 帮助中心模块

| # | 页面 | 文件 | 当前状态 | 目标状态 | 去 mock 阶段 | 关联任务 |
|---|------|------|---------|---------|-------------|---------|
| 56 | FAQ | `help/FAQ.tsx` | MOCK | STATIC | Phase 2 | P2-UX-03 |
| 57 | 查询语法 | `help/QuerySyntax.tsx` | MOCK | STATIC | Phase 2 | P2-UX-03 |
| 58 | 工单门户 | `help/TicketPortal.tsx` | MOCK | N/A | Phase 3 | - |

#### Dashboard

| # | 页面 | 文件 | 当前状态 | 目标状态 | 去 mock 阶段 | 关联任务 |
|---|------|------|---------|---------|-------------|---------|
| 59 | 仪表盘 | `Dashboard.tsx` | MOCK | REAL | Phase 1 W4 | W4-F3 |

### 10.4 统计汇总

| 状态 | Phase 1 去 mock | Phase 2 去 mock | Phase 3+ 去 mock | 保持 STATIC/N/A |
|------|----------------|----------------|-----------------|----------------|
| 数量 | 25 页 | 18 页 | 10 页 | 6 页 |

### 10.5 去 Mock 标准流程

```text
1. 在 src/api/ 下创建/更新对应模块的 API 文件
2. 在页面组件中导入 API 函数
3. 完全删除 mock 数据常量（mockXxx / MOCK_XXX）
4. useState 初始值设为空数组 [] 或 null
5. 添加 loading 状态（useState<boolean>(true)）
6. useEffect 中调用 API：成功 setData，失败 message.error() 弹窗提示
7. 页面添加 loading（Spin/Skeleton）和空状态（Empty）展示
8. 运行 pnpm lint + pnpm build 确认编译通过
9. 在浏览器中验证：数据来自真实 API + 断开后端时弹窗提示正确
```

---

## 11. 数据播种策略

### 11.1 种子数据分类

| 分类 | 说明 | 管理方式 |
|------|------|---------|
| 结构种子 | 角色/权限/默认配置等系统初始化数据 | 通过迁移脚本 `INSERT ... ON CONFLICT DO NOTHING` |
| 演示种子 | 开发/演示环境的示例数据 | 通过独立脚本 `scripts/seed-demo.sh`（待创建） |
| 测试种子 | 集成测试使用的数据 | 测试代码中 setup/teardown 管理 |

### 11.2 结构种子数据（通过迁移脚本）

| 迁移 | 种子内容 |
|------|---------|
| 000018 | roles 表：admin（所有权限）、operator（操作权限）、viewer（只读权限） |
| 000018 | 管理员用户：admin / 初始密码（首次登录强制修改） |

### 11.3 演示种子数据（通过脚本）

待创建 `scripts/seed-demo.sh`，内容包括：

| 数据 | 数量 | 说明 |
|------|------|------|
| 测试用户 | 3 个 | admin/operator/viewer 各一个 |
| 采集源 | 2~3 个 | 模拟不同服务器的日志采集 |
| 告警规则 | 3~5 条 | keyword/level_count/threshold 各一条 |
| 通知渠道 | 1~2 个 | 邮箱 + 钉钉 |
| ES 测试日志 | 1000 条 | 包含各级别的示例日志 |

### 11.4 数据隔离规则

- dev 环境数据不得出现在测试环境中
- 测试数据使用独立的数据库（`nexuslog_test`）
- 测试用例的 setup 必须有对应的 teardown
- 禁止在迁移脚本中插入仅用于测试的数据

---

## 12. 前端调试规范（chrome-devtools MCP 全功能测试）

### 12.1 强制规则

引用 `AGENTS.md` 中的前端调试强制规则，并强化为**全功能测试**：

> **所有涉及前端页面内容的任务，必须使用 `chrome-devtools` MCP 工具进行全功能测试与验证。**
> 每次结论必须包含四类证据：目标 URL、Console 信息、Network 请求、可复现步骤。
> 缺少上述任一证据的结论视为**无效结论**，任务不可标记为完成。

**工具配置**（`.mcp.json`）：

```json
{
  "chrome-devtools": {
    "command": "npx",
    "args": ["-y", "chrome-devtools-mcp@latest", "--browserUrl", "http://127.0.0.1:9222"]
  }
}
```

### 12.2 全功能测试范围

每个前端任务的测试必须覆盖以下全部适用项：

| 测试维度 | 测试内容 | 验证方法 |
|---------|---------|---------|
| 页面渲染 | 页面正常加载，布局无错乱 | `browser_navigate` + `browser_snapshot` |
| 数据展示 | 数据来自真实 API（非 mock），内容正确 | `browser_network` 检查请求/响应 |
| CRUD 操作 | 新增/编辑/删除/查询全部流程可用 | `browser_click` + `browser_fill` + `browser_snapshot` |
| 错误提示 | API 出错时 `message.error()` 弹窗正确展示 | 模拟错误场景 + `browser_snapshot` 检查弹窗 |
| 路由跳转 | 页内导航/跳转链接正常 | `browser_click` + 验证 URL 变化 |
| 分页/搜索 | 分页切换、搜索过滤正常 | `browser_click` + `browser_fill` + 验证数据变化 |
| 空状态 | 无数据时展示 `Empty` 组件 | 清空数据后 `browser_snapshot` |
| Console 干净 | 无新增 ERROR/WARNING | `browser_console_messages` |

### 12.3 证据收集标准

每个前端任务完成后，必须通过 `chrome-devtools` MCP 收集以下四类证据：

| 证据类型 | 收集方式 | 要求 |
|---------|---------|------|
| 目标 URL | `browser_navigate` 后的地址 | 完整 URL 含 hash 路由 |
| Console 信息 | `browser_console_messages` | 无新增 ERROR/WARNING |
| Network 请求 | `browser_network` | API 请求返回 2xx + 响应体结构正确 |
| 可复现步骤 | 操作记录 | 从打开页面到验证完成的完整交互步骤序列 |

### 12.4 标准测试流程

AI Agent 使用 `chrome-devtools` MCP 执行全功能测试：

```text
=== 阶段 1：页面加载验证 ===
1. browser_navigate → 打开目标页面 URL
2. browser_snapshot → 确认页面结构正确渲染
3. browser_console_messages → 确认 Console 无 ERROR
4. browser_network → 确认 API 请求返回 2xx，响应体正确

=== 阶段 2：交互功能测试 ===
5. browser_click / browser_fill → 执行页面核心交互（新增/编辑/搜索/删除等）
6. browser_snapshot → 每次交互后确认 UI 状态变化正确
7. browser_network → 确认交互触发的 API 请求和响应正确

=== 阶段 3：异常场景测试 ===
8. 模拟 API 错误场景（如后端服务停止）
9. browser_snapshot → 确认 message.error() 弹窗正确展示
10. 确认页面不崩溃，展示 Empty 空状态或保持可用

=== 阶段 4：证据汇总 ===
11. 汇总四类证据（URL + Console + Network + 操作步骤）
12. 任何证据缺失则任务不可标记完成
```

### 12.5 常见问题排查清单

| 症状 | 可能原因 | 排查方法（chrome-devtools MCP） |
|------|---------|---------|
| 页面白屏 | 路由配置错误 / 组件 import 失败 | `browser_console_messages` 查看错误信息 |
| API 返回 404 | 路径不匹配 / 网关未配置 | `browser_network` 检查请求 URL |
| API 返回 401 | token 过期 / 未登录 | `browser_evaluate` 检查 localStorage 中的 token |
| API 返回 403 | 权限不足 | 检查当前用户角色 |
| API 返回 500 | 后端异常 | 查看后端服务日志（`make dev-logs`） |
| 数据不显示 | API 响应格式不匹配 | `browser_network` 检查响应体结构 |
| 错误弹窗未出现 | 未使用 `message.error()` | `browser_snapshot` 检查 DOM 中是否有 `.ant-message` |
| 页面卡顿 | 大数据量未分页 / 未虚拟化 | `browser_evaluate` 执行 `performance.now()` 对比 |
| 样式错乱 | CSS 类名冲突 / 主题变量错误 | `browser_snapshot` 检查元素样式 |

---

## 13. 日志结构 v2 字段契约（当前实现）

> 生效日期：2026-03-07  
> 适用范围：`agent → control-plane → ES` 全链路  
> 当前代码版本：以 `agents/collector-agent/internal/pullapi` 与 `services/control-plane/internal/ingest` 的实现为准  
> 兼容策略：**已切换为纯 v2 结构，不再保留 pull 协议 legacy 扁平字段**

### 13.1 当前目标

| 项 | 当前约定 |
|------|------|
| 服务名前缀拆分 | 从日志正文拆出 `service.name` / `service.instance.id` / `container.name` |
| 空日志处理 | 丢弃纯空行、纯空白行、仅前缀空行（如 `keycloak-1 |`） |
| 多行合并 | Agent 优先合并 Java stack trace / `npm error` block |
| 第一层去重 | Agent 进行短时间窗重复合并 |
| 第二层去重 | Control-plane/ES sink 进行 10s 语义聚合去重 |
| 前端折叠展示 | 本阶段不做，后续放入聚类分析模块 |
| 新索引默认值 | `nexuslog-logs-v2` |
| Schema 版本 | `2.0` |
| Pipeline 版本 | `2.0` |

### 13.2 Agent Pull API v2 顶层结构

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `batch_id` | `string` | 是 | 本次 pull 批次 ID |
| `agent.id` | `string` | 建议 | Agent 唯一标识 |
| `agent.version` | `string` | 建议 | Agent 版本 |
| `cursor.next` | `string` | 是 | 下次继续拉取的游标 |
| `cursor.has_more` | `boolean` | 是 | 是否还有更多数据 |
| `records` | `array<object>` | 是 | 标准化日志记录列表 |

### 13.3 Agent Pull API v2 单条记录结构

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `record_id` | `string` | 是 | 批次内记录 ID |
| `sequence` | `int64` | 是 | Agent 本地递增序号 |
| `observed_at` | `RFC3339 string` | 是 | Agent 观察到该事件的时间 |
| `body` | `string` | 是 | 清洗后的日志正文 |
| `size_bytes` | `int` | 是 | `body` 字节数 |
| `source.kind` | `string` | 是 | `file/container/syslog/journald/other` |
| `source.path` | `string` | 建议 | 日志来源路径 |
| `source.offset` | `int64` | 建议 | 来源位点 |
| `source.stream` | `string` | 否 | `stdout/stderr` |
| `severity.text` | `string` | 建议 | `trace/debug/info/warn/error/fatal/unknown` |
| `severity.number` | `int` | 建议 | 级别数值 |
| `service.name` | `string` | 强烈建议 | 服务名，如 `keycloak` |
| `service.instance.id` | `string` | 建议 | 实例名，如 `keycloak-1` |
| `service.version` | `string` | 否 | 服务版本 |
| `service.environment` | `string` | 否 | 环境标识 |
| `container.name` | `string` | 否 | 容器名 |
| `attributes.*` | `map<string,string>` | 否 | 受控扩展属性 |
| `multiline.enabled` | `bool` | 是 | 是否由多行合并生成 |
| `multiline.line_count` | `int` | 否 | 合并后的有效行数 |
| `multiline.start_offset` | `int64` | 否 | 合并块起始偏移 |
| `multiline.end_offset` | `int64` | 否 | 合并块结束偏移 |
| `multiline.dropped_empty_prefix_lines` | `int` | 否 | 被过滤的空前缀行数 |
| `dedup.hit` | `bool` | 否 | Agent 层是否命中过去重 |
| `dedup.count` | `int` | 否 | Agent 层聚合后的次数 |
| `dedup.first_seen_at` | `RFC3339 string` | 否 | 去重窗口内首次出现时间 |
| `dedup.last_seen_at` | `RFC3339 string` | 否 | 去重窗口内最后一次出现时间 |
| `dedup.window_sec` | `int` | 否 | 去重窗口秒数 |
| `dedup.strategy` | `string` | 否 | `exact` / `multiline` |
| `original` | `string` | 否 | 合并前原始日志块 |

### 13.4 Agent 层职责边界

| 能力 | 当前是否在 Agent 做 | 说明 |
|------|------|------|
| 空行过滤 | 是 | 过滤纯空行、纯空白行 |
| 空前缀行过滤 | 是 | 例如 `keycloak-1 |` |
| 服务前缀拆分 | 是 | 提取 `service.*` 与 `container.name` |
| 多行异常块合并 | 是 | Java stack trace / `npm error` block |
| 短时间窗去重 | 是 | 对合并后的同类日志做第一层去重 |
| 复杂业务语义解析 | 否 | 不在 Agent 层做复杂规则引擎 |
| `event.id` 生成 | 否 | 由 Control-plane 统一生成 |

### 13.5 Control-plane 内部标准对象（Normalized ES Input）

Control-plane 当前不再依赖旧的扁平 pull 字段，而是直接消费 Agent v2 结构，统一做以下处理：

| 能力 | 当前实现 |
|------|------|
| Pull 协议解析 | 只读取 `cursor.next` / `cursor.has_more` / `record.source.*` / `record.body` |
| 包摘要生成 | 基于 `source.path`、`source.offset`、`body` 生成 `PullPackage` |
| `event.id` 生成 | `sha256(agent.id + source.kind + source.path + observed_at + sequence + normalized_body)` |
| `nexuslog.dedup.fingerprint` | `sha256(service.name + service.instance.id + log.level + normalized_message + error.type + normalized_stack_signature)` |
| 第二层去重 | ES sink 内进行 10s 语义聚合去重 |
| 写入索引 | `nexuslog-logs-v2` |

### 13.6 ES 最终文档结构（当前实现）

#### 顶层与事件字段

| 字段 | 类型 | 必填 |
|------|------|------|
| `@timestamp` | `date` | 是 |
| `message` | `text + keyword` | 是 |
| `event.id` | `keyword` | 是 |
| `event.record_id` | `keyword` | 否 |
| `event.sequence` | `long` | 是 |
| `event.original` | `text` | 否 |
| `event.kind` | `keyword` | 是 |
| `event.category` | `keyword[]` | 是 |
| `event.type` | `keyword[]` | 是 |
| `event.severity` | `short` | 否 |

#### 日志与来源字段

| 字段 | 类型 | 必填 |
|------|------|------|
| `log.level` | `keyword` | 是 |
| `log.offset` | `long` | 否 |
| `log.file.path` | `keyword` | 否 |
| `log.file.name` | `keyword` | 否 |
| `log.file.directory` | `keyword` | 否 |
| `source.kind` | `keyword` | 是 |
| `source.path` | `keyword` | 否 |
| `source.stream` | `keyword` | 否 |
| `agent.id` | `keyword` | 是 |
| `agent.version` | `keyword` | 否 |
| `agent.hostname` | `keyword` | 否 |

#### 服务 / 容器 / 主机 / 进程

| 字段 | 类型 | 必填 |
|------|------|------|
| `service.name` | `keyword` | 强烈建议 |
| `service.instance.id` | `keyword` | 建议 |
| `service.version` | `keyword` | 否 |
| `service.environment` | `keyword` | 否 |
| `container.name` | `keyword` | 否 |
| `host.name` | `keyword` | 否 |
| `host.ip` | `ip` | 否 |
| `process.pid` | `integer` | 否 |
| `process.thread.id` | `long` | 否 |

#### 关联上下文 / HTTP / URL

| 字段 | 类型 | 必填 |
|------|------|------|
| `trace.id` | `keyword` | 否 |
| `span.id` | `keyword` | 否 |
| `request.id` | `keyword` | 否 |
| `user.id` | `keyword` | 否 |
| `http.request.method` | `keyword` | 否 |
| `http.response.status_code` | `short` | 否 |
| `url.path` | `keyword` | 否 |
| `url.full` | `keyword` | 否 |

#### Error 与平台字段

| 字段 | 类型 | 必填 |
|------|------|------|
| `error.type` | `keyword` | 否 |
| `error.message` | `text` | 否 |
| `error.stack_trace` | `text` | 否 |
| `nexuslog.transport.batch_id` | `keyword` | 是 |
| `nexuslog.transport.channel` | `keyword` | 否 |
| `nexuslog.transport.compressed` | `boolean` | 否 |
| `nexuslog.transport.encrypted` | `boolean` | 否 |
| `nexuslog.ingest.received_at` | `date` | 是 |
| `nexuslog.ingest.schema_version` | `keyword` | 是 |
| `nexuslog.ingest.pipeline_version` | `keyword` | 是 |
| `nexuslog.ingest.parse_status` | `keyword` | 否 |
| `nexuslog.ingest.parse_rule` | `keyword` | 否 |
| `nexuslog.ingest.retry_count` | `short` | 否 |

#### 多行 / 去重 / 治理 / 标签

| 字段 | 类型 | 必填 |
|------|------|------|
| `nexuslog.multiline.enabled` | `boolean` | 是 |
| `nexuslog.multiline.line_count` | `integer` | 否 |
| `nexuslog.multiline.start_offset` | `long` | 否 |
| `nexuslog.multiline.end_offset` | `long` | 否 |
| `nexuslog.multiline.dropped_empty_prefix_lines` | `integer` | 否 |
| `nexuslog.dedup.fingerprint` | `keyword` | 建议 |
| `nexuslog.dedup.hit` | `boolean` | 否 |
| `nexuslog.dedup.count` | `integer` | 否 |
| `nexuslog.dedup.first_seen_at` | `date` | 否 |
| `nexuslog.dedup.last_seen_at` | `date` | 否 |
| `nexuslog.dedup.window_sec` | `integer` | 否 |
| `nexuslog.dedup.strategy` | `keyword` | 否 |
| `nexuslog.dedup.suppressed_count` | `integer` | 否 |
| `nexuslog.governance.tenant_id` | `keyword` | 否 |
| `nexuslog.governance.retention_policy` | `keyword` | 否 |
| `nexuslog.governance.pii_masked` | `boolean` | 是 |
| `nexuslog.governance.classification` | `keyword` | 否 |
| `labels.*` | `keyword` | 否 |

### 13.7 已废弃字段（禁止继续写入 Pull 协议）

| 旧字段 | 状态 | 替代字段 |
|------|------|------|
| `next_cursor` | 废弃 | `cursor.next` |
| `has_more` | 废弃 | `cursor.has_more` |
| `data` | 废弃 | `body` |
| `timestamp` | 废弃 | `observed_at` |
| `collected_at` | 废弃 | `observed_at` |
| `offset` | 废弃 | `source.offset` |
| 顶层 `source` 字符串 | 废弃 | `source.kind` + `source.path` + `source.offset` |
| `metadata` | 废弃 | 结构化字段 + `attributes.*` |

### 13.8 当前实现默认值

| 项 | 默认值 |
|------|------|
| 新索引名 | `nexuslog-logs-v2` |
| 多行合并 | Agent 优先，Control-plane 依赖 Agent v2 结果 |
| 语义去重窗口 | `10s` |
| 去重策略 | `Agent 短窗去重 + ES sink 语义聚合去重` |
| `event.kind` | `event` |
| `event.category` | `application` |
| `event.type` | `log` |
| `nexuslog.ingest.parse_status` | `success` |
| `nexuslog.governance.pii_masked` | `false` |

### 13.9 当前实现 vs 原始设计差异清单

> 本节用于区分“已按设计落地的部分”和“当前实现相对原始设计的偏差 / 待收口项”。  
> 结论以当前代码实现为准，不以最初讨论稿为准。

| 项 | 原始设计 | 当前实现 | 影响 / 后续建议 |
|------|------|------|------|
| Pull 协议中的来源字段命名 | 过渡方案中曾使用 `source_v2` | 当前已统一为 `source` 结构化对象 | 属于有意收口，后续文档与联调示例均应只使用 `source.*` |
| Pull 协议兼容策略 | 早期允许新旧字段并存一段时间 | 当前已切为纯 v2，不再返回 `next_cursor` / `has_more` / `data` / `timestamp` / `metadata` 等旧字段 | 属于有意破坏性重构；所有联调方必须使用 v2 契约 |
| Control-plane 兜底服务名提取 | 设计中要求 control-plane 对旧 Agent 或异常输入兜底提取 `service.*` | 当前实现主要依赖 Agent 已完成 prefix 拆分，control-plane 未再做同等级兜底解析 | 若未来存在第三方 Agent 或旧 Agent 接入，需要补一层服务名前缀兜底解析 |
| Control-plane 兜底多行合并 | 设计中要求 control-plane 必须能兜底合并 stack trace | 当前实现默认信任 Agent 的多行合并结果，未再做二次块级拼接 | 若后续接入多来源 Agent，建议补 control-plane fallback merge |
| 语义去重状态范围 | 设计允许理解为平台级统一语义聚合 | 当前语义去重在 ES sink 进程内以内存窗口实现，窗口默认为 `10s` | 单实例场景有效；多实例 control-plane 下需升级为共享状态或外部协调 |
| `message` / `error` 语义提取深度 | 设计希望从异常块中提取更完整的摘要、类型、主消息 | 当前实现为轻量规则：首行摘要 + 正则识别 `Exception/Error` + `npm.lifecycle_error` 特判 | 能满足第一阶段使用；后续可继续增加语言/框架规则 |
| 扩展字段富化来源 | 设计包含 `host.*` / `process.*` / `trace.*` / `http.*` / `url.*` / `classification` 等较完整上下文 | 当前实现支持这些字段落 ES，但多数依赖 `attributes.*` 透传，不做深度自动解析 | 如果需要高质量检索/聚合，应在 Agent 或 parse pipeline 增强这些字段提取 |
| `labels.*` 策略 | 设计要求受控标签体系 | 当前实现仅消费 `attributes` 中 `label.` 前缀，并补充少量默认标签（如 `env`） | 后续应建立统一标签白名单，避免 label key 漫灌 |
| ES 索引命名 | 原始讨论中默认写法偏向 `nexuslog-logs-v2-*` | 当前已统一为写入索引名 `nexuslog-logs-v2`，模板 pattern 同时兼容 `nexuslog-logs-v2` 与 `nexuslog-logs-v2-*` | 命名不一致问题已收口；部署时仍需确认 v2 模板已安装 |
| 前端折叠展示 | 原始方案已明确后置 | 当前仍未实现，保留到聚类分析模块 | 属于已确认延期项，不影响本阶段日志链路落地 |

### 13.10 后续建议优先级

| 优先级 | 建议项 | 原因 |
|------|------|------|
| P1 | 为 control-plane 补服务名前缀 / 多行合并兜底 | 提升异构 Agent 接入容错 |
| P1 | 在部署流程中显式校验 v2 模板已安装且命中 `nexuslog-logs-v2` | 避免环境漂移导致模板失效 |
| P1 | 将语义去重从进程内缓存升级为共享状态 | 支持多实例 control-plane |
| P2 | 增强 `error.type` / `error.message` / `trace/http/url` 提取规则 | 提升检索和分析质量 |
| P2 | 建立 `labels.*` 白名单治理 | 避免字段膨胀 |
| P3 | 前端聚类折叠展示 | 属于体验优化，已明确后置 |

## 14. 日志全链路与生命周期参考

> 本章用于给第 13 章的字段契约补一张端到端执行图，帮助在实施、联调、排障与验收时统一理解“日志何时被清洗、何时被聚合、何时进入告警与生命周期迁移”。
>
> 详细 UML 与存储生命周期说明见：`docs/NexusLog/10-process/31-log-end-to-end-lifecycle-and-uml.md`

### 14.1 在线主链路

| 阶段 | 关键动作 | 当前状态 |
|------|------|------|
| 日志生成 | 应用 / 容器 / 系统文件写出日志 | 已存在 |
| Agent 采集 | 增量读取源数据 | 已实现 |
| Agent 预处理 | 空行过滤、前缀拆分、多行合并、第一层去重 | 已实现 |
| Control-plane 执行 | Pull / ACK / NACK / 游标推进 / 任务状态流转 | 已实现 |
| Control-plane 归一化 | `event.id`、`fingerprint`、结构化文档构建、第二层去重 | 已实现 |
| ES 写入 | 写入 `nexuslog-logs-v2` data stream | 已实现 |
| Query API | 按 v2 字段查询并映射前端兼容结构 | 已实现 |
| 前端展示 | 实时检索页与详情抽屉展示真实日志 | 已实现 |

### 14.2 聚合 / 去重 / 告警放置点

| 能力 | 推荐层级 | 原因 |
|------|------|------|
| 多行合并 | Agent | 最贴近原始日志块 |
| 短窗完全相同去重 | Agent | 提前减少网络与写入压力 |
| 语义去重 | Control-plane / ES sink | 统一 `event.id` 与 `fingerprint` |
| 规则告警 | ES 落库后独立 evaluator | 依赖 ES 查询与窗口统计 |
| 静默 / 抑制 | 告警引擎层 | 避免告警风暴 |
| 聚类分析 / 前端折叠 | Analysis / Frontend | 属于读侧与展示增强 |

### 14.3 存储生命周期

| 阶段 | 默认阈值 | 关键动作 |
|------|------|------|
| Hot | `0ms` | 写入、实时查询、告警 |
| Warm | `3d` | readonly / shrink / forcemerge / warm 分配 |
| Cold | `30d` | searchable snapshot / cold 分配 |
| Delete | `90d` | `wait_for_snapshot` 后删除 |
| Archive | `90d+` | 对象存储长期归档与按需恢复 |

### 14.4 关键实现锚点

- `agents/collector-agent/internal/pullapi/normalize.go`
- `services/control-plane/internal/ingest/executor.go`
- `services/control-plane/internal/ingest/field_model.go`
- `services/control-plane/internal/ingest/es_sink.go`
- `services/control-plane/internal/alert/evaluator.go`
- `services/data-services/query-api/internal/repository/repository.go`
- `apps/frontend-console/src/pages/search/RealtimeSearch.tsx`
- `storage/elasticsearch/ilm/nexuslog-logs-ilm.json`
- `storage/elasticsearch/snapshots/snapshot-policy.json`
- `storage/glacier/archive-policies/archive-policy.yaml`
- `docs/NexusLog/10-process/31-log-end-to-end-lifecycle-and-uml.md`

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-03-07 | v1.2 | 新增第 14 章：日志全链路与生命周期参考；补充生成 → 采集 → ES → 前端 → 温/冷/归档链路、聚合/告警放置点与独立 UML 文档引用 |
| 2026-03-07 | v1.1 | 新增第 13 章：日志结构 v2 字段契约，并补充“当前实现 vs 原始设计差异清单”与后续建议优先级 |
| 2026-03-06 | v1.0 | 初始版本。覆盖 12 章：SDLC 流程、代码约束、质量门禁、测试策略、部署管理、Git 工作流、验收规范、Mock 追踪、数据播种、前端调试 |
