# Task 8 Real Pull -> ES -> ACK 联调证据摘要（2026-03-04）

## 1. 执行目标

验证 `control-plane` 执行链路可完成一次真实：

1. `pull-sources` 创建
2. `pull-tasks/run` 触发
3. 调用 agent `POST /agent/v1/logs/pull`
4. 写入 ES `_bulk`
5. 回写 agent `POST /agent/v1/logs/ack`
6. PG 侧落库与游标推进

## 2. 证据主日志

1. `docs/NexusLog/10-process/evidence/task-8-real-pull-es-ack-20260304-122352.log`

该日志包含：

1. 迁移执行（`000017`）
2. 容器/健康检查信息
3. 多轮联调过程（含失败定位）
4. 最终成功链路的 API/SQL/ES/日志证据

## 3. 关键过程与问题定位

1. 首次失败：`INGEST_AGENT_PULL_FAILED`，根因是 `control-plane` 与 `collector-agent` 不在同一 Docker 网络，`collector-agent` DNS 不可解析。
2. 第二次失败：`INGEST_ES_WRITE_FAILED`，根因是容器内默认 ES 地址 `http://localhost:9200` 不可达。
3. 最终成功：采用临时本机进程 `control-plane`（显式指定 DB/Agent/ES 地址）完成真实闭环，并在结束后恢复容器版 `control-plane`。

## 4. 最终成功样本（Final Attempt）

1. `source_id`: `29d0e0d6-885b-4442-a9eb-f110c1aec22d`
2. `task_id`: `7adb8307-effd-4528-8d87-8bb6ba6b8264`
3. `task.status`: `success`
4. `batch_id`: `batch-72aab03cfd43fa0f10bc4f15`
5. `package_id`: `777cab65-b0c7-4dda-8687-f7d83ac406e7`
6. `package.status`: `acked`
7. `receipt.result`: `ack`
8. `cursor.last_cursor`: `6`
9. `cursor.last_offset`: `290`
10. `dead_letters`: `0`

## 5. SQL 结果要点（见主日志原文）

1. `ingest_pull_tasks`：`status=success`，`batch_id` 已回填。
2. `agent_incremental_packages`：生成 1 条包记录，`record_count=6`，`status=acked`。
3. `agent_pull_batches`：生成 1 条批次记录，`status=acked`，`retry_count=0`。
4. `agent_pull_cursors`：按 `source_id + source_path` 推进到最新游标与偏移。
5. `ingest_delivery_receipts`：有 `ack` 回执。
6. `ingest_dead_letters`：无记录。

## 6. ES 结果要点（见主日志原文）

1. `POST /logs-remote/_refresh` 成功。
2. `GET /logs-remote/_count` 返回 `count=6`。
3. 按 `task_id` 与 `batch_id` 查询均命中 `6` 条文档。
4. 样本文档包含 `task_id/batch_id/record_id/source/offset/message` 字段。

## 7. 环境恢复状态

1. 临时本机 `control-plane` 进程已停止。
2. 容器版 `nexuslog-control-plane-1` 已恢复并通过 `GET /healthz`。
