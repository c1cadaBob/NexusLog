# 模块6：可视化与报告 - 技术设计文档

> **文档版本**: v1.0  
> **作者**: 系统架构团队  
> **更新日期**: 2026-01-31  
> **状态**: 已发布  
> **相关需求**: [requirements-module6.md](../requirements/requirements-module6.md)

---

## 1. 文档信息

### 1.1 版本历史
| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| v1.0 | 2026-01-31 | 系统架构团队 | 初稿，完整设计方案 |

### 1.2 相关文档
- [需求文档](../requirements/requirements-module6.md)
- [API设计文档](./api-design.md)
- [项目总体设计](./project-design-overview.md)

---

## 2. 总体架构

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      可视化与报告模块架构                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      配置中心（热更新）                           │  │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │  │
│  │  │ PostgreSQL   │───▶│    Redis     │───▶│   Pub/Sub    │      │  │
│  │  │ (配置持久化)  │    │ (配置缓存)   │    │ (配置变更)   │      │  │
│  │  └──────────────┘    └──────────────┘    └──────┬───────┘      │  │
│  └────────────────────────────────────────────────────┼─────────────┘  │
│                                                       │                 │
│                                                       ▼                 │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      前端展示层（React）                          │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  React 18 + TypeScript + Ant Design                        │ │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │  │
│  │  │  │ 实时监控  │  │ 日志搜索  │  │ 仪表盘   │  │ 报告页面  │  │ │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  状态管理（Zustand）                                        │ │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                │ │  │
│  │  │  │ LogStore │  │ DashStore│  │ UserStore│                │ │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘                │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  图表组件（ECharts 5.x）                                    │ │  │
│  │  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐       │ │  │
│  │  │  │时序图 │  │饼图  │  │柱状图 │  │热力图 │  │拓扑图 │       │ │  │
│  │  │  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘       │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────┼──────────────────────────┘  │
│                                         │                             │
│                                         ▼                             │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      API 网关层                                   │  │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │  │
│  │  │ REST API     │    │ WebSocket    │    │ GraphQL      │      │  │
│  │  │ (查询/配置)   │    │ (实时推送)   │    │ (灵活查询)   │      │  │
│  │  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │  │
│  │         └────────────────────┴────────────────────┘              │  │
│  └─────────────────────────────────────┬──────────────────────────┘  │
│                                        │                             │
│                                        ▼                             │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      业务逻辑层                                   │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  实时监控管理器                                             │ │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                │ │  │
│  │  │  │ WebSocket│  │ 数据聚合  │  │ 指标计算  │                │ │  │
│  │  │  │   Hub    │  │ Aggregator│  │ Calculator│                │ │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘                │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  仪表盘管理器                                               │ │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                │ │  │
│  │  │  │ 布局引擎  │  │ 模板管理  │  │ 版本控制  │                │ │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘                │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  日志查看器                                                 │ │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                │ │  │
│  │  │  │ 语法高亮  │  │ 上下文   │  │ 导出引擎  │                │ │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘                │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  报告生成器                                                 │ │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                │ │  │
│  │  │  │ 调度器   │  │ 模板引擎  │  │ PDF生成   │                │ │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘                │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────┼──────────────────────────┘  │
│                                         │                             │
│                                         ▼                             │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      数据源层                                     │  │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │  │
│  │  │Elasticsearch │    │ Prometheus   │    │ PostgreSQL   │      │  │
│  │  │ (日志数据)    │    │ (指标数据)   │    │ (元数据)     │      │  │
│  │  └──────────────┘    └──────────────┘    └──────────────┘      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 模块划分

| 子模块 | 职责 | 核心功能 |
|--------|------|----------|
| 实时监控管理 | 实时数据展示 | WebSocket推送、数据聚合、指标计算、图表渲染 |
| 仪表盘管理 | 自定义仪表盘 | 拖拽布局、组件配置、模板管理、版本控制、分享导出 |
| 日志查看器 | 日志可视化 | 语法高亮、上下文查看、字段解析、聚合视图、导出 |
| 报告生成器 | 定期报告 | 调度任务、数据采集、模板渲染、PDF/Excel生成、分发 |
| 配置中心 | 配置热更新 | PostgreSQL持久化、Redis缓存、Pub/Sub通知 |

### 2.3 关键路径

**实时监控路径**:
```
数据源 → 数据聚合(100ms) → WebSocket推送(50ms) → 前端渲染(100ms)
总延迟: < 2秒
```

**仪表盘加载路径**:
```
请求 → Redis缓存查询(10ms) → 配置加载(50ms) → 组件渲染(200ms)
缓存命中: < 300ms
缓存未命中: < 500ms
```

**日志查询路径**:
```
查询请求 → ES查询(200ms) → 结果解析(50ms) → 语法高亮(50ms) → 返回
总延迟: < 500ms (P95)
```

**报告生成路径**:
```
触发 → 数据采集(5s) → 模板渲染(3s) → PDF生成(20s) → 分发(2s)
总时间: < 30秒
```

---

## 3. 技术选型

### 3.1 核心技术栈

| 技术 | 版本 | 选择理由 |
|------|------|----------|
| React | 18+ | 现代化UI框架，组件化开发，生态完善 |
| TypeScript | 5.x | 类型安全，提高代码质量和可维护性 |
| Ant Design | 5.x | 企业级UI组件库，开箱即用 |
| ECharts | 5.x | 强大的图表库，支持丰富的图表类型 |
| Zustand | 4.x | 轻量级状态管理，简单易用 |
| WebSocket | - | 实时数据推送，低延迟 |
| Go | 1.21+ | 高性能后端，并发友好 |
| Chromium | - | PDF生成，支持复杂布局 |
| PostgreSQL | 15+ | 配置持久化，支持JSONB |
| Redis | 7.2+ | 配置缓存，Pub/Sub通知 |

### 3.2 前端框架对比

| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| React | 生态完善、组件丰富、性能好 | 学习曲线略陡 | ✅ 采用 |
| Vue | 简单易学、双向绑定 | 企业级组件较少 | ❌ 不采用 |
| Angular | 完整框架、TypeScript原生 | 过于复杂、体积大 | ❌ 不采用 |

### 3.3 图表库对比

| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| ECharts | 功能强大、图表类型丰富、中文文档 | 体积较大 | ✅ 采用 |
| D3.js | 灵活可定制、性能好 | 学习曲线陡、开发成本高 | ❌ 不采用 |
| Chart.js | 简单易用、体积小 | 功能有限、定制性差 | ❌ 不采用 |

### 3.4 PDF生成对比

| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| Chromium | 支持复杂HTML/CSS、效果好 | 资源占用高 | ✅ 采用 |
| wkhtmltopdf | 轻量级、速度快 | 不支持现代CSS | ❌ 不采用 |
| LaTeX | 专业排版、质量高 | 学习成本高、不灵活 | ❌ 不采用 |

### 3.5 实时通信对比

| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| WebSocket | 双向通信、低延迟、标准协议 | 需要维护连接 | ✅ 采用 |
| Server-Sent Events | 简单、单向推送 | 只支持服务端推送 | ❌ 不采用 |
| HTTP轮询 | 简单、兼容性好 | 延迟高、资源浪费 | ❌ 不采用 |

---

## 4. 关键流程设计

### 4.1 实时监控主流程

**流程步骤**:

```
1. 前端建立WebSocket连接
2. 后端注册客户端到Hub
3. 数据聚合器每5秒采集一次数据
4. 聚合系统指标（日志总量、错误率、延迟、活跃服务）
5. 生成图表数据（时序图、饼图、柱状图、热力图）
6. 通过WebSocket广播到所有客户端
7. 前端接收数据并更新图表
8. 客户端断开时自动清理连接
```

**时序图**:

```
前端    WebSocket   Hub    Aggregator   ES/Prometheus
 │         │         │          │              │
 │─连接───→│         │          │              │
 │         │─注册───→│          │              │
 │         │         │          │              │
 │         │         │←─定时触发─              │
 │         │         │          │─采集指标────→│
 │         │         │          │←─返回数据────│
 │         │         │          │              │
 │         │         │          │─生成图表─    │
 │         │         │←─广播数据─              │
 │         │←─推送───│          │              │
 │←─更新UI─│         │          │              │
```

### 4.2 仪表盘保存流程

**流程步骤**:

```
1. 用户编辑仪表盘（拖拽、调整、配置）
2. 前端验证配置（组件数量、位置重叠）
3. 发送保存请求到API
4. 后端验证仪表盘配置
5. 保存当前版本到对象存储（历史版本）
6. 更新数据库记录（版本号+1）
7. 清除Redis缓存
8. 返回成功响应
9. 前端更新本地状态
```

**时序图**:

```
前端    API    Validator   DB    Storage   Redis
 │       │         │        │        │        │
 │─保存─→│         │        │        │        │
 │       │─验证───→│        │        │        │
 │       │←─通过───│        │        │        │
 │       │─────────保存历史版本─────→│        │
 │       │─────────更新记录──→       │        │
 │       │─────────────────清除缓存─→│        │
 │       │←────────成功──────────────│        │
 │←─成功─│         │        │        │        │
```

### 4.3 日志查询流程

**流程步骤**:

```
1. 用户输入查询条件（关键词、时间范围、过滤器）
2. 前端构建查询请求
3. 后端验证请求参数
4. 构建Elasticsearch查询DSL
5. 执行查询（包含聚合）
6. 解析查询结果
7. 应用语法高亮
8. 自动解析JSON日志
9. 缓存查询结果（60秒）
10. 返回结果到前端
11. 前端渲染日志列表和图表
```

**时序图**:

```
前端    API    Validator   ES    Parser   Redis
 │       │         │        │       │       │
 │─查询─→│         │        │       │       │
 │       │─验证───→│        │       │       │
 │       │←─通过───│        │       │       │
 │       │─────────查询────→│       │       │
 │       │←────────结果──────│       │       │
 │       │─────────────解析─→│       │       │
 │       │←────────高亮──────│       │       │
 │       │─────────────────缓存─────→│       │
 │←─结果─│         │        │       │       │
```

### 4.4 报告生成流程

**流程步骤**:

```
1. Cron调度器触发报告任务
2. 加载报告配置（模板、数据源、收件人）
3. 从各数据源采集数据（ES、Prometheus、PostgreSQL）
4. 聚合和计算统计数据
5. 使用模板引擎渲染HTML
6. 根据格式生成文件（PDF/Excel/HTML）
7. 保存到对象存储
8. 发送到收件人（邮件/Webhook）
9. 记录生成历史
10. 清理过期报告（90天）
```

**时序图**:

```
Scheduler  Service  DataAgg  Template  Generator  Storage  Distributor
    │         │        │         │         │         │         │
    │─触发───→│        │         │         │         │         │
    │         │─采集数据→        │         │         │         │
    │         │←─返回───│        │         │         │         │
    │         │─────────渲染────→│         │         │         │
    │         │←────────HTML─────│         │         │         │
    │         │─────────────────生成PDF───→│         │         │
    │         │←────────────────文件───────│         │         │
    │         │─────────────────────────保存→         │         │
    │         │─────────────────────────────发送─────→│         │
    │         │←────────────────────────────完成──────│         │
```

### 4.5 配置热更新流程

**流程步骤**:

```
1. 用户通过API修改配置
2. 配置保存到PostgreSQL（版本化）
3. 配置同步到Redis
4. Redis发布Pub/Sub通知（config:module6:reload）
5. 各服务订阅通知
6. 从Redis加载新配置
7. 验证配置合法性
8. 使用atomic.Value原子更新配置
9. 记录审计日志
10. 下次操作时生效
```

**时序图**:

```
API  PostgreSQL  Redis  Service1  Service2  AuditLog
 │       │        │        │         │         │
 │─保存配置→      │        │         │         │
 │       │─同步→  │        │         │         │
 │       │        │─发布通知→        │         │
 │       │        │        │─订阅→   │         │
 │       │        │        │─加载配置→         │
 │       │        │        │─验证→   │         │
 │       │        │        │─原子更新│         │
 │       │        │        │─────────记录审计→ │
 │       │        │        │←生效───│         │
```

### 4.6 异常流程

