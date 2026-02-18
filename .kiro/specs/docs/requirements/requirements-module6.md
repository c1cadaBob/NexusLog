# 模块六：可视化与报告

> **文档版本**: v1.0  
> **创建日期**: 2026-01-29  
> **所属模块**: 模块六：可视化与报告  
> **需求编号**: 

---

**模块概述**: 

提供丰富的可视化界面和报告功能，支持实时监控、历史分析、自定义仪表盘和定期报告生成。

**模块技术栈**:
- 前端框架：React 18+ + TypeScript (现代化 UI)
- 图表库：ECharts 5.x / D3.js (丰富的图表类型)
- 状态管理：Zustand (轻量级状态管理)
- UI 组件：Ant Design 5.x (企业级组件库)
- 报告生成：Go + Chromium (PDF/Excel 导出)
- 实时通信：WebSocket (实时数据推送)
- 配置管理：PostgreSQL + Redis 配置中心（热配置）

**模块架构**:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              可视化与报告模块整体架构                                        │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            配置中心（控制面）                                          │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ PostgreSQL   │───▶│    Redis     │───▶│   Pub/Sub    │                           │ │
│  │  │ (仪表盘配置/ │    │ (当前配置)   │    │ (配置变更)   │                           │ │
│  │  │  报告模板)   │    │              │    │              │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────┬───────┘                           │ │
│  └────────────────────────────────────────────────────┼─────────────────────────────────┘ │
│                                                       │                                   │
│                                                       ▼                                   │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            前端展示层（Frontend）                                      │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  React 应用                                                                  │     │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │     │ │
│  │  │  │ 实时监控页面  │  │ 日志搜索页面  │  │ 仪表盘页面   │  │ 报告页面     │   │     │ │
│  │  │  │ (Dashboard)  │  │ (Search)     │  │ (Custom)     │  │ (Report)     │   │     │ │
│  │  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │     │ │
│  │  │         └──────────────────┴──────────────────┴──────────────────┘           │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  │                                        │                                              │ │
│  │                                        ▼                                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  状态管理层 (Zustand Store)                                                  │     │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                      │     │ │
│  │  │  │ 日志状态     │  │ 仪表盘状态   │  │ 用户偏好     │                      │     │ │
│  │  │  │ (LogStore)   │  │ (DashStore)  │  │ (UserStore)  │                      │     │ │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘                      │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  │                                        │                                              │ │
│  │                                        ▼                                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  图表组件层 (Chart Components)                                               │     │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │     │ │
│  │  │  │ 时序图       │  │ 饼图         │  │ 柱状图       │  │ 热力图       │   │     │ │
│  │  │  │ (TimeSeries) │  │ (Pie)        │  │ (Bar)        │  │ (Heatmap)    │   │     │ │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │     │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │     │ │
│  │  │  │ 拓扑图       │  │ 火焰图       │  │ 表格         │  │ 统计卡片     │   │     │ │
│  │  │  │ (Topology)   │  │ (Flame)      │  │ (Table)      │  │ (StatCard)   │   │     │ │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │     │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘     │ │
│  └────────────────────────────────────────┼──────────────────────────────────────────┘ │
│                                           │                                             │
│                                           ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            API 网关层（API Gateway）                                   │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ REST API     │    │ WebSocket    │    │ GraphQL      │                           │ │
│  │  │ (查询/配置)  │    │ (实时推送)   │    │ (灵活查询)   │                           │ │
│  │  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                           │ │
│  │         └────────────────────┴────────────────────┘                                  │ │
│  └─────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                        │                                                 │
│                                        ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            数据聚合层（Aggregation）                                   │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  实时数据聚合器 (Real-time Aggregator)                                       │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 日志聚合     │───▶│ 指标聚合     │───▶│ 事件聚合     │                 │     │ │
│  │  │  │ (Log Agg)    │    │ (Metric Agg) │    │ (Event Agg)  │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  │                                        │                                              │ │
│  │                                        ▼                                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  历史数据查询器 (Historical Query)                                           │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ Elasticsearch│───▶│ 时间范围过滤  │───▶│ 结果缓存     │                 │     │ │
│  │  │  │ 查询         │    │ (Time Filter)│    │ (Redis)      │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘     │ │
│  └────────────────────────────────────────┼──────────────────────────────────────────┘ │
│                                           │                                             │
│                                           ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            仪表盘管理层（Dashboard Manager）                           │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  仪表盘引擎 (Dashboard Engine)                                               │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 布局管理     │───▶│ 组件渲染     │───▶│ 数据绑定     │                 │     │ │
│  │  │  │ (Layout)     │    │ (Render)     │    │ (Binding)    │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  │                                        │                                              │ │
│  │                                        ▼                                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  模板管理器 (Template Manager)                                               │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 预置模板     │    │ 自定义模板   │    │ 模板共享     │                 │     │ │
│  │  │  │ (Preset)     │    │ (Custom)     │    │ (Share)      │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘     │ │
│  └────────────────────────────────────────┼──────────────────────────────────────────┘ │
│                                           │                                             │
│                                           ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            报告生成层（Report Generator）                              │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  报告引擎 (Report Engine)                                                    │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 数据采集     │───▶│ 报告渲染     │───▶│ 格式导出     │                 │     │ │
│  │  │  │ (Collect)    │    │ (Render)     │    │ (Export)     │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  │                                        │                                              │ │
│  │                                        ▼                                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  调度器 (Scheduler)                                                          │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 定时任务     │───▶│ 报告分发     │───▶│ 历史归档     │                 │     │ │
│  │  │  │ (Cron)       │    │ (Distribute) │    │ (Archive)    │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘     │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            数据源层（Data Sources）                                │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                       │ │
│  │  │ Elasticsearch│    │ Prometheus   │    │ PostgreSQL   │                       │ │
│  │  │ (日志数据)   │    │ (指标数据)   │    │ (元数据)     │                       │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                       │ │
│  └───────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**架构说明**:

1. **配置中心层**: 使用 PostgreSQL 存储仪表盘配置和报告模板，Redis 分发当前生效配置
2. **前端展示层**: React + TypeScript 构建的现代化 UI，支持实时监控、日志搜索、自定义仪表盘和报告
3. **API 网关层**: 提供 REST API、WebSocket 和 GraphQL 三种接口方式
4. **数据聚合层**: 实时数据聚合和历史数据查询，支持结果缓存
5. **仪表盘管理层**: 仪表盘引擎和模板管理器，支持拖拽式布局和组件配置
6. **报告生成层**: 报告引擎和调度器，支持定时生成和多格式导出
7. **数据源层**: 从 Elasticsearch、Prometheus、PostgreSQL 获取数据

**数据流向**:

```
数据源 → 数据聚合 → API 网关 → 前端展示
         ↓                      ↓
      仪表盘管理 → 报告生成 → 分发归档
         ↑                      ↑
         └──── 配置中心（热更新）─────┘
```

**需求列表**:
- 需求 6-20：实时监控仪表盘 [MVP]
- 需求 6-21：自定义仪表盘 [MVP]
- 需求 6-22：日志可视化 [MVP]
- 需求 6-23：定期报告生成 [Phase 2]

---



#### 需求 6-20：实时监控仪表盘 [MVP]

**用户故事**: 

作为运维工程师，我希望能够通过实时监控仪表盘查看系统状态，以便快速了解系统健康状况和发现异常。

**验收标准**:

1. THE Dashboard SHALL 展示实时日志流、系统指标和告警信息，数据刷新延迟 ≤ 2 秒
2. THE Dashboard SHALL 提供多种图表类型（时序图、饼图、柱状图、热力图、拓扑图），至少支持 8 种图表
3. THE Dashboard SHALL 支持自动刷新，可配置刷新间隔（5 秒、10 秒、30 秒、1 分钟、5 分钟）
4. THE Dashboard SHALL 展示关键指标卡片（日志总量、错误率、平均延迟、活跃服务数），实时更新
5. WHEN 用户点击图表数据点时，THE Dashboard SHALL 展示详细信息和相关日志
6. THE Dashboard SHALL 支持时间范围选择（最近 5 分钟、15 分钟、1 小时、6 小时、24 小时、自定义）
7. THE Dashboard SHALL 支持全屏模式，适合大屏展示
8. THE Dashboard SHALL 使用 WebSocket 实现实时数据推送，避免轮询
9. THE Dashboard SHALL 支持暗色/亮色主题切换
10. THE Dashboard SHALL 通过配置中心管理仪表盘配置，支持热更新

**实现方向**:

**实现方式**:

```go
// 仪表盘管理器
type DashboardManager struct {
    wsHub      *WebSocketHub        // WebSocket 中心
    aggregator *DataAggregator      // 数据聚合器
    cache      *DashboardCache      // 仪表盘缓存
    config     atomic.Value         // 配置（支持热更新）
    metrics    *DashboardMetrics    // 仪表盘指标
}

// 仪表盘配置
type DashboardConfig struct {
    RefreshInterval  int              // 刷新间隔（秒）
    DefaultTimeRange string           // 默认时间范围
    EnabledCharts    []string         // 启用的图表类型
    Theme            string           // 主题：light/dark
    AutoRefresh      bool             // 是否自动刷新
}

// WebSocket 中心
type WebSocketHub struct {
    clients    map[*WebSocketClient]bool // 客户端连接
    broadcast  chan *DashboardData       // 广播通道
    register   chan *WebSocketClient     // 注册通道
    unregister chan *WebSocketClient     // 注销通道
    mu         sync.RWMutex
}

// WebSocket 客户端
type WebSocketClient struct {
    hub        *WebSocketHub
    conn       *websocket.Conn
    send       chan []byte
    filters    *DashboardFilters // 客户端过滤条件
}

// 仪表盘数据
type DashboardData struct {
    Timestamp    time.Time              // 时间戳
    Metrics      *SystemMetrics         // 系统指标
    LogStream    []*LogEntry            // 日志流
    Alerts       []*Alert               // 告警列表
    Charts       map[string]*ChartData  // 图表数据
}

// 系统指标
type SystemMetrics struct {
    TotalLogs      int64   // 日志总量
    ErrorRate      float64 // 错误率（%）
    AvgLatency     float64 // 平均延迟（毫秒）
    ActiveServices int     // 活跃服务数
    ThroughputQPS  int64   // 吞吐量（QPS）
}

// 图表数据
type ChartData struct {
    Type   string                 // 图表类型：timeseries/pie/bar/heatmap/topology
    Title  string                 // 图表标题
    Data   interface{}            // 图表数据
    Config map[string]interface{} // 图表配置
}

// 启动 WebSocket 中心
func (hub *WebSocketHub) Run() {
    for {
        select {
        case client := <-hub.register:
            // 注册客户端
            hub.mu.Lock()
            hub.clients[client] = true
            hub.mu.Unlock()
            log.Info("客户端已连接", "total", len(hub.clients))
            
        case client := <-hub.unregister:
            // 注销客户端
            hub.mu.Lock()
            if _, ok := hub.clients[client]; ok {
                delete(hub.clients, client)
                close(client.send)
            }
            hub.mu.Unlock()
            log.Info("客户端已断开", "total", len(hub.clients))
            
        case data := <-hub.broadcast:
            // 广播数据到所有客户端
            hub.mu.RLock()
            for client := range hub.clients {
                // 应用客户端过滤条件
                if filteredData := client.applyFilters(data); filteredData != nil {
                    select {
                    case client.send <- filteredData:
                    default:
                        // 发送失败，关闭客户端
                        close(client.send)
                        delete(hub.clients, client)
                    }
                }
            }
            hub.mu.RUnlock()
        }
    }
}

// 应用过滤条件
func (c *WebSocketClient) applyFilters(data *DashboardData) []byte {
    // 根据客户端过滤条件过滤数据
    filtered := &DashboardData{
        Timestamp: data.Timestamp,
        Metrics:   data.Metrics,
        Charts:    make(map[string]*ChartData),
    }
    
    // 过滤日志流
    if c.filters.LogLevel != "" {
        for _, log := range data.LogStream {
            if log.Level == c.filters.LogLevel {
                filtered.LogStream = append(filtered.LogStream, log)
            }
        }
    } else {
        filtered.LogStream = data.LogStream
    }
    
    // 过滤告警
    if c.filters.AlertSeverity != "" {
        for _, alert := range data.Alerts {
            if alert.Severity == c.filters.AlertSeverity {
                filtered.Alerts = append(filtered.Alerts, alert)
            }
        }
    } else {
        filtered.Alerts = data.Alerts
    }
    
    // 过滤图表
    for chartType, chartData := range data.Charts {
        if c.filters.EnabledCharts == nil || contains(c.filters.EnabledCharts, chartType) {
            filtered.Charts[chartType] = chartData
        }
    }
    
    // 序列化为 JSON
    jsonData, err := json.Marshal(filtered)
    if err != nil {
        log.Error("序列化失败", "error", err)
        return nil
    }
    
    return jsonData
}

// 数据聚合器
type DataAggregator struct {
    esClient   *elasticsearch.Client
    promClient *prometheus.Client
    pgClient   *sql.DB
    cache      *redis.Client
}

// 聚合仪表盘数据
func (da *DataAggregator) AggregateDashboardData(timeRange string) (*DashboardData, error) {
    data := &DashboardData{
        Timestamp: time.Now(),
        Charts:    make(map[string]*ChartData),
    }
    
    // 1. 聚合系统指标
    metrics, err := da.aggregateSystemMetrics(timeRange)
    if err != nil {
        return nil, fmt.Errorf("聚合系统指标失败: %w", err)
    }
    data.Metrics = metrics
    
    // 2. 获取实时日志流
    logStream, err := da.getRealtimeLogStream(100)
    if err != nil {
        log.Warn("获取日志流失败", "error", err)
    } else {
        data.LogStream = logStream
    }
    
    // 3. 获取活跃告警
    alerts, err := da.getActiveAlerts()
    if err != nil {
        log.Warn("获取告警失败", "error", err)
    } else {
        data.Alerts = alerts
    }
    
    // 4. 生成图表数据
    data.Charts["timeseries"] = da.generateTimeSeriesChart(timeRange)
    data.Charts["pie"] = da.generatePieChart(timeRange)
    data.Charts["bar"] = da.generateBarChart(timeRange)
    data.Charts["heatmap"] = da.generateHeatmapChart(timeRange)
    data.Charts["topology"] = da.generateTopologyChart()
    
    return data, nil
}

// 聚合系统指标
func (da *DataAggregator) aggregateSystemMetrics(timeRange string) (*SystemMetrics, error) {
    // 尝试从缓存获取
    cacheKey := fmt.Sprintf("metrics:%s", timeRange)
    if cached, err := da.cache.Get(context.Background(), cacheKey).Result(); err == nil {
        var metrics SystemMetrics
        if err := json.Unmarshal([]byte(cached), &metrics); err == nil {
            return &metrics, nil
        }
    }
    
    // 从 Elasticsearch 查询日志统计
    totalLogs, errorCount, err := da.queryLogStats(timeRange)
    if err != nil {
        return nil, err
    }
    
    // 从 Prometheus 查询延迟指标
    avgLatency, err := da.queryAvgLatency(timeRange)
    if err != nil {
        log.Warn("查询延迟失败", "error", err)
        avgLatency = 0
    }
    
    // 从 PostgreSQL 查询活跃服务数
    activeServices, err := da.queryActiveServices()
    if err != nil {
        log.Warn("查询活跃服务失败", "error", err)
        activeServices = 0
    }
    
    // 计算错误率
    errorRate := 0.0
    if totalLogs > 0 {
        errorRate = float64(errorCount) / float64(totalLogs) * 100
    }
    
    // 计算吞吐量（QPS）
    duration := parseDuration(timeRange)
    throughputQPS := totalLogs / int64(duration.Seconds())
    
    metrics := &SystemMetrics{
        TotalLogs:      totalLogs,
        ErrorRate:      errorRate,
        AvgLatency:     avgLatency,
        ActiveServices: activeServices,
        ThroughputQPS:  throughputQPS,
    }
    
    // 缓存结果（5 秒）
    jsonData, _ := json.Marshal(metrics)
    da.cache.Set(context.Background(), cacheKey, jsonData, 5*time.Second)
    
    return metrics, nil
}

// 生成时序图数据
func (da *DataAggregator) generateTimeSeriesChart(timeRange string) *ChartData {
    // 查询时序数据
    query := fmt.Sprintf(`
        SELECT 
            date_trunc('minute', timestamp) as time,
            COUNT(*) as count,
            COUNT(*) FILTER (WHERE level = 'ERROR') as error_count
        FROM logs
        WHERE timestamp >= NOW() - INTERVAL '%s'
        GROUP BY time
        ORDER BY time
    `, timeRange)
    
    rows, err := da.pgClient.Query(query)
    if err != nil {
        log.Error("查询时序数据失败", "error", err)
        return nil
    }
    defer rows.Close()
    
    var series []map[string]interface{}
    for rows.Next() {
        var t time.Time
        var count, errorCount int64
        if err := rows.Scan(&t, &count, &errorCount); err != nil {
            continue
        }
        
        series = append(series, map[string]interface{}{
            "time":        t.Unix() * 1000, // 毫秒时间戳
            "total":       count,
            "error":       errorCount,
            "error_rate":  float64(errorCount) / float64(count) * 100,
        })
    }
    
    return &ChartData{
        Type:  "timeseries",
        Title: "日志趋势",
        Data:  series,
        Config: map[string]interface{}{
            "xAxis": "time",
            "yAxis": []string{"total", "error"},
            "smooth": true,
        },
    }
}

// 生成饼图数据
func (da *DataAggregator) generatePieChart(timeRange string) *ChartData {
    // 查询日志级别分布
    query := fmt.Sprintf(`
        SELECT level, COUNT(*) as count
        FROM logs
        WHERE timestamp >= NOW() - INTERVAL '%s'
        GROUP BY level
    `, timeRange)
    
    rows, err := da.pgClient.Query(query)
    if err != nil {
        log.Error("查询饼图数据失败", "error", err)
        return nil
    }
    defer rows.Close()
    
    var data []map[string]interface{}
    for rows.Next() {
        var level string
        var count int64
        if err := rows.Scan(&level, &count); err != nil {
            continue
        }
        
        data = append(data, map[string]interface{}{
            "name":  level,
            "value": count,
        })
    }
    
    return &ChartData{
        Type:  "pie",
        Title: "日志级别分布",
        Data:  data,
        Config: map[string]interface{}{
            "radius": []string{"40%", "70%"},
            "label": map[string]interface{}{
                "show": true,
                "formatter": "{b}: {c} ({d}%)",
            },
        },
    }
}

// HTTP 处理器：WebSocket 连接
func (dm *DashboardManager) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
    // 升级为 WebSocket 连接
    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        log.Error("WebSocket 升级失败", "error", err)
        return
    }
    
    // 解析过滤条件
    filters := &DashboardFilters{
        LogLevel:      r.URL.Query().Get("log_level"),
        AlertSeverity: r.URL.Query().Get("alert_severity"),
    }
    
    // 创建客户端
    client := &WebSocketClient{
        hub:     dm.wsHub,
        conn:    conn,
        send:    make(chan []byte, 256),
        filters: filters,
    }
    
    // 注册客户端
    dm.wsHub.register <- client
    
    // 启动读写协程
    go client.writePump()
    go client.readPump()
}

// 写入数据到 WebSocket
func (c *WebSocketClient) writePump() {
    ticker := time.NewTicker(30 * time.Second)
    defer func() {
        ticker.Stop()
        c.conn.Close()
    }()
    
    for {
        select {
        case message, ok := <-c.send:
            if !ok {
                // 通道已关闭
                c.conn.WriteMessage(websocket.CloseMessage, []byte{})
                return
            }
            
            // 发送消息
            if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
                return
            }
            
        case <-ticker.C:
            // 发送心跳
            if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
                return
            }
        }
    }
}

// 从 WebSocket 读取数据
func (c *WebSocketClient) readPump() {
    defer func() {
        c.hub.unregister <- c
        c.conn.Close()
    }()
    
    for {
        _, message, err := c.conn.ReadMessage()
        if err != nil {
            break
        }
        
        // 处理客户端消息（如更新过滤条件）
        c.handleMessage(message)
    }
}
```

