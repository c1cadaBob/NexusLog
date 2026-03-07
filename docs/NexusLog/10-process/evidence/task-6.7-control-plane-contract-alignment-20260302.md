# Task 6.7 control-plane ingest 契约对齐实现记录

- 日期：2026-03-02
- 任务：`6.7 对齐请求字段、分页与错误码（按 12 文档）`
- 服务：`services/control-plane`
- 对齐基线：`docs/NexusLog/process/12-current-project-api-interface-design.md`

## 本次对齐内容

1. 错误码对齐（3.5 规范）：
   - `REQ_INVALID_PARAMS`
   - `RES_NOT_FOUND`
   - `RES_CONFLICT`
   - `INTERNAL_ERROR`
2. 分页 `meta` 对齐（3.4 规范）：
   - 所有 ingest 列表接口统一返回 `meta.page/page_size/total/has_next`。
   - 覆盖接口：`GET /api/v1/ingest/pull-sources`、`GET /api/v1/ingest/pull-tasks`、`GET /api/v1/ingest/packages`。
3. 请求字段口径复核（5.2 接口骨架）：
   - `pull-sources`：`page/page_size/status`、`name/host/port/protocol/path/auth`、`{source_id}+更新字段`。
   - `pull-tasks`：`source_id/trigger_type/options`、`source_id/status/page/page_size`。
   - `packages`：`agent_id/source_ref/status/page/page_size`。
   - `receipts`：`package_id/status(ack|nack)/reason/checksum`。
   - `dead-letters/replay`：`dead_letter_ids[]/reason`。

## 自动化测试结果

- 命令：
  - `cd /opt/projects/NexusLog/services/control-plane && go test ./internal/ingest -v`
- 结果：`PASS`
- 关键覆盖：
  - `TestGlobalErrorCodeContractAlignment`（错误码常量对齐）
  - `TestPullSourceCreateAndList/TestListPullTasksPagination/TestListPullPackagesPagination`（`has_next` 分页元信息）
  - `TestCreateReceipt*`、`TestReplayDeadLetters*`（写接口与错误码场景回归）
- 测试日志：
  - `docs/NexusLog/process/evidence/task-6.7-control-plane-contract-alignment-20260302.log`

## 备注

- 当前实现保持 M2 阶段内存仓储最小闭环，重点完成契约层一致性对齐。
- 持久化落库与跨服务错误码透传治理在 8.x/后续任务继续推进。
