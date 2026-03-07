# 数据表完善与扩展预留方案（面向下一阶段开发）

> 目标：基于当前仓库真实状态，检查数据模型可完善点，并给出可扩展设计。  
> 范围：`storage/postgresql/migrations`、`docs/NexusLog/20-database/sql`、前端 59 页业务需求、Agent/Query/Gateway 代码现状。

## 1. 现状结论（必须先统一）

### 1.1 存在“双迁移真相源”分叉

- 运行时迁移（`storage/postgresql/migrations/000001_init_schema.up.sql`）：当前仅 `6` 张表。
  - `obs.tenant/users/roles/user_roles/alert_rules/audit_logs`
- 文档迁移（`docs/NexusLog/20-database/sql/V1~V11`）：共 `87` 张表（含增量迁移新增表）。

结论：如果不先统一迁移真相源，后续业务开发会出现“页面需求 > API > 表结构”无法稳定对齐的问题。

### 1.2 与前端业务覆盖存在结构性缺口

结合 `docs/NexusLog/10-process/04-frontend-pages-functional-workflow-dataflow.md`：

- 前端页面已覆盖 59 路由页面。
- 后端业务接口大多占位（`query-api/audit-api/export-api` 仅返回“待实现”）。
- 现有运行时 6 张表无法支撑检索、采集、事件、配置版本、通知、静默、工单等主链路。

---

## 2. 数据表可完善点（按业务域）

## 2.1 认证与账号域

当前可用：`users/roles/user_roles`（运行时）；文档域尚有 `tenant/project/environment`。

建议新增（MVP 必做）：

- `user_session`
  - 用途：登录会话、刷新 token、踢下线。
  - 关键字段：`id/user_id/tenant_id/refresh_token_hash/expires_at/revoked_at/client_ip/user_agent/created_at`。
- `password_reset_token`
  - 用途：找回密码链路。
  - 关键字段：`id/user_id/token_hash/expires_at/used_at`。
- `login_attempt`
  - 用途：登录风控、锁定策略。
  - 关键字段：`id/tenant_id/username/ip/result/reason/created_at`。

扩展预留：

- `identity_provider_binding`（为 SSO/OIDC/LDAP 预留）。
- `user_mfa_factor`（MFA 演进）。

## 2.2 采集与接入域（重点：你提出的 a/b）

现有可复用：文档域 `agent_node/agent_group/collector_rule/collector_target`。

当前不足：

- 缺“远端拉取任务”一等实体。
- 缺“增量打包任务/清单/回执”链路表。
- 缺“文件级 checkpoint 元数据”落库（当前 agent 本地文件 checkpoint，不可中心审计）。

建议新增（MVP 必做）：

- `ingest_pull_source`
  - 用途：配置远端服务器拉取源（主机、端口、协议、认证引用）。
  - 关键字段：`id/tenant_id/project_id/env_id/name/host/port/protocol/path_pattern/auth_ref/status/poll_interval_sec`。
- `ingest_pull_task`
  - 用途：调度执行主动拉取任务。
  - 关键字段：`id/source_id/scheduled_at/started_at/finished_at/status/error_code/error_message/bytes_pulled/files_pulled`。
- `agent_incremental_package`
  - 用途：Agent 对本地日志增量打包的作业记录。
  - 关键字段：`id/agent_id/source_ref/package_no/from_offset/to_offset/file_count/size_bytes/checksum/status/created_at/sent_at`。
- `agent_package_file`
  - 用途：包内文件清单（便于精确追溯）。
  - 关键字段：`id/package_id/file_path/file_inode/from_offset/to_offset/line_count/checksum`。
- `ingest_delivery_receipt`
  - 用途：日志服务器接收回执（ACK/NACK），保证可补偿。
  - 关键字段：`id/package_id/received_at/result/error_code/error_message/consumer_offset`。
- `ingest_file_checkpoint`
  - 用途：中心化断点，与 agent 本地 checkpoint 形成双保险。
  - 关键字段：`id/agent_id/source_ref/file_path/file_inode/offset/updated_at`。
