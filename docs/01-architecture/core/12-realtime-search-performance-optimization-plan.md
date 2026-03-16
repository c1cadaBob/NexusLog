# 12. 实时检索性能优化实施方案（V1）

## 1. 文档目标

本文档针对以下问题给出一套**可落地、可分阶段实施**的优化方案：

- 实时检索页日志加载缓慢
- 手动刷新或自动刷新时等待时间过长
- 页面刷新期间请求堆积，出现 `pending` / `500`
- 图表、列表、总数等多个区域互相等待，导致整页反馈迟缓

本文档的目标不是一次性给出最终代码，而是形成一份能够直接进入开发排期的实施方案，覆盖：

- 当前瓶颈定位
- 优化优先级（P0 / P1 / P2）
- 前后端改造建议
- 文件级落点
- 验证方法与验收标准

---

## 2. 当前观测事实

## 2.1 页面证据

- 目标 URL：`http://127.0.0.1:3000/#/search/realtime`
- Console：出现多条 `500 Internal Server Error`
- Network：
  - `POST /api/v1/query/logs [500]`
  - `POST /api/v1/query/stats/aggregate [500]`
  - 同一时段存在多条 `pending` 的 `/logs` 与 `/stats/aggregate` 请求
- 可复现步骤：
  1. 打开实时检索页
  2. 保持“实时”开启，不输入关键词或只做轻筛选
  3. 等待 10~20 秒，或频繁切换筛选 / 点击执行
  4. 打开浏览器 Network，可看到新一轮请求在上一轮未完成时继续进入，形成堆积

## 2.2 当前链路现状

### 前端实时页行为

当前实时页每次执行查询时，会同时发起：

1. 表格日志请求：`/api/v1/query/logs`
2. 直方图总量请求：`/api/v1/query/stats/aggregate`
3. 直方图错误量请求：`/api/v1/query/stats/aggregate`

也就是说，**每次刷新至少 3 个请求**。

相关代码：

- `apps/frontend-console/src/pages/search/RealtimeSearch.tsx:167`
- `apps/frontend-console/src/pages/search/RealtimeSearch.tsx:202`
- `apps/frontend-console/src/pages/search/RealtimeSearch.tsx:214`

### 自动刷新模型

当前实时模式使用固定 `setInterval(5000)` 周期轮询，不会等待上一轮请求完成。

这意味着：

- 如果单次查询耗时 `< 5s`，体验尚可
- 如果单次查询耗时 `> 5s`，下一轮请求会继续压上来
- 最终形成请求叠加、后端抖动、接口 `500`

相关代码：

- `apps/frontend-console/src/pages/search/RealtimeSearch.tsx:296`

### 日志表格时间范围

实时页表格查询当前只传 `to`，默认不传 `from`：

```ts
function buildRealtimeTableTimeRange(snapshotTo?: string) {
  return {
    from: '',
    to: snapshotTo?.trim() || new Date().toISOString(),
  };
}
```

这等价于：

- 默认查询“租户下截至当前时间的全部历史日志”
- 再按 `@timestamp desc` 取前 N 条

这会让“空查询”成为最重的场景之一。

相关代码：

- `apps/frontend-console/src/pages/search/RealtimeSearch.tsx:25`
- `services/data-services/query-api/internal/repository/repository.go:517`
- `services/data-services/query-api/internal/repository/repository.go:526`

### 后端查询特征

当前日志查询后端行为：

- 默认 `track_total_hits: true`
- 默认返回 `raw_log + 全量 fields`
- 无 `pit_id` 时会尝试打开 PIT
- 分页第一页也走完整的总数与完整字段返回逻辑

相关代码：

- `services/data-services/query-api/internal/repository/repository.go:150`
- `services/data-services/query-api/internal/repository/repository.go:151`
- `services/data-services/query-api/internal/repository/repository.go:141`
- `services/data-services/query-api/internal/service/service.go:677`
- `services/data-services/query-api/internal/service/service.go:724`

### 实际耗时样本

从 `query-api` 容器日志可观察到：

- `/api/v1/query/logs` 常见耗时约 `0.6s ~ 4.2s`
- `/api/v1/query/stats/aggregate` 常见耗时约 `0.8s ~ 2.8s`
- 当这些请求重叠时，容易进一步抖动并触发失败

---

## 3. 根因总结

可将当前问题拆成四类根因：

### 3.1 查询范围过大

默认实时表格查询没有下界时间窗，空查询或弱筛选查询会扫描过多历史数据。

