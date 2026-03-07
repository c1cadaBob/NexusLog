# 迁移执行态基线（文件存在 vs 环境已执行）

> 基线日期：2026-03-01  
> 运行环境：`docker compose` 本地 `postgres`（`localhost:5432`）  
> 运行时唯一迁移目录：`storage/postgresql/migrations`

## 1. 文档目的

本文件用于明确两个维度，避免“迁移文件已存在”被误解为“环境已执行”：

1. 文件存在态：仓库 `storage/postgresql/migrations` 中是否存在成对的 `up/down` 迁移文件。
2. 环境执行态：目标环境数据库是否已执行到对应版本，且关键表实际存在。

## 2. 当前执行态结论（2026-03-01）

1. `schema_migrations`：`version=15`, `dirty=false`。
2. 迁移文件覆盖：`000001`、`000012`、`000013`、`000014`、`000015` 均存在 `up/down` 成对文件。
3. 关键表执行校验：25/25 均存在（含 `obs.tenant` 与 `public` 下关键业务表）。

## 3. 版本矩阵（文件态 vs 执行态）

| 迁移版本 | 文件存在态（仓库） | 执行态（环境） | 关键表校验 |
|---|---|---|---|
| `000001` | `up/down` 成对存在 | 已执行 | `obs.tenant/users/roles/user_roles/alert_rules/audit_logs` 存在 |
| `000012` | `up/down` 成对存在 | 已执行 | `user_sessions/password_reset_tokens/login_attempts` 存在 |
| `000013` | `up/down` 成对存在 | 已执行 | `ingest_pull_*`、`agent_*`、`ingest_*` 关键表存在 |
| `000014` | `up/down` 成对存在 | 已执行 | `query_histories/saved_queries/saved_query_tags` 存在 |
| `000015` | `up/down` 成对存在 | 已执行 | `config_*`、`runtime_config_*` 关键表存在 |

## 4. 判定口径（团队统一）

1. “已新增迁移”仅表示文件存在态成立，不等于环境执行态成立。
2. “已完成迁移执行”必须同时满足：
   - `schema_migrations` 版本与目标一致且 `dirty=false`
   - 对应关键表存在性校验通过
   - 有可追溯证据日志
3. 所有文档在描述迁移状态时，必须显式标注是“文件态”还是“执行态”。

## 5. 证据索引

1. `docs/NexusLog/10-process/evidence/task-1.2-migration-up-remediation-20260228.log`
2. `docs/NexusLog/10-process/evidence/task-1.2-migration-up-recheck-20260228.log`
3. `docs/NexusLog/10-process/evidence/task-1.3-migration-down-rollback-20260228.log`
4. `docs/NexusLog/10-process/evidence/task-1.4-migration-command-sequence-20260301.log`
5. `docs/NexusLog/10-process/evidence/task-1.5-migration-execution-state-sync-20260301.log`

## 6. 后续维护要求

1. 每新增一个迁移版本，需同步更新本文件第 3 节版本矩阵。
2. 每次环境迁移演练完成后，需追加新的执行证据日志并更新本文件基线日期。
3. 若出现 `dirty=true`，必须先完成恢复再更新任何“已执行”文档状态。