| 异常类型 | 处理策略 | 恢复机制 |
|----------|----------|----------|
| WebSocket断开 | 自动重连（指数退避） | 最多重试5次 |
| 数据聚合失败 | 使用上次有效值 | 记录错误日志 |
| 查询超时 | 返回超时错误 | 建议缩小查询范围 |
| 报告生成失败 | 重试3次 | 发送失败通知 |
| 配置验证失败 | 保持原配置 | 记录错误日志 |
| PDF生成超时 | 降级为HTML | 通知用户 |
| 缓存不可用 | 降级为直接查询 | 自动重连Redis |

---

## 5. 接口设计

详见 [API设计文档](./api-design.md) 模块6部分

### 5.1 API列表概览

模块6共提供 **53个API接口**，分为以下类别：

**实时监控管理** (8个接口):
- API-6-201: 建立WebSocket连接
- API-6-202: 获取实时指标
- API-6-203: 获取系统概览
- API-6-204: 获取活跃告警
- API-6-205: 配置监控刷新间隔
- API-6-206: 获取监控配置
- API-6-207: 切换主题
- API-6-208: 全屏模式切换

**仪表盘管理** (15个接口):
- API-6-209: 创建仪表盘
- API-6-210: 更新仪表盘
- API-6-211: 删除仪表盘
- API-6-212: 获取仪表盘列表
- API-6-213: 获取单个仪表盘
- API-6-214: 复制仪表盘
- API-6-215: 分享仪表盘
- API-6-216: 导出仪表盘
- API-6-217: 导入仪表盘
- API-6-218: 获取历史版本
- API-6-219: 恢复历史版本
- API-6-220: 获取预置模板
- API-6-221: 添加组件
- API-6-222: 更新组件
- API-6-223: 删除组件

**日志可视化** (12个接口):
- API-6-224: 查询日志
- API-6-225: 获取日志上下文
- API-6-226: 导出日志
- API-6-227: 创建书签
- API-6-228: 获取书签列表
- API-6-229: 删除书签
- API-6-230: 日志对比
- API-6-231: 获取日志聚合
- API-6-232: 获取字段统计
- API-6-233: 日志流订阅
- API-6-234: 配置日志查看器
- API-6-235: 获取查看器配置

**报告管理** (10个接口):
- API-6-236: 创建报告定义
- API-6-237: 更新报告定义
- API-6-238: 删除报告定义
- API-6-239: 获取报告列表
- API-6-240: 手动生成报告
- API-6-241: 获取报告历史
- API-6-242: 下载报告
- API-6-243: 预览报告
- API-6-244: 订阅报告
- API-6-245: 取消订阅

**告警规则管理（支持热更新）** (8个接口):
- API-6-246: 创建告警规则
- API-6-247: 更新告警规则
- API-6-248: 删除告警规则
- API-6-249: 获取告警规则列表
- API-6-250: 获取单个告警规则
- API-6-251: 启用/禁用告警规则
- API-6-252: 验证告警规则表达式
- API-6-253: 获取告警规则历史版本

### 5.2 核心接口示例

**建立WebSocket连接**:

```javascript
// 前端代码
const ws = new WebSocket('ws://api-server/api/v1/dashboard/realtime');

ws.onopen = () => {
  console.log('WebSocket连接已建立');
  // 发送订阅消息
  ws.send(JSON.stringify({
    type: 'subscribe',
    filters: {
      log_level: 'ERROR',
      time_range: '15m'
    }
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // 更新仪表盘数据
  updateDashboard(data);
};

ws.onerror = (error) => {
  console.error('WebSocket错误:', error);
};

ws.onclose = () => {
  console.log('WebSocket连接已关闭');
  // 自动重连
  setTimeout(reconnect, 5000);
};
```

**创建仪表盘**:

```http
POST /api/v1/dashboards
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "系统监控仪表盘",
  "description": "实时监控系统运行状态",
  "layout": {
    "type": "grid",
    "columns": 12,
    "row_height": 80,
    "gaps": 10
  },
  "components": [
    {
      "id": "comp-1",
      "type": "chart",
      "title": "日志趋势",
      "position": {
        "x": 0,
        "y": 0,
        "width": 6,
        "height": 4
      },
      "data_source": {
        "type": "elasticsearch",
        "query": "level:*",
        "params": {
          "time_range": "1h"
        }
      },
      "chart_config": {
        "type": "line",
        "options": {
          "smooth": true
        }
      },
      "refresh_interval": 30
    }
  ],
  "settings": {
    "theme": "light",
    "auto_refresh": true,
    "refresh_interval": 30,
    "time_range": "1h"
  },
  "permission": {
    "visibility": "team",
    "team_ids": ["team-001"]
  }
}

Response:
{
  "code": 0,
  "data": {
    "id": "dash-123456",
    "message": "仪表盘创建成功"
  }
}
```

**查询日志**:

```http
POST /api/v1/logs/query
Content-Type: application/json
Authorization: Bearer <token>

{
  "query": "level:ERROR AND service:api-server",
  "time_range": {
    "from": "2026-01-31T00:00:00Z",
    "to": "2026-01-31T23:59:59Z"
  },
  "filters": [
    {
      "field": "level",
      "operator": "eq",
      "value": "ERROR"
    }
  ],
  "sort": "desc",
  "page": 0,
  "page_size": 100,
  "highlight": true
}

Response:
{
  "code": 0,
  "data": {
    "total": 1523,
    "logs": [
      {
        "id": "log-001",
        "timestamp": "2026-01-31T10:30:00Z",
        "level": "ERROR",
        "message": "Database connection failed",
        "source": "api-server",
        "fields": {
          "trace_id": "trace-123",
          "user_id": "user-456"
        },
        "highlight": {
          "message": ["Database <mark>connection</mark> failed"]
        }
      }
    ],
    "aggregations": {
      "by_level": {
        "type": "terms",
        "buckets": [
          {"key": "ERROR", "doc_count": 1523},
          {"key": "WARN", "doc_count": 3421}
        ]
      }
    },
    "took": 245
  }
}
```

**生成报告**:

```http
POST /api/v1/reports/{report_id}/generate
Content-Type: application/json
Authorization: Bearer <token>

Response:
{
  "code": 0,
  "data": {
    "report_id": "report-123456",
    "file_name": "系统概览报告_20260131.pdf",
    "file_size": 2048576,
    "format": "pdf",
    "generated_at": "2026-01-31T10:00:00Z",
    "generation_time": 25.3,
    "download_url": "/api/v1/reports/download/report-123456"
  }
}
```

---

## 6. 数据设计

### 6.1 数据模型

**仪表盘数据模型**:

```go
// 仪表盘
type Dashboard struct {
    ID          string              `json:"id" db:"id"`
    Name        string              `json:"name" db:"name"`
    Description string              `json:"description" db:"description"`
    Layout      *DashboardLayout    `json:"layout" db:"layout"`
    Components  []*DashboardComponent `json:"components" db:"components"`
    Settings    *DashboardSettings  `json:"settings" db:"settings"`
    Permission  *DashboardPermission `json:"permission" db:"permission"`
    Version     int                 `json:"version" db:"version"`
    CreatedBy   string              `json:"created_by" db:"created_by"`
    CreatedAt   time.Time           `json:"created_at" db:"created_at"`
    UpdatedAt   time.Time           `json:"updated_at" db:"updated_at"`
}

// 仪表盘版本
type DashboardVersion struct {
    ID          int64     `json:"id" db:"id"`
    DashboardID string    `json:"dashboard_id" db:"dashboard_id"`
    Version     int       `json:"version" db:"version"`
    Data        []byte    `json:"data" db:"data"`
    CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

// 仪表盘分享
type DashboardShare struct {
    Token       string    `json:"token" db:"token"`
    DashboardID string    `json:"dashboard_id" db:"dashboard_id"`
    CreatedBy   string    `json:"created_by" db:"created_by"`
    CreatedAt   time.Time `json:"created_at" db:"created_at"`
    ExpiresAt   time.Time `json:"expires_at" db:"expires_at"`
}
```

**报告数据模型**:

```go
// 报告定义
type Report struct {
    ID          string              `json:"id" db:"id"`
    Name        string              `json:"name" db:"name"`
    Type        string              `json:"type" db:"type"`
    Schedule    *ReportSchedule     `json:"schedule" db:"schedule"`
    Template    string              `json:"template" db:"template"`
    DataSources []*DataSourceConfig `json:"data_sources" db:"data_sources"`
    Recipients  []*Recipient        `json:"recipients" db:"recipients"`
    Format      string              `json:"format" db:"format"`
    Enabled     bool                `json:"enabled" db:"enabled"`
    CreatedBy   string              `json:"created_by" db:"created_by"`
    CreatedAt   time.Time           `json:"created_at" db:"created_at"`
    UpdatedAt   time.Time           `json:"updated_at" db:"updated_at"`
}

// 报告历史
type ReportHistory struct {
    ID          string    `json:"id" db:"id"`
    ReportID    string    `json:"report_id" db:"report_id"`
    FileName    string    `json:"file_name" db:"file_name"`
    FileSize    int64     `json:"file_size" db:"file_size"`
    Format      string    `json:"format" db:"format"`
    Status      string    `json:"status" db:"status"`
    GeneratedAt time.Time `json:"generated_at" db:"generated_at"`
    Duration    float64   `json:"duration" db:"duration"`
    Error       string    `json:"error,omitempty" db:"error"`
}
```

### 6.2 数据库设计

**仪表盘表** (dashboards):

```sql
CREATE TABLE dashboards (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    layout JSONB NOT NULL,
    components JSONB NOT NULL DEFAULT '[]',
    settings JSONB NOT NULL DEFAULT '{}',
    permission JSONB NOT NULL DEFAULT '{}',
    version INT NOT NULL DEFAULT 1,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dashboards_created_by ON dashboards(created_by);
CREATE INDEX idx_dashboards_updated ON dashboards(updated_at DESC);
CREATE INDEX idx_dashboards_name ON dashboards(name);
```

**仪表盘版本表** (dashboard_versions):

```sql
CREATE TABLE dashboard_versions (
    id SERIAL PRIMARY KEY,
    dashboard_id VARCHAR(64) NOT NULL,
    version INT NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dashboard FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
);

CREATE INDEX idx_dashboard_versions_dashboard ON dashboard_versions(dashboard_id, version DESC);
```

**仪表盘分享表** (dashboard_shares):

```sql
CREATE TABLE dashboard_shares (
    token VARCHAR(64) PRIMARY KEY,
    dashboard_id VARCHAR(64) NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    CONSTRAINT fk_dashboard_share FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
);

CREATE INDEX idx_dashboard_shares_dashboard ON dashboard_shares(dashboard_id);
CREATE INDEX idx_dashboard_shares_expires ON dashboard_shares(expires_at);
```

**日志书签表** (log_bookmarks):

```sql
CREATE TABLE log_bookmarks (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    log_id VARCHAR(64) NOT NULL,
    note TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_log_bookmarks_user ON log_bookmarks(user_id, created_at DESC);
CREATE INDEX idx_log_bookmarks_log ON log_bookmarks(log_id);
```

**报告定义表** (reports):

```sql
CREATE TABLE reports (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(64) NOT NULL,
    schedule JSONB NOT NULL,
    template VARCHAR(255) NOT NULL,
    data_sources JSONB NOT NULL DEFAULT '[]',
    recipients JSONB NOT NULL DEFAULT '[]',
    format VARCHAR(32) NOT NULL DEFAULT 'pdf',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reports_type ON reports(type);
CREATE INDEX idx_reports_enabled ON reports(enabled);
CREATE INDEX idx_reports_created_by ON reports(created_by);
```

**报告历史表** (report_history):

```sql
CREATE TABLE report_history (
    id VARCHAR(64) PRIMARY KEY,
    report_id VARCHAR(64) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    format VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    duration FLOAT NOT NULL,
    error TEXT,
    CONSTRAINT fk_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);

CREATE INDEX idx_report_history_report ON report_history(report_id, generated_at DESC);
CREATE INDEX idx_report_history_status ON report_history(status);
CREATE INDEX idx_report_history_generated ON report_history(generated_at DESC);
```

**告警规则表** (alert_rules):

