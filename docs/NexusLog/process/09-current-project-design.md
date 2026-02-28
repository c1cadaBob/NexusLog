# 当前项目适配设计文档（设计基线）

## 1. 设计目标

基于当前代码现实，设计一套可在 M1~M3 内实现的“最小业务闭环”方案，覆盖认证、接入、检索、治理四条核心链路，并保证：

1. API 路径统一
2. 数据模型可追溯
3. 配置可热更新
4. 失败可回滚

本设计对应需求文档 `08-current-project-requirements.md` 中的 `R1~R9`。

## 2. 当前态与目标态

### 2.1 当前态（代码事实）

1. 前端页面完整，但核心业务页仍存在本地/Mock 主路径。
2. `api-service`、`control-plane`、`query-api`、`audit-api`、`export-api` 业务实现不足，部分仅健康检查或占位响应。
3. 网关具备 Lua 鉴权/限流能力，但路由前缀与 upstream 一致性存在差异。
4. 迁移目录已扩展到 `000012~000015`，但历史文档与执行态尚未完全对齐。

### 2.2 目标态（M3 结束）

1. 认证链路可用：注册/登录/刷新/退出/重置密码。
2. 接入链路可用：远端主动拉取 + Agent 增量包 + ACK/NACK + 死信重放。
3. 检索链路可用：实时检索 + 历史 + 收藏查询，前端主路径去 mock。
4. 治理链路可用：审计查询 + 告警规则 + 用户角色最小闭环。
5. 配置链路可用：`config_*` 版本发布、实例订阅、分发日志、失败回滚。

## 3. 逻辑架构（当前适配版）

```text
Frontend Console
  -> Gateway(OpenResty + Lua auth/rate-limit)
      -> api-service        (auth + alerts + security)
      -> control-plane      (ingest control APIs)
      -> query-api          (query logs/history/saved)
      -> audit-api          (audit logs query)
      -> bff-service        (overview aggregation)

Data Plane:
  Collector-Agent -> Kafka -> (query path/consume path)

Metadata Plane:
  PostgreSQL (000001 + 000012~000015)
  Redis (cache + config notice)
  Elasticsearch (log body + aggregation)
```

## 4. 服务职责划分

| 服务 | 职责边界 | 非职责（避免越界） |
|---|---|---|
| `api-service` | 认证、会话、安全治理（告警规则、用户角色）接口 | 不承担日志正文检索 |
| `control-plane` | 接入源、拉取任务、包与回执控制接口 | 不直接承载前台检索逻辑 |
| `query-api` | 日志检索、查询历史、收藏查询 | 不承载用户管理 |
| `audit-api` | 审计日志查询 | 不承载告警规则 CRUD |
| `export-api` | 保留导出占位与后续扩展 | 本轮不承担主闭环责任 |
| `bff-service` | 首页聚合与健康探针聚合 | 不替代核心业务服务 |
| `gateway` | 统一入口、鉴权、限流、路由、错误码统一 | 不承载业务逻辑实现 |
| `collector-agent` | 文件/syslog 采集、插件处理、重试、checkpoint | 不管理控制台任务配置 |

## 5. 接口设计（统一前缀版）

## 5.1 认证与治理接口（`api-service`）

1. `POST /api/v1/auth/register`
2. `POST /api/v1/auth/login`
3. `POST /api/v1/auth/refresh`
4. `POST /api/v1/auth/logout`
5. `POST /api/v1/auth/password/reset-request`
6. `POST /api/v1/auth/password/reset-confirm`
7. `GET/POST/PUT/DELETE /api/v1/alerts/rules`
8. `GET/POST/PUT /api/v1/security/users`
9. `GET/POST/PUT /api/v1/security/roles`

## 5.2 接入控制接口（`control-plane`）

1. `GET/POST/PUT /api/v1/ingest/pull-sources`
2. `POST /api/v1/ingest/pull-tasks/run`
3. `GET /api/v1/ingest/pull-tasks`
4. `GET /api/v1/ingest/packages`
5. `POST /api/v1/ingest/receipts`
6. `POST /api/v1/ingest/dead-letters/replay`

## 5.3 检索与审计接口（`query-api` / `audit-api`）

1. `POST /api/v1/query/logs`
2. `GET/DELETE /api/v1/query/history`
3. `GET/POST/PUT/DELETE /api/v1/query/saved`
4. `GET /api/v1/audit/logs`

## 5.4 网关路由规则

1. `/api/v1/auth/* -> api-service`
2. `/api/v1/query/* -> query-api`
3. `/api/v1/audit/* -> audit-api`
4. `/api/v1/export/* -> export-api`
5. `/api/v1/bff/* -> bff-service`
6. 受保护路径统一经过 `auth_check.lua`；认证白名单仅保留必须匿名访问路径。

