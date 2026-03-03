# 当前项目 API 接口设计（M1~M3）

> 版本：v1.0  
> 基线日期：2026-02-28  
> 适用范围：M1~M3 最小可交付闭环（认证、接入、检索、治理）

## 1. 文档定位

本文件是当前项目的接口契约基线，目标是统一：

1. 网关入口路径与后端服务边界。
2. API 命名、鉴权、错误码、幂等、分页等通用规范。
3. M1~M3 每个接口的职责、字段骨架、落库范围、验收口径。

本文件与 `09-current-project-design.md` 的关系：

1. `09` 关注架构与流程。
2. `12` 关注可联调的接口契约层细节。

## 2. 总体接口设计原则

1. 统一前缀：外部接口统一 ` /api/v1/* `。
2. 服务单责：认证治理归 `api-service`，检索归 `query-api`，审计归 `audit-api`。
3. 可观测：所有接口返回 `request_id`，并在网关与服务日志可追踪。
4. 可回滚：新增写接口必须支持灰度与关闭策略。
5. 兼容优先：旧路径过渡期允许保留，但冻结后以本文件为准。

## 3. 全局规范

### 3.1 基础约定

| 项 | 规范 |
|---|---|
| Base URL | `/api/v1` |
| Content-Type | `application/json; charset=utf-8` |
| 时间格式 | ISO-8601（UTC），示例 `2026-02-28T09:30:00Z` |
| ID 格式 | `uuid`（推荐）或服务内可解析的唯一字符串 |
| 请求追踪 | `X-Request-ID`（可选；缺省由网关生成） |
| 幂等键 | `X-Idempotency-Key`（建议用于关键写操作） |

### 3.2 鉴权约定

| 类型 | 说明 | 适用接口 |
|---|---|---|
| `public` | 无需 Bearer Token | `auth/register`、`auth/login`、`auth/password/reset-request`、`auth/password/reset-confirm`、`health` |
| `session` | 需要有效访问令牌 | 大部分业务读写接口 |
| `admin` | 需要管理员权限 | `alerts/rules*`、`security/users*`、`security/roles*` |

### 3.3 统一响应结构

成功响应：

```json
{
  "code": "OK",
  "message": "success",
  "request_id": "gw-1700000000-127.0.0.1",
  "data": {},
  "meta": {}
}
```

失败响应：

```json
{
  "code": "AUTH_INVALID_TOKEN",
  "message": "token invalid or expired",
  "request_id": "gw-1700000000-127.0.0.1",
  "details": {
    "field": "authorization"
  }
}
```

### 3.4 分页规范

请求参数：

1. `page`（从 1 开始）
2. `page_size`（默认 20，建议上限 200）
3. `sort`（示例：`created_at:desc`）

返回 `meta` 字段：

1. `page`
2. `page_size`
3. `total`
4. `has_next`

### 3.5 错误码规范（核心子集）

| HTTP | 业务码 | 说明 |
|---|---|---|
| 400 | `REQ_INVALID_PARAMS` | 参数校验失败 |
| 401 | `AUTH_MISSING_TOKEN` | 缺少令牌 |
| 401 | `AUTH_INVALID_TOKEN` | 令牌无效或过期 |
| 403 | `AUTH_FORBIDDEN` | 权限不足 |
| 404 | `RES_NOT_FOUND` | 资源不存在 |
| 409 | `RES_CONFLICT` | 幂等冲突或状态冲突 |
| 429 | `RATE_LIMITED` | 限流 |
| 500 | `INTERNAL_ERROR` | 未分类系统异常 |
| 503 | `DOWNSTREAM_UNAVAILABLE` | 下游服务不可用 |
| 409 | `AGENT_VERSION_CONFLICT` | Agent 版本冲突，当前批次拒绝升级 |
| 503 | `AGENT_OFFLINE` | Agent 不在线，无法下发任务或升级计划 |
| 504 | `ANALYSIS_TIMEOUT` | 分析计算超时，未在 SLA 内返回 |
| 503 | `ANALYSIS_DOWNGRADED` | 分析能力降级，返回降级结果或失败提示 |

