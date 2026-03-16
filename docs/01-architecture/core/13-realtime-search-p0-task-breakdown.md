# 13. 实时检索性能优化 P0 开发任务拆解单（V1）

## 1. 文档目标

本文档是 `docs/01-architecture/core/12-realtime-search-performance-optimization-plan.md` 的继续细化版本，目标是把实时检索性能优化中的 **P0 快速收益项** 拆到可以直接进入开发排期和联调的粒度。

与 `12` 的区别如下：

- `12` 解决“问题是什么、为什么这样改、优先级怎么排”
- `13` 解决“第一阶段到底改哪些函数、接口参数、页面状态、测试点和验收点”

本文档只聚焦 **P0**，不处理 P1 的 histogram 合并接口、列表/详情模式拆分、服务端缓存等结构性改造。

---

## 2. P0 范围定义

本轮建议只做以下 5 个 P0 项：

1. **P0-1：实时表格默认时间窗**
2. **P0-2：自动刷新串行化，禁止轮询叠加**
3. **P0-3：前端请求取消与过期响应丢弃**
4. **P0-4：SWR（stale-while-refresh）页面体验**
5. **P0-5：表格请求与直方图请求解耦**

本轮明确 **不做**：

- 不新增 WebSocket / SSE
- 不改 Elasticsearch 索引结构
- 不引入 Redis 缓存
- 不在本轮就把 `/stats/aggregate` 合并成单接口
- 不在本轮就把 `/logs` 拆成 summary/detail 两个后端返回模式

这样可以把风险压在前端编排和少量后端查询参数治理上，确保收益快、改动面可控。

---

## 3. 当前代码落点总览

## 3.1 前端关键文件

| 文件 | 当前职责 | P0 关注点 |
|---|---|---|
| `apps/frontend-console/src/pages/search/RealtimeSearch.tsx` | 实时检索页主页面 | 时间窗、轮询模型、请求编排、加载状态、图表/表格更新策略 |
| `apps/frontend-console/src/api/query.ts` | query-api 前端请求封装 | `fetch()` 取消能力、`/logs` 请求参数透传、`/stats/aggregate` 请求参数透传 |
| `apps/frontend-console/src/pages/search/realtimeNoiseFilters.ts` | 实时页筛选参数构建 | 与新时间窗和自动刷新策略联动，但本轮不做复杂逻辑 |
| `apps/frontend-console/src/pages/search/realtimeHistogram.ts` | histogram 数据映射 | 接收拆开的总量/错误量返回，保持兼容 |

## 3.2 后端关键文件

| 文件 | 当前职责 | P0 关注点 |
|---|---|---|
| `services/data-services/query-api/internal/handler/handler.go` | `/api/v1/query/logs` handler | 如需新增轻量查询参数，本文件负责绑定与下发 |
| `services/data-services/query-api/internal/service/service.go` | `SearchLogs()` 主流程 | 校验请求、调用仓储、结果映射 |
| `services/data-services/query-api/internal/repository/repository.go` | ES `_search` 封装 | `track_total_hits`、PIT、分页策略 |
| `services/data-services/query-api/internal/service/stats_service.go` | `/stats/aggregate` 聚合逻辑 | 本轮先保持兼容，仅配合前端解耦 |

---

## 4. P0-1：实时表格默认时间窗

## 4.1 问题

当前实时表格查询默认：

- `from = ''`
- `to = now`

也就是没有时间下界。对空查询和弱筛选来说，这等同于从全历史里倒序找最新日志，默认成本过高。

当前代码落点：

- `apps/frontend-console/src/pages/search/RealtimeSearch.tsx`
  - `buildRealtimeTableTimeRange()`
- `services/data-services/query-api/internal/repository/repository.go`
  - `BuildESQuery()` 中对 `TimeRangeFrom` / `TimeRangeTo` 的 `range` 组装

## 4.2 目标状态

默认实时页表格查询改为：

