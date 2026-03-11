# NexusLog 链路完整性判定与后续核验计划

> 评估日期：2026-03-08  
> 评估范围：`README.md`、`docs/01-architecture/core/*.md`、`docs/NexusLog/10-process/*.md`、`docker-compose*.yml`、`agents/*`、`services/*`、`apps/frontend-console/*`  
> 评估目标：判定当前仓库中 `采集 → 传输 → 存储 → 分析 → 告警 → 可视化` 链路在“目标平台蓝图”与“当前真实实现”两个口径下是否完整，并明确后续核验顺序。

## 1. 摘要

基于当前仓库中的需求基线、流程文档、架构文档、README 技术栈表以及服务入口代码，`采集 → 传输 → 存储 → 分析 → 告警 → 可视化` 链路的判定如下：

- **目标平台蓝图**：链路定义完整
- **当前真实实现**：链路不完整
- **当前最关键断点**：
  1. Agent rewrite 采集未接入真实采集输出
  2. Control-plane rewrite 缺少真正的拉取与写 ES 执行器
  3. Query API 当前返回 `410 Gone`，导致前端日志与分析页面主链断开

### 1.1 一句话结论

- 若按 `README.md` 与 `docs/01-architecture/core/*` 的**目标技术栈 / 目标蓝图**判断，这条链路是完整定义过的。
- 若按 `docs/NexusLog/10-process/34-current-real-implementation-flowcharts.md` 与当前入口代码的**当前真实实现**判断，这条链路当前**不是完整闭环**。

---

## 2. 分析依据

### 2.1 文档依据

- `README.md`
- `docs/01-architecture/core/01-system-context.md`
- `docs/01-architecture/core/02-logical-architecture.md`
- `docs/01-architecture/core/03-deployment-architecture.md`
- `docs/01-architecture/core/04-dataflow.md`
- `docs/01-architecture/core/05-security-architecture.md`
- `docs/NexusLog/10-process/07-document-code-gap-matrix.md`
- `docs/NexusLog/10-process/08-current-project-requirements.md`
- `docs/NexusLog/10-process/20-log-ingest-e2e-workflow-v2.md`
- `docs/NexusLog/10-process/32-log-sequence-diagram-mermaid.md`
- `docs/NexusLog/10-process/34-current-real-implementation-flowcharts.md`
- `docs/NexusLog/10-process/35-target-platform-blueprint-flowcharts.md`
- `docs/NexusLog/10-process/36-runtime-business-flowcharts.md`
- `docs/02-operations/runbooks/log-chain-m1-local-e2e.md`

### 2.2 代码依据

- `agents/collector-agent/cmd/agent/main.go`
- `agents/collector-agent/cmd/agent/rewrite_http.go`
- `agents/collector-agent/internal/pullv2/http.go`
- `services/control-plane/cmd/api/main.go`
- `services/control-plane/cmd/api/ingestv3_routes.go`
- `services/data-services/query-api/cmd/api/main.go`
- `apps/frontend-console/src/api/query.ts`
- `apps/frontend-console/src/pages/search/RealtimeSearch.tsx`
- `docker-compose.yml`
- `docker-compose.override.yml`

### 2.3 判定优先级

1. **当前真实实现** 以 `docs/NexusLog/10-process/34-current-real-implementation-flowcharts.md` 和当前服务入口代码为最高优先级口径。
2. **目标技术栈与目标架构** 以 `README.md` 与 `docs/01-architecture/core/*` 为口径。
3. 若文档与代码冲突，**现实可运行性判断以代码为准**。

---

## 3. 技术栈口径结论

### 3.1 目标技术栈要求

按 `README.md` 与目标架构文档，平台目标能力覆盖：

- 采集：Go Agent + 插件
- 传输：Kafka + Schema Registry
- 实时处理：Flink
- 存储：Elasticsearch + PostgreSQL + Redis + MinIO/S3
- 告警：Alertmanager
- 可视化：Frontend Console + Grafana

### 3.2 当前真实实现口径

按当前实现文档，当前主路径应以：

- `Collector Agent → Control-plane → Elasticsearch → Query API → Frontend`

为准。

