# Task 7.1 agent checkpoint 增量扫描实现记录

- 日期：2026-03-02
- 任务：`7.1 完成文件增量读取（checkpoint 增量扫描）`
- 服务：`agents/collector-agent`

## 本次交付范围

1. 在 `collector` 实现文件增量扫描：
   - 支持 `glob` 与单文件路径解析；
   - 首次扫描从 checkpoint 偏移恢复；
   - 文件截断/轮转时自动回退到 `offset=0`；
   - 每条记录携带绝对偏移 `metadata.offset`。
2. 在 `pipeline` 修正 checkpoint 回写逻辑：
   - 优先使用记录中的绝对偏移 `metadata.offset`；
   - 同一批次按 `source` 取最大偏移回写；
   - 缺失偏移时兼容回退到 `len(data)`。
3. 增加 4 个单元测试，覆盖增量读取、重启续传与偏移回写。

## 自动化测试结果

- 命令（全量）：
  - `cd /opt/projects/NexusLog/agents/collector-agent && go test ./...`
- 结果：`PASS`
- 命令（7.1 聚焦）：
  - `cd /opt/projects/NexusLog/agents/collector-agent && go test ./internal/collector ./internal/pipeline -run "CollectFilesIncrementalFromCheckpoint|CollectFilesResumeAfterRestart|ProcessBatchSavesLatestOffsetPerSource|ResolveCheckpointOffset" -v`
- 关键用例：
  - `TestCollectFilesIncrementalFromCheckpoint`
  - `TestCollectFilesResumeAfterRestart`
  - `TestResolveCheckpointOffset`
  - `TestProcessBatchSavesLatestOffsetPerSource`
- 测试日志：
  - `docs/NexusLog/process/evidence/task-7.1-agent-incremental-read-20260302.log`

## 备注

- 当前 7.1 已满足“重启后按 checkpoint 续传、避免重复全量读取”的最小闭环。
- `GET /agent/v1/meta`、`POST /agent/v1/logs/pull`、`POST /agent/v1/logs/ack` 将在 7.2 继续实现。