- `from = now - 15m`
- `to = now`

同时为后续 UI 预留时间窗状态，推荐预设值：

- `5m`
- `15m`
- `30m`
- `1h`

本轮 P0 可以先做默认值与基础切换，不要求做复杂的自定义时间选择器。

## 4.3 具体改动

### 前端：`apps/frontend-console/src/pages/search/RealtimeSearch.tsx`

需要调整的函数与状态：

1. `buildRealtimeTableTimeRange(snapshotTo?: string)`
   - 从固定返回 `{ from: '', to: now }`
   - 改为根据当前实时窗口状态计算 `from`
   - 推荐新增工具函数：
     - `resolveRealtimeWindowFrom(windowKey: '5m' | '15m' | '30m' | '1h', snapshotTo: string): string`

2. 页面状态新增：
   - `const [liveWindow, setLiveWindow] = useState<'5m' | '15m' | '30m' | '1h'>('15m')`

3. 执行查询时：
   - `executeQuery()` 中构造 `realtimeTableTimeRange` 时改为读取 `liveWindow`

4. 页面交互：
   - 在搜索栏或实时开关附近增加简单时间窗选择器（推荐 `Select`）
   - 切换时间窗时触发第一页重新查询

### 后端：`services/data-services/query-api/internal/repository/repository.go`

本轮不改接口协议，只需要确认：

- 当前 `BuildESQuery()` 已支持 `TimeRangeFrom` 时写入 `range.gte`
- 不需要新增接口字段

### 可选兜底：`services/data-services/query-api/internal/service/service.go`

如果希望避免未来其他前端又传空 `from`，可在 `SearchLogs()` 加一个可选兜底策略：

- 当请求标记为 realtime 且 `time_range.from` 为空时，后端自动补默认值

但这会引入“接口语义依赖页面场景”的副作用。本轮建议 **先不做后端隐式补值**，保持行为透明。

## 4.4 测试点

### 前端

- 初始进入实时页，表格请求体里的 `time_range.from` 不再为空
- 切换 `5m/15m/30m/1h` 时，请求体 `from` 正确变化
- 切换时间窗后自动回到第 1 页

### 联调

- 打开 `http://127.0.0.1:3000/#/search/realtime`
- Console 无新增报错
- Network 中 `POST /api/v1/query/logs` 的请求体包含非空 `time_range.from`
- 复现步骤：
  1. 打开实时检索页
  2. 保持实时开启
  3. 观察首次 `/logs` 请求体
  4. 切换时间窗
  5. 再观察下一次 `/logs` 请求体是否变化

---

## 5. P0-2：自动刷新串行化

## 5.1 问题

当前实时模式使用固定 `setInterval(5000)`：

- 不关心上一轮请求是否结束
- 只要时间到了就继续发下一轮
- 当 `/logs` 和 `/stats/aggregate` 同时变慢时，请求会堆积

当前代码落点：

- `apps/frontend-console/src/pages/search/RealtimeSearch.tsx`
  - 自动刷新 `useEffect()`
  - `executeQuery()`

## 5.2 目标状态

实时轮询改为串行调度：

- 一次只允许存在一轮有效刷新任务
- 上一轮结束后再等待固定间隔，随后开始下一轮
- 若用户手动触发新查询，自动刷新链路复用同一个执行器，不并发叠加

推荐模型：

- `setTimeout` 递归调度
- 而不是 `setInterval`

## 5.3 具体改动

### 前端：`apps/frontend-console/src/pages/search/RealtimeSearch.tsx`

建议新增以下引用状态：

- `const liveTimerRef = useRef<number | null>(null)`
- `const inFlightRefreshRef = useRef(false)`
- `const destroyedRef = useRef(false)`

建议新增以下函数：

1. `clearLiveTimer()`
   - 清理已有 timer

2. `scheduleNextLiveTick(delay = 5000)`
   - 若 `isLive` 为 `false`，直接返回
   - 用 `window.setTimeout()` 安排下一轮