以下组件**不应被视为当前已落地主路径**：

- Kafka
- Flink
- Keycloak
- OPA
- Schema Registry
- Jaeger

它们仍可出现在目标态文档中，但必须标注为：

- `目标态`
- `规划态`
- `历史口径`

### 3.3 当前技术栈口径差异结论

| 维度 | 目标态 | 当前态 | 结论 |
|---|---|---|---|
| 采集 | Go Agent + 插件 | Agent 旧采集在，rewrite 主路径未接入真实输出 | 部分完成 |
| 传输 | Kafka + Schema Registry + Flink | 当前主路径已收口到 Pull API / Control-plane rewrite 协议 | 不完整 |
| 存储 | ES + PG + Redis + MinIO | 基础设施在，rewrite 执行主链未写实 | 基础设施存在，但链路不完整 |
| 分析 | Query / Aggregate / Clustering / NLP | 基础查询与聚合代码有残留，当前主入口未恢复 | 不完整 |
| 告警 | Alertmanager + Rule Engine + Incident | Rule/Event/Silence/Incident API 部分存在，评估器未闭环 | 部分完成 |
| 可视化 | Frontend Console + Grafana | 前端页面存在，真实查询主接口当前为 `410` | 部分完成但主链断开 |

---

## 4. 当前完整链路应当是什么

按当前实现文档，真实主路径应为：

1. 应用 / 容器 / 系统文件生成原始日志
2. Collector Agent 增量读取日志
3. Agent 执行预处理：空行过滤、前缀拆分、多行合并、第一层去重
4. Agent Pull API 暴露 `batch_id / cursor / records`
5. Control-plane 调度拉取任务并主动拉取日志
6. 归一化层生成 `event.id / fingerprint / error.*`
7. Elasticsearch Data Stream `nexuslog-logs-v2` 落库
8. Query API 按 v2 字段检索和兼容映射
9. Frontend Console 展示实时检索、详情抽屉、趋势图
10. Alert Evaluator 周期扫描 ES 并生成告警事件
11. ILM / Snapshot / Archive 负责热温冷迁移与归档

### 4.1 当前真实实现图口径

可直接参考：

- `docs/NexusLog/10-process/34-current-real-implementation-flowcharts.md`
- `docs/NexusLog/10-process/32-log-sequence-diagram-mermaid.md`
- `docs/NexusLog/10-process/20-log-ingest-e2e-workflow-v2.md`

---

## 5. 分阶段完整性判定

## 5.1 采集

**判定：部分完成**

### 已具备

- 文档定义了文件增量读取、预处理、多行合并、第一层去重、Pull API 暴露
- 旧 Agent 采集能力仍存在于 legacy 代码路径
- 本地开发编排已挂载 `/var/log`、远端模拟 Agent 也提供宿主与容器日志挂载

### 缺失

- rewrite 模式下未把真实采集输出接入 `pullv2.Service`
- 当前默认启动路径已切到 rewrite，导致 legacy 采集主链默认不再生效

### 代码事实

- `agents/collector-agent/cmd/agent/main.go` 在 `LEGACY_LOG_PIPELINE_ENABLED=false` 时切换到 rewrite HTTP 服务
- `agents/collector-agent/cmd/agent/rewrite_http.go` 仅启动 `pullv2.New(...)` 与路由，没有真实采集数据写入逻辑

### 结论

当前采集能力不能按“rewrite 默认主路径”视为已闭环，只能判定为**部分完成**。

---

## 5.2 传输

**判定：不完整**

### 已具备

#### Agent rewrite

- `GET /agent/v2/meta`
- `POST /agent/v2/logs/pull`
- `POST /agent/v2/logs/ack`

#### Control-plane rewrite

- `POST /api/v2/ingest/plans/resolve`
- `POST /api/v2/ingest/cursors/commit`

### 缺失

- 没有新的 runtime executor 去执行 `plan -> pull -> normalize -> index -> ack`
- 旧 v1 ingest runtime 已被剥离
- Kafka / Flink 仅存在目标态文档口径，不构成当前链路

### 结论

当前 rewrite 只完成了协议与游标接口骨架，尚未形成真正的传输执行闭环，因此判定为**不完整**。