### 3.2 请求模型过重

单次页面刷新会发起 3 个请求；而且轮询是固定周期并发触发，不会等待上一轮结束。

### 3.3 返回载荷过大

列表接口返回了大量详情字段，但列表渲染并不需要这些字段。

### 3.4 图表与列表强耦合

当前实现使用 `Promise.all`，任意一个请求变慢都会拖慢整页更新。

---

## 4. 目标状态

## 4.1 用户体验目标

### P0 目标（快速优化后）

- 实时页首次进入时，旧数据/骨架在 `100~200ms` 内可见
- 默认空查询场景，单轮刷新体感等待明显下降
- 自动刷新不再出现请求堆积
- 单次刷新失败时，页面不整块清空

### P1 目标（结构优化后）

- 实时页一次刷新主链路请求数从 `3` 降到 `1~2`
- 直方图和表格可分开更新，不再互相阻塞
- 列表打开速度与详情展开速度分离

### P2 目标（后端/索引优化后）

- 高频空查询和常见 service/level 检索稳定在低抖动区间
- 聚合类查询具备热点缓存和失败回退
- 实时页对 ES 抖动的敏感性显著下降

## 4.2 技术目标

- 默认实时查询必须带明确时间窗
- 自动刷新必须串行化
- 前端必须支持取消旧请求
- 列表接口只返回列表必需字段
- 聚合接口尽量一次返回完整图表数据
- 后端对热点查询具备短 TTL 缓存和陈旧结果回退能力

---

## 5. 推荐实施路径

## 5.1 最推荐路径

建议采用以下路径，而不是直接上 WebSocket / SSE：

1. **先修查询模型**
2. **再缩请求数量**
3. **再减返回载荷**
4. **最后做后端缓存与 ES 优化**

原因：

- 当前瓶颈首先来自“查询过重 + 请求叠加”
- 如果直接引入 WebSocket / SSE，但底层查询模型不变，只会把相同的重查询持续推到服务端
- 先解决默认时间窗、轮询并发、请求合并，收益更直接、风险更小

---

## 6. P0：快速收益优化（建议优先实施）

## 6.1 P0-1：给实时表格加默认时间窗

### 方案

将实时表格默认时间范围从：

- `from = ''`
- `to = now`

调整为：

- `from = now - 15m`（推荐）
- `to = now`

并在 UI 中增加快捷切换：

- `5m`
- `15m`
- `30m`
- `1h`
- `自定义`

### 收益

- 直接减少 ES 扫描范围
- 空查询性能收益最大
- 不影响“实时”语义

### 文件级落点

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `apps/frontend-console/src/pages/search/RealtimeSearch.tsx` | 实时页表格查询参数构建 | 修改 `buildRealtimeTableTimeRange()`，默认补 `from`；增加时间窗状态与切换 UI |
| `apps/frontend-console/src/api/query.ts` | 发送 `/logs` 请求 | 保留现有 `time_range` 结构，无需大改 |
| `services/data-services/query-api/internal/repository/repository.go` | ES 查询组装 | 无需改接口协议，只要前端传 `from` 即可命中 `range.gte` |

### 相关代码定位

- `apps/frontend-console/src/pages/search/RealtimeSearch.tsx:25`
- `apps/frontend-console/src/api/query.ts:1309`
- `services/data-services/query-api/internal/repository/repository.go:517`

## 6.2 P0-2：将轮询从并发改为串行

### 方案

将当前固定 `setInterval(5000)` 模型改为：

- 上一轮请求完成后，再调度下一轮
- 若当前仍有 in-flight 请求，则跳过新一轮轮询
- 若上一轮耗时较长，则自动退避，如：`5s -> 10s -> 15s`

### 收益

- 避免请求叠加
- 降低接口 `500`
- 降低 ES 与 query-api 的并发抖动

### 文件级落点

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `apps/frontend-console/src/pages/search/RealtimeSearch.tsx` | 控制自动刷新 | 将 `setInterval` 改为串行轮询；增加 in-flight guard、动态退避 |
| `apps/frontend-console/src/api/query.ts` | 查询封装 | 可增加取消支持，配合中断旧请求 |

### 相关代码定位

- `apps/frontend-console/src/pages/search/RealtimeSearch.tsx:296`

## 6.3 P0-3：支持取消旧请求

### 方案

在前端查询层引入 `AbortController`：