3. `runLiveTick()`
   - 若已有 in-flight 刷新，则直接跳过并重新调度
   - 调用 `executeQuery({ silent: true, ... })`
   - `finally` 中再调度下一轮

4. 自动刷新 `useEffect()`
   - 从 `setInterval` 改为初次 `scheduleNextLiveTick()`
   - 卸载或退出实时模式时清理 timer

### 轮询串行规则

建议统一为：

- 页面只维护一个 live timer
- `executeQuery()` 开始前设置 in-flight 标志
- 结束后释放标志
- 下一轮刷新永远由上一轮完成回调触发

### 是否做退避

本轮可先不做复杂指数退避，只做固定 5 秒串行化。

如果想顺手做轻量优化，可追加：

- 成功后 `5s`
- 失败后 `10s`

但这不是本轮必须项。

## 5.4 测试点

### 前端

- 开启实时模式，10~20 秒内不会再出现多轮重叠刷新
- 切到非实时模式后，不再继续发起轮询请求
- 在分页第 2 页开启实时时，刷新仍按当前策略运行，不会多实例并发

### 联调

- 目标 URL：`http://127.0.0.1:3000/#/search/realtime`
- Console：无新增报错
- Network：同一时间窗口内不再持续出现 3 组以上重叠 `pending`
- 复现步骤：
  1. 打开实时检索页
  2. 保持实时开启
  3. 持续观察 20 秒以上
  4. 查看 Network 时间轴，确认新请求在上一轮结束后才发起

---

## 6. P0-3：前端请求取消与过期响应丢弃

## 6.1 问题

当前虽然有 `latestQueryRequestRef` 做“过期响应丢弃”，但仍存在两个问题：

1. 老请求仍在网络层和服务端继续执行，占用资源
2. `Promise.all()` 绑定下的聚合请求也会继续跑完

也就是说，现在只解决了“旧结果不落 UI”，没有解决“旧请求继续占资源”。

## 6.2 目标状态

- 每次发起新查询前，主动取消上一轮仍未完成的 `/logs` 和 `/stats/aggregate`
- 被取消的请求不弹错误提示
- 只有最新请求能更新 UI

## 6.3 具体改动

### 前端：`apps/frontend-console/src/api/query.ts`

需要扩展 `requestQueryApi()`：

1. 给 `options` 增加：
   - `signal?: AbortSignal`

2. `fetch()` 调用时透传：
   - `signal: options.signal`

3. `queryRealtimeLogs()` 增加可选参数：
   - `signal?: AbortSignal`

4. `fetchAggregateStats()` 增加可选参数：
   - `signal?: AbortSignal`

### 前端：`apps/frontend-console/src/pages/search/RealtimeSearch.tsx`

建议新增以下引用状态：

- `const activeAbortControllersRef = useRef<AbortController[]>([])`

建议新增以下工具函数：

1. `abortActiveRequests()`
   - 逐个 `abort()` 现有 controller
   - 清空引用数组

2. `createTrackedAbortController()`
   - 创建 controller
   - 推入 `activeAbortControllersRef`
   - 返回 controller

### `executeQuery()` 的改造

1. 在发起新查询前执行 `abortActiveRequests()`
2. 分别为 `/logs`、总量 histogram、错误量 histogram 创建 controller
3. 将对应 `signal` 透传给：
   - `queryRealtimeLogs()`
   - `fetchAggregateStats()`
4. `catch` 中识别取消错误：
   - `AbortError` 不应提示“查询失败”
5. `finally` 中清理已完成 controller 引用

## 6.4 与现有 `latestQueryRequestRef` 的关系

本轮建议 **两者同时保留**：

- `AbortController` 负责尽量停止旧请求
- `latestQueryRequestRef` 负责最终 UI 层的“最后写入胜出”保护

这样更稳妥，因为：

