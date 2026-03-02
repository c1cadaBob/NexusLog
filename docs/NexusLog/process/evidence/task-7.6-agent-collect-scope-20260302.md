# Task 7.6 Agent 采集范围 include/exclude 可配置实现记录

- 日期：2026-03-02
- 任务：`7.6 提供可配置日志采集范围能力（包含路径 include/exclude），并在 systemd 与 Docker 两种运行方式下可独立配置`
- 服务：`agents/collector-agent`

## 本次交付范围

1. 采集器能力增强：
   - `SourceConfig` 新增 `ExcludePaths`；
   - 文件扫描阶段支持排除规则匹配（完整路径与文件名模式）。
2. Agent 启动配置增强：
   - 新增 `COLLECTOR_INCLUDE_PATHS`（逗号分隔）；
   - 新增 `COLLECTOR_EXCLUDE_PATHS`（逗号分隔）；
   - 运行时由 `cmd/agent/main.go` 解析并注入采集源。
3. 安装配置同步（双模式）：
   - systemd 环境文件：`deploy/systemd/collector-agent.env.example`
   - Docker 环境变量：`deploy/docker/docker-compose.agent.yml`
   - 安装文档补充：`docs/install-dual-mode.md`

## 自动化测试结果

- 命令（全量）：
  - `cd /opt/projects/NexusLog/agents/collector-agent && go test ./...`
- 结果：`PASS`
- 命令（7.6 聚焦）：
  - `cd /opt/projects/NexusLog/agents/collector-agent && go test ./internal/collector -run "CollectFilesWithExcludePatterns|CollectFilesIncrementalFromCheckpoint|CollectFilesResumeAfterRestart" -v`
- 关键用例：
  - `TestCollectFilesWithExcludePatterns`
  - `TestCollectFilesIncrementalFromCheckpoint`
  - `TestCollectFilesResumeAfterRestart`
- 测试日志：
  - `docs/NexusLog/process/evidence/task-7.6-agent-collect-scope-20260302.log`

## 双模式配置验证

1. systemd 配置示例：
   - `COLLECTOR_INCLUDE_PATHS=/var/log/*.log,/data/app/*.log`
   - `COLLECTOR_EXCLUDE_PATHS=/var/log/wtmp,/data/app/debug-*.log`
2. Docker 配置渲染验证：
   - 命令：`docker compose -f deploy/docker/docker-compose.agent.yml config`
   - 日志：`docs/NexusLog/process/evidence/task-7.6-agent-collect-scope-compose-20260302.log`
   - 已确认 compose 输出包含 `COLLECTOR_INCLUDE_PATHS/COLLECTOR_EXCLUDE_PATHS`。

## 备注

- 当前实现满足“systemd 与 Docker 两种运行方式可独立配置采集范围”的交付目标。
