# Task 6.5 control-plane receipts 写入实现记录

- 日期：2026-03-02
- 任务：`6.5 实现 POST /api/v1/ingest/receipts`
- 服务：`services/control-plane`

## 本次交付范围

1. 新增 `POST /api/v1/ingest/receipts`。
2. 请求字段支持：`package_id`、`status(ack/nack)`、`reason`、`checksum`。
3. 响应字段返回：`receipt_id`、`accepted`。
4. ACK/NACK 处理逻辑：
   - `ack`：将包状态更新为 `acked`，并写入 `acked_at`。
   - `nack`：将包状态更新为 `nacked`（后续 6.6 可据此重放/补偿）。
5. 参数校验与错误码：
   - `INGEST_RECEIPT_INVALID_ARGUMENT`
   - `INGEST_RECEIPT_PACKAGE_NOT_FOUND`
   - `INGEST_RECEIPT_CHECKSUM_MISMATCH`
6. 当回执 `checksum` 与包 `checksum` 不一致时返回 `409`，且不更新包状态。

## 自动化测试结果

- 命令：
  - `cd /opt/projects/NexusLog/services/control-plane && go test ./internal/ingest -run "CreateReceipt" -v`
- 结果：`PASS`
- 覆盖用例：
  - `TestCreateReceiptAck`
  - `TestCreateReceiptNack`
  - `TestCreateReceiptInvalidArgument`
  - `TestCreateReceiptPackageNotFound`
  - `TestCreateReceiptChecksumMismatch`
- 测试日志：
  - `docs/NexusLog/10-process/evidence/task-6.5-control-plane-receipts-20260302.log`

## 备注

- 当前 6.5 在内存仓储层完成 ACK/NACK 回执闭环，满足接口行为与失败场景校验。
- 死信重放能力将在 6.6 与后续任务继续对接。
