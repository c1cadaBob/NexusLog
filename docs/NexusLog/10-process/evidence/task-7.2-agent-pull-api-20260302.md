# Task 7.2 agent pull API 实现记录

- 日期：2026-03-02
- 任务：`7.2 实现 GET /agent/v1/meta、POST /agent/v1/logs/pull、POST /agent/v1/logs/ack`
- 服务：`agents/collector-agent`

## 本次交付范围

1. 新增 `internal/pullapi` 服务并注册三条接口：
   - `GET /agent/v1/meta`
   - `POST /agent/v1/logs/pull`
   - `POST /agent/v1/logs/ack`
2. 实现 pull/ack 会话闭环：
   - 采集批次入内存窗口后按 `cursor + max_records + max_bytes` 拉取；
   - 生成 `batch_id` 并维护 pending 批次；
   - `ack` 成功后回写 checkpoint，返回 `accepted/checkpoint_updated`。
3. 在主程序增加采集批次 fan-out：
   - 同时投递给 pull API 缓冲与现有 pipeline，保持兼容链路并行。
4. 参数校验失败返回稳定错误码：
   - `REQ_INVALID_PARAMS`
   - `RES_NOT_FOUND`
   - `INTERNAL_ERROR`（预留）

## 自动化测试结果

- 命令（全量）：
  - `cd /opt/projects/NexusLog/agents/collector-agent && go test ./...`
- 结果：`PASS`
- 命令（7.2 聚焦）：
  - `cd /opt/projects/NexusLog/agents/collector-agent && go test ./internal/pullapi -run "MetaRouteSuccess|PullAndAckFlow|PullInvalidArgument" -v`
- 关键用例：
  - `TestMetaRouteSuccess`
  - `TestPullAndAckFlow`
  - `TestPullInvalidArgument`
- 测试日志：
  - `docs/NexusLog/process/evidence/task-7.2-agent-pull-api-20260302.log`

## 备注

- 当前 7.2 已形成“采集 -> pull -> ack -> checkpoint”最小接口闭环。
- `X-Agent-Key/X-Key-Id` 鉴权将在 7.3 继续补齐。