## 4. 网关路由策略（当前态 vs 目标态）

| 维度 | 当前态（代码现实） | 目标态（M1~M3） |
|---|---|---|
| 查询/审计/导出前缀 | 仍存在 `/api/data/*` 路由 | 统一 `/api/v1/query/*`、`/api/v1/audit/*`、`/api/v1/export/*` |
| Data Services upstream | `data-services:8080` 旧聚合 upstream | 按服务拆分到 `query-api:8082`、`audit-api:8083`、`export-api:8084` |
| 认证白名单 | 包含 `forgot-password` 旧路径 | 切换为 `password/reset-request`、`password/reset-confirm` |
| BFF 路由 | `/api/v1/bff/*` 已有 | 保持兼容，继续作为 Dashboard 聚合入口 |

冻结策略：

1. Week1 完成网关路由与 upstream 映射修正。
2. Week2 完成认证白名单路径切换。
3. Week5 前冻结查询相关路径，不再新增平行命名。

## 5. 服务级接口清单（M1~M3）

### 5.1 `api-service`（认证 + 治理）

| 接口 | 方法 | 鉴权 | 请求字段骨架 | 响应字段骨架 | 关联表 | 里程碑 |
|---|---|---|---|---|---|---|
| `/api/v1/auth/register` | POST | public | `username,password,email,display_name` | `user_id,username` | `users` | M1 |
| `/api/v1/auth/login` | POST | public | `username,password,remember_me` | `access_token,refresh_token,expires_in,user` | `users,user_roles,user_sessions,login_attempts` | M1 |
| `/api/v1/auth/refresh` | POST | public/session | `refresh_token` | `access_token,refresh_token,expires_in` | `user_sessions` | M1 |
| `/api/v1/auth/logout` | POST | session | `refresh_token(optional)` | `logged_out=true` | `user_sessions` | M1 |
| `/api/v1/auth/password/reset-request` | POST | public | `email_or_username` | `accepted=true` | `password_reset_tokens,login_attempts` | M1 |
| `/api/v1/auth/password/reset-confirm` | POST | public | `token,new_password` | `reset=true` | `password_reset_tokens` | M1 |
| `/api/v1/alerts/rules` | GET | admin | `page,page_size,status,severity` | `items[]` | `alert_rules` | M3 |
| `/api/v1/alerts/rules` | POST | admin | `name,condition,severity,enabled` | `rule_id,version,enabled` | `alert_rules` | M3 |
| `/api/v1/alerts/rules/{rule_id}` | PUT | admin | `name,condition,severity,enabled` | `updated=true` | `alert_rules` | M3 |
| `/api/v1/alerts/rules/{rule_id}` | DELETE | admin | - | `deleted=true` | `alert_rules` | M3 |
| `/api/v1/security/users` | GET | admin | `page,page_size,keyword,status` | `items[]` | `users` | M3 |
| `/api/v1/security/users` | POST | admin | `username,email,display_name,role_ids[]` | `user_id` | `users,user_roles` | M3 |
| `/api/v1/security/users/{user_id}` | PUT | admin | `email,display_name,status,role_ids[]` | `updated=true` | `users,user_roles` | M3 |
| `/api/v1/security/roles` | GET | admin | `page,page_size,keyword` | `items[]` | `roles` | M3 |
| `/api/v1/security/roles` | POST | admin | `name,description,permissions[]` | `role_id` | `roles` | M3 |
| `/api/v1/security/roles/{role_id}` | PUT | admin | `name,description,permissions[]` | `updated=true` | `roles` | M3 |

### 5.2 `control-plane`（接入控制）

