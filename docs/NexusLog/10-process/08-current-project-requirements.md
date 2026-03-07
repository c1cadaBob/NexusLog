# 当前项目适配需求文档（需求基线）

## 1. 文档目的

本文件用于将“项目前期的总体需求/设计/开发文档”与“当前仓库真实实现状态”进行整合，形成适用于当前阶段（M1~M3）的可执行需求基线。  
本需求文档与以下文件配套使用：

- `05-next-priority-development-plan.md`（优先级与里程碑方向）
- `06-m1-m3-weekly-delivery-checklist.md`（周级执行清单）
- `07-document-code-gap-matrix.md`（文档-代码差异闭环）

## 2. 输入来源

1. 项目初期文档：`.kiro/specs/project-scaffold/*`、`.kiro/specs/project-roadmap/*`
2. 当前项目文档：`docs/NexusLog/10-process/02~07`、`docs/NexusLog/20-database/08-schema-gap-and-extension-plan.md`
3. 当前代码与配置：`apps/*`、`services/*`、`agents/*`、`gateway/*`、`storage/postgresql/migrations/*`

## 3. 适配原则

1. 先闭环再扩展：优先打通“页面 -> API -> 数据表 -> 监控 -> 回滚”最小可用链路。
2. 代码事实优先：若旧文档与现状冲突，以当前仓库真实代码和迁移目录为准。
3. 单一真相源：数据库迁移统一以 `storage/postgresql/migrations` 为唯一入口。
4. 热配置优先：业务规则优先进入 `config_*` 表，避免长期 YAML 固化。
5. 里程碑驱动：需求必须可映射到 M1/M2/M3，并具有明确验收标准。

## 4. 范围与非范围

### 4.1 本轮范围（M1~M3）

1. 认证与网关最小闭环（登录/注册/会话/重置密码）
2. 接入链路最小闭环（远端主动拉取 + Agent 增量包 + 回执/死信）
3. 检索链路最小闭环（实时检索 + 历史 + 收藏）
4. 治理链路最小闭环（审计查询 + 告警规则 + 用户角色）
5. 配置中心与热下发链路（发布、订阅、分发日志、失败回滚）

### 4.2 非范围（本轮不做）

1. P2 相关能力（ML/NLP、边缘计算、服务网格高级能力）
2. 大规模架构重构（拆分新业务域、引入新中间件替代现有栈）
3. 大量新增页面（仅改造现有页面主路径，去 mock 并接真实 API）

## 5. 术语

- `M1/M2/M3`: 三个连续里程碑，覆盖 6 周执行窗口
- `P0`: 当前阶段必须完成且阻断验收的需求
- `At-least-once`: 至少一次投递语义，允许重复但不允许静默丢失
- `config_*`: `config_namespace/config_item/config_version/config_publish` 及运行时分发表
- `差异项`: `07-document-code-gap-matrix.md` 中定义的 `GAP-001~GAP-018`

## 6. 需求定义

### 需求 R1：迁移真相源统一（P0）

**用户故事**：作为平台与后端团队，我希望数据库迁移只有一个入口，以便在任何环境都可一致初始化和回滚。

#### 验收标准

1. THE 项目 SHALL 将 `storage/postgresql/migrations` 作为唯一运行时迁移入口。
2. WHEN 环境初始化执行迁移时, THE 系统 SHALL 通过单一命令完成元数据表初始化。
3. THE 迁移流程 SHALL 支持 `up/down` 双向演练并保留日志证据。
4. THE 团队 SHALL 在文档中标注“迁移文件存在态”和“环境执行态”。

### 需求 R2：认证最小闭环（P0）

**用户故事**：作为业务用户，我希望可以完成注册、登录、会话续期、退出和密码重置，以访问受保护功能。

#### 验收标准

1. THE `api-service` SHALL 实现以下接口：
   - `POST /api/v1/auth/register`
   - `POST /api/v1/auth/login`
   - `POST /api/v1/auth/refresh`
   - `POST /api/v1/auth/logout`
   - `POST /api/v1/auth/password/reset-request`
   - `POST /api/v1/auth/password/reset-confirm`
2. THE 前端登录链路 SHALL 使用真实 API，不得在主路径使用本地模拟登录。
3. WHEN token 失效时, THE 受保护路由 SHALL 跳转登录并阻断访问。
4. THE 认证相关行为 SHALL 写入 `user_sessions/password_reset_tokens/login_attempts`。

### 需求 R3：网关路由与鉴权一致性（P0）

**用户故事**：作为平台运维，我希望网关路由、白名单、upstream 与服务编排一致，以保障调用可达且错误码统一。

#### 验收标准

1. THE Gateway SHALL 支持并统一以下业务前缀：
   - `/api/v1/auth/*`
   - `/api/v1/query/*`
   - `/api/v1/audit/*`
   - `/api/v1/export/*`
   - `/api/v1/bff/*`
2. THE Gateway upstream 配置 SHALL 与 `docker-compose.yml` 的服务名和端口一致。
3. WHEN 认证接口路径变更时, THE 白名单 SHALL 同步更新并通过联调验证。
4. THE 鉴权失败响应 SHALL 使用统一结构与状态码。

### 需求 R4：日志接入最小闭环（P0）