- 触发新搜索时取消旧请求
- 切换筛选时取消旧请求
- 页面卸载时取消旧请求
- 自动刷新时若用户手动触发查询，优先以手动查询为准

### 收益

- 避免过期请求回写页面
- 降低前端等待感
- 进一步减少后端无效工作

### 文件级落点

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `apps/frontend-console/src/api/query.ts` | `/logs` 与 `/stats/aggregate` 请求封装 | 增加可选 `signal` 参数 |
| `apps/frontend-console/src/pages/search/RealtimeSearch.tsx` | 驱动查询 | 对表格请求和聚合请求引入统一生命周期控制 |

## 6.4 P0-4：刷新时保留旧数据，采用 SWR 体验

### 方案

当前刷新时，不应让用户看到“整块等待”。建议改成：

- 保留上一轮日志表格数据
- 保留上一轮直方图数据
- 在局部显示“更新中”状态
- 若刷新失败，保留旧数据并提示“当前展示的是最近一次成功结果”

### 收益

- 体感等待显著下降
- 即使请求失败也不会出现整页空白

### 文件级落点

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `apps/frontend-console/src/pages/search/RealtimeSearch.tsx` | 页内状态管理 | 区分首次加载与刷新加载；拆分 `tableLoading` / `histogramLoading` / `isRefreshing` |

## 6.5 P0-5：聚合失败时不阻塞表格渲染

### 方案

当前 `Promise.all` 会让图表和表格一起等待。建议改成：

- 表格请求独立更新
- 直方图请求独立更新
- 其中一个失败时，不阻塞另一个区域渲染

### 收益

- 用户先看到结果，再等图表
- 页面不会被最慢的请求拖住

### 文件级落点

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `apps/frontend-console/src/pages/search/RealtimeSearch.tsx` | 聚合与列表并行更新 | 从单个 `Promise.all` 改为独立提交、独立落 UI |

---

## 7. P1：结构优化（建议在 P0 后尽快推进）

## 7.1 P1-1：合并直方图请求

### 方案

当前为了构建“正常/错误”堆叠图，前端发了两次 `/stats/aggregate`：

- 一次取总量
- 一次取 `level=error`

建议新增一个聚合接口，一次返回：

- `total_buckets`
- `error_buckets`
- 可选 `warn_buckets`

### 推荐 API 草案

- `POST /api/v1/query/stats/realtime-histogram`

请求示例：

```json
{
  "time_range": "30m",
  "keywords": "",
  "filters": {
    "exclude_internal_noise": true
  },
  "series": ["total", "error"]
}
```

返回示例：

```json
{
  "buckets": [
    { "time": "2026-03-16T04:39:00Z", "total": 55, "error": 3 }
  ]
}
```

### 收益

- 每轮刷新请求数从 3 个降到 2 个
- 直方图总量与错误量天然一致，不再依赖前端拼装

### 文件级落点

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `services/data-services/query-api/internal/handler/stats_handler.go` | 聚合 handler | 新增 realtime histogram handler |
| `services/data-services/query-api/internal/service/stats_service.go` | 聚合业务逻辑 | 新增一次返回多序列的聚合能力 |
| `apps/frontend-console/src/api/query.ts` | 聚合 API 封装 | 新增 `fetchRealtimeHistogramStats()` |
| `apps/frontend-console/src/pages/search/RealtimeSearch.tsx` | 图表数据组装 | 使用新接口替代双 `/stats/aggregate` |

## 7.2 P1-2：列表接口与详情接口拆分

### 方案

当前 `/logs` 返回：

- `message`
- `raw_log`
- `fields`
- 各类展示辅助字段

但表格只需要：

- 时间
- 级别
- 服务
- 主机
- 主机 IP
- 消息摘要

建议改成：

- 列表接口返回轻量字段
- 打开抽屉时再调用详情接口获取 `raw_log/full fields`

### 推荐 API 草案

- `POST /api/v1/query/logs`：默认返回轻量字段
- `GET /api/v1/query/logs/:id`：返回完整详情

或者：

- 在 `/logs` 支持 `include_fields=false`、`include_raw=false`

### 收益

- 降低网络体积
- 降低前端 JSON 解析耗时
- 降低 React 渲染负担

### 文件级落点

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `services/data-services/query-api/internal/service/service.go` | 原始日志映射 | 增加“列表模式 / 详情模式”返回控制 |
| `services/data-services/query-api/internal/handler/handler.go` | `/logs` handler | 支持轻量模式参数 |
| `apps/frontend-console/src/api/query.ts` | 查询封装 | 增加 `includeFields/includeRaw` 参数 |
| `apps/frontend-console/src/pages/search/RealtimeSearch.tsx` | 表格与抽屉 | 首屏使用轻量数据；抽屉按需拉详情 |

