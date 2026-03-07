# Task 6.4 control-plane packages 查询实现记录

- 日期：2026-03-02
- 任务：`6.4 实现 GET /api/v1/ingest/packages`
- 服务：`services/control-plane`

## 本次交付范围

1. 新增 `GET /api/v1/ingest/packages` 查询接口。
2. 支持查询参数：
   - `agent_id`（可选）
   - `source_ref`（可选）
   - `status`（可选，支持 `created/uploading/uploaded/acked/nacked/failed/dead_lettered`）
   - `page/page_size`（可选，默认 `1/20`，`page_size` 上限 200）
3. 返回结构支持 `items[]` 与分页元数据 `meta.page/meta.page_size/meta.total`。
4. 列表默认按 `created_at` 倒序（最新包优先）。
5. 参数非法场景返回统一错误码：`INGEST_PACKAGE_INVALID_ARGUMENT`。

## 自动化测试结果

- 命令：
  - `cd /opt/projects/NexusLog/services/control-plane && go test ./internal/ingest -run "ListPullPackages" -v`
- 结果：`PASS`
- 覆盖用例：
  - `TestListPullPackagesByFilter`
  - `TestListPullPackagesPagination`
  - `TestListPullPackagesInvalidArgument`
- 测试日志：
  - `docs/NexusLog/process/evidence/task-6.4-control-plane-packages-query-20260302.log`

## 备注

- 当前 6.4 为内存仓储查询闭环，已覆盖筛选、分页、参数校验。
- 后续 8.x 阶段将与 `agent_incremental_packages/agent_package_files` 实表落库对接。
