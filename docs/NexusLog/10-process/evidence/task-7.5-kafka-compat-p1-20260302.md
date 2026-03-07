# Task 7.5 Kafka 主推链路降级为 P1 兼容项记录

- 日期：2026-03-02
- 任务：`7.5 将 Kafka 主推链路标记为 P1 兼容项，不作为 M2 P0 门禁`
- 服务：`agents/collector-agent`

## 本次交付范围

1. 调整 `cmd/agent/main.go` 启动策略：
   - Pull API 作为主路径优先启动；
   - Kafka 链路变为可选兼容路径（`ENABLE_KAFKA_PIPELINE`）；
   - Kafka Producer/Pipeline 初始化失败时自动降级为 `pull-only`，不阻断进程启动。
2. 增加运行模式日志标记：
   - `采集分发已启动：pull + kafka-compat`
   - `采集分发已启动：pull-only`
3. 安装配置示例同步：
   - `deploy/systemd/collector-agent.env.example` 增加 `ENABLE_KAFKA_PIPELINE=false`
   - `deploy/docker/docker-compose.agent.yml` 增加 `ENABLE_KAFKA_PIPELINE=false`

## 自动化测试结果

- 命令（全量）：
  - `cd /opt/projects/NexusLog/agents/collector-agent && go test ./...`
- 结果：`PASS`

## 运行验证（降级冒烟）

- 验证方法：
  - 通过不可写 `CACHE_DIR` 人为触发 pipeline 初始化失败；
  - 观察进程是否降级为 `pull-only` 并保持 API 可用。
- 结果：
  - `/healthz` 正常；
  - `/agent/v1/meta` 正常；
  - 运行日志出现 `处理管道初始化失败，降级为 pull-only 模式`。
- 日志：
  - `docs/NexusLog/10-process/evidence/task-7.5-kafka-p1-fallback-20260302.log`

## 备注

- 当前实现满足“Kafka 不可用不阻断 M2 主路径”的目标。
- Kafka 仍保留为兼容输出链路，后续可在稳定环境中按需启用。