### 当前代码定位

- `services/data-services/query-api/internal/service/service.go:677`
- `services/data-services/query-api/internal/service/service.go:724`

## 7.3 P1-3：第一页查询不要每次都做精确总数

### 方案

实时页第一页主要目的是“看最新数据”，而不是“立刻拿到全量精确 total”。

建议：

- 实时模式第一页把 `track_total_hits` 从 `true` 改为阈值模式，如 `1000` 或 `10000`
- 前端 UI 显示：
  - `共 1000+ 条`
  - 或 `结果很多，已展示最新 N 条`

### 收益

- 降低 ES 计数成本
- 改善空查询与弱过滤场景响应速度

### 文件级落点

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `services/data-services/query-api/internal/repository/repository.go` | ES 查询构造 | 按模式设置 `track_total_hits` |
| `services/data-services/query-api/internal/service/service.go` | SearchLogs 结果模型 | 增加“是否为估算总数”标记 |
| `apps/frontend-console/src/api/query.ts` | 前端解析 | 兼容估算 total |
| `apps/frontend-console/src/pages/search/RealtimeSearch.tsx` | 总数展示 | 支持 `1000+` / `approximate` 展示 |

## 7.4 P1-4：第一页实时查询不要每次重新开 PIT

### 方案

当前第一页查询以“最新数据”为主，不一定需要每轮重新走 PIT 逻辑。建议：

- 第 1 页实时刷新使用普通 latest query
- 翻页时再进入 `pit + search_after` 深分页模式
- 若用户停留在第一页，优先降低查询成本而非维持深分页一致性

### 收益

- 减少 PIT 管理开销
- 降低第一页刷新成本
- 更符合实时页语义

### 文件级落点

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `services/data-services/query-api/internal/repository/repository.go` | PIT 打开与复用 | 区分“实时第一页模式”和“深分页模式” |
| `apps/frontend-console/src/pages/search/RealtimeSearch.tsx` | 分页与 cursor 管理 | 首页实时轮询不强制重置为新的 PIT 上下文 |

---

## 8. P2：后端与索引层优化

## 8.1 P2-1：为热点查询增加短 TTL 缓存

### 方案

为高频实时查询增加服务端缓存：

缓存键建议包含：

- tenant_id
- keywords
- filters
- time_range
- page
- page_size
- query mode（table / histogram）

缓存策略建议：

- TTL：`3s ~ 10s`
- stale fallback：`30s ~ 60s`

### 收益

- 高频刷新用户明显收益
- 空查询、弱过滤、常见 service 查询收益最大

### 文件级落点

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `services/data-services/query-api/internal/service/service.go` | SearchLogs 主流程 | 增加查询缓存入口 |
| `services/data-services/query-api/internal/service/stats_service.go` | 聚合类请求 | 为 histogram 聚合增加缓存与 stale fallback |

## 8.2 P2-2：热数据与冷数据查询分层

### 方案

对实时页默认查询只命中最近热索引/热分片，不默认扫全历史 data stream。

### 收益

- 进一步降低空查询成本
- 更符合“实时检索”的实际语义

### 文件级落点

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `services/data-services/query-api/internal/repository/repository.go` | ES 查询入口 | 为实时页注入热索引 alias / 热数据路由策略 |
| `storage` / ES 模板配置 | 索引与 alias 管理 | 区分 realtime alias 与 full history alias |

## 8.3 P2-3：预聚合分钟桶

### 方案

对于“最近 30 分钟分钟桶统计”这类极高频、低维度请求，可引入：

- 预聚合索引
- Redis / 内存旁路缓存
- 或专门的 metrics materialization 流程

### 收益

- 直方图查询可从秒级压到亚秒级
- 降低 ES 实时聚合压力

---

## 9. 文件级实施拆解单

## 9.1 前端

