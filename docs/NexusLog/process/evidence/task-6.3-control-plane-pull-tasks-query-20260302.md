# Task 6.3 control-plane pull-tasks 查询实现记录

- 日期：2026-03-02
- 任务：`6.3 实现 GET /api/v1/ingest/pull-tasks`
- 服务：`services/control-plane`

## 本次交付范围

1. 新增 `GET /api/v1/ingest/pull-tasks` 查询接口。
2. 支持查询参数：
   - `source_id`（可选）
   - `status`（可选，支持 `pending/running/success/failed/canceled`）
   - `page/page_size`（可选，默认 `1/20`，`page_size` 上限 200）
3. 查询结果支持分页元数据：`meta.page/meta.page_size/meta.total`。
4. 查询结果默认按 `scheduled_at` 倒序（最新任务优先）。
5. 参数非法场景返回统一错误码：`INGEST_PULL_TASK_INVALID_ARGUMENT`。

## 自动化测试结果

- 命令：
  - `cd /opt/projects/NexusLog/services/control-plane && go test ./internal/ingest -run "PullTask" -v`
- 结果：`PASS`
- 覆盖用例：
  - `TestListPullTasksByFilter`
  - `TestListPullTasksPagination`
  - `TestListPullTasksInvalidArgument`
- 测试日志：
  - `docs/NexusLog/process/evidence/task-6.3-control-plane-pull-tasks-query-20260302.log`

## 备注

- 当前 6.3 在内存仓储层完成任务查询闭环，已满足接口行为、分页和筛选要求。
- 任务状态流转与持久化落库将在 8.x 阶段继续对接数据库实体。