## 6. 数据设计（运行时迁移对齐）

## 6.1 基础复用（`000001`）

1. `obs.tenant`
2. `users`
3. `roles`
4. `user_roles`
5. `alert_rules`
6. `audit_logs`

## 6.2 认证与安全（`000012`）

1. `user_sessions`
2. `password_reset_tokens`
3. `login_attempts`

## 6.3 接入与可追溯（`000013`）

1. `ingest_pull_sources`
2. `ingest_pull_tasks`
3. `agent_incremental_packages`
4. `agent_package_files`
5. `ingest_delivery_receipts`
6. `ingest_file_checkpoints`
7. `ingest_dead_letters`

## 6.4 检索元数据（`000014`）

1. `query_histories`
2. `saved_queries`
3. `saved_query_tags`

## 6.5 配置中心与分发（`000015`）

1. `config_namespace`
2. `config_item`
3. `config_version`
4. `config_publish`
5. `runtime_config_subscription`
6. `runtime_config_dispatch_log`

## 7. 关键流程设计

## 7.1 认证流程（登录）

```text
LoginPage -> Gateway -> api-service(/auth/login)
  -> users/user_roles 验证
  -> user_sessions 写入
  -> 返回 access/refresh
  -> 前端持久化会话
  -> ProtectedRoute 放行
```

关键点：
1. 失败登录必须写 `login_attempts`。
2. token 刷新与注销必须更新 `user_sessions.session_status`。

## 7.2 接入流程（主动拉取 + 回执）

```text
Console(/ingestion/sources) -> control-plane(pull-sources)
  -> ingest_pull_sources
Scheduler -> ingest_pull_tasks(status flow)
Agent/Server package -> ingest_delivery_receipts(ack/nack)
  -> ack: update ingest_file_checkpoints
  -> nack: write ingest_dead_letters
  -> replay: dead-letter replay API
```

关键点：
1. 包级幂等：`agent_id + source_ref + package_no`、`checksum` 唯一。
2. 必须支持 at-least-once，允许重复但不丢失。

## 7.3 检索流程（实时 + 历史 + 收藏）

```text
RealtimeSearch -> query-api(/query/logs) -> ES
  -> query_histories write
SavedQueries CRUD -> saved_queries/saved_query_tags
SearchHistory -> /query/history
```

关键点：
1. `/search/realtime` 主路径去 `MOCK_*`。
2. 查询失败/超时写历史并标注 `status/error_message`。

## 8. 配置热更新设计

1. 基线加载：服务启动读取最近成功配置版本。
2. 发布流程：创建 `config_version` -> 创建 `config_publish` -> 下发事件。
3. 实例反馈：实例上报 `runtime_config_subscription` 与 `runtime_config_dispatch_log`。
4. 失败回滚：发布失败自动回滚到上一版本并记录失败原因。

## 9. 错误处理与一致性策略

1. 接口错误分层：参数校验（4xx）、业务失败（4xx/409）、系统异常（5xx）。
2. 幂等键：
   - 接入包：`package_no/checksum`
   - 关键写操作：建议携带请求幂等键
3. 失败补偿：
   - 接入失败进入 `ingest_dead_letters`
   - 支持 `dead-letters/replay` 重放
4. 超时策略：
   - 网关统一超时配置
   - 下游失败返回可观测错误码与 `request_id`

## 10. 可观测性与测试设计

1. 服务健康：所有核心服务暴露 `/healthz`。
2. 业务指标：认证失败率、任务失败率、重放次数、查询超时率。
3. 最小自动化测试：
   - 每链路至少 1 成功 + 1 失败
   - 迁移 `up/down` 双向测试
4. 发布后观测窗口：30 分钟重点观测错误率、延迟、积压、重试。

## 11. 发布与回滚设计

1. 发布顺序：迁移 -> 网关 -> 后端 -> 前端 -> 联调验证。
2. 回滚策略：
   - 数据：迁移 down 或功能开关降级
   - 服务：回滚镜像版本
   - 配置：回滚 `config_publish`
3. 验收门禁：未关闭 P0 差异项不得标记里程碑完成。

## 12. 与旧设计文档的转换说明

1. 从“全量平台规划型设计”收敛为“M1~M3 可执行设计”。
2. 保留网关/IAM/数据分层等正确架构骨架，去除当前阶段不必要的 P2 细节。
3. 将接口命名、表结构、周次目标与当前仓库真实文件保持一致。

## 13. 版本记录

- `v1.0`（2026-02-28）：基于当前代码状态生成当前适配设计基线。