| 接口 | 方法 | 鉴权 | 请求字段骨架 | 响应字段骨架 | 关联表 | 里程碑 |
|---|---|---|---|---|---|---|
| `/api/v1/ingest/pull-sources` | GET | session | `page,page_size,status` | `items[]` | `ingest_pull_sources` | M2 |
| `/api/v1/ingest/pull-sources` | POST | session | `name,host,port,protocol,path,auth` | `source_id,status` | `ingest_pull_sources` | M2 |
| `/api/v1/ingest/pull-sources/{source_id}` | PUT | session | `name,host,port,protocol,path,status` | `updated=true` | `ingest_pull_sources` | M2 |
| `/api/v1/ingest/pull-tasks/run` | POST | session | `source_id,trigger_type,options` | `task_id,status=pending` | `ingest_pull_tasks` | M2 |
| `/api/v1/ingest/pull-tasks` | GET | session | `source_id,status,page,page_size` | `items[]` | `ingest_pull_tasks` | M2 |
| `/api/v1/ingest/packages` | GET | session | `agent_id,source_ref,status,page,page_size` | `items[]` | `agent_incremental_packages,agent_package_files` | M2 |
| `/api/v1/ingest/receipts` | POST | session | `package_id,status(ack/nack),reason,checksum` | `receipt_id,accepted` | `ingest_delivery_receipts,ingest_file_checkpoints,ingest_dead_letters` | M2 |
| `/api/v1/ingest/dead-letters/replay` | POST | session | `dead_letter_ids[],reason` | `replay_batch_id,replayed_count` | `ingest_dead_letters` | M2 |

状态机建议：

1. `ingest_pull_tasks.status`: `pending -> running -> success|failed|canceled`
2. `agent_incremental_packages.status`: `created -> uploaded -> acked|nacked`

`GET /api/v1/ingest/packages` 的 `items[]` 结构补充（2026-03-03）：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `package_id` | string | 是 | 增量包唯一标识。 |
| `agent_id` | string | 是 | 产生日志包的 Agent 标识。 |
| `source_ref` | string | 是 | 来源标识（单文件场景通常为文件路径，多来源场景可为 `multi-source`）。 |
| `package_no` | string | 是 | 包序号（业务可读标识）。 |
| `batch_id` | string | 否 | 对应 agent pull 返回的 `batch_id`，用于链路追踪。 |
| `next_cursor` | string | 否 | 对应 agent pull 返回的 `next_cursor`。 |
| `record_count` | int | 否 | 包内日志条数。 |
| `from_offset` | int64 | 是 | 包覆盖的起始偏移。 |
| `to_offset` | int64 | 是 | 包覆盖的结束偏移。 |
| `file_count` | int | 是 | 包内文件数。 |
| `size_bytes` | int64 | 是 | 包总字节数。 |
| `checksum` | string | 是 | 包级校验和，用于幂等与一致性验证。 |
| `status` | string | 是 | 包状态（`created/uploaded/acked/nacked/failed/dead_lettered`）。 |
| `files[]` | array | 否 | 文件级摘要列表；每项包含 `file_path/from_offset/to_offset/line_count/size_bytes/checksum`，以及可追溯字段 `first_record_id/last_record_id`。 |
| `metadata` | object | 否 | 扩展字段（如 `has_more/next_cursor`），与数据库 `metadata jsonb` 对齐。 |

### 5.3 `query-api`（检索）