```sql
CREATE TABLE alert_rules (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    expr TEXT NOT NULL,
    for_duration VARCHAR(32),
    labels JSONB NOT NULL DEFAULT '{}',
    annotations JSONB NOT NULL DEFAULT '{}',
    category VARCHAR(64) NOT NULL DEFAULT 'custom',
    severity VARCHAR(32) NOT NULL DEFAULT 'warning',
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_severity CHECK (severity IN ('info', 'warning', 'critical'))
);

CREATE INDEX idx_alert_rules_category ON alert_rules(category);
CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled);
CREATE INDEX idx_alert_rules_severity ON alert_rules(severity);
CREATE INDEX idx_alert_rules_created_by ON alert_rules(created_by);
CREATE INDEX idx_alert_rules_updated ON alert_rules(updated_at DESC);
```

**告警规则历史表** (alert_rule_history):

```sql
CREATE TABLE alert_rule_history (
    id SERIAL PRIMARY KEY,
    rule_id VARCHAR(64) NOT NULL,
    version INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    expr TEXT NOT NULL,
    for_duration VARCHAR(32),
    labels JSONB NOT NULL DEFAULT '{}',
    annotations JSONB NOT NULL DEFAULT '{}',
    changed_by VARCHAR(255) NOT NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    change_type VARCHAR(32) NOT NULL,
    CONSTRAINT check_change_type CHECK (change_type IN ('create', 'update', 'delete'))
);

CREATE INDEX idx_alert_rule_history_rule_id ON alert_rule_history(rule_id);
CREATE INDEX idx_alert_rule_history_changed_at ON alert_rule_history(changed_at DESC);
```

### 6.3 缓存设计

**Redis缓存键设计**:

| 缓存键 | 类型 | TTL | 说明 |
|--------|------|-----|------|
| `config:dashboard` | String | - | 仪表盘配置（持久化） |
| `config:log_viewer` | String | - | 日志查看器配置（持久化） |
| `config:report` | String | - | 报告配置（持久化） |
| `dashboard:{id}` | String | 5m | 仪表盘详情缓存 |
| `dashboard:list:{user_id}` | List | 1m | 用户仪表盘列表 |
| `log:query:{hash}` | String | 1m | 日志查询结果缓存 |
| `log:context:{log_id}` | String | 5m | 日志上下文缓存 |
| `report:template:{name}` | String | 1h | 报告模板缓存 |
| `report:data:{report_id}` | String | 10m | 报告数据缓存 |
| `ws:clients` | Set | - | WebSocket客户端列表 |
| `metrics:realtime` | Hash | 5s | 实时指标数据 |

**缓存更新策略**:

1. **配置缓存**: 写入时更新，通过Pub/Sub通知所有节点
2. **仪表盘缓存**: 写入时失效，读取时重建（Cache-Aside模式）
3. **查询缓存**: LRU淘汰，TTL过期自动删除
4. **实时指标**: 定时更新（5秒），过期自动删除

### 6.4 索引设计

**Elasticsearch索引优化**:

```json
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1,
    "refresh_interval": "5s",
    "index": {
      "max_result_window": 100000
    }
  },
  "mappings": {
    "properties": {
      "@timestamp": {
        "type": "date",
        "format": "strict_date_optional_time||epoch_millis"
      },
      "level": {
        "type": "keyword"
      },
      "source": {
        "type": "keyword"
      },
      "message": {
        "type": "text",
        "analyzer": "standard",
        "fields": {
          "keyword": {
            "type": "keyword",
            "ignore_above": 256
          }
        }
      },
      "trace_id": {
        "type": "keyword"
      },
      "user_id": {
        "type": "keyword"
      },
      "fields": {
        "type": "object",
        "enabled": true
      }
    }
  }
}
```

**常用查询字段索引**:
- `@timestamp`: 时间范围查询（必须）
- `level`: 日志级别过滤
- `source`: 服务名称过滤
- `trace_id`: 链路追踪
- `user_id`: 用户行为分析

---

## 7. 安全设计

### 7.1 认证授权

**API认证**:
- 使用JWT Token进行身份认证
- Token有效期: 24小时
- 支持Token刷新机制
- 支持SSO单点登录集成

**权限控制**:

| 权限范围 | 权限说明 | 适用角色 |
|---------|---------|---------|
| dashboard.read | 查看仪表盘 | 所有用户 |
| dashboard.write | 创建/编辑仪表盘 | 开发、运维 |
| dashboard.delete | 删除仪表盘 | 仪表盘创建者、管理员 |
| dashboard.share | 分享仪表盘 | 仪表盘创建者、管理员 |
| log.read | 查看日志 | 所有用户 |
| log.export | 导出日志 | 开发、运维、管理员 |
| report.read | 查看报告 | 所有用户 |
| report.write | 创建/编辑报告 | 运维、管理员 |
| report.generate | 手动生成报告 | 运维、管理员 |
| config.read | 查看配置 | 开发、运维、管理员 |
| config.write | 修改配置 | 管理员 |

### 7.2 数据安全

**敏感数据加密**:
- 仪表盘分享令牌使用AES-256加密存储
- 报告收件人邮箱使用单向哈希存储
- WebSocket连接使用TLS加密
- 数据库连接使用SSL/TLS

**传输安全**:
- 所有API通信使用HTTPS/TLS 1.3
- WebSocket使用WSS（WebSocket Secure）
- 内部服务间通信使用mTLS
- Redis连接使用TLS加密

**数据脱敏**:
- 日志中的敏感信息自动脱敏（IP、邮箱、手机号）
- 导出日志时可选择脱敏级别
- 报告中的个人信息按需脱敏

### 7.3 审计日志

**审计事件**:

| 事件类型 | 记录内容 | 保留期限 |
|---------|---------|---------|
| 仪表盘创建 | 操作人、仪表盘名称、时间戳 | 1年 |
| 仪表盘修改 | 操作人、变更内容、版本号 | 1年 |
| 仪表盘删除 | 操作人、仪表盘名称、时间戳 | 1年 |
| 仪表盘分享 | 操作人、分享对象、过期时间 | 1年 |
| 日志查询 | 用户、查询条件、结果数量 | 90天 |
| 日志导出 | 用户、导出范围、格式 | 1年 |
| 报告生成 | 报告类型、生成时间、状态 | 1年 |
| 配置变更 | 操作人、变更前后值、时间戳 | 1年 |

**审计日志格式**:

```json
{
  "event_id": "audit-123456",
  "event_type": "dashboard_create",
  "user_id": "user-001",
  "user_name": "admin@example.com",
  "timestamp": "2026-01-31T10:30:00Z",
  "resource_type": "dashboard",
  "resource_id": "dash-123456",
  "action": "create",
  "details": {
    "dashboard_name": "系统监控仪表盘",
    "components_count": 5
  },
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0..."
}
```

### 7.4 安全加固

**API限流**:
- 每用户: 100请求/分钟
- 每IP: 1000请求/分钟
- WebSocket连接: 10个/用户
- 日志导出: 5次/小时/用户

**防护措施**:
- SQL注入防护: 使用参数化查询
- XSS防护: 输出转义、CSP策略
- CSRF防护: Token验证
- 点击劫持防护: X-Frame-Options
- DDoS防护: 限流 + WAF

**安全审计**:
- 定期安全扫描（每周）
- 漏洞修复SLA: 高危24小时、中危7天、低危30天
- 安全事件响应流程
- 定期渗透测试（每季度）

---

## 8. 性能设计

### 8.1 性能指标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| WebSocket推送延迟 | < 2秒 | 数据生成到前端接收的时间差 |
| 仪表盘加载时间 | < 500ms (缓存命中) | 请求到响应的时间 |
| 仪表盘保存时间 | < 500ms | 保存请求到成功响应 |
| 日志查询延迟 | < 500ms (P95) | 查询请求到返回结果 |
| 日志导出时间 | < 30秒 (10万条) | 导出请求到文件生成 |
| 报告生成时间 | < 30秒 | 触发到PDF生成完成 |
| 配置热更新生效时间 | < 30秒 | 配置变更到所有节点生效 |
| WebSocket并发连接数 | >= 1000 | 单节点支持的连接数 |
| 日志查询并发数 | >= 100 | 同时执行的查询数 |
| 缓存命中率 | >= 60% | Redis缓存命中次数/总请求 |

### 8.2 优化策略

**实时监控优化**:

1. **WebSocket连接优化**
   - 使用连接池复用TCP连接
   - 实现心跳机制，及时清理断开连接
   - 使用二进制协议（MessagePack）减少传输量
   - 客户端级别的数据过滤，减少无效推送

2. **数据聚合优化**
   - 使用滑动窗口聚合，避免重复计算
   - 预聚合常用指标，减少实时计算
   - 使用Redis缓存聚合结果（5秒TTL）
   - 异步聚合，不阻塞主流程

3. **图表渲染优化**
   - 前端使用虚拟滚动，减少DOM节点
   - 图表数据降采样，减少渲染点数
   - 使用Canvas渲染替代SVG（大数据量）
   - 实现图表懒加载，按需渲染

**仪表盘优化**:

1. **加载优化**
   - Redis缓存仪表盘配置（5分钟）
   - 组件数据并行加载
   - 使用CDN加速静态资源
   - 实现骨架屏，提升感知性能

2. **保存优化**
   - 异步保存历史版本到对象存储
   - 批量更新组件配置
   - 使用乐观锁避免冲突
   - 延迟清除缓存（写入后100ms）

3. **版本管理优化**
   - 历史版本存储到对象存储（S3/MinIO）
   - 只保留最近10个版本
   - 版本数据压缩存储
   - 按需加载历史版本

**日志查询优化**:

1. **查询优化**
   - 使用查询缓存（1分钟TTL）
   - 查询改写，优化执行计划
   - 限制查询时间范围（最大7天）
   - 使用Elasticsearch的scroll API分页

2. **索引优化**
   - 热数据使用SSD存储
   - 定期合并小段（segment）
   - 删除无用字段索引
   - 使用索引生命周期管理（ILM）

3. **导出优化**
   - 流式导出，避免内存溢出
   - 使用goroutine并发处理
   - 压缩导出文件（gzip）
   - 限制单次导出数量（10万条）

**报告生成优化**:

1. **数据采集优化**
   - 并行采集多个数据源
   - 使用缓存避免重复查询
   - 增量计算，复用历史数据
   - 设置采集超时（10秒）

2. **渲染优化**
   - 使用模板缓存（1小时）
   - 预编译模板，减少解析时间
   - 图表预渲染为图片
   - 使用Chromium无头模式生成PDF

3. **分发优化**
   - 异步发送邮件
   - 使用消息队列削峰
   - 批量发送，减少连接开销
   - 失败重试机制（最多3次）

### 8.3 容量规划

**前端服务**:

| 组件 | 副本数 | CPU | 内存 | 说明 |
|------|--------|-----|------|------|
| React应用 | 3 | 1核 | 2GB | Nginx托管 |
| WebSocket服务 | 3 | 2核 | 4GB | 支持3000并发连接 |

**后端服务**:

| 组件 | 副本数 | CPU | 内存 | 存储 | 说明 |
|------|--------|-----|------|------|------|
| API Server | 3 | 2核 | 4GB | - | 处理HTTP请求 |
| Report Generator | 2 | 4核 | 8GB | 50GB | PDF生成 |
| Data Aggregator | 3 | 2核 | 4GB | - | 数据聚合 |

**数据存储**:

| 组件 | 副本数 | CPU | 内存 | 存储 | 说明 |
|------|--------|-----|------|------|------|
| PostgreSQL | 3 | 4核 | 16GB | 500GB | 主从复制 |
| Redis | 3 | 2核 | 8GB | 50GB | 集群模式 |
| Elasticsearch | 3 | 8核 | 32GB | 2TB | 日志存储 |
| MinIO | 3 | 2核 | 4GB | 1TB | 对象存储 |

**容量增长预测**:

- 仪表盘数量增长: 每月10%
- 日志查询量增长: 每月15%
- 报告数量增长: 每月5%
- 存储需求: 每月增加50GB
- 建议每季度评估容量，提前扩容

### 8.4 性能测试

**压力测试场景**:

1. **WebSocket压力测试**
   - 模拟1000个并发连接
   - 验证推送延迟 < 2秒
   - 验证连接稳定性（24小时）

2. **仪表盘压力测试**
   - 模拟100并发加载仪表盘
   - 验证加载时间 < 500ms (P95)
   - 验证缓存命中率 >= 60%