| 优先级 | 文件 | 需要改动 |
|---|---|---|
| P0 | `apps/frontend-console/src/pages/search/RealtimeSearch.tsx` | 默认时间窗、串行轮询、请求取消、SWR、图表与表格解耦 |
| P0 | `apps/frontend-console/src/api/query.ts` | 支持请求取消、可选轻量返回参数、可选 approx total |
| P1 | `apps/frontend-console/src/pages/search/RealtimeSearch.tsx` | 改用新 histogram 合并接口 |
| P1 | `apps/frontend-console/src/pages/search/RealtimeSearch.tsx` | 抽屉详情改为按需加载 |
| P1 | `apps/frontend-console/src/pages/search/realtimeHistogram.ts` | 兼容新 histogram 返回结构 |
| P1 | `apps/frontend-console/src/pages/search/realtimeNoiseFilters.ts` | 与时间窗 / 模式策略联动 |

## 9.2 query-api

| 优先级 | 文件 | 需要改动 |
|---|---|---|
| P0 | `services/data-services/query-api/internal/repository/repository.go` | 根据场景控制 `track_total_hits`、PIT 策略 |
| P1 | `services/data-services/query-api/internal/service/service.go` | 列表/详情模式拆分，减少返回字段 |
| P1 | `services/data-services/query-api/internal/handler/handler.go` | `/logs` 支持轻量模式参数 |
| P1 | `services/data-services/query-api/internal/handler/stats_handler.go` | 新增合并 histogram 接口 |
| P1 | `services/data-services/query-api/internal/service/stats_service.go` | 一次返回多序列 histogram |
| P2 | `services/data-services/query-api/internal/service/service.go` | 查询结果缓存与 stale fallback |
| P2 | `services/data-services/query-api/internal/service/stats_service.go` | 聚合热点缓存 |

## 9.3 数据与索引层

| 优先级 | 文件/区域 | 需要改动 |
|---|---|---|
| P2 | ES index template / alias 配置 | 区分 realtime alias 与 full history alias |
| P2 | Flink / 聚合链路 | 视情况补分钟级预聚合 |
| P2 | Redis / 缓存层 | 存放热点 histogram / query fingerprint 结果 |

---

## 10. 验收标准

## 10.1 功能验收

- 实时页仍支持：
  - 手动执行查询
  - 自动刷新
  - 分页翻页
  - 筛选切换
  - 抽屉查看详情
- 查询失败时页面不整块空白
- 自动刷新期间不会出现请求无限叠加

## 10.2 性能验收

建议至少采集以下指标：

- 前端：
  - 首屏可见时间
  - 刷新按钮点击到表格更新完成耗时
  - 自动刷新并发中的 in-flight 请求数
  - 被取消请求数
- 后端：
  - `/query/logs` P50/P95/P99
  - `/query/stats/aggregate` 或新 histogram 接口 P50/P95/P99
  - 缓存命中率
  - 接口 `500` 比例

## 10.3 体验验收

- 刷新时用户始终能看到可用内容，而非整块空白
- 同一用户长时间停留实时页，不会把 query-api 压到持续抖动
- 默认空查询进入页时体感明显快于当前实现

---

## 11. 实施顺序建议

### 第一阶段（立即做）

1. 默认时间窗
2. 串行轮询
3. 请求取消
4. SWR 体验
5. 图表/表格解耦

### 第二阶段（随后做）

1. 合并 histogram 接口
2. 列表/详情拆分
3. approx total
4. 首页实时查询弱化 PIT

### 第三阶段（容量优化）

1. 短 TTL 查询缓存
2. 聚合 stale fallback
3. 热索引 alias
4. 预聚合分钟桶

---

## 12. 不建议的路径

以下路径不建议作为第一优先级：

### 12.1 直接上 WebSocket / SSE

原因：

- 当前根因是查询模型过重，不是传输协议本身
- 若底层还是“全历史扫 + 3 请求并发”，改成长连接不会从根本上解决问题

### 12.2 只加前端 loading 动画，不改请求模型

原因：

- 只能改善表象，不能减少真实等待时间
- 也不能阻止请求堆积与后端 `500`

### 12.3 一开始就大规模改 ES 索引结构

原因：

- 成本高、验证周期长
- 先做 P0/P1 通常就能拿到显著收益

---

## 13. 推荐下一步

建议下一步直接进入 **P0 实施任务拆解**，并优先改以下文件：

1. `apps/frontend-console/src/pages/search/RealtimeSearch.tsx`
2. `apps/frontend-console/src/api/query.ts`
3. `services/data-services/query-api/internal/repository/repository.go`
4. `services/data-services/query-api/internal/service/service.go`
5. `services/data-services/query-api/internal/service/stats_service.go`

如果需要，可以在下一轮继续产出一份：

- **P0 开发任务拆解单**
- 精确到函数、接口参数、测试用例和提交流水线的实施文档