| 接口 | 方法 | 鉴权 | 请求字段骨架 | 响应字段骨架 | 关联表 | 里程碑 |
|---|---|---|---|---|---|---|
| `/api/v1/query/logs` | POST | session | `time_range,keywords,filters,sort,page,page_size` | `hits[],aggregations,meta` | `query_histories`（记录检索元数据） | M3 |
| `/api/v1/query/history` | GET | session | `page,page_size,keyword` | `items[]` | `query_histories` | M3 |
| `/api/v1/query/history/{history_id}` | DELETE | session | - | `deleted=true` | `query_histories` | M3 |
| `/api/v1/query/saved` | GET | session | `page,page_size,tag` | `items[]` | `saved_queries,saved_query_tags` | M3 |
| `/api/v1/query/saved` | POST | session | `name,query,tags[]` | `saved_query_id` | `saved_queries,saved_query_tags` | M3 |
| `/api/v1/query/saved/{saved_query_id}` | PUT | session | `name,query,tags[]` | `updated=true` | `saved_queries,saved_query_tags` | M3 |
| `/api/v1/query/saved/{saved_query_id}` | DELETE | session | - | `deleted=true` | `saved_queries,saved_query_tags` | M3 |
| `/api/v1/query/analysis/trend` | POST | session | `time_range,dimensions,metrics,filters` | `series[],summary,meta` | `query_histories`（记录分析元数据） | M3 |
| `/api/v1/query/analysis/anomaly` | POST | session | `time_range,target_metric,window,threshold,filters` | `anomalies[],score,meta` | `query_histories`（记录分析元数据） | M3 |
| `/api/v1/query/analysis/pattern` | POST | session | `time_range,pattern_type,filters,group_by` | `patterns[],confidence,meta` | `query_histories`（记录分析元数据） | M3 |

兼容说明：

1. 如果历史实现临时使用 `DELETE /api/v1/query/history?id=...`，仅作为过渡。
2. Week5 冻结为路径参数形式：`/history/{history_id}`。

### 5.4 `audit-api`（审计）

| 接口 | 方法 | 鉴权 | 请求字段骨架 | 响应字段骨架 | 关联表 | 里程碑 |
|---|---|---|---|---|---|---|
| `/api/v1/audit/logs` | GET | admin | `page,page_size,user_id,action,resource,start_time,end_time` | `items[]` | `audit_logs` | M3 |

### 5.5 `bff-service`（聚合）

| 接口 | 方法 | 鉴权 | 请求字段骨架 | 响应字段骨架 | 里程碑 |
|---|---|---|---|---|---|
| `/api/v1/bff/overview` | GET | session | `tenant_id(optional)` | `services,alerts,ingest,query_summary` | M3（增强） |

### 5.6 `control-plane`（Agent 生命周期）

| 接口 | 方法 | 鉴权 | 请求字段骨架 | 响应字段骨架 | 关联表 | 里程碑 |
|---|---|---|---|---|---|---|
| `/api/v1/agents/register` | POST | session | `agent_name,host,fingerprint,version,capabilities[]` | `agent_id,status,lease_ttl_sec` | `agent_incremental_packages`（复用标识） | M2 扩展 |
| `/api/v1/agents/heartbeat` | POST | session | `agent_id,version,ip,last_error,resource_usage` | `status,next_heartbeat_sec` | `ingest_delivery_receipts`（复用追踪） | M2 扩展 |
| `/api/v1/agents` | GET | session | `status,page,page_size,keyword` | `items[]` | `agent_incremental_packages`（复用标识） | M2 扩展 |
| `/api/v1/agents/{agent_id}/upgrade-plan` | POST | admin | `target_version,batch_id,package_ref,rollout_policy` | `plan_id,status=pending_ack` | `agent_incremental_packages,agent_package_files` | M2 扩展 |
| `/api/v1/agents/{agent_id}/upgrade-ack` | POST | session | `plan_id,ack_status,reason` | `accepted,agent_status` | `ingest_delivery_receipts,ingest_dead_letters` | M2 扩展 |
| `/api/v1/agents/{agent_id}/decommission` | POST | admin | `reason,operator,archive` | `decommissioned=true` | `audit_logs`（记录治理事件） | M2 扩展 |

### 5.7 `collector-agent`（远端拉取 API）

说明：

1. 该组接口由远端 Agent 暴露给日志服务器主动调用，不经网关转发。
2. 鉴权默认使用 API Key，支持双密钥轮换（`active/next`）。
3. Agent 主路径为“增量采集 + pull/ack”，Kafka 推送仅保留为兼容项（P1）。