3. **日志查询压力测试**
   - 模拟100并发查询
   - 验证查询延迟 < 500ms (P95)
   - 验证查询超时率 < 1%

4. **报告生成压力测试**
   - 模拟10个并发报告生成
   - 验证生成时间 < 30秒
   - 验证生成成功率 >= 99%

**性能基准**:

```bash
# WebSocket压力测试
artillery run websocket-load-test.yml
# 预期: 1000并发，延迟 < 2秒

# 仪表盘加载测试
ab -n 1000 -c 100 http://api-server/api/v1/dashboards/dash-001
# 预期: P95 < 500ms

# 日志查询测试
ab -n 1000 -c 100 -p query.json http://api-server/api/v1/logs/query
# 预期: P95 < 500ms

# 报告生成测试
for i in {1..10}; do
  curl -X POST http://api-server/api/v1/reports/report-001/generate &
done
# 预期: 全部在30秒内完成
```

---

## 9. 部署方案

### 9.1 部署架构

**Kubernetes部署架构**:

```
┌─────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Namespace: visualization                           │   │
│  │  ┌──────────────┐  ┌──────────────┐                │   │
│  │  │ Frontend     │  │ WebSocket    │                │   │
│  │  │ Deployment   │  │ Deployment   │                │   │
│  │  │ (3 replicas) │  │ (3 replicas) │                │   │
│  │  └──────────────┘  └──────────────┘                │   │
│  │  ┌──────────────┐  ┌──────────────┐                │   │
│  │  │ API Server   │  │ Report Gen   │                │   │
│  │  │ Deployment   │  │ Deployment   │                │   │
│  │  │ (3 replicas) │  │ (2 replicas) │                │   │
│  │  └──────────────┘  └──────────────┘                │   │
│  │  ┌──────────────┐                                  │   │
│  │  │ Ingress      │                                  │   │
│  │  │ (Nginx)      │                                  │   │
│  │  └──────────────┘                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Namespace: data                                    │   │
│  │  ┌──────────────┐  ┌──────────────┐                │   │
│  │  │ PostgreSQL   │  │  Redis       │                │   │
│  │  │ StatefulSet  │  │  StatefulSet │                │   │
│  │  │ (3 replicas) │  │  (3 replicas)│                │   │
│  │  └──────────────┘  └──────────────┘                │   │
│  │  ┌──────────────┐                                  │   │
│  │  │ MinIO        │                                  │   │
│  │  │ StatefulSet  │                                  │   │
│  │  │ (3 replicas) │                                  │   │
│  │  └──────────────┘                                  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 资源配置

**生产环境配置**:

| 组件 | 副本数 | CPU请求 | CPU限制 | 内存请求 | 内存限制 | 存储 |
|------|--------|---------|---------|----------|----------|------|
| Frontend | 3 | 0.5核 | 1核 | 1GB | 2GB | - |
| WebSocket | 3 | 1核 | 2核 | 2GB | 4GB | - |
| API Server | 3 | 1核 | 2核 | 2GB | 4GB | - |
| Report Generator | 2 | 2核 | 4核 | 4GB | 8GB | 50GB |
| Data Aggregator | 3 | 1核 | 2核 | 2GB | 4GB | - |
| PostgreSQL | 3 | 2核 | 4核 | 8GB | 16GB | 500GB |
| Redis | 3 | 1核 | 2核 | 4GB | 8GB | 50GB |
| MinIO | 3 | 1核 | 2核 | 2GB | 4GB | 1TB |

**测试环境配置**:

| 组件 | 副本数 | CPU | 内存 | 存储 |
|------|--------|-----|------|------|
| Frontend | 1 | 0.5核 | 1GB | - |
| WebSocket | 1 | 1核 | 2GB | - |
| API Server | 1 | 1核 | 2GB | - |
| Report Generator | 1 | 2核 | 4GB | 10GB |
| PostgreSQL | 1 | 2核 | 4GB | 100GB |
| Redis | 1 | 1核 | 2GB | 10GB |
| MinIO | 1 | 1核 | 2GB | 100GB |

### 9.3 Helm Chart配置

**values.yaml**:

```yaml
# 前端配置
frontend:
  enabled: true
  replicas: 3
  image:
    repository: log-management/frontend
    tag: v1.0.0
  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: 1
      memory: 2Gi
  service:
    type: ClusterIP
    port: 80

# WebSocket配置
websocket:
  enabled: true
  replicas: 3
  image:
    repository: log-management/websocket
    tag: v1.0.0
  resources:
    requests:
      cpu: 1
      memory: 2Gi
    limits:
      cpu: 2
      memory: 4Gi
  config:
    maxConnections: 1000
    heartbeatInterval: 30

# API Server配置
apiServer:
  enabled: true
  replicas: 3
  image:
    repository: log-management/api-server
    tag: v1.0.0
  resources:
    requests:
      cpu: 1
      memory: 2Gi
    limits:
      cpu: 2
      memory: 4Gi

# 报告生成器配置
reportGenerator:
  enabled: true
  replicas: 2
  image:
    repository: log-management/report-generator
    tag: v1.0.0
  resources:
    requests:
      cpu: 2
      memory: 4Gi
    limits:
      cpu: 4
      memory: 8Gi
  persistence:
    enabled: true
    size: 50Gi
    storageClass: fast-ssd

# PostgreSQL配置
postgresql:
  enabled: true
  replicas: 3
  image:
    repository: postgres
    tag: 15-alpine
  resources:
    requests:
      cpu: 2
      memory: 8Gi
    limits:
      cpu: 4
      memory: 16Gi
  persistence:
    enabled: true
    size: 500Gi
    storageClass: fast-ssd

# Redis配置
redis:
  enabled: true
  cluster:
    enabled: true
    nodes: 3
  resources:
    requests:
      cpu: 1
      memory: 4Gi
    limits:
      cpu: 2
      memory: 8Gi
  persistence:
    enabled: true
    size: 50Gi

# MinIO配置
minio:
  enabled: true
  replicas: 3
  resources:
    requests:
      cpu: 1
      memory: 2Gi
    limits:
      cpu: 2
      memory: 4Gi
  persistence:
    enabled: true
    size: 1Ti
    storageClass: standard

# Ingress配置
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: dashboard.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: dashboard-tls
      hosts:
        - dashboard.example.com
```

### 9.4 发布策略

**滚动更新策略**:

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1        # 最多额外创建1个Pod
    maxUnavailable: 0  # 更新期间保持所有Pod可用
```

**发布流程**:

1. **预发布检查**
   - 配置验证
   - 资源检查
   - 依赖服务健康检查
   - 数据库迁移脚本验证

2. **灰度发布**
   - 先更新1个Pod
   - 观察5分钟
   - 检查错误日志和监控指标
   - 无异常后继续

3. **全量发布**
   - 逐个更新剩余Pod
   - 每个Pod更新后等待就绪探针通过
   - 健康检查通过后继续下一个
   - 全部更新完成后验证

4. **发布验证**
   - 功能冒烟测试
   - 性能基准测试
   - 监控指标检查
   - 用户反馈收集

5. **回滚准备**
   - 保留上一版本镜像
   - 准备回滚脚本
   - 设置自动回滚触发条件（错误率>5%）

### 9.5 部署命令

**安装部署**:

```bash
# 添加Helm仓库
helm repo add log-management https://charts.example.com/log-management
helm repo update

# 创建命名空间
kubectl create namespace visualization
kubectl create namespace data

# 安装可视化模块
helm install visualization log-management/visualization \
  --namespace visualization \
  -f values-production.yaml \
  --wait \
  --timeout 10m

# 验证部署
kubectl get pods -n visualization
kubectl get pods -n data
kubectl get ingress -n visualization
```

**升级部署**:

```bash
# 升级配置
helm upgrade visualization log-management/visualization \
  --namespace visualization \
  -f values-production.yaml \
  --wait \
  --timeout 10m

# 查看升级状态
helm status visualization -n visualization
helm history visualization -n visualization
```

**回滚部署**:

```bash
# 查看历史版本
helm history visualization -n visualization

# 回滚到上一版本
helm rollback visualization -n visualization

# 回滚到指定版本
helm rollback visualization 3 -n visualization
```

**健康检查**:

```bash
# 检查Pod状态
kubectl get pods -n visualization -o wide

# 检查服务状态
kubectl get svc -n visualization

# 检查日志
kubectl logs -n visualization -l app=api-server --tail=100

# 检查事件
kubectl get events -n visualization --sort-by='.lastTimestamp'
```

---

## 10. 监控与运维

### 10.1 监控指标

**WebSocket指标**:

```prometheus
# WebSocket连接数
websocket_connections_total{status="active|idle"}

# WebSocket消息发送数
websocket_messages_sent_total{type="data|heartbeat"}

# WebSocket消息延迟
websocket_message_latency_seconds{quantile="0.5|0.95|0.99"}

# WebSocket连接错误
websocket_connection_errors_total{reason="timeout|closed|error"}

# WebSocket带宽使用
websocket_bandwidth_bytes_per_second{direction="in|out"}
```

**仪表盘指标**:

```prometheus
# 仪表盘操作数
dashboard_operations_total{operation="create|update|delete|load"}

# 仪表盘加载延迟
dashboard_load_duration_seconds{quantile="0.5|0.95|0.99"}

# 仪表盘缓存命中率
dashboard_cache_hit_rate_percent

# 仪表盘版本数
dashboard_versions_total

# 仪表盘分享数
dashboard_shares_total{status="active|expired"}
```

**日志查询指标**:

```prometheus
# 日志查询数
log_query_requests_total{status="success|error|timeout"}

# 日志查询延迟
log_query_duration_seconds{quantile="0.5|0.95|0.99"}

# 日志导出数
log_export_requests_total{format="txt|csv|json"}

# 日志导出大小
log_export_size_bytes

# 日志书签数
log_bookmarks_total
```

**报告指标**:

```prometheus
# 报告生成数
report_generation_total{status="success|failed"}

# 报告生成延迟
report_generation_duration_seconds

# 报告大小
report_size_bytes{format="pdf|excel|html"}

# 报告分发数
report_distribution_total{channel="email|webhook"}

# 报告订阅数
report_subscriptions_total
```

### 10.2 告警规则（支持热更新）

**告警规则热更新机制**:

模块6的告警规则支持通过API动态更新，无需重启Prometheus：

1. 用户通过API创建/修改告警规则
2. 规则保存到PostgreSQL（版本化）
3. 规则同步到Redis
4. 告警管理器订阅Redis通知
5. 动态生成Prometheus规则文件
6. 通过Prometheus HTTP API重载规则（`POST /-/reload`）
7. 规则立即生效，无需重启

**内置告警规则**:

**WebSocket告警**:

```yaml
groups:
  - name: websocket
    interval: 30s
    rules:
      # WebSocket连接数过高
      - alert: HighWebSocketConnections
        expr: websocket_connections_total{status="active"} > 800
        for: 5m
        labels:
          severity: warning
          category: websocket
        annotations:
          summary: "WebSocket连接数过高"
          description: "当前连接数 {{ $value }}，接近上限1000"
          runbook_url: "https://wiki.example.com/runbooks/high-ws-connections"
      
      # WebSocket消息延迟高
      - alert: HighWebSocketLatency
        expr: websocket_message_latency_seconds{quantile="0.95"} > 2
        for: 5m
        labels:
          severity: warning
          category: websocket
        annotations:
          summary: "WebSocket消息延迟过高"
          description: "P95延迟 {{ $value }}秒，超过2秒阈值"
          runbook_url: "https://wiki.example.com/runbooks/high-ws-latency"
      
      # WebSocket连接错误率高
      - alert: HighWebSocketErrorRate
        expr: rate(websocket_connection_errors_total[5m]) > 10
        for: 5m
        labels:
          severity: critical
          category: websocket
        annotations:
          summary: "WebSocket连接错误率高"
          description: "错误率 {{ $value }}/秒"
          runbook_url: "https://wiki.example.com/runbooks/high-ws-errors"
```

**仪表盘告警**:

```yaml
groups:
  - name: dashboard
    interval: 30s
    rules:
      # 仪表盘加载延迟高
      - alert: HighDashboardLoadLatency
        expr: dashboard_load_duration_seconds{quantile="0.95"} > 1
        for: 5m
        labels:
          severity: warning
          category: dashboard
        annotations:
          summary: "仪表盘加载延迟过高"
          description: "P95加载延迟 {{ $value }}秒，超过500ms目标"
          runbook_url: "https://wiki.example.com/runbooks/high-dashboard-latency"
      
      # 仪表盘缓存命中率低
      - alert: LowDashboardCacheHitRate
        expr: dashboard_cache_hit_rate_percent < 50
        for: 10m
        labels:
          severity: warning
          category: dashboard
        annotations:
          summary: "仪表盘缓存命中率低"
          description: "缓存命中率 {{ $value }}%，低于60%目标"
          runbook_url: "https://wiki.example.com/runbooks/low-cache-hit"
```

**日志查询告警**:

```yaml
groups:
  - name: log_query
    interval: 30s
    rules:
      # 日志查询延迟高
      - alert: HighLogQueryLatency
        expr: log_query_duration_seconds{quantile="0.95"} > 1
        for: 5m
        labels:
          severity: warning
          category: query
        annotations:
          summary: "日志查询延迟过高"
          description: "P95查询延迟 {{ $value }}秒，超过500ms目标"
          runbook_url: "https://wiki.example.com/runbooks/high-query-latency"
      
      # 日志查询超时率高
      - alert: HighLogQueryTimeoutRate
        expr: rate(log_query_requests_total{status="timeout"}[5m]) / rate(log_query_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
          category: query
        annotations:
          summary: "日志查询超时率高"
          description: "超时率 {{ $value | humanizePercentage }}，超过5%阈值"
          runbook_url: "https://wiki.example.com/runbooks/high-timeout-rate"
```

**报告生成告警**:

```yaml
groups:
  - name: report
    interval: 30s
    rules:
      # 报告生成失败率高
      - alert: HighReportFailureRate
        expr: rate(report_generation_total{status="failed"}[5m]) / rate(report_generation_total[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
          category: report
        annotations:
          summary: "报告生成失败率高"
          description: "失败率 {{ $value | humanizePercentage }}，超过10%阈值"
          runbook_url: "https://wiki.example.com/runbooks/high-report-failure"
      
      # 报告生成时间过长
      - alert: SlowReportGeneration
        expr: report_generation_duration_seconds > 60
        for: 1m
        labels:
          severity: warning
          category: report
        annotations:
          summary: "报告生成时间过长"
          description: "生成耗时 {{ $value }}秒，超过30秒目标"
          runbook_url: "https://wiki.example.com/runbooks/slow-report-gen"
```

**自定义告警规则管理**:

```go
// internal/visualization/alerting/rule_manager.go
package alerting

import (
    "context"
    "encoding/json"
    "fmt"
    "os"
    "sync"
    "time"
)

// 告警规则管理器
type AlertRuleManager struct {
    config         *AlertConfig
    db             *PostgreSQL
    redis          *Redis
    prometheus     *PrometheusClient
    ruleFile       string
    mu             sync.RWMutex
    rules          map[string]*AlertRule
}

// 告警规则
type AlertRule struct {
    ID          string            `json:"id" db:"id"`
    Name        string            `json:"name" db:"name"`
    Enabled     bool              `json:"enabled" db:"enabled"`
    Expr        string            `json:"expr" db:"expr"`
    For         string            `json:"for" db:"for"`
    Labels      map[string]string `json:"labels" db:"labels"`
    Annotations map[string]string `json:"annotations" db:"annotations"`
    Category    string            `json:"category" db:"category"`
    Severity    string            `json:"severity" db:"severity"`
    CreatedBy   string            `json:"created_by" db:"created_by"`
    CreatedAt   time.Time         `json:"created_at" db:"created_at"`
    UpdatedAt   time.Time         `json:"updated_at" db:"updated_at"`
}

// 创建告警规则管理器
func NewAlertRuleManager(config *AlertConfig, db *PostgreSQL, redis *Redis, prometheus *PrometheusClient) (*AlertRuleManager, error) {
    arm := &AlertRuleManager{
        config:     config,
        db:         db,
        redis:      redis,
        prometheus: prometheus,
        ruleFile:   "/etc/prometheus/rules/module6_custom_rules.yml",
        rules:      make(map[string]*AlertRule),
    }
    
    // 从数据库加载规则
    if err := arm.loadRulesFromDB(); err != nil {
        return nil, err
    }
    
    return arm, nil
}

// 启动规则管理器
func (arm *AlertRuleManager) Start(ctx context.Context) error {
    // 订阅规则变更通知
    pubsub := arm.redis.Subscribe("alert:rules:module6:reload")
    
    go func() {
        for {
            select {
            case <-ctx.Done():
                return
            case msg := <-pubsub.Channel():
                arm.handleRuleChange(msg)
            }
        }
    }()
    
    log.Info("告警规则管理器已启动")
    return nil
}

// 创建告警规则
func (arm *AlertRuleManager) CreateRule(rule *AlertRule) error {
    arm.mu.Lock()
    defer arm.mu.Unlock()
    
    // 1. 验证规则
    if err := arm.validateRule(rule); err != nil {
        return fmt.Errorf("规则验证失败: %w", err)
    }
    
    // 2. 生成规则ID
    rule.ID = fmt.Sprintf("rule-%d", time.Now().UnixNano())
    rule.CreatedAt = time.Now()
    rule.UpdatedAt = time.Now()
    
    // 3. 保存到数据库
    if err := arm.db.SaveAlertRule(rule); err != nil {
        return fmt.Errorf("保存规则失败: %w", err)
    }
    
    // 4. 更新内存缓存
    arm.rules[rule.ID] = rule
    
    // 5. 重新生成规则文件
    if err := arm.generateRuleFile(); err != nil {
        return fmt.Errorf("生成规则文件失败: %w", err)
    }
    
    // 6. 重载Prometheus规则
    if err := arm.reloadPrometheusRules(); err != nil {
        return fmt.Errorf("重载Prometheus规则失败: %w", err)
    }
    
    // 7. 发布变更通知
    arm.redis.Publish("alert:rules:module6:reload", rule.ID)
    
    log.Infof("告警规则已创建: %s", rule.Name)
    return nil
}

// 更新告警规则
func (arm *AlertRuleManager) UpdateRule(ruleID string, updates *AlertRule) error {
    arm.mu.Lock()
    defer arm.mu.Unlock()
    
    // 1. 检查规则是否存在
    existing, ok := arm.rules[ruleID]
    if !ok {
        return fmt.Errorf("规则不存在: %s", ruleID)
    }
    
    // 2. 验证更新
    if err := arm.validateRule(updates); err != nil {
        return fmt.Errorf("规则验证失败: %w", err)
    }
    
    // 3. 合并更新
    updates.ID = ruleID
    updates.CreatedAt = existing.CreatedAt
    updates.CreatedBy = existing.CreatedBy
    updates.UpdatedAt = time.Now()
    
    // 4. 保存到数据库
    if err := arm.db.UpdateAlertRule(updates); err != nil {
        return fmt.Errorf("更新规则失败: %w", err)
    }
    
    // 5. 更新内存缓存
    arm.rules[ruleID] = updates
    
    // 6. 重新生成规则文件
    if err := arm.generateRuleFile(); err != nil {
        return fmt.Errorf("生成规则文件失败: %w", err)
    }
    
    // 7. 重载Prometheus规则
    if err := arm.reloadPrometheusRules(); err != nil {
        return fmt.Errorf("重载Prometheus规则失败: %w", err)
    }
    
    // 8. 发布变更通知
    arm.redis.Publish("alert:rules:module6:reload", ruleID)
    
    log.Infof("告警规则已更新: %s", updates.Name)
    return nil
}

// 删除告警规则
func (arm *AlertRuleManager) DeleteRule(ruleID string) error {
    arm.mu.Lock()
    defer arm.mu.Unlock()
    
    // 1. 检查规则是否存在
    if _, ok := arm.rules[ruleID]; !ok {
        return fmt.Errorf("规则不存在: %s", ruleID)
    }
    
    // 2. 从数据库删除
    if err := arm.db.DeleteAlertRule(ruleID); err != nil {
        return fmt.Errorf("删除规则失败: %w", err)
    }
    
    // 3. 从内存删除
    delete(arm.rules, ruleID)
    
    // 4. 重新生成规则文件
    if err := arm.generateRuleFile(); err != nil {
        return fmt.Errorf("生成规则文件失败: %w", err)
    }
    
    // 5. 重载Prometheus规则
    if err := arm.reloadPrometheusRules(); err != nil {
        return fmt.Errorf("重载Prometheus规则失败: %w", err)
    }
    
    // 6. 发布变更通知
    arm.redis.Publish("alert:rules:module6:reload", ruleID)
    
    log.Infof("告警规则已删除: %s", ruleID)
    return nil
}

// 验证告警规则
func (arm *AlertRuleManager) validateRule(rule *AlertRule) error {
    // 验证名称
    if rule.Name == "" {
        return fmt.Errorf("规则名称不能为空")
    }
    
    // 验证表达式
    if rule.Expr == "" {
        return fmt.Errorf("规则表达式不能为空")
    }
    
    // 验证表达式语法（通过Prometheus API）
    if err := arm.prometheus.ValidateExpr(rule.Expr); err != nil {
        return fmt.Errorf("表达式语法错误: %w", err)
    }
    
    // 验证持续时间
    if rule.For != "" {
        if _, err := time.ParseDuration(rule.For); err != nil {
            return fmt.Errorf("持续时间格式错误: %w", err)
        }
    }
    
    // 验证严重级别
    validSeverities := map[string]bool{
        "info":     true,
        "warning":  true,
        "critical": true,
    }
    if !validSeverities[rule.Severity] {
        return fmt.Errorf("无效的严重级别: %s", rule.Severity)
    }
    
    return nil
}

// 生成Prometheus规则文件
func (arm *AlertRuleManager) generateRuleFile() error {
    // 按类别分组规则
    groups := make(map[string][]*AlertRule)
    
    for _, rule := range arm.rules {
        if !rule.Enabled {
            continue
        }
        
        category := rule.Category
        if category == "" {
            category = "custom"
        }
        
        groups[category] = append(groups[category], rule)
    }
    
    // 生成YAML格式
    var yamlContent string
    yamlContent += "groups:\n"
    
    for category, rules := range groups {
        yamlContent += fmt.Sprintf("  - name: %s_custom\n", category)
        yamlContent += "    interval: 30s\n"
        yamlContent += "    rules:\n"
        
        for _, rule := range rules {
            yamlContent += fmt.Sprintf("      - alert: %s\n", rule.Name)
            yamlContent += fmt.Sprintf("        expr: %s\n", rule.Expr)
            
            if rule.For != "" {
                yamlContent += fmt.Sprintf("        for: %s\n", rule.For)
            }
            
            if len(rule.Labels) > 0 {
                yamlContent += "        labels:\n"
                for k, v := range rule.Labels {
                    yamlContent += fmt.Sprintf("          %s: %s\n", k, v)
                }
            }
            
            if len(rule.Annotations) > 0 {
                yamlContent += "        annotations:\n"
                for k, v := range rule.Annotations {
                    yamlContent += fmt.Sprintf("          %s: \"%s\"\n", k, v)
                }
            }
        }
    }
    
    // 写入文件
    if err := os.WriteFile(arm.ruleFile, []byte(yamlContent), 0644); err != nil {
        return fmt.Errorf("写入规则文件失败: %w", err)
    }
    
    log.Infof("规则文件已生成: %s", arm.ruleFile)
    return nil
}

// 重载Prometheus规则
func (arm *AlertRuleManager) reloadPrometheusRules() error {
    // 调用Prometheus HTTP API重载规则
    if err := arm.prometheus.Reload(); err != nil {
        return fmt.Errorf("重载失败: %w", err)
    }
    
    log.Info("Prometheus规则已重载")
    return nil
}

// 处理规则变更
func (arm *AlertRuleManager) handleRuleChange(msg *redis.Message) {
    log.Infof("收到规则变更通知: %s", msg.Payload)
    
    // 从数据库重新加载规则
    if err := arm.loadRulesFromDB(); err != nil {
        log.Errorf("重新加载规则失败: %v", err)
        return
    }
    
    // 重新生成规则文件
    if err := arm.generateRuleFile(); err != nil {
        log.Errorf("生成规则文件失败: %v", err)
        return
    }
    
    log.Info("规则已重新加载")
}

// 从数据库加载规则
func (arm *AlertRuleManager) loadRulesFromDB() error {
    rules, err := arm.db.GetAllAlertRules()
    if err != nil {
        return err
    }
    
    arm.mu.Lock()
    defer arm.mu.Unlock()
    
    arm.rules = make(map[string]*AlertRule)
    for _, rule := range rules {
        arm.rules[rule.ID] = rule
    }
    
    return nil
}

// 获取所有规则
func (arm *AlertRuleManager) GetAllRules() []*AlertRule {
    arm.mu.RLock()
    defer arm.mu.RUnlock()
    
    rules := make([]*AlertRule, 0, len(arm.rules))
    for _, rule := range arm.rules {
        rules = append(rules, rule)
    }
    
    return rules
}

// 获取单个规则
func (arm *AlertRuleManager) GetRule(ruleID string) (*AlertRule, error) {
    arm.mu.RLock()
    defer arm.mu.RUnlock()
    
    rule, ok := arm.rules[ruleID]
    if !ok {
        return nil, fmt.Errorf("规则不存在: %s", ruleID)
    }
    
    return rule, nil
}
```