---

## 5.3 存储

**判定：基础设施存在，但链路不完整**

### 已具备

- ES / PG / Redis / MinIO 在目标态或本地开发环境中存在
- 文档定义了 ES data stream + PG 元数据存储模型
- Control-plane 仍保留游标存储适配层

### 缺失

- 当前 rewrite 链路没有实际把日志稳定写入 ES 的执行路径
- PG 中任务、包、回执、死信等主链运行逻辑已不再由默认 runtime 驱动

### 结论

“存储系统存在”不等于“存储链路完整”。当前只能判定为**基础设施在、主链路不完整**。

---

## 5.4 分析

**判定：不完整**

### 已具备

- 前端存在日志聚合分析页
- Query API 源码目录中仍有部分查询与统计实现代码
- 文档对分析、聚类、趋势等能力有清晰目标定义

### 缺失

- `query-api` 当前主入口统一返回 `410 Gone`
- 聚类、异常模式、折叠展示仍主要属于规划态
- 即使部分 service/repository 代码仍在，也未通过当前主入口形成对外闭环

### 结论

分析能力不能按“存在页面和内部实现代码”就认定为完成，当前判定为**不完整**。

---

## 5.5 告警

**判定：部分完成**

### 已具备

- Alert rule / event / silence / incident API 仍有控制面路由
- 文档已定义从 ES 到告警事件的评估路径
- 前端告警相关页面与客户端已存在

### 缺失

- 自动日志告警评估器已从 runtime 剥离
- Alertmanager / Grafana 更多是平台目标栈，不代表当前应用链已闭环
- 当前未确认由日志主链直接触发 `alert_event` 的默认运行能力

### 结论

告警域可判定为**部分完成**，但“日志落库后自动规则评估”的关键闭环尚未恢复。

---

## 5.6 可视化

**判定：部分完成但主链断开**

### 已具备

- 前端 `/search/realtime` 页面存在
- 前端查询客户端存在，并按真实接口写法请求 `/api/v1/query/logs`
- 详情抽屉和趋势图逻辑存在

### 缺失

- 后端 `query-api` 当前 `410`
- 因此前端日志主数据显示链断开
- Dashboard / AggregateAnalysis / AlertList 仍可能混有 fallback / 占位数据源

### 结论

可视化层的 **UI 形态存在**，但**真实数据主链当前未完整恢复**。

---

## 6. 重要公共接口现状

## 6.1 当前存在但未闭环的新接口

### Agent rewrite

- `GET /agent/v2/meta`
- `POST /agent/v2/logs/pull`
- `POST /agent/v2/logs/ack`

### Control-plane rewrite

- `POST /api/v2/ingest/plans/resolve`
- `POST /api/v2/ingest/cursors/commit`

## 6.2 当前被显式停用的旧接口

### Query API

- `POST /api/v1/query/logs`
- `GET /api/v1/query/history`
- `DELETE /api/v1/query/history/:id`
- `GET/POST/PUT/DELETE /api/v1/query/saved`

### Control-plane v1 ingest

- `/api/v1/ingest/*` 当前返回 `410 Gone`

## 6.3 接口层结论

当前公共接口层同时呈现出：

- rewrite 新接口已出现，但未形成端到端执行闭环
- v1 主接口已被显式停用
- 前端仍按“真实接口模式”调用，但后端查询主入口尚未恢复

因此接口层处于**迁移中间态**。

---

## 7. 完整性判定标准

### 7.1 判定为“完整”必须同时满足

1. Agent 在当前默认模式下能持续采集真实日志
2. Control-plane 能按固定周期拉取并写入 ES
3. Query API 能对外提供日志查询和统计接口
4. Frontend 能基于真实接口显示日志列表、详情、趋势
5. Alert Evaluator 能从 ES 周期扫描并产生告警事件
6. 整条链路具备 ACK/NACK、游标推进、失败重试或死信追踪

### 7.2 当前不满足项

- 第 1、2、3、5 项均未完全满足
- 第 4 项前端 UI 存在，但依赖的后端主接口未恢复
- 因此整体不能判定为“链路完整”

---

## 8. 建议的下一轮核验顺序