- 某些请求可能在 abort 前已完成
- 某些 polyfill / 浏览器行为可能不会完全同步中断 Promise 链

## 6.5 测试点

### 前端

- 快速切换筛选、连续点击“执行”，旧请求被取消
- 取消请求不弹红色错误提示
- 只有最后一次查询结果生效

### 联调

- 目标 URL：`http://127.0.0.1:3000/#/search/realtime`
- Console：无未处理 Promise reject
- Network：旧请求状态显示为 cancelled / aborted 或被浏览器提前终止
- 复现步骤：
  1. 打开实时检索页
  2. 连续快速修改关键词并回车执行 3~5 次
  3. 观察 Network 中早期请求被取消
  4. 页面最终只展示最后一次查询结果

---

## 7. P0-4：SWR 页面体验

## 7.1 问题

当前 `executeQuery()` 每次都会 `setTableLoading(true)`，页面多个区域刷新时更接近“整页重新等结果”，体感偏慢。

即使请求没有真的非常慢，只要 loading 状态太重，用户也会觉得页面卡顿。

## 7.2 目标状态

页面改为 stale-while-refresh：

- 刷新期间保留旧表格数据与旧 histogram 数据
- 仅显示轻量“正在刷新”状态
- 真正首次加载和无数据态时，才显示强 loading / skeleton

## 7.3 具体改动

### 前端：`apps/frontend-console/src/pages/search/RealtimeSearch.tsx`

建议把当前 loading 状态拆成：

- `initialLoading`：首次加载或页面完全无数据时使用
- `tableRefreshing`：表格轻量刷新中
- `histogramRefreshing`：图表轻量刷新中

建议状态：

- `const [initialLoading, setInitialLoading] = useState(true)`
- `const [tableRefreshing, setTableRefreshing] = useState(false)`
- `const [histogramRefreshing, setHistogramRefreshing] = useState(false)`

### 行为规则

1. 首次进入页面且没有历史数据时：
   - 显示 skeleton / `Table loading`

2. 后续刷新：
   - 不清空 `logs`
   - 不清空 `histogramData`
   - 只设置轻量刷新标志

3. 刷新失败：
   - 保留旧结果
   - 显示 `message.warning` 或非阻塞错误
   - 不把表格打空

### 组件层建议

- `Table` 的 `loading` 只在 `initialLoading` 为真且无数据时使用
- 刷新态用标题区 `Tag` / `Typography.Text` / `Button loading` 表示
- histogram 卡片同理，只显示右上角小 loading 状态，不清空图表

## 7.4 测试点

### 前端

- 首次进入页面有 loading，后续刷新保留旧数据
- 刷新失败时页面不空白
- 自动刷新中用户仍可浏览旧结果

### 联调

- 目标 URL：`http://127.0.0.1:3000/#/search/realtime`
- Console：无新增报错
- Network：请求期间页面仍显示旧表格数据
- 复现步骤：
  1. 打开实时检索页等待首批数据完成
  2. 再次点击执行或等待自动刷新
  3. 观察表格和图表未被清空
  4. 人为制造一次失败请求，确认旧数据仍保留

---

## 8. P0-5：表格与直方图请求解耦

## 8.1 问题

当前 `executeQuery()` 使用 `Promise.all()`：

- `/logs`
- `/stats/aggregate` 总量
- `/stats/aggregate` 错误量

任何一项变慢，都会拖慢整页更新。

这导致用户必须等待三项都结束，才能看到任何变化。

## 8.2 目标状态

改为分阶段更新：

- 表格请求独立完成后，立即更新表格
- histogram 请求完成后，再单独更新图表
- 某一侧失败，不影响另一侧成功更新

## 8.3 具体改动

### 前端：`apps/frontend-console/src/pages/search/RealtimeSearch.tsx`

建议把 `executeQuery()` 拆成两个内部子流程：