鉴权请求头：

1. `X-Agent-Key`（必填）
2. `X-Key-Id`（建议，标识 active/next）
3. `X-Request-ID`（可选）

| 接口 | 方法 | 鉴权 | 请求字段骨架 | 响应字段骨架 | 语义 | 里程碑 |
|---|---|---|---|---|---|---|
| `/agent/v1/meta` | GET | api-key | - | `agent_id,version,status,sources,capabilities` | 返回 Agent 运行信息与采集范围 | M2 |
| `/agent/v1/logs/pull` | POST | api-key | `cursor,max_records,max_bytes,timeout_ms` | `batch_id,records[],next_cursor,has_more` | 按游标批次拉取，不提交 checkpoint | M2 |
| `/agent/v1/logs/ack` | POST | api-key | `batch_id,status(ack/nack),committed_cursor,reason` | `accepted,checkpoint_updated` | 仅 `ack` 成功后提交 checkpoint，`nack` 不推进 | M2 |

`POST /agent/v1/logs/pull` 的 `records[]` 结构（2026-03-03 补充）：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `record_id` | string | 是 | Agent 侧记录标识（`rec-{sequence}`），用于幂等追踪与排障定位。 |
| `sequence` | int64 | 是 | Agent 内部递增序号，可与 `cursor/next_cursor` 对照。 |
| `source` | string | 是 | 日志来源标识（通常为文件路径，也可为 syslog 源标识）。 |
| `timestamp` | int64 | 是 | 采集时间戳（Unix 纳秒）。 |
| `collected_at` | string | 是 | `timestamp` 的 UTC 可读格式（RFC3339Nano）。 |
| `data` | string | 是 | 日志原文。 |
| `size_bytes` | int | 是 | 日志原文的字节长度。 |
| `offset` | int64 | 是 | 该条日志在来源中的绝对偏移（行尾位置）。 |
| `metadata` | object | 否 | 扩展元数据（键值对）；为兼容历史调用方，至少可读取 `metadata.offset`。 |

兼容性说明：

1. 历史字段 `source/timestamp/data/metadata` 继续保留，不做删除。
2. 新增字段 `record_id/sequence/collected_at/size_bytes/offset` 为向后兼容扩展。
3. `ack` 提交 checkpoint 语义不变，仍以记录偏移推进，不因字段扩展改变处理流程。

## 6. 关键对象模型（DTO 骨架）

### 6.1 Auth Session

```json
{
  "user_id": "uuid",
  "session_id": "uuid",
  "access_token": "jwt",
  "refresh_token": "opaque-or-jwt",
  "expires_at": "2026-02-28T10:00:00Z",
  "roles": ["admin", "operator"]
}
```

### 6.2 Pull Task

```json
{
  "task_id": "uuid",
  "source_id": "uuid",
  "status": "running",
  "started_at": "2026-02-28T09:10:00Z",
  "finished_at": null,
  "error_message": null
}
```

### 6.3 Query Log Result

```json
{
  "hits": [
    {
      "timestamp": "2026-02-28T09:20:00Z",
      "level": "ERROR",
      "message": "timeout on upstream",
      "source": "agent-a"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 1200,
    "has_next": true
  }
}
```

### 6.4 AgentRegistration

```json
{
  "agent_name": "collector-shanghai-01",
  "host": "10.0.0.15",
  "fingerprint": "sha256:xxxx",
  "version": "1.3.0",
  "capabilities": ["file_incremental", "pull_api", "ack_checkpoint"],
  "registered_at": "2026-03-01T10:00:00Z"
}
```

### 6.5 AgentHeartbeat 与 AgentUpgradePlan