1. 核验 Agent rewrite 是否接入真实采集数据源
2. 核验 Control-plane 是否具备真实的 pull-to-ES executor
3. 核验 Query API 是否恢复 `POST /api/v1/query/logs`
4. 核验前端 `/search/realtime` 是否可从真实查询接口显示数据
5. 核验 Alert Evaluator 是否重新接入 ES 周期扫描
6. 核验 `Dashboard` / `AggregateAnalysis` / `AlertList` 是否均脱离占位或本地 fallback

### 8.1 推荐执行顺序

为避免前端层面反复误判，建议按以下顺序推进：

- 先打通 `Agent → Control-plane → ES`
- 再恢复 `Query API`
- 最后做浏览器验证与前端结论确认

Docker 恢复后的命令化验收清单见：

- `docs/02-operations/runbooks/log-chain-m1-local-e2e.md`

---

## 9. 测试场景与验收

## 9.1 场景 A：采集与传输

- 向 `/var/log` 或测试日志文件追加新日志
- Agent 能读取并形成可拉取记录
- Control-plane 能取得 batch 并提交 cursor

## 9.2 场景 B：存储

- 新日志写入 ES data stream
- 文档 `_id` 稳定，重复拉取不会异常膨胀

## 9.3 场景 C：分析

- `/api/v1/query/logs` 返回 `200`
- `/api/v1/query/stats/aggregate` 返回聚合桶
- 前端分析页可见真实聚合结果

## 9.4 场景 D：告警

- 创建规则
- 规则命中后生成 `alert_event`
- 可选升级为 `incident`

## 9.5 场景 E：可视化

- `/search/realtime` 显示真实日志
- 详情抽屉展示 `event_id / batch_id / source`
- 趋势图能显示真实时间分布

---

## 10. 当前结论的边界说明

### 10.1 本结论不等同于“系统完全不可用”

本结论只表示：

- **从采集到前端显示的全链路尚未完整闭环**

它并不表示：

- 所有服务都不可启动
- 所有数据都不可查询
- 所有告警与分析功能都完全不存在

### 10.2 本结论属于“现实可运行性判定”

- 目标架构与目标技术栈仍然保留
- 文档中的目标态能力不应被误判为当前实现态
- 当前是否“完整”，以服务默认启动路径和对外接口可用性为准

---

## 11. 显式假设与默认值

- 以 `docs/NexusLog/10-process/34-current-real-implementation-flowcharts.md` 作为“当前真实实现”最高优先级文档口径
- 以 `README.md` 与 `docs/01-architecture/core/*` 作为“目标技术栈与目标架构”口径
- 以当前服务入口代码作为最终现实判定依据
- 若文档与代码冲突，现实可运行性判断以代码为准
- 本结论不等同于“系统完全不可用”，而是指“从采集到前端显示的全链路尚未完整闭环”

---

## 12. 参考资料

- `README.md`
- `docs/01-architecture/core/01-system-context.md`
- `docs/01-architecture/core/02-logical-architecture.md`
- `docs/01-architecture/core/03-deployment-architecture.md`
- `docs/01-architecture/core/04-dataflow.md`
- `docs/01-architecture/core/05-security-architecture.md`
- `docs/NexusLog/10-process/07-document-code-gap-matrix.md`
- `docs/NexusLog/10-process/08-current-project-requirements.md`
- `docs/NexusLog/10-process/20-log-ingest-e2e-workflow-v2.md`
- `docs/NexusLog/10-process/32-log-sequence-diagram-mermaid.md`
- `docs/NexusLog/10-process/34-current-real-implementation-flowcharts.md`
- `docs/NexusLog/10-process/35-target-platform-blueprint-flowcharts.md`
- `docs/NexusLog/10-process/36-runtime-business-flowcharts.md`

## 13. 变更记录

| 日期 | 版本 | 变更内容 |
|---|---|---|
| 2026-03-08 | v1.0 | 初始版本。新增链路完整性判定、当前断点分析、阶段性完整性结论与后续核验顺序。 |
| 2026-03-08 | v1.1 | 补充 Docker 恢复后的命令化 E2E 验收清单入口。 |
