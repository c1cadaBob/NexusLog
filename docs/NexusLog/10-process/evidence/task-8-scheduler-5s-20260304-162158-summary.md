# 任务8：自动调度 5s 拉取联调证据（2026-03-04）

## 结论
- 控制面 `ingest scheduler` 已开启并持续运行。
- 远程日志源 `31f0d08e-cc4d-4a88-9955-92768717e39e` 与 `0cfa9a2a-a183-4415-8953-bf58e619e13e` 的 `pull_interval_sec` 均为 `5`。
- 两个远程源最近任务均为 `trigger_type=scheduled` 且 `status=success`，`last_cursor` 持续推进。
- Elasticsearch `logs-remote` 在 5 秒粒度采样中持续增长，验证“自动拉取 -> 入库 ES”链路有效。

## 关键证据
- 原始日志文件：`docs/NexusLog/10-process/evidence/task-8-scheduler-5s-20260304-162158.log`
- pull source 配置证据：`pull_interval_sec=5`（见日志 `## pull_sources` 区段）
- 任务成功证据：两个 source 最近 10 条任务均为 `scheduled + success`（见日志 `## pull_tasks_source_31f0` / `## pull_tasks_source_0cfa`）
- 调度周期证据：control-plane 连续输出 `interval_sec=5`（见日志 `## control_plane_scheduler_logs`）

## ES 增量采样（每 5 秒）
- 2026-03-04T08:21:58Z `count=108506`
- 2026-03-04T08:22:03Z `count=109506`
- 2026-03-04T08:22:08Z `count=110506`
- 2026-03-04T08:22:13Z `count=111006`
- 2026-03-04T08:22:18Z `count=112006`
- 2026-03-04T08:22:23Z `count=112506`

## 结果说明
- 25 秒内总增量：`+4000`（`108506 -> 112506`）。
- 说明调度触发与入 ES 均在持续执行，已满足“每 5 秒自动拉取”的运行表现。
