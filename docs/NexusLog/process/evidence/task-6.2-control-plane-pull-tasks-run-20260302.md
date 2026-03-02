# Task 6.2 control-plane pull-tasks/run 实现记录

- 日期：2026-03-02
- 任务：`6.2 实现 POST /api/v1/ingest/pull-tasks/run`
- 服务：`services/control-plane`

## 本次交付范围

1. 新增 `POST /api/v1/ingest/pull-tasks/run`。
2. 请求字段支持：`source_id`、`trigger_type`、`options`。
3. 响应字段返回：`task_id`、`source_id`、`trigger_type`、`status=pending`。
4. 增加参数校验与错误码：
   - `INGEST_PULL_TASK_INVALID_ARGUMENT`
   - `INGEST_PULL_TASK_SOURCE_NOT_FOUND`
5. 在任务触发前校验 `source_id` 是否存在（复用 6.1 pull-sources 内存仓储）。

## 自动化测试结果

- 命令：
  - `cd /opt/projects/NexusLog/services/control-plane && go test ./internal/ingest -run RunPullTask -v`
- 结果：`PASS`
- 测试日志：
  - `docs/NexusLog/process/evidence/task-6.2-control-plane-pull-tasks-run-20260302.log`

## 备注

- 当前为任务 6.2 最小可用实现，任务创建后状态初始化为 `pending`。
- 任务状态机完整流转与任务查询能力将在 6.3 继续补齐。