```json
{
  "agent_heartbeat": {
    "agent_id": "uuid",
    "version": "1.3.0",
    "last_seen": "2026-03-01T10:02:00Z",
    "resource_usage": {
      "cpu_percent": 12.5,
      "memory_mb": 256
    },
    "status": "online"
  },
  "agent_upgrade_plan": {
    "plan_id": "uuid",
    "agent_id": "uuid",
    "target_version": "1.4.0",
    "batch_id": "batch-20260301-a",
    "rollout_policy": "canary",
    "ack_status": "pending_ack"
  }
}
```

### 6.6 AnalysisRequest 与 AnalysisResult

```json
{
  "analysis_request": {
    "time_range": {
      "from": "2026-03-01T08:00:00Z",
      "to": "2026-03-01T10:00:00Z"
    },
    "filters": {
      "service": ["api-service"],
      "level": ["ERROR"]
    },
    "dimensions": ["service", "host"],
    "metrics": ["count", "error_rate"]
  },
  "analysis_result": {
    "result_type": "trend",
    "series": [],
    "summary": {
      "total": 1200,
      "anomaly_points": 3
    },
    "meta": {
      "degraded": false,
      "request_id": "gw-1700000000-127.0.0.1"
    }
  }
}
```

## 7. 接口安全与一致性要求

1. 写接口建议启用 `X-Idempotency-Key`，防止重试导致重复写入。
2. 管理接口（用户、角色、告警）必须记录审计日志。
3. 网关鉴权失败统一返回同结构错误体和 `request_id`。
4. 任何跨服务调用失败必须转换为稳定错误码，不直透内部异常堆栈。

## 8. 版本与变更策略

1. 版本策略：M1~M3 固定 `v1`，不新增 `v2` 前缀。
2. 破坏性变更：必须先增加兼容字段，至少跨一个周周期后删除旧字段。
3. 路径变更：必须同步更新 `06/07/08/09/10/11/12` 文档。
4. 接口冻结点：
   1. Week2 结束冻结认证接口字段。
   2. Week4 结束冻结 ingest 接口字段。
   3. Week5 结束冻结 query 接口字段。
   4. Week6 结束冻结治理接口字段。

## 9. API 验收门禁（联调必须满足）

1. 每个新接口至少 1 条成功 + 1 条失败自动化测试。
2. 每个写接口至少 1 条幂等/重复提交测试。
3. 每组接口至少 1 条鉴权失败测试（401/403）。
4. 每个里程碑至少 1 条前后端主链路 E2E 测试。
5. 所有 API 变更需附证据：契约 diff、测试报告、网关日志样例。

## 10. 与现有代码差异的优先级处理

| 差异 | 优先级 | 收敛周次 | 说明 |
|---|---|---|---|
| 网关仍有 `/api/data/*` 旧前缀 | P0 | Week1~Week2 | 迁移到 `/api/v1/query|audit|export/*` |
| upstream 仍有 `*:8080` 旧端口 | P0 | Week1 | 对齐 `query:8082/audit:8083/export:8084` |
| 认证白名单保留 `forgot-password` 旧路径 | P0 | Week2 | 切换到 `password/reset-*` 路径 |
| 查询历史删除接口风格不统一 | P1 | Week5 | 统一 `DELETE /history/{history_id}` |

## 11. 版本记录

- `v1.3`（2026-03-03）：补充 `GET /api/v1/ingest/packages` 的包级/文件级日志结构字段，明确 `batch_id/next_cursor/record_count/files[]/metadata` 契约。
- `v1.2`（2026-03-03）：细化 `collector-agent` 拉取记录 `records[]` 字段结构，明确 `record_id/sequence/offset/size_bytes/collected_at` 及兼容策略。
- `v1.1`（2026-03-01）：补齐 Agent 生命周期与分析接口契约，新增 DTO 骨架与错误码扩展，明确 M2/M3 扩展接口口径。
- `v1.0`（2026-02-28）：首次形成当前项目 API 接口设计基线，覆盖 M1~M3 所有 P0 接口。