- `ingest_dead_letter`
  - 用途：采集失败/解码失败/落库失败死信。
  - 关键字段：`id/tenant_id/source_ref/payload/error_code/error_message/failed_at/retry_count`。

扩展预留：

- `ingest_transform_profile`（未来解析/脱敏策略下沉到接入层）。
- `ingest_bandwidth_quota`（按租户/项目限额）。

## 2.3 检索与查询域（重点：你提出的 c）

建议新增（MVP 必做）：

- `query_history`
  - 用途：检索历史页。
- `saved_query`
  - 用途：收藏查询页。
- `saved_query_tag`
  - 用途：标签和分类。

说明：日志正文仍建议主存 ES Data Stream；PG 只存“查询元数据/偏好/审计”。

## 2.4 告警与事件域

文档域已有 `alert_event/alert_ack/incident*`，但运行时未落地。

建议补齐：

- `alert_rule_version`（规则版本化与回滚）。
- `alert_notification_channel`、`alert_notification_binding`（通知渠道与规则绑定）。
- `alert_silence_policy`、`alert_silence_matcher`（静默策略）。
- `incident_status_transition_log`（显式状态迁移日志；虽然已有触发器规则，仍建议保留业务可读日志）。

## 2.5 配置与热固化域（重点：避免改 YAML + 重启）

文档域已具备 `config_namespace/config_item/config_version/config_publish`，建议作为统一配置中心事实源。

建议新增：

- `runtime_config_subscription`
  - 用途：记录服务实例订阅关系与配置版本。
- `runtime_config_dispatch_log`
  - 用途：记录配置下发、回滚、失败重试。

---

## 3. 扩展性设计规范（建议作为后续所有新表模板）

所有新增业务表建议统一包含：

- 组织维度：`tenant_id/project_id/env_id`（如确实全局表可例外）。
- 生命周期字段：`status/created_at/updated_at`，必要时 `deleted_at`（软删）。
- 幂等字段：`dedup_key` 或业务唯一键（接口重放安全）。
- 可扩展字段：`metadata jsonb DEFAULT '{}'::jsonb`（避免频繁 DDL）。
- 审计追踪：`trace_id/operator`（结合 `data_change_audit`）。

索引建议：

- 高频筛选复合索引：`(tenant_id, status, created_at DESC)`。
- 时间分区大表：按月分区 + BRIN（审计、任务流水）。
- JSON 检索字段：GIN 索引仅用于明确查询路径，避免泛滥。

约束建议：

- 状态字段用 `CHECK` 或状态机迁移表。
- 关键引用外键 + `ON DELETE` 策略明确。
- 所有时间区间字段增加 `CHECK (end >= start)`。

---

## 4. 迁移落地切分（已按运行时迁移目录创建）

已在 `storage/postgresql/migrations` 创建：

- `000012_mvp_auth_session_and_security.up.sql`
  - `user_sessions/password_reset_tokens/login_attempts`
- `000013_mvp_ingest_pull_and_incremental_package.up.sql`
  - `ingest_pull_sources/ingest_pull_tasks/agent_incremental_packages/agent_package_files/ingest_delivery_receipts/ingest_file_checkpoints/ingest_dead_letters`
- `000014_mvp_search_query_metadata.up.sql`
  - `query_histories/saved_queries/saved_query_tags`
- `000015_runtime_config_dispatch_and_subscription.up.sql`
  - `config_namespace/config_item/config_version/config_publish/runtime_config_subscription/runtime_config_dispatch_log`

以上迁移均已提供 `.down.sql` 回滚脚本。

---

## 5. 决策状态（2026-02-28）

已确认：

1. **迁移真相源**：统一到 `storage/postgresql/migrations`。
2. **采集模式（MVP）**：服务器主动拉取为主。
3. **采集模式（后续）**：演进为 Agent 推送为主，服务器主动拉取为辅。
4. **登录体系（MVP）**：先本地账号，后续再接 Keycloak。
5. **检索优先级**：实时检索 + 历史/收藏并行落地。
6. **租户模型命名统一策略**：统一为 `obs.tenant`（单数 + schema），不保留兼容视图。