**自定义告警规则API**:

```http
# 创建告警规则
POST /api/v1/alerts/rules
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "CustomHighDashboardLatency",
  "enabled": true,
  "expr": "dashboard_load_duration_seconds{quantile=\"0.95\"} > 2",
  "for": "10m",
  "labels": {
    "severity": "critical",
    "category": "custom",
    "team": "frontend"
  },
  "annotations": {
    "summary": "自定义仪表盘延迟告警",
    "description": "仪表盘加载P95延迟 {{ $value }}秒，持续10分钟",
    "runbook_url": "https://wiki.example.com/runbooks/custom-dashboard-latency"
  },
  "category": "dashboard",
  "severity": "critical"
}

Response:
{
  "code": 0,
  "data": {
    "id": "rule-123456",
    "message": "告警规则已创建，Prometheus规则已重载"
  }
}

# 更新告警规则
PUT /api/v1/alerts/rules/{rule_id}
Content-Type: application/json
Authorization: Bearer <token>

{
  "enabled": true,
  "expr": "dashboard_load_duration_seconds{quantile=\"0.95\"} > 3",
  "for": "15m"
}

Response:
{
  "code": 0,
  "message": "告警规则已更新，Prometheus规则已重载"
}

# 删除告警规则
DELETE /api/v1/alerts/rules/{rule_id}
Authorization: Bearer <token>

Response:
{
  "code": 0,
  "message": "告警规则已删除，Prometheus规则已重载"
}

# 获取告警规则列表
GET /api/v1/alerts/rules?category=dashboard&enabled=true
Authorization: Bearer <token>

Response:
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": "rule-123456",
        "name": "CustomHighDashboardLatency",
        "enabled": true,
        "expr": "dashboard_load_duration_seconds{quantile=\"0.95\"} > 3",
        "for": "15m",
        "labels": {
          "severity": "critical",
          "category": "custom"
        },
        "annotations": {
          "summary": "自定义仪表盘延迟告警"
        },
        "created_at": "2026-01-31T10:00:00Z",
        "updated_at": "2026-01-31T11:00:00Z"
      }
    ],
    "total": 1
  }
}

# 验证告警规则表达式
POST /api/v1/alerts/rules/validate
Content-Type: application/json
Authorization: Bearer <token>

{
  "expr": "dashboard_load_duration_seconds{quantile=\"0.95\"} > 3"
}

Response:
{
  "code": 0,
  "data": {
    "valid": true,
    "message": "表达式语法正确"
  }
}

# 获取告警规则历史版本
GET /api/v1/alerts/rules/{rule_id}/history
Authorization: Bearer <token>

Response:
{
  "code": 0,
  "data": {
    "items": [
      {
        "version": 2,
        "expr": "dashboard_load_duration_seconds{quantile=\"0.95\"} > 3",
        "changed_by": "admin@example.com",
        "changed_at": "2026-01-31T11:00:00Z",
        "change_type": "update"
      },
      {
        "version": 1,
        "expr": "dashboard_load_duration_seconds{quantile=\"0.95\"} > 2",
        "changed_by": "admin@example.com",
        "changed_at": "2026-01-31T10:00:00Z",
        "change_type": "create"
      }
    ],
    "total": 2
  }
}
```

### 10.3 日志规范

**日志级别**:

| 级别 | 使用场景 | 示例 |
|------|---------|------|
| DEBUG | 详细调试信息 | "WebSocket消息: {data}" |
| INFO | 正常操作信息 | "仪表盘已创建: dash-123456" |
| WARN | 警告信息 | "缓存命中率低: 45%" |
| ERROR | 错误信息 | "报告生成失败: 模板不存在" |
| FATAL | 致命错误 | "数据库连接失败，服务退出" |

**日志格式**:

```json
{
  "timestamp": "2026-01-31T10:30:00.123Z",
  "level": "INFO",
  "module": "dashboard",
  "message": "仪表盘已创建",
  "context": {
    "dashboard_id": "dash-123456",
    "dashboard_name": "系统监控",
    "user_id": "user-001",
    "components_count": 5
  },
  "trace_id": "trace-123456",
  "span_id": "span-789"
}
```

### 10.4 运维手册

**日常运维任务**:

1. **每日检查**
   - 查看WebSocket连接数和延迟
   - 检查仪表盘加载性能
   - 查看日志查询延迟
   - 检查报告生成状态
   - 查看告警列表

2. **每周检查**
   - 审查缓存命中率
   - 分析慢查询列表
   - 检查存储使用情况
   - 清理过期数据
   - 性能趋势分析

3. **每月检查**
   - 容量规划评估
   - 成本分析
   - 安全审计
   - 用户反馈收集
   - 功能使用统计

**常见问题处理**:

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| WebSocket连接断开 | 网络不稳定 | 检查网络，调整心跳间隔 |
| 仪表盘加载慢 | 缓存失效 | 预热缓存，增加TTL |
| 日志查询超时 | 查询范围过大 | 限制时间范围，优化查询 |
| 报告生成失败 | 模板错误 | 检查模板语法，修复错误 |
| 缓存命中率低 | TTL设置过短 | 调整缓存TTL |
| 导出文件过大 | 数据量过多 | 限制导出数量，使用压缩 |

**应急响应流程**:

1. **P0级故障（服务不可用）**
   - 响应时间: 5分钟内
   - 处理流程: 立即回滚 → 恢复服务 → 分析原因
   - 通知: 所有相关人员
   - 示例: WebSocket服务全部宕机

2. **P1级故障（功能受损）**
   - 响应时间: 30分钟内
   - 处理流程: 评估影响 → 临时方案 → 根本修复
   - 通知: 运维团队
   - 示例: 报告生成失败率>50%

3. **P2级故障（性能下降）**
   - 响应时间: 2小时内
   - 处理流程: 分析原因 → 优化配置 → 验证效果
   - 通知: 值班人员
   - 示例: 仪表盘加载延迟>2秒

**备份与恢复**:

```bash
# 备份仪表盘配置
kubectl exec -n data postgresql-0 -- pg_dump -U postgres -t dashboards > dashboards-backup.sql

# 备份报告定义
kubectl exec -n data postgresql-0 -- pg_dump -U postgres -t reports > reports-backup.sql

# 备份Redis数据
kubectl exec -n data redis-0 -- redis-cli --rdb /tmp/dump.rdb
kubectl cp data/redis-0:/tmp/dump.rdb ./redis-backup.rdb

# 恢复仪表盘配置
kubectl cp dashboards-backup.sql data/postgresql-0:/tmp/
kubectl exec -n data postgresql-0 -- psql -U postgres < /tmp/dashboards-backup.sql

# 恢复Redis数据
kubectl cp redis-backup.rdb data/redis-0:/tmp/dump.rdb
kubectl exec -n data redis-0 -- redis-cli --rdb /tmp/dump.rdb
kubectl exec -n data redis-0 -- redis-cli SHUTDOWN SAVE
kubectl rollout restart statefulset/redis -n data
```

---

## 11. 配置热更新详细设计

### 11.1 可热更新配置项

**实时监控配置**:

| 配置项 | 类型 | 默认值 | 说明 | 更新方式 | 生效时间 | 是否推荐热更新 |
|--------|------|--------|------|----------|----------|---------------|
| refresh_interval | int | 5 | 刷新间隔（秒） | Redis Pub/Sub | 下次推送周期 | ✅ 推荐 |
| default_time_range | string | "15m" | 默认时间范围 | Redis Pub/Sub | 立即生效 | ✅ 推荐 |
| enabled_charts | array | ["timeseries","pie","bar"] | 启用的图表类型 | Redis Pub/Sub | 下次数据聚合 | ✅ 推荐 |
| theme | string | "light" | 主题（light/dark） | Redis Pub/Sub | 立即生效 | ✅ 推荐 |
| auto_refresh | bool | true | 是否自动刷新 | Redis Pub/Sub | 立即生效 | ✅ 推荐 |
| max_log_stream_size | int | 100 | 日志流最大条数 | Redis Pub/Sub | 下次推送 | ✅ 推荐 |
| cache_ttl | int | 5 | 缓存过期时间（秒） | Redis Pub/Sub | 下次缓存写入 | ✅ 推荐 |
| ws_heartbeat_interval | int | 30 | WebSocket心跳间隔（秒） | Redis Pub/Sub | 新连接生效 | ✅ 推荐 |

**仪表盘配置**:

| 配置项 | 类型 | 默认值 | 说明 | 更新方式 | 生效时间 | 是否推荐热更新 |
|--------|------|--------|------|----------|----------|---------------|
| max_components | int | 20 | 每个仪表盘最大组件数 | Redis Pub/Sub | 下次验证 | ✅ 推荐 |
| max_versions | int | 10 | 保留的历史版本数 | Redis Pub/Sub | 下次保存 | ✅ 推荐 |
| share_expiry_days | int | 30 | 分享链接有效期（天） | Redis Pub/Sub | 下次分享 | ✅ 推荐 |
| cache_ttl | int | 300 | 缓存过期时间（秒） | Redis Pub/Sub | 下次缓存写入 | ✅ 推荐 |
| default_layout_columns | int | 12 | 默认网格列数 | Redis Pub/Sub | 新仪表盘生效 | ✅ 推荐 |
| default_row_height | int | 80 | 默认行高（像素） | Redis Pub/Sub | 新仪表盘生效 | ✅ 推荐 |
| auto_save_interval | int | 30 | 自动保存间隔（秒） | Redis Pub/Sub | 立即生效 | ✅ 推荐 |

**日志查看器配置**:

| 配置项 | 类型 | 默认值 | 说明 | 更新方式 | 生效时间 | 是否推荐热更新 |
|--------|------|--------|------|----------|----------|---------------|
| max_page_size | int | 1000 | 最大分页大小 | Redis Pub/Sub | 下次查询 | ✅ 推荐 |
| max_export_size | int | 100000 | 最大导出数量 | Redis Pub/Sub | 下次导出 | ✅ 推荐 |
| context_size | int | 50 | 上下文大小 | Redis Pub/Sub | 下次上下文查询 | ✅ 推荐 |
| highlight_enabled | bool | true | 是否启用语法高亮 | Redis Pub/Sub | 下次查询 | ✅ 推荐 |
| auto_parse | bool | true | 是否自动解析JSON | Redis Pub/Sub | 下次查询 | ✅ 推荐 |
| cache_ttl | int | 60 | 缓存过期时间（秒） | Redis Pub/Sub | 下次缓存写入 | ✅ 推荐 |
| max_time_range_days | int | 7 | 最大查询时间范围（天） | Redis Pub/Sub | 下次查询 | ✅ 推荐 |

**报告配置**:

| 配置项 | 类型 | 默认值 | 说明 | 更新方式 | 生效时间 | 是否推荐热更新 |
|--------|------|--------|------|----------|----------|---------------|
| enabled | bool | true | 是否启用报告 | Redis Pub/Sub | 立即生效 | ✅ 推荐 |
| max_generation_time | int | 30 | 最大生成时间（秒） | Redis Pub/Sub | 下次生成 | ✅ 推荐 |
| retention_days | int | 90 | 保留天数 | Redis Pub/Sub | 下次清理 | ✅ 推荐 |
| default_format | string | "pdf" | 默认格式 | Redis Pub/Sub | 新报告生效 | ✅ 推荐 |
| template_cache_ttl | int | 3600 | 模板缓存时间（秒） | Redis Pub/Sub | 下次缓存写入 | ✅ 推荐 |
| max_concurrent_generation | int | 5 | 最大并发生成数 | Redis Pub/Sub | 立即生效 | ✅ 推荐 |
| chromium_timeout | int | 60 | Chromium超时时间（秒） | Redis Pub/Sub | 下次生成 | ✅ 推荐 |

**不推荐热更新的配置**:

| 配置项 | 类型 | 默认值 | 说明 | 更新方式 | 生效时间 | 是否推荐热更新 |
|--------|------|--------|------|----------|----------|---------------|
| grafana_url | string | "" | Grafana服务地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐(需要重建HTTP客户端) |
| prometheus_url | string | "" | Prometheus服务地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐(需要重建HTTP客户端) |
| elasticsearch_addresses | array | [] | ES集群地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐(需要重建客户端) |
| redis_address | string | "" | Redis地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐(需要重建连接) |

### 11.2 热更新实现

**配置管理器**:

```go
// internal/visualization/config/manager.go
package config

import (
    "context"
    "encoding/json"
    "sync/atomic"
    "time"
)

// 配置管理器
type ConfigManager struct {
    // 使用atomic.Value实现无锁读取
    dashboardConfig atomic.Value  // *DashboardConfig
    logViewerConfig atomic.Value  // *LogViewerConfig
    reportConfig    atomic.Value  // *ReportConfig
    monitorConfig   atomic.Value  // *MonitorConfig
    
    db     *PostgreSQL
    redis  *Redis
    pubsub *redis.PubSub
}

// 创建配置管理器
func NewConfigManager(db *PostgreSQL, redis *Redis) (*ConfigManager, error) {
    cm := &ConfigManager{
        db:    db,
        redis: redis,
    }
    
    // 从数据库加载初始配置
    if err := cm.loadInitialConfig(); err != nil {
        return nil, err
    }
    
    // 订阅配置变更通知
    cm.pubsub = redis.Subscribe("config:module6:reload")
    
    return cm, nil
}

// 启动配置热更新监听
func (cm *ConfigManager) Start(ctx context.Context) error {
    go cm.watchConfigChanges(ctx)
    log.Info("配置热更新监听已启动")
    return nil
}

// 监听配置变更
func (cm *ConfigManager) watchConfigChanges(ctx context.Context) {
    for {
        select {
        case <-ctx.Done():
            return
        case msg := <-cm.pubsub.Channel():
            cm.handleConfigChange(msg)
        }
    }
}

// 处理配置变更
func (cm *ConfigManager) handleConfigChange(msg *redis.Message) {
    log.Infof("收到配置变更通知: %s", msg.Payload)
    
    // 解析变更类型
    var change ConfigChange
    if err := json.Unmarshal([]byte(msg.Payload), &change); err != nil {
        log.Errorf("解析配置变更失败: %v", err)
        return
    }
    
    // 根据配置类型加载新配置
    switch change.Type {
    case "dashboard":
        cm.reloadDashboardConfig()
    case "log_viewer":
        cm.reloadLogViewerConfig()
    case "report":
        cm.reloadReportConfig()
    case "monitor":
        cm.reloadMonitorConfig()
    case "all":
        cm.reloadAllConfig()
    }
}

// 重新加载仪表盘配置
func (cm *ConfigManager) reloadDashboardConfig() {
    log.Info("开始重新加载仪表盘配置")
    
    // 1. 从Redis加载配置
    configJSON, err := cm.redis.Get("config:dashboard")
    if err != nil {
        log.Errorf("从Redis加载配置失败: %v", err)
        return
    }
    
    // 2. 解析配置
    var newConfig DashboardConfig
    if err := json.Unmarshal([]byte(configJSON), &newConfig); err != nil {
        log.Errorf("解析配置失败: %v", err)
        return
    }
    
    // 3. 验证配置
    if err := cm.validateDashboardConfig(&newConfig); err != nil {
        log.Errorf("配置验证失败: %v", err)
        return
    }
    
    // 4. 原子更新配置
    cm.dashboardConfig.Store(&newConfig)
    
    // 5. 记录审计日志
    cm.logConfigChange("dashboard", &newConfig)
    
    log.Info("仪表盘配置重新加载完成")
}

// 验证仪表盘配置
func (cm *ConfigManager) validateDashboardConfig(config *DashboardConfig) error {
    // 验证组件数量限制
    if config.MaxComponents < 1 || config.MaxComponents > 50 {
        return fmt.Errorf("max_components必须在1-50之间")
    }
    
    // 验证版本数限制
    if config.MaxVersions < 1 || config.MaxVersions > 100 {
        return fmt.Errorf("max_versions必须在1-100之间")
    }
    
    // 验证分享有效期
    if config.ShareExpiryDays < 1 || config.ShareExpiryDays > 365 {
        return fmt.Errorf("share_expiry_days必须在1-365之间")
    }
    
    // 验证缓存TTL
    if config.CacheTTL < 0 || config.CacheTTL > 3600 {
        return fmt.Errorf("cache_ttl必须在0-3600之间")
    }
    
    return nil
}

// 获取仪表盘配置（无锁读取）
func (cm *ConfigManager) GetDashboardConfig() *DashboardConfig {
    return cm.dashboardConfig.Load().(*DashboardConfig)
}

// 获取日志查看器配置（无锁读取）
func (cm *ConfigManager) GetLogViewerConfig() *LogViewerConfig {
    return cm.logViewerConfig.Load().(*LogViewerConfig)
}

// 获取报告配置（无锁读取）
func (cm *ConfigManager) GetReportConfig() *ReportConfig {
    return cm.reportConfig.Load().(*ReportConfig)
}

// 获取监控配置（无锁读取）
func (cm *ConfigManager) GetMonitorConfig() *MonitorConfig {
    return cm.monitorConfig.Load().(*MonitorConfig)
}

// 记录配置变更审计日志
func (cm *ConfigManager) logConfigChange(configType string, config interface{}) {
    auditLog := AuditLog{
        EventType:    "config_change",
        ResourceType: configType,
        Action:       "update",
        Timestamp:    time.Now(),
        Details:      config,
    }
    
    // 保存到数据库
    if err := cm.db.SaveAuditLog(&auditLog); err != nil {
        log.Errorf("保存审计日志失败: %v", err)
    }
}
```

**配置更新API**:

```go
// HTTP处理器：更新仪表盘配置
func (h *ConfigHandler) UpdateDashboardConfig(w http.ResponseWriter, r *http.Request) {
    var config DashboardConfig
    if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
        http.Error(w, "解析请求失败", http.StatusBadRequest)
        return
    }
    
    // 1. 验证配置
    if err := h.configManager.validateDashboardConfig(&config); err != nil {
        http.Error(w, fmt.Sprintf("配置验证失败: %v", err), http.StatusBadRequest)
        return
    }
    
    // 2. 保存到PostgreSQL（版本化）
    if err := h.db.SaveDashboardConfig(&config); err != nil {
        http.Error(w, "保存配置失败", http.StatusInternalServerError)
        return
    }
    
    // 3. 同步到Redis
    configJSON, _ := json.Marshal(config)
    if err := h.redis.Set("config:dashboard", configJSON, 0); err != nil {
        log.Errorf("同步配置到Redis失败: %v", err)
    }
    
    // 4. 发布Pub/Sub通知
    change := ConfigChange{
        Type:      "dashboard",
        Timestamp: time.Now(),
    }
    changeJSON, _ := json.Marshal(change)
    h.redis.Publish("config:module6:reload", changeJSON)
    
    // 5. 返回成功响应
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]interface{}{
        "code":    0,
        "message": "配置已更新",
    })
}
```

### 11.3 不可热更新配置项（需要重启）

**Kubernetes部署配置** (❌ 不支持热更新):

```yaml
# deploy/helm/log-management/values.yaml
# WebSocket配置
websocket:
  enabled: true
  replicas: 3  # ❌ 不支持热更新，需要重启
  image:
    repository: log-management/websocket
    tag: v1.0.0  # ❌ 不支持热更新，需要重启
  resources:
    requests:
      cpu: 1      # ❌ 不支持热更新，需要重启
      memory: 2Gi # ❌ 不支持热更新，需要重启
    limits:
      cpu: 2      # ❌ 不支持热更新，需要重启
      memory: 4Gi # ❌ 不支持热更新，需要重启

# API Server配置
apiServer:
  enabled: true
  replicas: 3  # ❌ 不支持热更新，需要重启
  resources:
    requests:
      cpu: 1      # ❌ 不支持热更新，需要重启
      memory: 2Gi # ❌ 不支持热更新，需要重启
```

**原因**: 这些是Kubernetes资源配置，修改后需要重新部署Pod。

**连接配置** (⚠️ 不推荐热更新):

```yaml
# configs/visualization.yaml
postgresql:
  host: "postgres"          # ⚠️ 不推荐热更新，需要重建连接池
  port: 5432                # ⚠️ 不推荐热更新，需要重建连接池
  database: "visualization" # ⚠️ 不推荐热更新，需要重建连接池
  max_connections: 100      # ⚠️ 不推荐热更新，需要重建连接池

redis:
  address: "redis:6379"     # ⚠️ 不推荐热更新，需要重建连接
  password: "secret"        # ⚠️ 不推荐热更新，需要重建连接
  db: 0                     # ⚠️ 不推荐热更新，需要重建连接

elasticsearch:
  addresses: ["es:9200"]    # ⚠️ 不推荐热更新，需要重建客户端
  username: "elastic"       # ⚠️ 不推荐热更新，需要重建客户端
  password: "secret"        # ⚠️ 不推荐热更新，需要重建客户端

minio:
  endpoint: "minio:9000"    # ⚠️ 不推荐热更新，需要重建客户端
  access_key: "minioadmin"  # ⚠️ 不推荐热更新，需要重建客户端
  secret_key: "minioadmin"  # ⚠️ 不推荐热更新，需要重建客户端
```

**原因**: 修改连接配置需要重建连接池和客户端，可能导致数据丢失或服务中断。建议通过滚动重启更新。

### 11.4 YAML配置备用方案

当热更新机制不可用时，可以通过修改YAML配置文件并重启服务来更新配置：

```yaml
# configs/visualization_config.yaml
# ✅ 支持热更新，也可以通过YAML文件更新

# 实时监控配置
monitor:
  refresh_interval: 5
  default_time_range: "15m"
  enabled_charts: ["timeseries", "pie", "bar", "heatmap"]
  theme: "light"
  auto_refresh: true
  max_log_stream_size: 100
  cache_ttl: 5
  ws_heartbeat_interval: 30

# 仪表盘配置
dashboard:
  max_components: 20
  max_versions: 10
  share_expiry_days: 30
  cache_ttl: 300
  default_layout_columns: 12
  default_row_height: 80
  auto_save_interval: 30

# 日志查看器配置
log_viewer:
  max_page_size: 1000
  max_export_size: 100000
  context_size: 50
  highlight_enabled: true
  auto_parse: true
  cache_ttl: 60
  max_time_range_days: 7

# 报告配置
report:
  enabled: true
  max_generation_time: 30
  retention_days: 90
  default_format: "pdf"
  template_cache_ttl: 3600
  max_concurrent_generation: 5
  chromium_timeout: 60
```

**更新流程**:
1. 修改YAML配置文件
2. 通过ConfigMap更新Kubernetes配置
3. 滚动重启服务
4. 新配置生效

```bash
# 更新ConfigMap
kubectl create configmap visualization-config \
  --from-file=configs/visualization_config.yaml \
  --dry-run=client -o yaml | kubectl apply -f -

# 滚动重启服务
kubectl rollout restart deployment/api-server -n visualization
kubectl rollout restart deployment/websocket -n visualization
```

### 11.5 扩展接口设计

为了支持未来的配置扩展，预留以下接口：