1. `runTableQuery()`
   - 负责 `/logs`
   - 成功后立即：
     - `setLogs()`
     - `setTotal()`
     - `setCurrentPage()`
     - `setQueryTimeMS()`
     - `setQueryTimedOut()`
     - `setTableSnapshotTo()`
     - 维护分页 cursor

2. `runHistogramQuery()`
   - 负责两次 `/stats/aggregate`
   - 成功后再：
     - `setHistogramData()`

### 推荐编排方式

优先方案：

- 先并行启动表格与 histogram
- 但分别 `await` 与分别处理结果
- 不使用一个总的 `Promise.all()` 决定整页成败

伪流程：

1. 发起 `tablePromise`
2. 发起 `totalHistogramPromise`
3. 发起 `errorHistogramPromise`
4. `await tablePromise` 后立即更新表格
5. `await Promise.allSettled([totalHistogramPromise, errorHistogramPromise])`
6. 若 histogram 成功则更新图表，否则保留旧图表数据

### 失败语义建议

- 表格失败：提示查询失败，但 histogram 成功仍可更新
- histogram 失败：只提示图表刷新失败，不影响表格
- 若用户 `silent` 刷新，则失败只记轻提示或静默

## 8.4 测试点

### 前端

- 表格先返回时，页面先看到新表格
- histogram 较慢时，图表稍后更新，但不阻塞表格
- 图表失败时，表格仍正常更新

### 联调

- 目标 URL：`http://127.0.0.1:3000/#/search/realtime`
- Console：无新增报错
- Network：可见 `/logs` 与 `/stats/aggregate` 分别完成
- 复现步骤：
  1. 打开实时检索页
  2. 执行一次查询
  3. 观察表格是否先于图表更新
  4. 模拟一个 histogram 失败场景，确认表格不受影响

---

## 9. 后端 P0 配合项

## 9.1 `repository.go`：控制默认查询成本

文件：`services/data-services/query-api/internal/repository/repository.go`

当前默认行为：

- `track_total_hits = true`
- 无 `pit_id` 时自动打开 PIT

本轮 P0 推荐只做 **低风险可选优化**：

### 可选项 A：按场景关闭精确 total

如果前端第一页只需“是否还有下一页”，可以考虑支持：

- `track_total_hits = false` 或限定为上限值

但这会影响当前分页总数显示逻辑。本轮若不想动 UI 语义，可以先不做。

### 可选项 B：第一页弱化 PIT

当前第一页也会自动开 PIT，这对实时页“只看最新数据”的场景可能偏重。

可考虑增加条件：

- 仅当使用 `search_after` 深分页时再打开 PIT
- 第 1 页普通查询先不自动开 PIT

这个改动收益明确，但会涉及分页稳定性验证。若本轮要确保稳妥，可把它放到 `P0.5` 或 `P1`。

## 9.2 `service.go`：保持结果映射兼容

文件：`services/data-services/query-api/internal/service/service.go`

本轮建议：

- 不改返回结构
- 不在本轮就裁剪 `RawLog` / `Fields`
- 重点保证前端 P0 编排调整时，后端接口契约不需要一起大改

这样可以让 P0 以“前端请求模型治理”为主，减少联调变量。

---

## 10. 推荐实施顺序

建议严格按以下顺序落地：

1. `P0-1` 默认时间窗
2. `P0-2` 串行轮询
3. `P0-3` 请求取消
4. `P0-5` 表格与图表解耦
5. `P0-4` SWR 体验整理

原因：

- `P0-1` 与 `P0-2` 先解决“查询太重 + 请求叠加”
- `P0-3` 再解决“旧请求仍占资源”
- `P0-5` 解决“整页互相等待”
- `P0-4` 最后收口 UI 体验，避免中途反复改 loading 状态

---

## 11. 建议按文件拆任务卡

## 11.1 前端任务卡

### 任务卡 F1：实时时间窗

