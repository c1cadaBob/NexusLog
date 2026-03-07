# Task 7.3 agent pull API 鉴权实现记录

- 日期：2026-03-02
- 任务：`7.3 增加 Agent 拉取接口鉴权：X-Agent-Key（必填）与 X-Key-Id（可选）`
- 服务：`agents/collector-agent`

## 本次交付范围

1. `internal/pullapi` 增加鉴权配置与校验逻辑：
   - `X-Agent-Key` 必填；
   - `X-Key-Id` 可选（提供时按 key-id 精确匹配，不提供时按已配置 key 集合匹配）。
2. 三个接口统一鉴权：
   - `GET /agent/v1/meta`
   - `POST /agent/v1/logs/pull`
   - `POST /agent/v1/logs/ack`
3. 失败场景统一返回 `401` 且不暴露内部信息：
   - 缺失 key：`AUTH_MISSING_TOKEN`
   - key 非法：`AUTH_INVALID_TOKEN`
   - message 固定 `unauthorized`
4. 主程序新增鉴权环境变量配置：
   - `AGENT_API_KEY_ACTIVE_ID`（默认 `active`）
   - `AGENT_API_KEY_ACTIVE`（默认 `dev-agent-key`）
   - `AGENT_API_KEY_NEXT_ID`（默认 `next`）
   - `AGENT_API_KEY_NEXT`（默认空）

## 自动化测试结果

- 命令（全量）：
  - `cd /opt/projects/NexusLog/agents/collector-agent && go test ./...`
- 结果：`PASS`
- 命令（7.3 聚焦）：
  - `cd /opt/projects/NexusLog/agents/collector-agent && go test ./internal/pullapi -run "Auth|MetaRouteSuccess|PullAndAckFlow|PullInvalidArgument" -v`
- 关键用例：
  - `TestAuthMissingHeader`
  - `TestAuthInvalidKey`
  - `TestPullAndAckFlow`
- 测试日志：
  - `docs/NexusLog/10-process/evidence/task-7.3-agent-pull-auth-20260302.log`

## 备注

- 当前鉴权支持双 key（active/next）轮换场景，后续可扩展为从数据库或控制面动态下发。