```go
// 配置变更钩子接口
type ConfigHook interface {
    // 配置变更前调用
    OnBeforeConfigChange(configType string, oldConfig, newConfig interface{}) error
    
    // 配置变更后调用
    OnAfterConfigChange(configType string, config interface{}) error
}

// 注册配置钩子
func (cm *ConfigManager) RegisterHook(hook ConfigHook) {
    cm.hooks = append(cm.hooks, hook)
}

// 配置验证器接口
type ConfigValidator interface {
    // 验证配置
    Validate(config interface{}) error
}

// 注册配置验证器
func (cm *ConfigManager) RegisterValidator(configType string, validator ConfigValidator) {
    cm.validators[configType] = validator
}

// 图表渲染器插件接口
type ChartRenderer interface {
    // 渲染图表
    Render(data interface{}, options map[string]interface{}) ([]byte, error)
    
    // 获取支持的图表类型
    GetSupportedTypes() []string
}

// 注册图表渲染器
func (cm *ConfigManager) RegisterChartRenderer(renderer ChartRenderer) {
    for _, chartType := range renderer.GetSupportedTypes() {
        cm.chartRenderers[chartType] = renderer
    }
}

// 报告模板引擎接口
type TemplateEngine interface {
    // 渲染模板
    Render(template string, data interface{}) (string, error)
    
    // 验证模板语法
    Validate(template string) error
}

// 注册模板引擎
func (cm *ConfigManager) RegisterTemplateEngine(name string, engine TemplateEngine) {
    cm.templateEngines[name] = engine
}
```

**使用示例**:

```go
// 注册配置钩子
cm.RegisterHook(&MyConfigHook{})

// 注册配置验证器
cm.RegisterValidator("dashboard", &DashboardConfigValidator{})

// 注册图表渲染器
cm.RegisterChartRenderer(&CustomChartRenderer{})

// 注册模板引擎
cm.RegisterTemplateEngine("jinja2", &Jinja2Engine{})
```

### 11.6 配置热更新API

**更新仪表盘配置**:

```http
PUT /api/v1/config/dashboard
Content-Type: application/json
Authorization: Bearer <token>

{
  "max_components": 25,
  "max_versions": 15,
  "share_expiry_days": 60,
  "cache_ttl": 600,
  "auto_save_interval": 60
}

Response:
{
  "code": 0,
  "message": "仪表盘配置已更新并生效"
}
```

**更新日志查看器配置**:

```http
PUT /api/v1/config/log-viewer
Content-Type: application/json
Authorization: Bearer <token>

{
  "max_page_size": 2000,
  "max_export_size": 200000,
  "context_size": 100,
  "highlight_enabled": true,
  "cache_ttl": 120
}

Response:
{
  "code": 0,
  "message": "日志查看器配置已更新并生效"
}
```

**更新报告配置**:

```http
PUT /api/v1/config/report
Content-Type: application/json
Authorization: Bearer <token>

{
  "enabled": true,
  "max_generation_time": 60,
  "retention_days": 180,
  "max_concurrent_generation": 10
}

Response:
{
  "code": 0,
  "message": "报告配置已更新并生效"
}
```

**获取当前配置**:

```http
GET /api/v1/config/dashboard
Authorization: Bearer <token>

Response:
{
  "code": 0,
  "data": {
    "max_components": 25,
    "max_versions": 15,
    "share_expiry_days": 60,
    "cache_ttl": 600,
    "auto_save_interval": 60,
    "updated_at": "2026-02-01T10:00:00Z"
  }
}
```

**获取配置历史版本**:

```http
GET /api/v1/config/dashboard/history
Authorization: Bearer <token>

Response:
{
  "code": 0,
  "data": {
    "items": [
      {
        "version": 3,
        "config": {
          "max_components": 25,
          "max_versions": 15
        },
        "changed_by": "admin@example.com",
        "changed_at": "2026-02-01T10:00:00Z"
      },
      {
        "version": 2,
        "config": {
          "max_components": 20,
          "max_versions": 10
        },
        "changed_by": "admin@example.com",
        "changed_at": "2026-01-31T10:00:00Z"
      }
    ],
    "total": 3
  }
}
```

**回滚配置到历史版本**:

```http
POST /api/v1/config/dashboard/rollback
Content-Type: application/json
Authorization: Bearer <token>

{
  "version": 2
}

Response:
{
  "code": 0,
  "message": "配置已回滚到版本2"
}
```

### 11.7 验收标准

1. **生效时间验收**
   - THE System SHALL 在配置变更后30秒内生效
   - WHEN 配置无效时，THE System SHALL 保持原配置并记录错误日志
   - THE System SHALL 支持通过API查询当前生效的配置值

2. **配置验证验收**
   - THE System SHALL 验证所有配置项的合法性
   - WHEN 配置超出范围时，THE System SHALL 拒绝更新并返回错误信息
   - THE System SHALL 记录所有配置变更的审计日志

3. **一致性验收**
   - THE System SHALL 确保所有节点的配置最终一致
   - WHEN Redis不可用时，THE System SHALL 使用数据库中的配置
   - THE System SHALL 在节点重启后自动加载最新配置

4. **回滚验收**
   - THE System SHALL 支持配置版本管理
   - THE System SHALL 支持回滚到历史版本
   - WHEN 回滚时，THE System SHALL 发布配置变更通知

---

## 12. 风险与回滚

### 12.1 风险识别

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| WebSocket连接中断 | 中 | 高 | 自动重连机制、心跳检测、连接池 |
| 仪表盘数据丢失 | 低 | 高 | 版本管理、定期备份、对象存储 |
| 日志查询超时 | 中 | 中 | 查询优化、限制时间范围、缓存 |
| 报告生成失败 | 中 | 中 | 重试机制、降级方案、告警通知 |
| 缓存雪崩 | 低 | 高 | 缓存预热、随机TTL、降级查询 |
| 配置错误 | 中 | 高 | 配置验证、灰度发布、快速回滚 |
| 性能下降 | 中 | 中 | 性能监控、自动扩容、限流保护 |
| 数据泄露 | 低 | 高 | 权限控制、数据加密、审计日志 |

### 12.2 回滚方案

**配置回滚**:

```bash
# 1. 查看配置历史版本
curl -X GET http://api-server/api/v1/config/dashboard/versions

# 2. 回滚到指定版本
curl -X POST http://api-server/api/v1/config/dashboard/rollback \
  -H "Content-Type: application/json" \
  -d '{"version": 5}'

# 3. 验证回滚成功
curl -X GET http://api-server/api/v1/config/dashboard
```

**代码回滚**:

```bash
# 1. 检测到异常（错误率>5%）
# 2. 执行Helm回滚
helm rollback visualization -n visualization

# 3. 验证服务恢复
kubectl get pods -n visualization
kubectl logs -n visualization -l app=api-server --tail=100

# 4. 检查监控指标
curl http://prometheus:9090/api/v1/query?query=up{job="api-server"}
```

**数据回滚**:

```bash
# 1. 停止服务
kubectl scale deployment api-server --replicas=0 -n visualization

# 2. 恢复数据库备份
kubectl cp dashboards-backup.sql data/postgresql-0:/tmp/
kubectl exec -n data postgresql-0 -- psql -U postgres < /tmp/dashboards-backup.sql

# 3. 清除Redis缓存
kubectl exec -n data redis-0 -- redis-cli FLUSHDB

# 4. 重启服务
kubectl scale deployment api-server --replicas=3 -n visualization

# 5. 验证数据恢复
curl -X GET http://api-server/api/v1/dashboards
```

### 12.3 应急预案

**WebSocket服务中断**:

1. **检测**: 监控告警触发（连接数为0）
2. **评估**: 检查Pod状态、日志、网络
3. **处理**: 
   - 重启WebSocket服务
   - 检查负载均衡配置
   - 验证证书有效性
4. **恢复**: 客户端自动重连
5. **复盘**: 分析根因、优化监控

**仪表盘加载失败**:

1. **检测**: 用户反馈或监控告警
2. **评估**: 检查缓存、数据库、API服务
3. **处理**:
   - 清除缓存重试
   - 检查数据库连接
   - 降级为默认仪表盘
4. **恢复**: 修复数据或配置
5. **复盘**: 优化错误处理

**报告生成失败**:

1. **检测**: 报告生成告警
2. **评估**: 检查Chromium、模板、数据源
3. **处理**:
   - 重试生成（最多3次）
   - 降级为HTML格式
   - 通知用户失败原因
4. **恢复**: 修复模板或数据
5. **复盘**: 优化生成流程

---

## 13. 附录

### 13.1 术语表

| 术语 | 说明 |
|------|------|
| WebSocket | 全双工通信协议，支持服务端主动推送 |
| 仪表盘 | Dashboard，可视化展示多个指标和图表的页面 |
| 组件 | Component，仪表盘中的单个可视化元素 |
| 布局引擎 | Layout Engine，管理组件位置和大小的系统 |
| 语法高亮 | Syntax Highlighting，根据日志级别使用不同颜色 |
| 上下文 | Context，目标日志前后的相关日志 |
| 书签 | Bookmark，标记重要日志的功能 |
| 报告模板 | Report Template，定义报告格式和内容的模板 |
| 对象存储 | Object Storage，存储大文件的分布式存储系统（如S3、MinIO） |
| 热更新 | Hot Reload，无需重启服务即可更新配置 |
| 原子操作 | Atomic Operation，不可分割的操作，保证并发安全 |
| 降采样 | Downsampling，减少数据点数量以提高渲染性能 |
| 骨架屏 | Skeleton Screen，加载时显示的占位符，提升感知性能 |

### 13.2 参考文档

**技术文档**:
- [React 18 文档](https://react.dev/)
- [ECharts 5 文档](https://echarts.apache.org/zh/index.html)
- [WebSocket API](https://developer.mozilla.org/zh-CN/docs/Web/API/WebSocket)
- [Elasticsearch Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl.html)
- [Chromium Headless](https://developer.chrome.com/docs/chromium/headless)
- [PostgreSQL JSONB](https://www.postgresql.org/docs/current/datatype-json.html)
- [Redis Pub/Sub](https://redis.io/docs/manual/pubsub/)

**最佳实践**:
- [React Performance Optimization](https://react.dev/learn/render-and-commit)
- [WebSocket Best Practices](https://www.ably.com/topic/websockets)
- [Elasticsearch Performance Tuning](https://www.elastic.co/guide/en/elasticsearch/reference/current/tune-for-search-speed.html)
- [PDF Generation Best Practices](https://github.com/puppeteer/puppeteer/blob/main/docs/api.md)

**相关项目**:
- [Grafana](https://github.com/grafana/grafana) - 开源可视化平台
- [Kibana](https://github.com/elastic/kibana) - Elasticsearch可视化工具
- [Apache Superset](https://github.com/apache/superset) - 数据探索平台

### 13.3 配置示例

**仪表盘配置示例**:

```json
{
  "id": "dash-001",
  "name": "系统监控仪表盘",
  "description": "实时监控系统运行状态",
  "layout": {
    "type": "grid",
    "columns": 12,
    "row_height": 80,
    "gaps": 10
  },
  "components": [
    {
      "id": "comp-1",
      "type": "chart",
      "title": "日志趋势",
      "position": {"x": 0, "y": 0, "width": 6, "height": 4},
      "data_source": {
        "type": "elasticsearch",
        "query": "level:*",
        "params": {"time_range": "1h"}
      },
      "chart_config": {
        "type": "line",
        "options": {"smooth": true}
      },
      "refresh_interval": 30
    }
  ],
  "settings": {
    "theme": "light",
    "auto_refresh": true,
    "refresh_interval": 30,
    "time_range": "1h"
  }
}
```

**报告配置示例**:

```json
{
  "id": "report-001",
  "name": "每日系统概览报告",
  "type": "overview",
  "schedule": {
    "type": "daily",
    "time": "09:00"
  },
  "template": "system-overview",
  "data_sources": [
    {
      "type": "elasticsearch",
      "query": "level:ERROR",
      "params": {"time_range": "24h"}
    },
    {
      "type": "prometheus",
      "query": "up",
      "params": {}
    }
  ],
  "recipients": [
    {
      "type": "email",
      "address": "ops@example.com"
    }
  ],
  "format": "pdf",
  "enabled": true
}
```

### 13.4 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-01-31 | v1.0 | 初稿，完整设计方案 | 系统架构团队 |
| 2026-01-31 | v1.0 | 完成第6-13章内容 | 系统架构团队 |

---

**文档结束**