- 文件：`apps/frontend-console/src/pages/search/RealtimeSearch.tsx`
- 目标：给实时表格默认加 `15m` 下界，并增加基础时间窗切换
- 风险：低
- 依赖：无

### 任务卡 F2：串行轮询

- 文件：`apps/frontend-console/src/pages/search/RealtimeSearch.tsx`
- 目标：`setInterval` 改为串行 `setTimeout`
- 风险：中
- 依赖：F1

### 任务卡 F3：请求取消

- 文件：`apps/frontend-console/src/api/query.ts`
- 文件：`apps/frontend-console/src/pages/search/RealtimeSearch.tsx`
- 目标：为 `/logs` 与 `/stats/aggregate` 接入 `AbortController`
- 风险：中
- 依赖：F2

### 任务卡 F4：表格/图表解耦

- 文件：`apps/frontend-console/src/pages/search/RealtimeSearch.tsx`
- 文件：`apps/frontend-console/src/pages/search/realtimeHistogram.ts`
- 目标：去掉整页 `Promise.all()` 阻塞
- 风险：中
- 依赖：F3

### 任务卡 F5：SWR 体验收口

- 文件：`apps/frontend-console/src/pages/search/RealtimeSearch.tsx`
- 目标：保留旧数据刷新，不再整块 loading
- 风险：低到中
- 依赖：F4

## 11.2 后端任务卡

### 任务卡 B1：第一页 PIT 策略评估

- 文件：`services/data-services/query-api/internal/repository/repository.go`
- 目标：评估是否在第 1 页关闭自动 PIT
- 风险：中
- 依赖：可独立进行
- 备注：建议先做 PoC，不必和前端 P0 同 MR 强绑定

### 任务卡 B2：`track_total_hits` 策略评估

- 文件：`services/data-services/query-api/internal/repository/repository.go`
- 目标：评估是否支持 approximate total
- 风险：中
- 依赖：需要和前端分页展示策略一起确认
- 备注：建议放后续迭代，不抢占本轮 P0 主线

---

## 12. 验收标准（P0）

## 12.1 体验验收

满足以下全部条件即可判定 P0 成功：

- 默认进入实时页时，请求范围限定在近 15 分钟
- 自动刷新不再形成持续叠加请求
- 快速连续执行查询时，旧请求会被取消
- 表格更新不再被 histogram 慢请求完全阻塞
- 刷新期间页面保留旧结果，不整块空白

## 12.2 浏览器证据要求

根据仓库规则，前端相关结论必须包含以下证据：

1. **目标 URL**
   - `http://127.0.0.1:3000/#/search/realtime`

2. **Console 信息**
   - 无新增报错
   - 无未处理 `AbortError`

3. **Network 请求**
   - `/api/v1/query/logs`
   - `/api/v1/query/stats/aggregate`
   - 需要证明：
     - `time_range.from` 非空
     - 旧请求被取消
     - 请求不再重叠堆积
     - 表格与 histogram 更新可分离观察

4. **可复现步骤**
   - 页面打开
   - 开启实时
   - 连续执行查询
   - 观察请求取消与串行刷新

## 12.3 指标验收

建议同时记录：

- 手动点击“执行”到表格更新完成时间
- 自动刷新周期内 in-flight 请求数峰值
- `/logs` 与 `/stats/aggregate` 的失败比例
- 页面刷新时用户可见空白时间

---

## 13. 下一步建议

完成本文件后，最合理的下一步不是继续写更大的方案，而是直接进入 **P0 编码实施**，优先修改：

1. `apps/frontend-console/src/pages/search/RealtimeSearch.tsx`
2. `apps/frontend-console/src/api/query.ts`
3. `services/data-services/query-api/internal/repository/repository.go`（如决定顺手做 PIT/total 优化）

推荐先做一个最小可交付版本：

- 默认时间窗
- 串行轮询
- 请求取消

这三个改完后，通常就已经能明显降低实时页刷新等待感和请求堆积问题。