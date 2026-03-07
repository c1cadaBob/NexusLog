# Task 6.1 control-plane pull-sources 实现记录

- 日期：2026-03-02
- 任务：`6.1 实现 GET/POST/PUT /api/v1/ingest/pull-sources`
- 服务：`services/control-plane`

## 本次交付范围

1. 新增 `GET /api/v1/ingest/pull-sources`：支持 `page/page_size/status`。
2. 新增 `POST /api/v1/ingest/pull-sources`：支持创建拉取源（`name/host/port/protocol/path/auth`）。
3. 新增 `PUT /api/v1/ingest/pull-sources/:source_id` 与 `PUT /api/v1/ingest/pull-sources`：支持更新拉取源。
4. 增加参数校验与错误码：
   - `INGEST_PULL_SOURCE_INVALID_ARGUMENT`
   - `INGEST_PULL_SOURCE_NOT_FOUND`
   - `INGEST_PULL_SOURCE_NAME_CONFLICT`
5. 增加接口自动化测试（含参数校验失败场景）。

## 自动化测试结果

- 命令：
  - `cd /opt/projects/NexusLog/services/control-plane && go test ./internal/ingest -run PullSource -v`
- 结果：`PASS`
- 测试日志：
  - `docs/NexusLog/process/evidence/task-6.1-control-plane-pull-sources-20260302.log`

## 备注

- 当前为任务 6.1 的最小可用实现，使用内存仓储完成接口行为与校验闭环。
- 任务 8.1 将对接 `ingest_pull_sources` 持久化落库能力。
