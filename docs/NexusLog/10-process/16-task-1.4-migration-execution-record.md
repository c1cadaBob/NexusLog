# 任务 1.4 迁移执行记录（命令顺序/执行结果/失败恢复）

## 1. 文档目的与范围

本文件用于完成任务 1.4：将数据库迁移执行流程沉淀为可复用的标准操作记录，并给出失败恢复步骤与证据索引。

范围限定：
1. 仅覆盖运行时迁移目录 `storage/postgresql/migrations`。
2. 仅复跑既有迁移 `000012~000015` 的 `down/up` 演练。
3. 不新增业务逻辑，不修改迁移 SQL 语义。

## 2. 前置条件

1. 迁移工具可用：`migrate` 已安装且可执行。
2. 数据库连接已设置：`DB_DSN`（优先）或 `DATABASE_URL`（兜底）。
3. `postgres` 容器可用：`docker compose ps postgres` 显示 healthy。
4. 统一入口约束：
   - 推荐入口：`make db-migrate-*`
   - 直接入口：`scripts/db-migrate.sh`
   - 禁止散落执行原始 `migrate -path ...` 命令。

## 3. 标准执行顺序（按主证据日志）

执行日期：`2026-03-01`  
主证据日志：`docs/NexusLog/10-process/evidence/task-1.4-migration-command-sequence-20260301.log`

1. 进入仓库并设置连接串：
   - `cd /opt/projects/NexusLog`
   - `export DB_DSN='postgres://nexuslog:nexuslog_dev@localhost:5432/nexuslog?sslmode=disable'`
2. 记录环境与基线：
   - `date`
   - `command -v migrate`
   - `migrate -version`
   - `make db-migrate-version`
   - `docker compose ps postgres`
   - `SELECT version, dirty FROM schema_migrations;`
3. 执行回滚演练：
   - `make db-migrate-down STEPS=4`
4. 校验回滚结果：
   - `schema_migrations` 预期 `1/f`
   - 关键表（`000012~000015`）不存在
5. 执行恢复演练：
   - `make db-migrate-up STEPS=4`
6. 校验恢复结果：
   - `schema_migrations` 预期 `15/f`
   - `000012/000015` 关键表恢复存在

## 4. 执行结果摘要

1. 回滚阶段：`down 4` 成功，版本由 `15/f` 变为 `1/f`。
2. 回滚校验：`000012~000015` 涉及关键表查询结果为 `0 rows`。
3. 恢复阶段：`up 4` 成功，版本恢复为 `15/f`。
4. 恢复校验：`user_sessions/password_reset_tokens/login_attempts/config_*/runtime_config_*` 均存在。
5. 最终结论：迁移命令顺序、执行结果可复现，环境已恢复到可继续开发状态。

## 5. 失败恢复步骤（场景矩阵）

| 失败场景 | 现象 | 恢复步骤 |
|---|---|---|
| `DB_DSN` 缺失 | 报错 `DB_DSN is not set` | 1) `export DB_DSN='postgres://nexuslog:nexuslog_dev@localhost:5432/nexuslog?sslmode=disable'` 2) 重试 `make db-migrate-version` |
| `STEPS` 参数非法 | 报错 `down steps must be an integer` | 1) 修正为整数参数 2) 重试 `make db-migrate-down STEPS=1` |
| `schema_migrations dirty=true` | 迁移中断或版本脏状态 | 1) `scripts/db-migrate.sh goto <last_clean_version>` 2) `make db-migrate-up` 3) SQL 复核 `version, dirty` |
| `go mod download` 网络失败 | 镜像构建失败，下载超时 | 1) `source /opt/projects/NexusLog/.env.mirrors` 2) `docker compose build --build-arg GOPROXY=$GOPROXY control-plane api-service query-api audit-api export-api` |
| 宿主端口冲突 | `port is already allocated` | 1) 使用 `docker compose run -d --no-deps --name nl-...` 启容器 2) `docker exec` 容器内检查 `/healthz` 3) 通过后再处理端口冲突 |

## 6. 证据索引

1. `docs/NexusLog/10-process/evidence/task-1.2-migration-up-20260228.log`
2. `docs/NexusLog/10-process/evidence/task-1.2-migration-up-remediation-20260228.log`
3. `docs/NexusLog/10-process/evidence/task-1.2-migration-up-recheck-20260228.log`
4. `docs/NexusLog/10-process/evidence/task-1.3-migration-down-rollback-20260228.log`
5. `docs/NexusLog/10-process/evidence/task-1.4-migration-command-sequence-20260301.log`
6. `docs/NexusLog/10-process/evidence/task-1.4-migration-failure-recovery-20260301.log`

## 7. 结论与边界

1. 任务 1.4 已闭环：命令顺序、执行结果、失败恢复步骤均已文档化并有当日补证。
2. 本次不包含任务 1.5（迁移执行态口径同步治理）的范围扩展。
3. 当前数据库最终状态保持 `schema_migrations=15` 且 `dirty=false`。