**用户故事**：作为运维与数据平台团队，我希望支持主动拉取与 Agent 增量包两条接入路径，并能追踪任务状态与失败补偿。

#### 验收标准

1. THE `control-plane` SHALL 提供拉取源与任务接口：
   - `GET/POST/PUT /api/v1/ingest/pull-sources`
   - `POST /api/v1/ingest/pull-tasks/run`
   - `GET /api/v1/ingest/pull-tasks`
2. THE `control-plane` SHALL 提供包与回执接口：
   - `GET /api/v1/ingest/packages`
   - `POST /api/v1/ingest/receipts`
   - `POST /api/v1/ingest/dead-letters/replay`
3. THE 接入链路 SHALL 落库以下实体：`ingest_pull_sources/ingest_pull_tasks/agent_incremental_packages/agent_package_files/ingest_delivery_receipts/ingest_file_checkpoints/ingest_dead_letters`。
4. WHEN 接收失败或下游失败时, THE 系统 SHALL 支持死信重放并保留完整追踪记录。

### 需求 R5：检索最小闭环（P0）

**用户故事**：作为控制台用户，我希望在检索页面进行实时查询、查看历史和管理收藏查询。

#### 验收标准

1. THE `query-api` SHALL 实现以下接口：
   - `POST /api/v1/query/logs`
   - `GET /api/v1/query/history`
   - `DELETE /api/v1/query/history/:id`
   - `GET/POST/PUT/DELETE /api/v1/query/saved`
2. THE `/search/realtime` 主路径 SHALL 移除 `MOCK_*` 数据依赖。
3. THE `/search/history` 与 `/search/saved` SHALL 对接 PG 元数据表。
4. THE 查询错误与超时 SHALL 提供可观测错误码与降级路径。

### 需求 R6：治理最小闭环（P0）

**用户故事**：作为安全与运营人员，我希望能够完成审计查询、告警规则管理、用户角色管理，以支撑上线后的基础运营。

#### 验收标准

1. THE `audit-api` SHALL 实现 `GET /api/v1/audit/logs`。
2. THE `api-service` SHALL 实现：
   - `GET/POST/PUT/DELETE /api/v1/alerts/rules`
   - `GET/POST/PUT /api/v1/security/users`
   - `GET/POST/PUT /api/v1/security/roles`
3. THE 前端 `/security/audit`、`/alerts/rules`、`/security/users`、`/security/roles` 主路径 SHALL 接真实 API。
4. THE 治理闭环 SHALL 复用并正确写入 `audit_logs/alert_rules/users/roles/user_roles`。

### 需求 R7：配置中心与热下发（P0）

**用户故事**：作为运维与平台团队，我希望在不重启主进程的情况下发布业务配置，并具备失败回滚能力。

#### 验收标准

1. THE 系统 SHALL 使用 `config_namespace/config_item/config_version/config_publish` 管理配置版本。
2. THE 系统 SHALL 使用 `runtime_config_subscription/runtime_config_dispatch_log` 跟踪分发状态。
3. WHEN 配置发布失败时, THE 系统 SHALL 支持自动回滚到上一版本并记录失败原因。
4. THE 登录策略、查询策略等业务参数 SHALL 可通过配置中心动态生效。

### 需求 R8：质量门禁与可观测性（P1）

**用户故事**：作为研发与质量团队，我希望每条核心链路具备最小测试与观测证据，以降低回归风险。

#### 验收标准

1. THE 每条主链路 SHALL 至少具备 1 条成功路径 + 1 条失败路径自动化测试。
2. THE API 服务 SHALL 暴露健康探针并纳入链路监控。
3. THE 里程碑验收 SHALL 包含请求日志、表记录、错误指标、回滚演练证据。
4. THE 未关闭的 P0 差异项 SHALL 阻止里程碑验收通过。

### 需求 R9：文档一致性治理（P1）

**用户故事**：作为项目负责人，我希望需求、设计、任务和代码保持一致，以减少沟通成本和返工。

#### 验收标准

1. THE 接口路径变更 SHALL 同步更新 `04/05/06/07/08/09/10` 相关文档。
2. THE 每周周报 SHALL 更新 `07` 文档中的 GAP 状态与证据链接。
3. THE 文档中涉及“已完成”条目 SHALL 具有代码或测试证据。
4. WHEN 出现文档与代码冲突时, THE 团队 SHALL 在当周修正或显式标注顺延。

## 7. 需求优先级与里程碑映射

| 需求 | 优先级 | 目标里程碑 | 目标周次 |
|---|---|---|---|
| R1 | P0 | M1 | Week1 |
| R2 | P0 | M1 | Week1~Week2 |
| R3 | P0 | M1 | Week1~Week2 |
| R4 | P0 | M2 | Week3~Week4 |
| R5 | P0 | M3 | Week5 |
| R6 | P0 | M3 | Week6 |
| R7 | P0 | M1~M3 | Week1~Week6 |
| R8 | P1 | M1~M3 | Week1~Week6 |
| R9 | P1 | M1~M3 | Week1~Week6 |

## 8. 版本记录

- `v1.0`（2026-02-28）：基于当前仓库真实状态重构需求基线，替换早期泛化需求为可执行需求。