**关键实现点**:

1. 使用 WebSocket 实现实时数据推送，避免 HTTP 轮询的性能开销
2. 实现 WebSocket Hub 模式，支持多客户端连接和广播
3. 支持客户端级别的数据过滤，减少网络传输量
4. 使用 Redis 缓存聚合结果，提高查询性能（5 秒缓存）
5. 支持多种图表类型（时序图、饼图、柱状图、热力图、拓扑图）
6. 实现心跳机制，自动检测和清理断开的连接
7. 使用 atomic.Value 实现配置热更新，无需重启服务

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| refresh_interval | int | 5 | 刷新间隔（秒） |
| default_time_range | string | "15m" | 默认时间范围 |
| enabled_charts | array | ["timeseries","pie","bar"] | 启用的图表类型 |
| theme | string | "light" | 主题 |
| auto_refresh | bool | true | 是否自动刷新 |
| max_log_stream_size | int | 100 | 日志流最大条数 |
| cache_ttl | int | 5 | 缓存过期时间（秒） |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（下一次数据推送）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后 3 秒内生效
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误日志
3. THE System SHALL 支持通过 API 查询当前生效的配置值
4. THE System SHALL 记录所有配置变更的审计日志
5. WHEN 刷新间隔变更时，THE System SHALL 平滑过渡，不中断现有连接

---


#### 需求 6-21：自定义仪表盘 [MVP]

**用户故事**: 

作为运维工程师，我希望能够创建和自定义仪表盘布局，以便根据不同场景展示关注的指标和图表。

**验收标准**:

1. THE Dashboard SHALL 支持拖拽式布局编辑，用户可以自由调整组件位置和大小
2. THE Dashboard SHALL 提供至少 10 种预置仪表盘模板（系统概览、服务监控、错误分析、性能分析等）
3. THE Dashboard SHALL 支持添加、删除、复制组件，每个仪表盘最多支持 20 个组件
4. THE Dashboard SHALL 支持组件配置（数据源、查询条件、刷新间隔、样式），配置即时生效
5. THE Dashboard SHALL 支持保存和加载自定义仪表盘，保存响应时间 < 500ms
6. THE Dashboard SHALL 支持仪表盘分享，生成唯一分享链接
7. THE Dashboard SHALL 支持仪表盘导入导出（JSON 格式）
8. THE Dashboard SHALL 支持仪表盘版本管理，保留最近 10 个版本
9. THE Dashboard SHALL 支持仪表盘权限控制（私有、团队、公开）
10. THE Dashboard SHALL 通过配置中心管理仪表盘配置，支持热更新

**实现方向**:

**实现方式**:

```go
// 仪表盘服务
type DashboardService struct {
    db         *sql.DB
    cache      *redis.Client
    storage    *ObjectStorage    // 对象存储（S3/MinIO）
    config     atomic.Value
    metrics    *ServiceMetrics
}

// 仪表盘定义
type Dashboard struct {
    ID          string              `json:"id"`
    Name        string              `json:"name"`
    Description string              `json:"description"`
    Layout      *DashboardLayout    `json:"layout"`
    Components  []*DashboardComponent `json:"components"`
    Settings    *DashboardSettings  `json:"settings"`
    Permission  *DashboardPermission `json:"permission"`
    Version     int                 `json:"version"`
    CreatedBy   string              `json:"created_by"`
    CreatedAt   time.Time           `json:"created_at"`
    UpdatedAt   time.Time           `json:"updated_at"`
}

// 仪表盘布局
type DashboardLayout struct {
    Type    string              `json:"type"` // grid/flex/absolute
    Columns int                 `json:"columns"` // 网格列数
    RowHeight int               `json:"row_height"` // 行高（像素）
    Gaps    int                 `json:"gaps"` // 间距（像素）
}

// 仪表盘组件
type DashboardComponent struct {
    ID          string              `json:"id"`
    Type        string              `json:"type"` // chart/stat/table/text
    Title       string              `json:"title"`
    Position    *ComponentPosition  `json:"position"`
    DataSource  *DataSourceConfig   `json:"data_source"`
    ChartConfig *ChartConfig        `json:"chart_config"`
    RefreshInterval int             `json:"refresh_interval"` // 秒
    Style       map[string]interface{} `json:"style"`
}

// 组件位置
type ComponentPosition struct {
    X      int `json:"x"` // 列位置
    Y      int `json:"y"` // 行位置
    Width  int `json:"width"` // 宽度（列数）
    Height int `json:"height"` // 高度（行数）
}

// 数据源配置
type DataSourceConfig struct {
    Type   string                 `json:"type"` // elasticsearch/prometheus/postgres
    Query  string                 `json:"query"` // 查询语句
    Params map[string]interface{} `json:"params"` // 查询参数
}

// 图表配置
type ChartConfig struct {
    Type    string                 `json:"type"` // line/bar/pie/heatmap/gauge
    Options map[string]interface{} `json:"options"` // ECharts 配置
}

// 仪表盘设置
type DashboardSettings struct {
    Theme           string `json:"theme"` // light/dark
    AutoRefresh     bool   `json:"auto_refresh"`
    RefreshInterval int    `json:"refresh_interval"` // 秒
    TimeRange       string `json:"time_range"` // 默认时间范围
}

// 仪表盘权限
type DashboardPermission struct {
    Visibility string   `json:"visibility"` // private/team/public
    OwnerID    string   `json:"owner_id"`
    TeamIDs    []string `json:"team_ids"`
    SharedWith []string `json:"shared_with"` // 用户 ID 列表
}

// 创建仪表盘
func (ds *DashboardService) CreateDashboard(dashboard *Dashboard) error {
    // 1. 生成 ID
    dashboard.ID = generateID()
    dashboard.Version = 1
    dashboard.CreatedAt = time.Now()
    dashboard.UpdatedAt = time.Now()
    
    // 2. 验证仪表盘
    if err := ds.validateDashboard(dashboard); err != nil {
        return fmt.Errorf("验证失败: %w", err)
    }
    
    // 3. 保存到数据库
    query := `
        INSERT INTO dashboards (id, name, description, layout, components, settings, permission, version, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `
    
    layoutJSON, _ := json.Marshal(dashboard.Layout)
    componentsJSON, _ := json.Marshal(dashboard.Components)
    settingsJSON, _ := json.Marshal(dashboard.Settings)
    permissionJSON, _ := json.Marshal(dashboard.Permission)
    
    _, err := ds.db.Exec(query,
        dashboard.ID,
        dashboard.Name,
        dashboard.Description,
        layoutJSON,
        componentsJSON,
        settingsJSON,
        permissionJSON,
        dashboard.Version,
        dashboard.CreatedBy,
        dashboard.CreatedAt,
        dashboard.UpdatedAt,
    )
    
    if err != nil {
        return fmt.Errorf("保存失败: %w", err)
    }
    
    // 4. 清除缓存
    ds.cache.Del(context.Background(), fmt.Sprintf("dashboard:%s", dashboard.ID))
    
    return nil
}

// 更新仪表盘
func (ds *DashboardService) UpdateDashboard(dashboard *Dashboard) error {
    // 1. 获取当前版本
    current, err := ds.GetDashboard(dashboard.ID)
    if err != nil {
        return fmt.Errorf("获取当前版本失败: %w", err)
    }
    
    // 2. 保存历史版本
    if err := ds.saveVersion(current); err != nil {
        log.Warn("保存历史版本失败", "error", err)
    }
    
    // 3. 更新版本号
    dashboard.Version = current.Version + 1
    dashboard.UpdatedAt = time.Now()
    
    // 4. 验证仪表盘
    if err := ds.validateDashboard(dashboard); err != nil {
        return fmt.Errorf("验证失败: %w", err)
    }
    
    // 5. 更新数据库
    query := `
        UPDATE dashboards
        SET name = $1, description = $2, layout = $3, components = $4, 
            settings = $5, permission = $6, version = $7, updated_at = $8
        WHERE id = $9
    `
    
    layoutJSON, _ := json.Marshal(dashboard.Layout)
    componentsJSON, _ := json.Marshal(dashboard.Components)
    settingsJSON, _ := json.Marshal(dashboard.Settings)
    permissionJSON, _ := json.Marshal(dashboard.Permission)
    
    _, err = ds.db.Exec(query,
        dashboard.Name,
        dashboard.Description,
        layoutJSON,
        componentsJSON,
        settingsJSON,
        permissionJSON,
        dashboard.Version,
        dashboard.UpdatedAt,
        dashboard.ID,
    )
    
    if err != nil {
        return fmt.Errorf("更新失败: %w", err)
    }
    
    // 6. 清除缓存
    ds.cache.Del(context.Background(), fmt.Sprintf("dashboard:%s", dashboard.ID))
    
    return nil
}

// 获取仪表盘
func (ds *DashboardService) GetDashboard(id string) (*Dashboard, error) {
    // 1. 尝试从缓存获取
    cacheKey := fmt.Sprintf("dashboard:%s", id)
    if cached, err := ds.cache.Get(context.Background(), cacheKey).Result(); err == nil {
        var dashboard Dashboard
        if err := json.Unmarshal([]byte(cached), &dashboard); err == nil {
            return &dashboard, nil
        }
    }
    
    // 2. 从数据库查询
    query := `
        SELECT id, name, description, layout, components, settings, permission, version, created_by, created_at, updated_at
        FROM dashboards
        WHERE id = $1
    `
    
    var dashboard Dashboard
    var layoutJSON, componentsJSON, settingsJSON, permissionJSON []byte
    
    err := ds.db.QueryRow(query, id).Scan(
        &dashboard.ID,
        &dashboard.Name,
        &dashboard.Description,
        &layoutJSON,
        &componentsJSON,
        &settingsJSON,
        &permissionJSON,
        &dashboard.Version,
        &dashboard.CreatedBy,
        &dashboard.CreatedAt,
        &dashboard.UpdatedAt,
    )
    
    if err != nil {
        return nil, fmt.Errorf("查询失败: %w", err)
    }
    
    // 3. 反序列化 JSON 字段
    json.Unmarshal(layoutJSON, &dashboard.Layout)
    json.Unmarshal(componentsJSON, &dashboard.Components)
    json.Unmarshal(settingsJSON, &dashboard.Settings)
    json.Unmarshal(permissionJSON, &dashboard.Permission)
    
    // 4. 缓存结果（5 分钟）
    jsonData, _ := json.Marshal(dashboard)
    ds.cache.Set(context.Background(), cacheKey, jsonData, 5*time.Minute)
    
    return &dashboard, nil
}

// 分享仪表盘
func (ds *DashboardService) ShareDashboard(id string, userID string) (string, error) {
    // 1. 检查权限
    dashboard, err := ds.GetDashboard(id)
    if err != nil {
        return "", err
    }
    
    if dashboard.CreatedBy != userID {
        return "", fmt.Errorf("无权限分享")
    }
    
    // 2. 生成分享令牌
    shareToken := generateShareToken()
    
    // 3. 保存分享记录
    query := `
        INSERT INTO dashboard_shares (token, dashboard_id, created_by, created_at, expires_at)
        VALUES ($1, $2, $3, $4, $5)
    `
    
    expiresAt := time.Now().Add(30 * 24 * time.Hour) // 30 天有效期
    
    _, err = ds.db.Exec(query, shareToken, id, userID, time.Now(), expiresAt)
    if err != nil {
        return "", fmt.Errorf("保存分享记录失败: %w", err)
    }
    
    // 4. 返回分享链接
    shareURL := fmt.Sprintf("/dashboards/shared/%s", shareToken)
    return shareURL, nil
}

// 导出仪表盘
func (ds *DashboardService) ExportDashboard(id string) ([]byte, error) {
    dashboard, err := ds.GetDashboard(id)
    if err != nil {
        return nil, err
    }
    
    // 导出为 JSON
    jsonData, err := json.MarshalIndent(dashboard, "", "  ")
    if err != nil {
        return nil, fmt.Errorf("序列化失败: %w", err)
    }
    
    return jsonData, nil
}

// 导入仪表盘
func (ds *DashboardService) ImportDashboard(jsonData []byte, userID string) (*Dashboard, error) {
    var dashboard Dashboard
    if err := json.Unmarshal(jsonData, &dashboard); err != nil {
        return nil, fmt.Errorf("解析失败: %w", err)
    }
    
    // 重置 ID 和元数据
    dashboard.ID = ""
    dashboard.CreatedBy = userID
    dashboard.Permission = &DashboardPermission{
        Visibility: "private",
        OwnerID:    userID,
    }
    
    // 创建仪表盘
    if err := ds.CreateDashboard(&dashboard); err != nil {
        return nil, err
    }
    
    return &dashboard, nil
}

// 保存历史版本
func (ds *DashboardService) saveVersion(dashboard *Dashboard) error {
    // 序列化仪表盘
    jsonData, err := json.Marshal(dashboard)
    if err != nil {
        return err
    }
    
    // 保存到对象存储
    key := fmt.Sprintf("dashboards/%s/versions/%d.json", dashboard.ID, dashboard.Version)
    if err := ds.storage.Put(key, jsonData); err != nil {
        return err
    }
    
    // 保存版本记录到数据库
    query := `
        INSERT INTO dashboard_versions (dashboard_id, version, data, created_at)
        VALUES ($1, $2, $3, $4)
    `
    
    _, err = ds.db.Exec(query, dashboard.ID, dashboard.Version, jsonData, time.Now())
    return err
}

// 获取历史版本列表
func (ds *DashboardService) GetVersions(dashboardID string) ([]*DashboardVersion, error) {
    query := `
        SELECT version, created_at
        FROM dashboard_versions
        WHERE dashboard_id = $1
        ORDER BY version DESC
        LIMIT 10
    `
    
    rows, err := ds.db.Query(query, dashboardID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    
    var versions []*DashboardVersion
    for rows.Next() {
        var v DashboardVersion
        if err := rows.Scan(&v.Version, &v.CreatedAt); err != nil {
            continue
        }
        v.DashboardID = dashboardID
        versions = append(versions, &v)
    }
    
    return versions, nil
}

// 恢复历史版本
func (ds *DashboardService) RestoreVersion(dashboardID string, version int) error {
    // 1. 从对象存储获取历史版本
    key := fmt.Sprintf("dashboards/%s/versions/%d.json", dashboardID, version)
    jsonData, err := ds.storage.Get(key)
    if err != nil {
        return fmt.Errorf("获取历史版本失败: %w", err)
    }
    
    // 2. 反序列化
    var dashboard Dashboard
    if err := json.Unmarshal(jsonData, &dashboard); err != nil {
        return fmt.Errorf("解析失败: %w", err)
    }
    
    // 3. 更新仪表盘
    return ds.UpdateDashboard(&dashboard)
}

// 验证仪表盘
func (ds *DashboardService) validateDashboard(dashboard *Dashboard) error {
    // 1. 检查名称
    if dashboard.Name == "" {
        return fmt.Errorf("名称不能为空")
    }
    
    // 2. 检查组件数量
    if len(dashboard.Components) > 20 {
        return fmt.Errorf("组件数量不能超过 20 个")
    }
    
    // 3. 检查组件配置
    for _, component := range dashboard.Components {
        if component.Type == "" {
            return fmt.Errorf("组件类型不能为空")
        }
        
        if component.Position == nil {
            return fmt.Errorf("组件位置不能为空")
        }
        
        // 检查位置是否重叠
        if err := ds.checkOverlap(dashboard.Components, component); err != nil {
            return err
        }
    }
    
    return nil
}

// 检查组件位置是否重叠
func (ds *DashboardService) checkOverlap(components []*DashboardComponent, target *DashboardComponent) error {
    for _, comp := range components {
        if comp.ID == target.ID {
            continue
        }
        
        // 检查是否重叠
        if ds.isOverlap(comp.Position, target.Position) {
            return fmt.Errorf("组件位置重叠")
        }
    }
    
    return nil
}

// 判断两个位置是否重叠
func (ds *DashboardService) isOverlap(pos1, pos2 *ComponentPosition) bool {
    return !(pos1.X+pos1.Width <= pos2.X ||
        pos2.X+pos2.Width <= pos1.X ||
        pos1.Y+pos1.Height <= pos2.Y ||
        pos2.Y+pos2.Height <= pos1.Y)
}
```

**关键实现点**:

1. 使用网格布局系统，支持拖拽式组件调整
2. 实现仪表盘版本管理，保留最近 10 个历史版本
3. 使用对象存储（S3/MinIO）保存历史版本，节省数据库空间
4. 支持仪表盘分享，生成唯一令牌和过期时间
5. 实现组件位置重叠检测，确保布局合理
6. 使用 Redis 缓存仪表盘配置，提高加载性能（5 分钟缓存）
7. 支持仪表盘导入导出，使用标准 JSON 格式

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| max_components | int | 20 | 每个仪表盘最大组件数 |
| max_versions | int | 10 | 保留的历史版本数 |
| share_expiry_days | int | 30 | 分享链接有效期（天） |
| cache_ttl | int | 300 | 缓存过期时间（秒） |
| default_layout_columns | int | 12 | 默认网格列数 |
| default_row_height | int | 80 | 默认行高（像素） |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（下一次仪表盘操作）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后 3 秒内生效
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误日志
3. THE System SHALL 支持通过 API 查询当前生效的配置值
4. THE System SHALL 记录所有配置变更的审计日志
5. WHEN 最大组件数变更时，THE System SHALL 验证现有仪表盘是否符合新限制

---


#### 需求 6-22：日志可视化 [MVP]

**用户故事**: 

作为运维工程师，我希望能够通过可视化方式查看和分析日志，以便快速理解日志模式和发现异常。

**验收标准**:

1. THE Log_Viewer SHALL 支持日志流实时展示，延迟 ≤ 1 秒，支持自动滚动和暂停
2. THE Log_Viewer SHALL 支持语法高亮，自动识别日志级别（ERROR/WARN/INFO/DEBUG）并使用不同颜色
3. THE Log_Viewer SHALL 支持日志上下文查看，点击日志条目展示前后 50 条日志
4. THE Log_Viewer SHALL 支持日志字段提取和展示，自动解析 JSON 格式日志
5. THE Log_Viewer SHALL 支持日志聚合视图（按时间、服务、级别聚合），展示统计图表
6. THE Log_Viewer SHALL 支持日志过滤和搜索，支持正则表达式和全文搜索
7. THE Log_Viewer SHALL 支持日志导出（TXT、CSV、JSON 格式），单次最多导出 10 万条
8. THE Log_Viewer SHALL 支持日志书签，标记重要日志并快速跳转
9. THE Log_Viewer SHALL 支持日志对比，并排展示两个时间段的日志
10. THE Log_Viewer SHALL 通过配置中心管理展示配置，支持热更新

**实现方向**:

**实现方式**:

```go
// 日志查看器服务
type LogViewerService struct {
    esClient   *elasticsearch.Client
    cache      *redis.Client
    highlighter *SyntaxHighlighter
    parser     *LogParser
    config     atomic.Value
    metrics    *ServiceMetrics
}

// 日志查看器配置
type LogViewerConfig struct {
    MaxPageSize      int              // 最大分页大小
    MaxExportSize    int              // 最大导出数量
    ContextSize      int              // 上下文大小
    HighlightEnabled bool             // 是否启用语法高亮
    AutoParse        bool             // 是否自动解析 JSON
    CacheTTL         int              // 缓存过期时间（秒）
}

// 日志查询请求
type LogQueryRequest struct {
    Query       string            `json:"query"`        // 查询语句
    TimeRange   *TimeRange        `json:"time_range"`   // 时间范围
    Filters     []*LogFilter      `json:"filters"`      // 过滤条件
    Sort        string            `json:"sort"`         // 排序：asc/desc
    Page        int               `json:"page"`         // 页码
    PageSize    int               `json:"page_size"`    // 分页大小
    Highlight   bool              `json:"highlight"`    // 是否高亮
}

// 时间范围
type TimeRange struct {
    From string `json:"from"` // 开始时间
    To   string `json:"to"`   // 结束时间
}

// 日志过滤器
type LogFilter struct {
    Field    string      `json:"field"`    // 字段名
    Operator string      `json:"operator"` // 操作符：eq/ne/gt/lt/contains/regex
    Value    interface{} `json:"value"`    // 值
}

// 日志查询响应
type LogQueryResponse struct {
    Total    int64          `json:"total"`     // 总数
    Logs     []*LogEntry    `json:"logs"`      // 日志列表
    Aggregations map[string]*Aggregation `json:"aggregations"` // 聚合结果
    Took     int64          `json:"took"`      // 查询耗时（毫秒）
}

// 日志条目
type LogEntry struct {
    ID        string                 `json:"id"`
    Timestamp time.Time              `json:"timestamp"`
    Level     string                 `json:"level"`
    Message   string                 `json:"message"`
    Source    string                 `json:"source"`
    Fields    map[string]interface{} `json:"fields"`
    Highlight map[string][]string    `json:"highlight,omitempty"` // 高亮片段
    Parsed    map[string]interface{} `json:"parsed,omitempty"`    // 解析后的字段
}

// 聚合结果
type Aggregation struct {
    Type    string                 `json:"type"`    // 类型：terms/date_histogram/stats
    Buckets []*AggregationBucket   `json:"buckets"` // 桶
}

// 聚合桶
type AggregationBucket struct {
    Key      interface{} `json:"key"`
    DocCount int64       `json:"doc_count"`
}

// 查询日志
func (lvs *LogViewerService) QueryLogs(req *LogQueryRequest) (*LogQueryResponse, error) {
    config := lvs.config.Load().(*LogViewerConfig)
    
    // 1. 验证请求
    if err := lvs.validateRequest(req, config); err != nil {
        return nil, err
    }
    
    // 2. 构建 Elasticsearch 查询
    esQuery := lvs.buildESQuery(req)
    
    // 3. 执行查询
    startTime := time.Now()
    result, err := lvs.esClient.Search(
        lvs.esClient.Search.WithContext(context.Background()),
        lvs.esClient.Search.WithIndex("logs-*"),
        lvs.esClient.Search.WithBody(esQuery),
        lvs.esClient.Search.WithFrom(req.Page*req.PageSize),
        lvs.esClient.Search.WithSize(req.PageSize),
    )
    
    if err != nil {
        return nil, fmt.Errorf("查询失败: %w", err)
    }
    defer result.Body.Close()
    
    // 4. 解析结果
    var esResponse ESSearchResponse
    if err := json.NewDecoder(result.Body).Decode(&esResponse); err != nil {
        return nil, fmt.Errorf("解析结果失败: %w", err)
    }
    
    // 5. 转换为日志条目
    logs := make([]*LogEntry, 0, len(esResponse.Hits.Hits))
    for _, hit := range esResponse.Hits.Hits {
        log := lvs.convertToLogEntry(hit, req.Highlight, config.AutoParse)
        logs = append(logs, log)
    }
    
    // 6. 构建响应
    response := &LogQueryResponse{
        Total:        esResponse.Hits.Total.Value,
        Logs:         logs,
        Aggregations: lvs.convertAggregations(esResponse.Aggregations),
        Took:         time.Since(startTime).Milliseconds(),
    }
    
    return response, nil
}

// 构建 Elasticsearch 查询
func (lvs *LogViewerService) buildESQuery(req *LogQueryRequest) io.Reader {
    query := map[string]interface{}{
        "query": map[string]interface{}{
            "bool": map[string]interface{}{
                "must": []interface{}{},
                "filter": []interface{}{
                    map[string]interface{}{
                        "range": map[string]interface{}{
                            "@timestamp": map[string]interface{}{
                                "gte": req.TimeRange.From,
                                "lte": req.TimeRange.To,
                            },
                        },
                    },
                },
            },
        },
        "sort": []interface{}{
            map[string]interface{}{
                "@timestamp": map[string]interface{}{
                    "order": req.Sort,
                },
            },
        },
    }
    
    // 添加查询条件
    if req.Query != "" {
        query["query"].(map[string]interface{})["bool"].(map[string]interface{})["must"] = append(
            query["query"].(map[string]interface{})["bool"].(map[string]interface{})["must"].([]interface{}),
            map[string]interface{}{
                "query_string": map[string]interface{}{
                    "query": req.Query,
                },
            },
        )
    }
    
    // 添加过滤条件
    for _, filter := range req.Filters {
        filterClause := lvs.buildFilterClause(filter)
        query["query"].(map[string]interface{})["bool"].(map[string]interface{})["filter"] = append(
            query["query"].(map[string]interface{})["bool"].(map[string]interface{})["filter"].([]interface{}),
            filterClause,
        )
    }
    
    // 添加高亮
    if req.Highlight {
        query["highlight"] = map[string]interface{}{
            "fields": map[string]interface{}{
                "message": map[string]interface{}{
                    "pre_tags":  []string{"<mark>"},
                    "post_tags": []string{"</mark>"},
                },
            },
        }
    }
    
    // 添加聚合
    query["aggs"] = map[string]interface{}{
        "by_level": map[string]interface{}{
            "terms": map[string]interface{}{
                "field": "level.keyword",
                "size":  10,
            },
        },
        "by_service": map[string]interface{}{
            "terms": map[string]interface{}{
                "field": "source.keyword",
                "size":  20,
            },
        },
        "by_time": map[string]interface{}{
            "date_histogram": map[string]interface{}{
                "field":    "@timestamp",
                "interval": "1m",
            },
        },
    }
    
    // 序列化为 JSON
    jsonData, _ := json.Marshal(query)
    return bytes.NewReader(jsonData)
}

// 转换为日志条目
func (lvs *LogViewerService) convertToLogEntry(hit ESHit, highlight bool, autoParse bool) *LogEntry {
    log := &LogEntry{
        ID:        hit.ID,
        Timestamp: hit.Source.Timestamp,
        Level:     hit.Source.Level,
        Message:   hit.Source.Message,
        Source:    hit.Source.Source,
        Fields:    hit.Source.Fields,
    }
    
    // 添加高亮
    if highlight && hit.Highlight != nil {
        log.Highlight = hit.Highlight
    }
    
    // 自动解析 JSON
    if autoParse && lvs.parser.IsJSON(log.Message) {
        if parsed, err := lvs.parser.ParseJSON(log.Message); err == nil {
            log.Parsed = parsed
        }
    }
    
    return log
}

// 获取日志上下文
func (lvs *LogViewerService) GetLogContext(logID string, contextSize int) (*LogContext, error) {
    config := lvs.config.Load().(*LogViewerConfig)
    
    // 1. 获取目标日志
    targetLog, err := lvs.getLogByID(logID)
    if err != nil {
        return nil, err
    }
    
    // 2. 查询前后日志
    beforeLogs, err := lvs.queryContextLogs(targetLog, "before", contextSize)
    if err != nil {
        log.Warn("查询前置日志失败", "error", err)
    }
    
    afterLogs, err := lvs.queryContextLogs(targetLog, "after", contextSize)
    if err != nil {
        log.Warn("查询后置日志失败", "error", err)
    }
    
    // 3. 构建上下文
    context := &LogContext{
        Target: targetLog,
        Before: beforeLogs,
        After:  afterLogs,
    }
    
    return context, nil
}

// 日志上下文
type LogContext struct {
    Target *LogEntry   `json:"target"` // 目标日志
    Before []*LogEntry `json:"before"` // 前置日志
    After  []*LogEntry `json:"after"`  // 后置日志
}

// 查询上下文日志
func (lvs *LogViewerService) queryContextLogs(target *LogEntry, direction string, size int) ([]*LogEntry, error) {
    query := map[string]interface{}{
        "query": map[string]interface{}{
            "bool": map[string]interface{}{
                "filter": []interface{}{
                    map[string]interface{}{
                        "term": map[string]interface{}{
                            "source.keyword": target.Source,
                        },
                    },
                },
            },
        },
        "size": size,
    }
    
    // 根据方向设置时间范围和排序
    if direction == "before" {
        query["query"].(map[string]interface{})["bool"].(map[string]interface{})["filter"] = append(
            query["query"].(map[string]interface{})["bool"].(map[string]interface{})["filter"].([]interface{}),
            map[string]interface{}{
                "range": map[string]interface{}{
                    "@timestamp": map[string]interface{}{
                        "lt": target.Timestamp.Format(time.RFC3339),
                    },
                },
            },
        )
        query["sort"] = []interface{}{
            map[string]interface{}{
                "@timestamp": map[string]interface{}{
                    "order": "desc",
                },
            },
        }
    } else {
        query["query"].(map[string]interface{})["bool"].(map[string]interface{})["filter"] = append(
            query["query"].(map[string]interface{})["bool"].(map[string]interface{})["filter"].([]interface{}),
            map[string]interface{}{
                "range": map[string]interface{}{
                    "@timestamp": map[string]interface{}{
                        "gt": target.Timestamp.Format(time.RFC3339),
                    },
                },
            },
        )
        query["sort"] = []interface{}{
            map[string]interface{}{
                "@timestamp": map[string]interface{}{
                    "order": "asc",
                },
            },
        }
    }
    
    // 执行查询
    jsonData, _ := json.Marshal(query)
    result, err := lvs.esClient.Search(
        lvs.esClient.Search.WithContext(context.Background()),
        lvs.esClient.Search.WithIndex("logs-*"),
        lvs.esClient.Search.WithBody(bytes.NewReader(jsonData)),
    )
    
    if err != nil {
        return nil, err
    }
    defer result.Body.Close()
    
    // 解析结果
    var esResponse ESSearchResponse
    if err := json.NewDecoder(result.Body).Decode(&esResponse); err != nil {
        return nil, err
    }
    
    // 转换为日志条目
    logs := make([]*LogEntry, 0, len(esResponse.Hits.Hits))
    for _, hit := range esResponse.Hits.Hits {
        log := lvs.convertToLogEntry(hit, false, false)
        logs = append(logs, log)
    }
    
    // 如果是前置日志，需要反转顺序
    if direction == "before" {
        for i, j := 0, len(logs)-1; i < j; i, j = i+1, j-1 {
            logs[i], logs[j] = logs[j], logs[i]
        }
    }
    
    return logs, nil
}

// 导出日志
func (lvs *LogViewerService) ExportLogs(req *LogQueryRequest, format string) ([]byte, error) {
    config := lvs.config.Load().(*LogViewerConfig)
    
    // 1. 限制导出数量
    if req.PageSize > config.MaxExportSize {
        req.PageSize = config.MaxExportSize
    }
    
    // 2. 查询日志
    response, err := lvs.QueryLogs(req)
    if err != nil {
        return nil, err
    }
    
    // 3. 根据格式导出
    switch format {
    case "txt":
        return lvs.exportToTXT(response.Logs), nil
    case "csv":
        return lvs.exportToCSV(response.Logs), nil
    case "json":
        return lvs.exportToJSON(response.Logs), nil
    default:
        return nil, fmt.Errorf("不支持的格式: %s", format)
    }
}

// 导出为 TXT
func (lvs *LogViewerService) exportToTXT(logs []*LogEntry) []byte {
    var buf bytes.Buffer
    for _, log := range logs {
        buf.WriteString(fmt.Sprintf("[%s] [%s] [%s] %s\n",
            log.Timestamp.Format(time.RFC3339),
            log.Level,
            log.Source,
            log.Message,
        ))
    }
    return buf.Bytes()
}

// 导出为 CSV
func (lvs *LogViewerService) exportToCSV(logs []*LogEntry) []byte {
    var buf bytes.Buffer
    writer := csv.NewWriter(&buf)
    
    // 写入表头
    writer.Write([]string{"Timestamp", "Level", "Source", "Message"})
    
    // 写入数据
    for _, log := range logs {
        writer.Write([]string{
            log.Timestamp.Format(time.RFC3339),
            log.Level,
            log.Source,
            log.Message,
        })
    }
    
    writer.Flush()
    return buf.Bytes()
}

// 导出为 JSON
func (lvs *LogViewerService) exportToJSON(logs []*LogEntry) []byte {
    jsonData, _ := json.MarshalIndent(logs, "", "  ")
    return jsonData
}

// 日志书签服务
type LogBookmarkService struct {
    db *sql.DB
}

// 创建书签
func (lbs *LogBookmarkService) CreateBookmark(userID, logID, note string) error {
    query := `
        INSERT INTO log_bookmarks (user_id, log_id, note, created_at)
        VALUES ($1, $2, $3, $4)
    `
    
    _, err := lbs.db.Exec(query, userID, logID, note, time.Now())
    return err
}

// 获取书签列表
func (lbs *LogBookmarkService) GetBookmarks(userID string) ([]*LogBookmark, error) {
    query := `
        SELECT id, log_id, note, created_at
        FROM log_bookmarks
        WHERE user_id = $1
        ORDER BY created_at DESC
    `
    
    rows, err := lbs.db.Query(query, userID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    
    var bookmarks []*LogBookmark
    for rows.Next() {
        var b LogBookmark
        if err := rows.Scan(&b.ID, &b.LogID, &b.Note, &b.CreatedAt); err != nil {
            continue
        }
        b.UserID = userID
        bookmarks = append(bookmarks, &b)
    }
    
    return bookmarks, nil
}

// 日志书签
type LogBookmark struct {
    ID        int64     `json:"id"`
    UserID    string    `json:"user_id"`
    LogID     string    `json:"log_id"`
    Note      string    `json:"note"`
    CreatedAt time.Time `json:"created_at"`
}
```

**关键实现点**:

1. 使用 Elasticsearch 的 highlight 功能实现语法高亮
2. 实现日志上下文查询，通过时间范围和来源过滤获取前后日志
3. 支持自动解析 JSON 格式日志，提取结构化字段
4. 实现多种导出格式（TXT、CSV、JSON），限制单次导出数量
5. 使用聚合查询生成统计图表（按级别、服务、时间聚合）
6. 实现日志书签功能，支持标记和快速跳转
7. 使用 Redis 缓存查询结果，提高重复查询性能

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| max_page_size | int | 1000 | 最大分页大小 |
| max_export_size | int | 100000 | 最大导出数量 |
| context_size | int | 50 | 上下文大小 |
| highlight_enabled | bool | true | 是否启用语法高亮 |
| auto_parse | bool | true | 是否自动解析 JSON |
| cache_ttl | int | 60 | 缓存过期时间（秒） |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（下一次查询）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后 3 秒内生效
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误日志
3. THE System SHALL 支持通过 API 查询当前生效的配置值
4. THE System SHALL 记录所有配置变更的审计日志
5. WHEN 最大导出数量变更时，THE System SHALL 验证是否在合理范围内（1000-1000000）

---


#### 需求 6-23：定期报告生成 [Phase 2]

**用户故事**: 

作为运维经理，我希望系统能够自动生成定期报告，以便了解系统运行状况和向上级汇报。

**验收标准**:

1. THE Report_System SHALL 支持定时生成报告（每日、每周、每月），准时率 ≥ 99%
2. THE Report_System SHALL 支持多种报告类型（系统概览、错误分析、性能报告、趋势分析），至少 5 种
3. THE Report_System SHALL 支持多种导出格式（PDF、Excel、HTML），生成时间 < 30 秒
4. THE Report_System SHALL 自动发送报告到指定邮箱或消息通知渠道
5. THE Report_System SHALL 支持自定义报告模板，使用模板引擎渲染
6. THE Report_System SHALL 支持报告历史归档，保留最近 90 天的报告
7. THE Report_System SHALL 支持报告订阅，用户可订阅感兴趣的报告
8. THE Report_System SHALL 在报告中包含图表、表格和统计数据
9. THE Report_System SHALL 支持报告预览，生成前可预览效果
10. THE Report_System SHALL 通过配置中心管理报告配置，支持热更新

**实现方向**:

**实现方式**:

```go
// 报告生成服务
type ReportService struct {
    db          *sql.DB
    scheduler   *ReportScheduler     // 报告调度器
    generator   *ReportGenerator     // 报告生成器
    distributor *ReportDistributor   // 报告分发器
    storage     *ObjectStorage       // 对象存储
    config      atomic.Value         // 配置（支持热更新）
    metrics     *ServiceMetrics
}

// 报告配置
type ReportConfig struct {
    Enabled          bool              // 是否启用报告
    MaxGenerationTime int              // 最大生成时间（秒）
    RetentionDays    int               // 保留天数
    DefaultFormat    string            // 默认格式：pdf/excel/html
    TemplateDir      string            // 模板目录
}

// 报告定义
type Report struct {
    ID          string              `json:"id"`
    Name        string              `json:"name"`
    Type        string              `json:"type"` // overview/error/performance/trend/custom
    Schedule    *ReportSchedule     `json:"schedule"`
    Template    string              `json:"template"`
    DataSources []*DataSourceConfig `json:"data_sources"`
    Recipients  []*Recipient        `json:"recipients"`
    Format      string              `json:"format"` // pdf/excel/html
    Enabled     bool                `json:"enabled"`
    CreatedBy   string              `json:"created_by"`
    CreatedAt   time.Time           `json:"created_at"`
    UpdatedAt   time.Time           `json:"updated_at"`
}

// 报告调度
type ReportSchedule struct {
    Type     string `json:"type"` // daily/weekly/monthly/cron
    Time     string `json:"time"` // HH:MM
    DayOfWeek int   `json:"day_of_week,omitempty"` // 1-7 (周一到周日)
    DayOfMonth int  `json:"day_of_month,omitempty"` // 1-31
    Cron     string `json:"cron,omitempty"` // Cron 表达式
}

// 收件人
type Recipient struct {
    Type    string `json:"type"` // email/slack/teams/webhook
    Address string `json:"address"` // 邮箱地址或 Webhook URL
}

// 报告调度器
type ReportScheduler struct {
    cron    *cron.Cron
    service *ReportService
}

// 启动调度器
func (rs *ReportScheduler) Start() error {
    rs.cron = cron.New()
    
    // 加载所有启用的报告
    reports, err := rs.service.GetEnabledReports()
    if err != nil {
        return fmt.Errorf("加载报告失败: %w", err)
    }
    
    // 为每个报告添加调度任务
    for _, report := range reports {
        if err := rs.scheduleReport(report); err != nil {
            log.Error("调度报告失败", "report", report.Name, "error", err)
            continue
        }
    }
    
    // 启动调度器
    rs.cron.Start()
    log.Info("报告调度器已启动", "reports", len(reports))
    
    return nil
}

// 调度报告
func (rs *ReportScheduler) scheduleReport(report *Report) error {
    // 构建 Cron 表达式
    cronExpr := rs.buildCronExpression(report.Schedule)
    
    // 添加调度任务
    _, err := rs.cron.AddFunc(cronExpr, func() {
        log.Info("开始生成报告", "report", report.Name)
        
        // 生成报告
        if err := rs.service.GenerateReport(report.ID); err != nil {
            log.Error("生成报告失败", "report", report.Name, "error", err)
        } else {
            log.Info("报告生成成功", "report", report.Name)
        }
    })
    
    return err
}

// 构建 Cron 表达式
func (rs *ReportScheduler) buildCronExpression(schedule *ReportSchedule) string {
    switch schedule.Type {
    case "daily":
        // 每天指定时间
        hour, minute := parseTime(schedule.Time)
        return fmt.Sprintf("%d %d * * *", minute, hour)
        
    case "weekly":
        // 每周指定时间
        hour, minute := parseTime(schedule.Time)
        return fmt.Sprintf("%d %d * * %d", minute, hour, schedule.DayOfWeek)
        
    case "monthly":
        // 每月指定时间
        hour, minute := parseTime(schedule.Time)
        return fmt.Sprintf("%d %d %d * *", minute, hour, schedule.DayOfMonth)
        
    case "cron":
        // 自定义 Cron 表达式
        return schedule.Cron
        
    default:
        return "0 0 * * *" // 默认每天午夜
    }
}

// 报告生成器
type ReportGenerator struct {
    dataAggregator *DataAggregator
    templateEngine *TemplateEngine
    pdfGenerator   *PDFGenerator
    excelGenerator *ExcelGenerator
}

// 生成报告
func (rg *ReportGenerator) Generate(report *Report) (*GeneratedReport, error) {
    startTime := time.Now()
    
    // 1. 收集数据
    data, err := rg.collectData(report)
    if err != nil {
        return nil, fmt.Errorf("收集数据失败: %w", err)
    }
    
    // 2. 渲染模板
    content, err := rg.renderTemplate(report.Template, data)
    if err != nil {
        return nil, fmt.Errorf("渲染模板失败: %w", err)
    }
    
    // 3. 生成文件
    var fileData []byte
    var fileName string
    
    switch report.Format {
    case "pdf":
        fileData, err = rg.pdfGenerator.Generate(content)
        fileName = fmt.Sprintf("%s_%s.pdf", report.Name, time.Now().Format("20060102"))
        
    case "excel":
        fileData, err = rg.excelGenerator.Generate(data)
        fileName = fmt.Sprintf("%s_%s.xlsx", report.Name, time.Now().Format("20060102"))
        
    case "html":
        fileData = []byte(content)
        fileName = fmt.Sprintf("%s_%s.html", report.Name, time.Now().Format("20060102"))
        
    default:
        return nil, fmt.Errorf("不支持的格式: %s", report.Format)
    }
    
    if err != nil {
        return nil, fmt.Errorf("生成文件失败: %w", err)
    }
    
    // 4. 构建结果
    generatedReport := &GeneratedReport{
        ReportID:     report.ID,
        ReportName:   report.Name,
        FileName:     fileName,
        FileData:     fileData,
        FileSize:     len(fileData),
        Format:       report.Format,
        GeneratedAt:  time.Now(),
        GenerationTime: time.Since(startTime).Seconds(),
    }
    
    return generatedReport, nil
}

// 收集数据
func (rg *ReportGenerator) collectData(report *Report) (map[string]interface{}, error) {
    data := make(map[string]interface{})
    
    // 基础信息
    data["report_name"] = report.Name
    data["report_type"] = report.Type
    data["generated_at"] = time.Now().Format("2006-01-02 15:04:05")
    
    // 根据报告类型收集数据
    switch report.Type {
    case "overview":
        // 系统概览数据
        data["system_metrics"] = rg.dataAggregator.GetSystemMetrics("24h")
        data["service_status"] = rg.dataAggregator.GetServiceStatus()
        data["alert_summary"] = rg.dataAggregator.GetAlertSummary("24h")
        
    case "error":
        // 错误分析数据
        data["error_stats"] = rg.dataAggregator.GetErrorStats("24h")
        data["top_errors"] = rg.dataAggregator.GetTopErrors("24h", 10)
        data["error_trend"] = rg.dataAggregator.GetErrorTrend("7d")
        
    case "performance":
        // 性能报告数据
        data["latency_stats"] = rg.dataAggregator.GetLatencyStats("24h")
        data["throughput_stats"] = rg.dataAggregator.GetThroughputStats("24h")
        data["slow_queries"] = rg.dataAggregator.GetSlowQueries("24h", 10)
        
    case "trend":
        // 趋势分析数据
        data["log_volume_trend"] = rg.dataAggregator.GetLogVolumeTrend("30d")
        data["error_rate_trend"] = rg.dataAggregator.GetErrorRateTrend("30d")
        data["service_growth"] = rg.dataAggregator.GetServiceGrowth("30d")
    }
    
    // 从自定义数据源收集数据
    for _, ds := range report.DataSources {
        customData, err := rg.dataAggregator.QueryDataSource(ds)
        if err != nil {
            log.Warn("查询数据源失败", "data_source", ds.Type, "error", err)
            continue
        }
        data[ds.Type] = customData
    }
    
    return data, nil
}

// 渲染模板
func (rg *ReportGenerator) renderTemplate(templateName string, data map[string]interface{}) (string, error) {
    return rg.templateEngine.Render(templateName, data)
}

// 生成的报告
type GeneratedReport struct {
    ReportID       string    `json:"report_id"`
    ReportName     string    `json:"report_name"`
    FileName       string    `json:"file_name"`
    FileData       []byte    `json:"-"`
    FileSize       int       `json:"file_size"`
    Format         string    `json:"format"`
    GeneratedAt    time.Time `json:"generated_at"`
    GenerationTime float64   `json:"generation_time"` // 秒
}

// PDF 生成器
type PDFGenerator struct {
    chromium *chromium.Browser
}

// 生成 PDF
func (pg *PDFGenerator) Generate(htmlContent string) ([]byte, error) {
    // 使用 Chromium 将 HTML 转换为 PDF
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    
    // 创建页面
    page, err := pg.chromium.NewPage(ctx)
    if err != nil {
        return nil, err
    }
    defer page.Close()
    
    // 设置 HTML 内容
    if err := page.SetContent(htmlContent); err != nil {
        return nil, err
    }
    
    // 生成 PDF
    pdfData, err := page.PDF(&chromium.PDFOptions{
        PrintBackground: true,
        Format:          "A4",
        Margin: &chromium.PDFMargin{
            Top:    "1cm",
            Bottom: "1cm",
            Left:   "1cm",
            Right:  "1cm",
        },
    })
    
    return pdfData, err
}

// Excel 生成器
type ExcelGenerator struct{}

// 生成 Excel
func (eg *ExcelGenerator) Generate(data map[string]interface{}) ([]byte, error) {
    f := excelize.NewFile()
    
    // 创建概览表
    f.SetSheetName("Sheet1", "概览")
    eg.writeOverviewSheet(f, data)
    
    // 创建详细数据表
    if errorStats, ok := data["error_stats"].(map[string]interface{}); ok {
        f.NewSheet("错误统计")
        eg.writeErrorStatsSheet(f, errorStats)
    }
    
    // 保存为字节数组
    var buf bytes.Buffer
    if err := f.Write(&buf); err != nil {
        return nil, err
    }
    
    return buf.Bytes(), nil
}

// 报告分发器
type ReportDistributor struct {
    emailSender *EmailSender
    slackSender *SlackSender
}

// 分发报告
func (rd *ReportDistributor) Distribute(report *GeneratedReport, recipients []*Recipient) error {
    var errors []error
    
    for _, recipient := range recipients {
        var err error
        
        switch recipient.Type {
        case "email":
            err = rd.emailSender.Send(recipient.Address, report)
            
        case "slack":
            err = rd.slackSender.Send(recipient.Address, report)
            
        case "webhook":
            err = rd.sendWebhook(recipient.Address, report)
            
        default:
            err = fmt.Errorf("不支持的收件人类型: %s", recipient.Type)
        }
        
        if err != nil {
            log.Error("发送报告失败", "recipient", recipient.Address, "error", err)
            errors = append(errors, err)
        }
    }
    
    if len(errors) > 0 {
        return fmt.Errorf("部分发送失败: %v", errors)
    }
    
    return nil
}

// 报告服务：生成报告
func (rs *ReportService) GenerateReport(reportID string) error {
    // 1. 获取报告定义
    report, err := rs.GetReport(reportID)
    if err != nil {
        return err
    }
    
    // 2. 生成报告
    generatedReport, err := rs.generator.Generate(report)
    if err != nil {
        return fmt.Errorf("生成报告失败: %w", err)
    }
    
    // 3. 保存到对象存储
    key := fmt.Sprintf("reports/%s/%s", reportID, generatedReport.FileName)
    if err := rs.storage.Put(key, generatedReport.FileData); err != nil {
        return fmt.Errorf("保存报告失败: %w", err)
    }
    
    // 4. 保存记录到数据库
    if err := rs.saveReportRecord(generatedReport, key); err != nil {
        log.Warn("保存报告记录失败", "error", err)
    }
    
    // 5. 分发报告
    if err := rs.distributor.Distribute(generatedReport, report.Recipients); err != nil {
        log.Warn("分发报告失败", "error", err)
    }
    
    // 6. 清理过期报告
    go rs.cleanupExpiredReports(reportID)
    
    return nil
}

// 清理过期报告
func (rs *ReportService) cleanupExpiredReports(reportID string) {
    config := rs.config.Load().(*ReportConfig)
    
    // 查询过期报告
    query := `
        SELECT file_key
        FROM report_records
        WHERE report_id = $1 AND generated_at < NOW() - INTERVAL '%d days'
    `
    
    rows, err := rs.db.Query(fmt.Sprintf(query, config.RetentionDays), reportID)
    if err != nil {
        log.Error("查询过期报告失败", "error", err)
        return
    }
    defer rows.Close()
    
    // 删除过期报告
    for rows.Next() {
        var fileKey string
        if err := rows.Scan(&fileKey); err != nil {
            continue
        }
        
        // 从对象存储删除
        if err := rs.storage.Delete(fileKey); err != nil {
            log.Warn("删除报告文件失败", "key", fileKey, "error", err)
        }
    }
    
    // 删除数据库记录
    deleteQuery := `
        DELETE FROM report_records
        WHERE report_id = $1 AND generated_at < NOW() - INTERVAL '%d days'
    `
    
    rs.db.Exec(fmt.Sprintf(deleteQuery, config.RetentionDays), reportID)
}
```

**关键实现点**:

1. 使用 Cron 调度器实现定时报告生成，支持多种调度类型
2. 使用 Chromium 将 HTML 转换为 PDF，支持复杂布局和图表
3. 使用 Excelize 库生成 Excel 报告，支持多个工作表
4. 实现模板引擎，支持自定义报告模板
5. 支持多种分发渠道（邮件、Slack、Webhook）
6. 使用对象存储保存报告文件，节省数据库空间
7. 实现自动清理机制，定期删除过期报告

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| enabled | bool | true | 是否启用报告 |
| max_generation_time | int | 30 | 最大生成时间（秒） |
| retention_days | int | 90 | 保留天数 |
| default_format | string | "pdf" | 默认格式 |
| template_dir | string | "/templates" | 模板目录 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（下一次报告生成）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后 3 秒内生效
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误日志
3. THE System SHALL 支持通过 API 查询当前生效的配置值
4. THE System SHALL 记录所有配置变更的审计日志
5. WHEN 保留天数变更时，THE System SHALL 触发清理任务，删除超出保留期的报告

---

### API 接口汇总

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-6-190 | 获取实时仪表盘数据 | Dashboard | GET | /api/v1/dashboard/realtime | dashboard.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | 实时数据 |
| API-6-191 | WebSocket实时数据推送 | Dashboard | WS | /api/v1/dashboard/ws | dashboard.read | 无 | WebSocket消息流 | 101/401/403/500 | v1 | 否 | 否 | - | WebSocket连接 |
| API-6-192 | 获取系统指标 | Dashboard | GET | /api/v1/dashboard/metrics | dashboard.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-6-193 | 获取指定类型图表数据 | Dashboard | GET | /api/v1/dashboard/charts/{type} | dashboard.read | Query: time_range | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-6-194 | 更新仪表盘配置 | Dashboard | PUT | /api/v1/dashboard/config | dashboard.write | Body: config_data | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-6-195 | 查询仪表盘列表 | Dashboard | GET | /api/v1/dashboards | dashboard.read | Query: page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 是 | - | 支持分页 |
| API-6-196 | 创建仪表盘 | Dashboard | POST | /api/v1/dashboards | dashboard.write | Body: dashboard_data | {code:0,data:{id:"dash-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-6-197 | 获取仪表盘详情 | Dashboard | GET | /api/v1/dashboards/{id} | dashboard.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-6-198 | 更新仪表盘 | Dashboard | PUT | /api/v1/dashboards/{id} | dashboard.write | Body: dashboard_data | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-6-199 | 删除仪表盘 | Dashboard | DELETE | /api/v1/dashboards/{id} | dashboard.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-6-200 | 复制仪表盘 | Dashboard | POST | /api/v1/dashboards/{id}/duplicate | dashboard.write | 无 | {code:0,data:{id:"dash-2"}} | 200/401/403/404/500 | v1 | 否 | 否 | - | - |
| API-6-201 | 分享仪表盘 | Dashboard | POST | /api/v1/dashboards/{id}/share | dashboard.write | Body: {expire_time} | {code:0,data:{token:"abc123"}} | 200/400/401/403/404/500 | v1 | 否 | 否 | - | - |
| API-6-202 | 获取分享的仪表盘 | Dashboard | GET | /api/v1/dashboards/shared/{token} | 无 | 无 | {code:0,data:{...}} | 200/404/410/500 | v1 | 是 | 是 | - | 公开接口 |
| API-6-203 | 导出仪表盘 | Dashboard | GET | /api/v1/dashboards/{id}/export | dashboard.read | 无 | Binary | 200/401/403/404/500 | v1 | 是 | 否 | - | 返回JSON文件 |
| API-6-204 | 导入仪表盘 | Dashboard | POST | /api/v1/dashboards/import | dashboard.write | Body: dashboard_json | {code:0,data:{id:"dash-3"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-6-205 | 获取历史版本列表 | Dashboard | GET | /api/v1/dashboards/{id}/versions | dashboard.read | 无 | {code:0,data:[...]} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-6-206 | 恢复历史版本 | Dashboard | POST | /api/v1/dashboards/{id}/versions/{version}/restore | dashboard.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 否 | 否 | - | - |
| API-6-207 | 获取模板列表 | Dashboard | GET | /api/v1/dashboard-templates | dashboard.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-6-208 | 获取模板详情 | Dashboard | GET | /api/v1/dashboard-templates/{id} | dashboard.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-6-209 | 应用模板 | Dashboard | POST | /api/v1/dashboard-templates/{id}/apply | dashboard.write | Body: {name} | {code:0,data:{id:"dash-4"}} | 200/400/401/403/404/500 | v1 | 否 | 否 | - | - |
| API-6-210 | 查询日志 | Logs | POST | /api/v1/logs/query | logs.read | Body: query_request | {code:0,data:{items:[],total:0}} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-6-211 | 获取日志详情 | Logs | GET | /api/v1/logs/{id} | logs.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-6-212 | 获取日志上下文 | Logs | GET | /api/v1/logs/{id}/context | logs.read | Query: before, after | {code:0,data:[...]} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-6-213 | 导出日志 | Logs | POST | /api/v1/logs/export | logs.read | Body: {query,format} | Binary | 200/400/401/403/500 | v1 | 是 | 否 | - | 返回文件 |
| API-6-214 | 获取日志聚合统计 | Logs | GET | /api/v1/logs/aggregations | logs.read | Query: time_range, group_by | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-6-215 | 获取书签列表 | Logs | GET | /api/v1/log-bookmarks | logs.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-6-216 | 创建书签 | Logs | POST | /api/v1/log-bookmarks | logs.write | Body: {log_id,note} | {code:0,data:{id:"bm-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-6-217 | 删除书签 | Logs | DELETE | /api/v1/log-bookmarks/{id} | logs.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-6-218 | 查询报告列表 | Report | GET | /api/v1/reports | report.read | Query: page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 是 | - | 支持分页 |
| API-6-219 | 创建报告 | Report | POST | /api/v1/reports | report.write | Body: report_config | {code:0,data:{id:"rpt-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-6-220 | 获取报告详情 | Report | GET | /api/v1/reports/{id} | report.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-6-221 | 更新报告 | Report | PUT | /api/v1/reports/{id} | report.write | Body: report_config | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-6-222 | 删除报告 | Report | DELETE | /api/v1/reports/{id} | report.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-6-223 | 手动生成报告 | Report | POST | /api/v1/reports/{id}/generate | report.write | 无 | {code:0,data:{record_id:"rec-1"}} | 200/401/403/404/500 | v1 | 否 | 否 | - | - |
| API-6-224 | 预览报告 | Report | GET | /api/v1/reports/{id}/preview | report.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-6-225 | 查询报告记录 | Report | GET | /api/v1/report-records | report.read | Query: report_id, page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | - | 支持分页 |
| API-6-226 | 获取报告记录详情 | Report | GET | /api/v1/report-records/{id} | report.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-6-227 | 下载报告文件 | Report | GET | /api/v1/report-records/{id}/download | report.read | 无 | Binary | 200/401/403/404/500 | v1 | 是 | 否 | - | 返回文件 |
| API-6-228 | 删除报告记录 | Report | DELETE | /api/v1/report-records/{id} | report.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-6-229 | 获取订阅列表 | Report | GET | /api/v1/report-subscriptions | report.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-6-230 | 创建订阅 | Report | POST | /api/v1/report-subscriptions | report.write | Body: {report_id,channel} | {code:0,data:{id:"sub-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-6-231 | 取消订阅 | Report | DELETE | /api/v1/report-subscriptions/{id} | report.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-6-232 | 获取报告模板列表 | Report | GET | /api/v1/report-templates | report.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-6-233 | 获取报告模板详情 | Report | GET | /api/v1/report-templates/{id} | report.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-6-234 | 创建报告模板 | Report | POST | /api/v1/report-templates | report.write | Body: template_data | {code:0,data:{id:"tpl-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-6-235 | 更新报告模板 | Report | PUT | /api/v1/report-templates/{id} | report.write | Body: template_data | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-6-236 | 删除报告模板 | Report | DELETE | /api/v1/report-templates/{id} | report.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |

---


