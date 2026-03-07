# Task 6.6 control-plane dead-letters replay 实现记录

- 日期：2026-03-02
- 任务：`6.6 实现 POST /api/v1/ingest/dead-letters/replay`
- 服务：`services/control-plane`

## 本次交付范围

1. 新增 `POST /api/v1/ingest/dead-letters/replay`。
2. 请求字段支持：`dead_letter_ids[]`、`reason`。
3. 响应字段返回：`replay_batch_id`、`replayed_count`。
4. 行为规则：
   - 批量重放成功时返回 `200`，并更新每条死信的 `retry_count/replayed_at/replay_batch_id/replay_reason`。
   - 当 `dead_letter_ids` 全部不存在时返回 `404` 与 `INGEST_DEAD_LETTER_NOT_FOUND`。
5. 参数校验与错误码：
   - `INGEST_DEAD_LETTER_INVALID_ARGUMENT`
   - `INGEST_DEAD_LETTER_NOT_FOUND`
   - `INGEST_DEAD_LETTER_INTERNAL_ERROR`（预留）
6. 与 6.5 联动：
   - `POST /api/v1/ingest/receipts` 的 `nack` 分支会写入死信记录，供本接口重放。

## 自动化测试结果

- 命令：
  - `cd /opt/projects/NexusLog/services/control-plane && go test ./internal/ingest -run "ReplayDeadLetters|CreateReceipt" -v`
- 结果：`PASS`
- 覆盖用例：
  - `TestReplayDeadLettersSuccess`
  - `TestReplayDeadLettersInvalidArgument`
  - `TestReplayDeadLettersNotFound`
  - `TestCreateReceiptNack`（验证 `nack` 会写入死信）
- 测试日志：
  - `docs/NexusLog/process/evidence/task-6.6-control-plane-dead-letters-replay-20260302.log`

## 备注

- 当前 6.6 采用内存仓储完成最小可用闭环，满足接口语义、参数校验与错误场景要求。
- 后续 8.x 阶段将与持久化表结构和补偿流程进一步对接。
