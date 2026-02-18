# 模块十三：用户体验 - 技术设计文档

> **文档版本**: v1.0  
> **作者**: 系统架构团队  
> **更新日期**: 2026-01-31  
> **状态**: 已发布  
> **相关需求**: [requirements-module13.md](../requirements/requirements-module13.md)

---

## 1. 文档信息

### 1.1 版本历史
| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| v1.0 | 2026-01-31 | 系统架构团队 | 初稿，完整设计方案 |

### 1.2 文档状态
- **当前状态**: 已发布
- **评审状态**: 已通过
- **实施阶段**: MVP

### 1.3 相关文档
- [需求文档](../requirements/requirements-module13.md)
- [API设计文档](./api-design.md)
- [项目总体设计](./project-design-overview.md)

---

## 2. 总体架构

### 2.1 系统架构图
```
┌─────────────────────────────────────────────────────────────────────────┐
│                        用户体验架构                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      设计系统层                                   │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  设计令牌 (Design Tokens)                                  │ │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │  │
│  │  │  │ 颜色系统  │  │ 字体系统  │  │ 间距系统  │  │ 阴影系统  │  │ │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  主题系统                                                  │ │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                │ │  │
│  │  │  │ 浅色主题  │  │ 深色主题  │  │ 自定义   │                │ │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘                │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      组件层级                                     │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  基础组件层 (Ant Design 5+)                                │ │  │
│  │  │  • Button, Input, Select, Table, Modal                     │ │  │
│  │  │  • Card, Tag, Badge, Tooltip, Dropdown                     │ │  │
│  │  │  • Form, Checkbox, Radio, Switch                           │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │                            ↓                                      │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  业务组件层                                                │ │  │
│  │  │  • LogCard, AlertBadge, TimeRangePicker                    │ │  │
│  │  │  • SearchBar, FilterPanel, ChartWidget                     │ │  │
│  │  │  • UserAvatar, NotificationBell, ThemeToggle               │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │                            ↓                                      │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  页面模板层                                                │ │  │
│  │  │  • DashboardLayout, SearchLayout, DetailLayout             │ │  │
│  │  │  • SettingsLayout, ReportLayout                            │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      响应式布局层                                 │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  断点系统                                                  │ │  │
│  │  │  • xs: < 576px   (手机)                                    │ │  │
│  │  │  • sm: ≥ 576px   (平板竖屏)                                │ │  │
│  │  │  • md: ≥ 768px   (平板横屏)                                │ │  │
│  │  │  • lg: ≥ 992px   (小型桌面)                                │ │  │
│  │  │  • xl: ≥ 1200px  (标准桌面)                                │ │  │
│  │  │  • xxl: ≥ 1600px (大型桌面)                                │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  栅格系统 (24列)                                           │ │  │
│  │  │  • 响应式间距（gutter）                                    │ │  │
│  │  │  • 弹性布局（flex）                                        │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      交互动画层 (Framer Motion)                   │  │
│  │  • 页面切换动画 (Fade/Slide/Scale)                               │  │
│  │  • 加载动画 (Skeleton/Progress/Spinner)                          │  │
│  │  • 微交互动画 (按钮点击/卡片悬停/展开折叠)                        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      性能优化层                                   │  │
│  │  • 虚拟滚动 (@tanstack/react-virtual)                            │  │
│  │  • 懒加载 (图片/组件/路由)                                        │  │
│  │  • 代码分割 (路由级别/组件级别)                                   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      实时通信层 (Socket.io)                       │  │
│  │  • WebSocket连接管理                                             │  │
│  │  • 自动重连机制                                                  │  │
│  │  • 实时日志流                                                    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      个性化配置层                                 │  │
│  │  • 用户偏好设置 (主题/语言/时区)                                  │  │
│  │  • 快捷键配置                                                    │  │
│  │  • 布局保存与恢复                                                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 模块划分
| 子模块 | 职责 | 核心功能 |
|--------|------|----------|
| 设计系统 | 统一视觉规范 | 设计令牌、主题系统、颜色/字体/间距管理 |
| 组件库 | UI组件封装 | 基础组件、业务组件、页面模板 |
| 响应式布局 | 多设备适配 | 断点系统、栅格布局、弹性布局 |
| 交互动画 | 流畅体验 | 页面切换、加载动画、微交互 |
| 性能优化 | 高性能渲染 | 虚拟滚动、懒加载、代码分割 |
| 实时通信 | 数据实时更新 | WebSocket连接、实时日志流、自动重连 |
| 个性化配置 | 用户定制 | 偏好设置、快捷键、布局管理 |

### 2.3 关键路径
```
用户交互 → 组件渲染(< 16ms) → 数据请求(< 100ms) → 状态更新(< 10ms)
  → 动画过渡(< 300ms) → 页面展示

实时日志流: WebSocket连接 → 订阅日志 → 接收数据 → 虚拟滚动渲染
  → 自动滚动更新

搜索流程: 输入关键词 → 防抖(100ms) → 自动补全 → 执行搜索
  → 结果高亮显示

总体响应时间: < 500ms (P95)
```

---

## 3. 技术选型

### 3.1 核心技术栈
| 技术 | 版本 | 选择理由 |
|------|------|----------|
| React | 18+ | 主流前端框架，生态完善，性能优秀 |
| TypeScript | 5+ | 类型安全，提升代码质量和可维护性 |
| Ant Design | 5+ | 企业级UI组件库，组件丰富，设计规范 |
| Zustand | 4+ | 轻量级状态管理，API简洁，性能好 |
| Framer Motion | 11+ | 强大的动画库，声明式API，性能优秀 |
| @tanstack/react-virtual | 3+ | 虚拟滚动库，支持大数据列表渲染 |
| Socket.io | 4+ | WebSocket库，支持自动重连和降级 |
| Prism.js | 1.29+ | 代码语法高亮，支持多种语言 |
| ECharts | 5+ | 数据可视化库，图表类型丰富 |
| Day.js | 1.11+ | 轻量级日期处理库，API友好 |
| Axios | 1.6+ | HTTP客户端，支持拦截器和取消请求 |
| React Router | 6+ | 路由管理，支持懒加载和嵌套路由 |
| Vite | 5+ | 快速构建工具，开发体验好 |
| Allotment | 1.20+ | 窗口拆分库，支持灵活布局调整 |

### 3.2 技术对比

**状态管理选型**:

| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| Redux | 生态完善、调试工具强大 | 样板代码多、学习曲线陡 | ❌ |
| MobX | 响应式、代码简洁 | 魔法较多、不够透明 | ❌ |
| Zustand | 轻量、API简洁、性能好 | 生态相对较小 | ✅ |
| Jotai | 原子化、灵活 | 概念较新、学习成本 | ❌ |

**动画库选型**:

| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| CSS Transitions | 性能好、简单 | 功能有限、不够灵活 | ❌ |
| React Spring | 基于物理的动画、流畅 | API复杂、学习成本高 | ❌ |
| Framer Motion | 声明式、功能强大、易用 | 包体积稍大 | ✅ |
| GSAP | 功能最强大、性能极佳 | 商业许可、学习成本高 | ❌ |

**虚拟滚动选型**:

| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| react-window | 轻量、简单 | 功能有限 | ❌ |
| react-virtualized | 功能丰富 | 体积大、维护较少 | ❌ |
| @tanstack/react-virtual | 现代化、灵活、性能好 | 相对较新 | ✅ |

**WebSocket库选型**:

| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| 原生WebSocket | 无依赖、轻量 | 需要手动处理重连、降级 | ❌ |
| Socket.io | 功能完善、自动重连、降级 | 体积稍大 | ✅ |
| ws | 轻量、性能好 | 仅Node.js端 | ❌ |

---

## 4. 关键流程设计

### 4.1 主流程

**页面渲染流程**:

```
1. 用户访问页面
2. React Router匹配路由
3. 懒加载页面组件
4. 显示骨架屏
5. 请求数据(API/WebSocket)
6. 更新Zustand状态
7. 组件重新渲染
8. 页面切换动画
9. 完成渲染
```

**实时日志流程**:

```
1. 建立WebSocket连接
2. 发送订阅请求(包含查询条件)
3. 服务端推送日志数据
4. 客户端接收数据
5. 更新日志列表状态
6. 虚拟滚动渲染
7. 自动滚动到最新日志
8. 显示更新频率统计
```

**搜索流程**:

```
1. 用户输入搜索关键词
2. 防抖处理(100ms)
3. 请求搜索建议API
4. 显示自动补全列表
5. 用户选择或提交搜索
6. 解析搜索文本(字段搜索/正则/范围)
7. 发送搜索请求
8. 显示搜索结果
9. 高亮匹配关键词
10. 保存到搜索历史
```

**批量操作流程**:

```
1. 用户选择多条日志
2. 点击批量操作按钮
3. 显示确认对话框
4. 用户确认操作
5. 显示进度条
6. 批量处理(分批请求)
7. 更新进度
8. 操作完成
9. 显示结果统计
10. 提供撤销选项(30秒)
```

### 4.2 异常流程

| 异常类型 | 处理策略 | 恢复机制 |
|----------|----------|----------|
| API请求失败 | 显示错误提示、重试按钮 | 用户手动重试或自动重试3次 |
| WebSocket断开 | 显示断开状态、自动重连 | 指数退避重连(3s→30s)，最多5次 |
| 数据加载超时 | 显示超时提示、取消按钮 | 用户取消请求或等待 |
| 组件渲染错误 | Error Boundary捕获、显示错误页面 | 提供刷新按钮 |
| 配置加载失败 | 使用默认配置、显示警告 | 后台重试加载 |
| 批量操作失败 | 显示失败数量、失败原因 | 提供重试失败项功能 |

### 4.3 时序图

**实时日志流时序图**:

```
用户    前端    WebSocket    后端    Kafka
 │       │         │          │       │
 │─打开页面→│         │          │       │
 │       │─建立连接→│          │       │
 │       │         │─认证─────→│       │
 │       │         │←─成功─────│       │
 │       │─订阅日志→│          │       │
 │       │         │─订阅请求→│       │
 │       │         │          │─消费→│
 │       │         │          │←─日志─│
 │       │         │←─推送日志─│       │
 │       │←─更新UI──│          │       │
 │       │         │          │       │
 │─暂停流→│         │          │       │
 │       │─取消订阅→│          │       │
 │       │         │─取消请求→│       │
```

**搜索流程时序图**:

```
用户    前端    API服务器    ES集群
 │       │         │          │
 │─输入关键词→│         │          │
 │       │─防抖100ms─│          │
 │       │─请求建议→│          │
 │       │         │─查询────→│
 │       │         │←─结果────│
 │       │←─显示建议─│          │
 │       │         │          │
 │─提交搜索→│         │          │
 │       │─解析查询→│          │
 │       │─发送请求→│          │
 │       │         │─搜索────→│
 │       │         │←─结果────│
 │       │←─显示结果─│          │
 │       │─高亮关键词│          │
```

### 4.4 状态机

**WebSocket连接状态机**:

```
┌─────────────┐
│  未连接      │
│ (Disconnected)│
└──────┬──────┘
       │ connect()
       ↓
┌─────────────┐
│  连接中      │
│ (Connecting) │
└──────┬──────┘
       │ success
       ↓
┌─────────────┐     disconnect()     ┌─────────────┐
│  已连接      │────────────────────→│  断开中      │
│ (Connected)  │                     │ (Disconnecting)│
└──────┬──────┘                     └──────┬──────┘
       │ error/timeout                     │
       ↓                                   ↓
┌─────────────┐                     ┌─────────────┐
│  重连中      │                     │  已断开      │
│ (Reconnecting)│←────────────────────│ (Disconnected)│
└─────────────┘     retry            └─────────────┘
```

---

## 5. 接口设计

### 5.1 API列表

详见 [API设计文档](./api-design.md) 模块13部分，共17个接口:

**UI配置接口**:
- `GET /api/v1/ui/theme` - 获取主题配置
- `PUT /api/v1/ui/theme` - 更新主题配置

**日志批量操作接口**:
- `POST /api/v1/logs/batch/mark` - 批量标记日志
- `POST /api/v1/logs/batch/delete` - 批量删除日志
- `POST /api/v1/logs/batch/export` - 批量导出日志

**搜索接口**:
- `GET /api/v1/search/suggestions` - 获取搜索建议
- `GET /api/v1/search/history` - 获取搜索历史
- `GET /api/v1/search/filters` - 获取保存的过滤器
- `POST /api/v1/search/filters` - 保存过滤器

**实时通信接口**:
- `WS /api/v1/realtime/subscribe` - 订阅实时日志流
- `WS /api/v1/realtime/unsubscribe` - 取消订阅

**用户偏好接口**:
- `GET /api/v1/preferences` - 获取用户偏好设置
- `PUT /api/v1/preferences` - 更新用户偏好设置
- `GET /api/v1/preferences/export` - 导出用户配置
- `POST /api/v1/preferences/import` - 导入用户配置

**快捷键接口**:
- `GET /api/v1/shortcuts` - 获取快捷键配置
- `PUT /api/v1/shortcuts` - 更新快捷键配置

### 5.2 WebSocket消息格式

**订阅请求**:

```json
{
  "type": "subscribe",
  "data": {
    "query": {
      "text": "error",
      "filters": [
        {
          "field": "level",
          "operator": "eq",
          "value": "ERROR"
        }
      ],
      "timeRange": {
        "start": "2024-01-01T00:00:00Z",
        "end": "2024-01-31T23:59:59Z"
      }
    }
  }
}
```

**日志推送**:

```json
{
  "type": "log",
  "data": {
    "id": "log-123",
    "timestamp": "2024-01-15T10:30:00Z",
    "level": "ERROR",
    "service": "payment",
    "message": "Payment failed",
    "fields": {
      "userId": "user-456",
      "amount": 100.00
    }
  }
}
```

**连接状态**:

```json
{
  "type": "status",
  "data": {
    "connected": true,
    "updateRate": 50,
    "totalLogs": 1234
  }
}
```

### 5.3 数据格式

**搜索查询格式**:

```typescript
interface SearchQuery {
  text: string;                    // 全文搜索文本
  filters: Filter[];               // 过滤条件
  timeRange: TimeRange;            // 时间范围
  sort?: SortConfig;               // 排序配置
  pagination?: PaginationConfig;   // 分页配置
}

interface Filter {
  field: string;                   // 字段名
  operator: string;                // 操作符(eq/ne/contains/regex等)
  value: any;                      // 值
  logic?: 'AND' | 'OR';           // 逻辑运算符
}
```

**用户偏好格式**:

```typescript
interface UserPreferences {
  theme: 'light' | 'dark';         // 主题
  language: 'zh-CN' | 'en-US';     // 语言
  timezone: string;                // 时区
  dateFormat: string;              // 日期格式
  shortcuts: Record<string, string>; // 快捷键配置
  layout: LayoutConfig;            // 布局配置
  dashboardWidgets: WidgetConfig[]; // 仪表盘小部件
}
```

---

## 6. 数据设计

### 6.1 数据模型

**前端日志条目模型**:

```typescript
// 日志条目
interface LogEntry {
  id: string;                      // 唯一标识
  timestamp: string;               // 时间戳
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'; // 日志级别
  service: string;                 // 服务名称
  instance?: string;               // 实例ID
  message: string;                 // 日志消息
  stackTrace?: string;             // 错误堆栈
  traceId?: string;                // 追踪ID
  requestId?: string;              // 请求ID
  userId?: string;                 // 用户ID
  tags?: string[];                 // 标签
  fields?: Record<string, any>;    // 自定义字段
}

// 搜索过滤器
interface SavedFilter {
  id: string;                      // 过滤器ID
  name: string;                    // 过滤器名称
  query: string;                   // 查询文本
  filters: Filter[];               // 过滤条件
  count: number;                   // 使用次数
  createdAt: string;               // 创建时间
  updatedAt: string;               // 更新时间
}

// 用户偏好设置
interface UserPreferences {
  theme: 'light' | 'dark';         // 主题
  language: 'zh-CN' | 'en-US';     // 语言
  timezone: string;                // 时区
  dateFormat: string;              // 日期格式
  shortcuts: Record<string, string>; // 快捷键
  layout: {
    sidebarCollapsed: boolean;     // 侧边栏折叠状态
    splitPanes: Array<{            // 窗口拆分配置
      size: string;
      minSize: number;
    }>;
  };
  dashboardWidgets: Array<{        // 仪表盘小部件
    id: string;
    type: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    config: Record<string, any>;
  }>;
}

// UI配置
interface UIConfig {
  theme: string;                   // 默认主题
  animationEnabled: boolean;       // 是否启用动画
  animationDuration: number;       // 动画时长(毫秒)
  virtualScrollEnabled: boolean;   // 是否启用虚拟滚动
  virtualScrollOverscan: number;   // 虚拟滚动预渲染行数
  lazyLoadEnabled: boolean;        // 是否启用懒加载
  skeletonEnabled: boolean;        // 是否显示骨架屏
  responsiveBreakpoints: {         // 响应式断点
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
}
```

### 6.2 LocalStorage设计

**存储结构**:

| Key | 类型 | 说明 | 过期策略 |
|-----|------|------|----------|
| `userPreferences` | JSON | 用户偏好设置 | 永久 |
| `searchHistory` | JSON Array | 搜索历史(最近20条) | 永久 |
| `savedFilters` | JSON Array | 保存的过滤器 | 永久 |
| `theme` | String | 当前主题 | 永久 |
| `hasVisited` | Boolean | 是否已访问(引导教程) | 永久 |
| `layoutState` | JSON | 布局状态 | 永久 |

**数据示例**:

```json
{
  "userPreferences": {
    "theme": "dark",
    "language": "zh-CN",
    "timezone": "Asia/Shanghai",
    "dateFormat": "YYYY-MM-DD HH:mm:ss",
    "shortcuts": {
      "search": "ctrl+k",
      "refresh": "ctrl+r",
      "export": "ctrl+e"
    }
  },
  "searchHistory": [
    "level:ERROR",
    "service:payment",
    "message:/timeout/"
  ],
  "savedFilters": [
    {
      "id": "filter-1",
      "name": "支付错误",
      "query": "level:ERROR service:payment",
      "count": 15
    }
  ]
}
```

### 6.3 状态管理设计

**Zustand Store结构**:

```typescript
// 应用状态
interface AppState {
  // UI状态
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  loading: boolean;
  
  // 日志状态
  logs: LogEntry[];
  selectedLogIds: string[];
  currentLog: LogEntry | null;
  
  // 搜索状态
  searchQuery: SearchQuery;
  searchResults: LogEntry[];
  searchLoading: boolean;
  
  // 实时连接状态
  wsConnected: boolean;
  wsReconnecting: boolean;
  updateRate: number;
  
  // 用户偏好
  preferences: UserPreferences;
  
  // Actions
  setTheme: (theme: 'light' | 'dark') => void;
  toggleSidebar: () => void;
  setLogs: (logs: LogEntry[]) => void;
  selectLog: (id: string) => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
}

// Store实现
const useAppStore = create<AppState>((set) => ({
  // 初始状态
  theme: 'light',
  sidebarCollapsed: false,
  loading: false,
  logs: [],
  selectedLogIds: [],
  currentLog: null,
  searchQuery: {},
  searchResults: [],
  searchLoading: false,
  wsConnected: false,
  wsReconnecting: false,
  updateRate: 0,
  preferences: defaultPreferences,
  
  // Actions
  setTheme: (theme) => set({ theme }),
  toggleSidebar: () => set((state) => ({ 
    sidebarCollapsed: !state.sidebarCollapsed 
  })),
  setLogs: (logs) => set({ logs }),
  selectLog: (id) => set((state) => ({
    selectedLogIds: state.selectedLogIds.includes(id)
      ? state.selectedLogIds.filter(i => i !== id)
      : [...state.selectedLogIds, id]
  })),
  updatePreferences: (prefs) => set((state) => ({
    preferences: { ...state.preferences, ...prefs }
  })),
}));
```

### 6.4 缓存设计

**浏览器缓存策略**:

| 资源类型 | 缓存策略 | 过期时间 | 说明 |
|---------|---------|---------|------|
| HTML | no-cache | - | 每次验证 |
| JS/CSS | max-age | 1年 | 文件名带hash |
| 图片 | max-age | 30天 | 静态资源 |
| API响应 | no-cache | - | 实时数据 |
| 字体文件 | max-age | 1年 | 不常变化 |

**内存缓存**:

```typescript
// 搜索建议缓存
const suggestionCache = new Map<string, string[]>();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟

// 日志详情缓存
const logDetailCache = new LRUCache<string, LogEntry>({
  max: 100,  // 最多缓存100条
  ttl: 10 * 60 * 1000, // 10分钟过期
});
```

---

## 7. 安全设计

### 7.1 安全措施

**XSS防护**:
- 使用React的自动转义机制
- 对用户输入进行HTML转义
- 使用DOMPurify清理富文本内容
- CSP策略限制脚本来源

```typescript
// HTML转义
const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// 使用DOMPurify清理
import DOMPurify from 'dompurify';
const cleanHtml = DOMPurify.sanitize(dirtyHtml);
```

**CSRF防护**:
- 所有API请求携带CSRF Token
- Token存储在Cookie中(HttpOnly)
- 验证Referer头

```typescript
// Axios拦截器添加CSRF Token
axios.interceptors.request.use((config) => {
  const token = getCookie('csrf-token');
  if (token) {
    config.headers['X-CSRF-Token'] = token;
  }
  return config;
});
```

**认证授权**:
- JWT Token存储在HttpOnly Cookie
- Token自动刷新机制
- 权限验证在路由层和组件层

```typescript
// 路由守卫
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  return <>{children}</>;
};
```

**数据加密**:
- HTTPS传输加密
- 敏感数据本地存储加密
- WebSocket使用WSS协议

### 7.2 输入验证

**前端验证规则**:

| 字段类型 | 验证规则 | 错误提示 |
|---------|---------|---------|
| 搜索关键词 | 长度≤200字符 | "搜索关键词过长" |
| 日期范围 | 开始时间<结束时间 | "时间范围无效" |
| 批量操作 | 数量≤1000 | "批量操作数量超限" |
| 快捷键 | 有效的键盘组合 | "快捷键格式无效" |

```typescript
// 表单验证
const validateSearchQuery = (query: string): string | null => {
  if (query.length > 200) {
    return '搜索关键词过长，最多200字符';
  }
  
  // 检查特殊字符
  const dangerousChars = /<script|javascript:|onerror=/i;
  if (dangerousChars.test(query)) {
    return '搜索关键词包含非法字符';
  }
  
  return null;
};
```

### 7.3 审计日志

**记录内容**:
- 用户登录/登出
- 配置变更
- 批量操作
- 敏感数据访问

```typescript
// 审计日志记录
const logAudit = (action: string, details: any) => {
  const auditLog = {
    timestamp: new Date().toISOString(),
    userId: getCurrentUserId(),
    action,
    details,
    ip: getClientIP(),
    userAgent: navigator.userAgent,
  };
  
  // 发送到后端
  api.post('/api/v1/audit/log', auditLog);
};

// 使用示例
logAudit('BATCH_DELETE', {
  logIds: selectedIds,
  count: selectedIds.length,
});
```

---

## 8. 性能设计

### 8.1 性能指标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 首屏加载时间 | < 2s | Lighthouse |
| 页面切换时间 | < 300ms | Performance API |
| 搜索响应时间 | < 500ms | Network Timing |
| 虚拟滚动FPS | ≥ 60 | Chrome DevTools |
| 内存占用 | < 200MB | Chrome Task Manager |
| 包体积 | < 500KB (gzip) | Webpack Bundle Analyzer |
| WebSocket延迟 | < 100ms | 时间戳差值 |

### 8.2 优化策略

**代码分割**:

```typescript
// 路由级别懒加载
const LogSearch = lazy(() => import('./pages/LogSearch'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));

// 组件级别懒加载
const HeavyChart = lazy(() => import('./components/HeavyChart'));

// 使用Suspense包裹
<Suspense fallback={<LoadingSkeleton />}>
  <LogSearch />
</Suspense>
```

**虚拟滚动优化**:

```typescript
// 使用@tanstack/react-virtual
const virtualizer = useVirtualizer({
  count: logs.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 80,      // 预估行高
  overscan: 10,                // 预渲染10行
  measureElement: (el) => el.getBoundingClientRect().height, // 动态测量
});
```

**防抖节流**:

```typescript
// 搜索输入防抖
const debouncedSearch = useMemo(
  () => debounce((value: string) => {
    fetchSearchSuggestions(value);
  }, 100),
  []
);

// 滚动事件节流
const throttledScroll = useMemo(
  () => throttle(() => {
    updateScrollPosition();
  }, 16), // 60fps
  []
);
```

**图片优化**:

```typescript
// 懒加载图片
<LazyImage
  src="/large-image.jpg"
  placeholder="/placeholder.jpg"
  alt="描述"
/>

// 使用WebP格式
<picture>
  <source srcSet="/image.webp" type="image/webp" />
  <img src="/image.jpg" alt="描述" />
</picture>
```

**缓存策略**:

```typescript
// React Query缓存
const { data, isLoading } = useQuery({
  queryKey: ['logs', searchQuery],
  queryFn: () => fetchLogs(searchQuery),
  staleTime: 5 * 60 * 1000,    // 5分钟内不重新请求
  cacheTime: 10 * 60 * 1000,   // 缓存10分钟
});

// 搜索建议缓存
const suggestionCache = new Map();
const getCachedSuggestions = (keyword: string) => {
  if (suggestionCache.has(keyword)) {
    return suggestionCache.get(keyword);
  }
  
  const suggestions = fetchSuggestions(keyword);
  suggestionCache.set(keyword, suggestions);
  
  // 5分钟后清除
  setTimeout(() => {
    suggestionCache.delete(keyword);
  }, 5 * 60 * 1000);
  
  return suggestions;
};
```

**渲染优化**:

```typescript
// 使用React.memo避免不必要的重渲染
const LogCard = React.memo<LogCardProps>(({ log, selected, onSelect }) => {
  // 组件实现
}, (prevProps, nextProps) => {
  // 自定义比较函数
  return prevProps.log.id === nextProps.log.id &&
         prevProps.selected === nextProps.selected;
});

// 使用useMemo缓存计算结果
const filteredLogs = useMemo(() => {
  return logs.filter(log => log.level === 'ERROR');
}, [logs]);

// 使用useCallback缓存函数
const handleSelect = useCallback((id: string) => {
  setSelectedIds(prev => [...prev, id]);
}, []);
```

**Web Worker**:

```typescript
// 在Worker中处理大量数据
const worker = new Worker('/workers/log-processor.js');

worker.postMessage({
  type: 'PROCESS_LOGS',
  data: rawLogs,
});

worker.onmessage = (e) => {
  const processedLogs = e.data;
  setLogs(processedLogs);
};
```

### 8.3 性能监控

**关键指标采集**:

```typescript
// 使用Performance API
const measurePageLoad = () => {
  const perfData = performance.getEntriesByType('navigation')[0];
  
  return {
    dns: perfData.domainLookupEnd - perfData.domainLookupStart,
    tcp: perfData.connectEnd - perfData.connectStart,
    ttfb: perfData.responseStart - perfData.requestStart,
    download: perfData.responseEnd - perfData.responseStart,
    domParse: perfData.domInteractive - perfData.responseEnd,
    domReady: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
    load: perfData.loadEventEnd - perfData.loadEventStart,
  };
};

// 上报性能数据
const reportPerformance = () => {
  const metrics = measurePageLoad();
  
  api.post('/api/v1/metrics/performance', {
    page: window.location.pathname,
    metrics,
    timestamp: Date.now(),
  });
};
```

**Core Web Vitals监控**:

```typescript
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

// 监控核心指标
getCLS(console.log);  // Cumulative Layout Shift
getFID(console.log);  // First Input Delay
getFCP(console.log);  // First Contentful Paint
getLCP(console.log);  // Largest Contentful Paint
getTTFB(console.log); // Time to First Byte
```

---

## 9. 部署方案

### 9.1 部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                    前端部署架构                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐                                           │
│  │   用户浏览器  │                                           │
│  └──────┬──────┘                                           │
│         │ HTTPS                                            │
│         ↓                                                  │
│  ┌─────────────┐                                           │
│  │   CDN       │ (静态资源缓存)                             │
│  └──────┬──────┘                                           │
│         │                                                  │
│         ↓                                                  │
│  ┌─────────────┐                                           │
│  │   Nginx     │ (反向代理 + 负载均衡)                      │
│  └──────┬──────┘                                           │
│         │                                                  │
│    ┌────┴────┐                                            │
│    ↓         ↓                                            │
│  ┌────┐   ┌────┐                                          │
│  │Web1│   │Web2│ (静态文件服务)                            │
│  └────┘   └────┘                                          │
│                                                             │
│  WebSocket连接                                             │
│  ┌─────────────┐                                           │
│  │ Socket.io   │                                           │
│  │   Server    │                                           │
│  └─────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 构建配置

**Vite配置**:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  
  build: {
    // 输出目录
    outDir: 'dist',
    
    // 代码分割
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['antd', '@ant-design/icons'],
          'chart-vendor': ['echarts'],
          'utils': ['axios', 'dayjs', 'lodash-es'],
        },
      },
    },
    
    // 压缩配置
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,  // 生产环境移除console
        drop_debugger: true,
      },
    },
    
    // 资源内联阈值
    assetsInlineLimit: 4096,
    
    // 启用CSS代码分割
    cssCodeSplit: true,
    
    // 生成sourcemap
    sourcemap: process.env.NODE_ENV === 'development',
  },
  
  // 开发服务器配置
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
      },
    },
  },
});
```

### 9.3 Nginx配置

```nginx
# nginx.conf
server {
    listen 80;
    server_name log-management.example.com;
    
    # 重定向到HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name log-management.example.com;
    
    # SSL证书
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    # 静态文件根目录
    root /var/www/log-management/dist;
    index index.html;
    
    # Gzip压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1000;
    gzip_comp_level 6;
    
    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # API代理
    location /api/ {
        proxy_pass http://backend:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # WebSocket代理
    location /ws/ {
        proxy_pass http://backend:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
    
    # SPA路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';" always;
}
```

### 9.4 Docker部署

**Dockerfile**:

```dockerfile
# 构建阶段
FROM node:18-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./

# 安装依赖
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建
RUN pnpm build

# 生产阶段
FROM nginx:alpine

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制Nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 启动Nginx
CMD ["nginx", "-g", "daemon off;"]
```

**docker-compose.yml**:

```yaml
version: '3.8'

services:
  web:
    build:
      context: ./web
      dockerfile: Dockerfile
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./ssl:/etc/nginx/ssl:ro
    environment:
      - NODE_ENV=production
    depends_on:
      - api
    restart: unless-stopped
    
  api:
    image: log-management-api:latest
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/logdb
      - REDIS_URL=redis://redis:6379
    restart: unless-stopped
```

### 9.5 CI/CD流程

**GitHub Actions配置**:

```yaml
# .github/workflows/deploy.yml
name: Deploy Frontend

on:
  push:
    branches: [main]
    paths:
      - 'web/**'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout代码
        uses: actions/checkout@v3
      
      - name: 设置Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: 安装pnpm
        run: npm install -g pnpm
      
      - name: 安装依赖
        run: |
          cd web
          pnpm install --frozen-lockfile
      
      - name: 运行测试
        run: |
          cd web
          pnpm test
      
      - name: 构建
        run: |
          cd web
          pnpm build
      
      - name: 构建Docker镜像
        run: |
          docker build -t log-management-web:${{ github.sha }} ./web
          docker tag log-management-web:${{ github.sha }} log-management-web:latest
      
      - name: 推送到镜像仓库
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push log-management-web:${{ github.sha }}
          docker push log-management-web:latest
      
      - name: 部署到Kubernetes
        run: |
          kubectl set image deployment/web web=log-management-web:${{ github.sha }}
          kubectl rollout status deployment/web
```

### 9.6 资源配置

**Kubernetes部署配置**:

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: log-management-web
  namespace: log-management
spec:
  replicas: 3
  selector:
    matchLabels:
      app: log-management-web
  template:
    metadata:
      labels:
        app: log-management-web
    spec:
      containers:
      - name: web
        image: log-management-web:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: log-management-web
  namespace: log-management
spec:
  selector:
    app: log-management-web
  ports:
  - port: 80
    targetPort: 80
  type: LoadBalancer
```

---

## 10. 监控与运维

### 10.1 监控指标

**前端性能指标**:

```typescript
// 性能指标采集
const metrics = {
  // 页面加载指标
  'page_load_time': {
    type: 'histogram',
    help: '页面加载时间(毫秒)',
    buckets: [100, 500, 1000, 2000, 5000],
  },
  
  // API请求指标
  'api_request_duration': {
    type: 'histogram',
    help: 'API请求耗时(毫秒)',
    labels: ['method', 'endpoint', 'status'],
  },
  
  // WebSocket指标
  'websocket_connection_status': {
    type: 'gauge',
    help: 'WebSocket连接状态(0=断开,1=连接)',
  },
  
  'websocket_message_rate': {
    type: 'gauge',
    help: 'WebSocket消息接收速率(条/秒)',
  },
  
  // 用户交互指标
  'user_interaction_count': {
    type: 'counter',
    help: '用户交互次数',
    labels: ['action'],
  },
  
  // 错误指标
  'frontend_error_count': {
    type: 'counter',
    help: '前端错误次数',
    labels: ['type', 'message'],
  },
  
  // 资源加载指标
  'resource_load_time': {
    type: 'histogram',
    help: '资源加载时间(毫秒)',
    labels: ['type'],
  },
};
```

**监控实现**:

```typescript
// 错误监控
window.addEventListener('error', (event) => {
  // 上报错误
  reportError({
    type: 'runtime_error',
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error?.stack,
    timestamp: Date.now(),
  });
});

// Promise错误监控
window.addEventListener('unhandledrejection', (event) => {
  reportError({
    type: 'promise_rejection',
    message: event.reason?.message || String(event.reason),
    stack: event.reason?.stack,
    timestamp: Date.now(),
  });
});

// React错误边界
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    reportError({
      type: 'react_error',
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: Date.now(),
    });
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorPage />;
    }
    return this.props.children;
  }
}
```

### 10.2 告警规则（支持热更新）

**内置告警规则**:

| 告警 | 条件 | 级别 | 处理 | 热更新 |
|------|------|------|------|--------|
| 页面加载慢 | P95 > 3s | Warning | 检查CDN和网络 | ✅ 支持 |
| API请求失败率高 | 失败率 > 5% | Critical | 检查后端服务 | ✅ 支持 |
| WebSocket频繁断开 | 1分钟内断开3次 | Warning | 检查网络稳定性 | ✅ 支持 |
| 前端错误激增 | 5分钟内错误 > 100 | Critical | 回滚版本 | ✅ 支持 |
| 内存泄漏 | 内存持续增长 > 500MB | Warning | 检查代码 | ✅ 支持 |
| 资源加载失败 | 失败率 > 10% | Warning | 检查CDN | ✅ 支持 |

**告警规则热更新实现**:

```typescript
// 告警规则数据模型
interface AlertRule {
  id: string;                      // 规则ID
  name: string;                    // 规则名称
  enabled: boolean;                // 是否启用
  metric: string;                  // 监控指标
  condition: {
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'; // 比较操作符
    threshold: number;             // 阈值
    duration: number;              // 持续时间(秒)
  };
  severity: 'info' | 'warning' | 'critical'; // 告警级别
  notification: {
    channels: string[];            // 通知渠道(email/dingtalk/webhook)
    recipients: string[];          // 接收人
    template?: string;             // 通知模板
  };
  actions?: {                      // 自动处理动作
    type: string;
    config: Record<string, any>;
  }[];
  metadata?: Record<string, any>; // 额外元数据
}

// 告警规则管理器
class AlertRuleManager {
  private rules: Map<string, AlertRule>;
  private socket: Socket;
  private evaluationInterval: NodeJS.Timer;
  
  constructor() {
    this.rules = new Map();
    this.initWebSocket();
    this.startEvaluation();
  }
  
  // 初始化WebSocket连接
  private initWebSocket() {
    this.socket = io(process.env.REACT_APP_WS_URL, {
      auth: { token: getAuthToken() },
    });
    
    // 订阅告警规则更新
    this.socket.on('alert:rule:update', (rule: AlertRule) => {
      this.updateRule(rule);
    });
    
    this.socket.on('alert:rule:delete', (ruleId: string) => {
      this.deleteRule(ruleId);
    });
    
    // 连接成功后请求所有规则
    this.socket.on('connect', () => {
      this.socket.emit('alert:rules:request');
    });
    
    // 接收所有规则
    this.socket.on('alert:rules:response', (rules: AlertRule[]) => {
      rules.forEach(rule => this.rules.set(rule.id, rule));
      console.log(`已加载 ${rules.length} 条告警规则`);
    });
  }
  
  // 更新规则（热更新）
  private updateRule(rule: AlertRule) {
    const oldRule = this.rules.get(rule.id);
    
    // 验证规则
    if (!this.validateRule(rule)) {
      console.error('告警规则验证失败:', rule);
      message.error(`告警规则 "${rule.name}" 验证失败`);
      return;
    }
    
    // 更新规则
    this.rules.set(rule.id, rule);
    
    // 保存到LocalStorage
    this.saveToLocalStorage();
    
    // 记录审计日志
    this.logRuleChange('UPDATE', oldRule, rule);
    
    // 显示通知
    message.success(`告警规则 "${rule.name}" 已更新`);
  }
  
  // 删除规则
  private deleteRule(ruleId: string) {
    const rule = this.rules.get(ruleId);
    if (rule) {
      this.rules.delete(ruleId);
      this.saveToLocalStorage();
      this.logRuleChange('DELETE', rule, null);
      message.info(`告警规则 "${rule.name}" 已删除`);
    }
  }
  
  // 验证规则
  private validateRule(rule: AlertRule): boolean {
    // 检查必填字段
    if (!rule.id || !rule.name || !rule.metric) {
      return false;
    }
    
    // 检查阈值合理性
    if (rule.condition.threshold < 0) {
      return false;
    }
    
    // 检查持续时间
    if (rule.condition.duration < 0 || rule.condition.duration > 3600) {
      return false;
    }
    
    // 检查通知渠道
    if (rule.notification.channels.length === 0) {
      return false;
    }
    
    return true;
  }
  
  // 开始评估告警规则
  private startEvaluation() {
    // 每30秒评估一次
    this.evaluationInterval = setInterval(() => {
      this.evaluateRules();
    }, 30000);
  }
  
  // 评估所有规则
  private async evaluateRules() {
    for (const [id, rule] of this.rules) {
      if (!rule.enabled) continue;
      
      try {
        const triggered = await this.evaluateRule(rule);
        if (triggered) {
          this.triggerAlert(rule);
        }
      } catch (error) {
        console.error(`评估规则 ${rule.name} 失败:`, error);
      }
    }
  }
  
  // 评估单个规则
  private async evaluateRule(rule: AlertRule): Promise<boolean> {
    // 获取指标值
    const metricValue = await this.getMetricValue(rule.metric);
    
    // 比较阈值
    const { operator, threshold } = rule.condition;
    
    switch (operator) {
      case 'gt': return metricValue > threshold;
      case 'gte': return metricValue >= threshold;
      case 'lt': return metricValue < threshold;
      case 'lte': return metricValue <= threshold;
      case 'eq': return metricValue === threshold;
      default: return false;
    }
  }
  
  // 获取指标值
  private async getMetricValue(metric: string): Promise<number> {
    // 从性能监控系统获取指标值
    const response = await api.get(`/api/v1/metrics/${metric}`);
    return response.data.value;
  }
  
  // 触发告警
  private triggerAlert(rule: AlertRule) {
    const alert = {
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      timestamp: Date.now(),
      message: `告警: ${rule.name}`,
    };
    
    // 发送通知
    this.sendNotification(rule, alert);
    
    // 执行自动处理动作
    if (rule.actions) {
      this.executeActions(rule.actions, alert);
    }
    
    // 记录告警历史
    this.logAlert(alert);
  }
  
  // 发送通知
  private sendNotification(rule: AlertRule, alert: any) {
    rule.notification.channels.forEach(channel => {
      switch (channel) {
        case 'email':
          this.sendEmail(rule.notification.recipients, alert);
          break;
        case 'dingtalk':
          this.sendDingTalk(rule.notification.recipients, alert);
          break;
        case 'webhook':
          this.sendWebhook(rule.notification.recipients, alert);
          break;
      }
    });
  }
  
  // 保存到LocalStorage
  private saveToLocalStorage() {
    const rulesArray = Array.from(this.rules.values());
    localStorage.setItem('alertRules', JSON.stringify(rulesArray));
  }
  
  // 记录规则变更
  private logRuleChange(action: string, oldRule: AlertRule | null, newRule: AlertRule | null) {
    api.post('/api/v1/audit/alert-rule-change', {
      action,
      oldRule,
      newRule,
      timestamp: Date.now(),
      userId: getCurrentUserId(),
    });
  }
  
  // 记录告警
  private logAlert(alert: any) {
    api.post('/api/v1/alerts/log', alert);
  }
  
  // 获取所有规则
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }
  
  // 获取单个规则
  getRule(id: string): AlertRule | undefined {
    return this.rules.get(id);
  }
}

// 全局告警规则管理器实例
export const alertRuleManager = new AlertRuleManager();
```

**自定义告警设置UI**:

```typescript
// 自定义告警规则编辑器
const AlertRuleEditor: React.FC = () => {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  
  // 加载规则
  useEffect(() => {
    const loadedRules = alertRuleManager.getRules();
    setRules(loadedRules);
  }, []);
  
  // 创建新规则
  const handleCreate = () => {
    setEditingRule({
      id: uuid(),
      name: '',
      enabled: true,
      metric: 'page_load_time',
      condition: {
        operator: 'gt',
        threshold: 3000,
        duration: 300,
      },
      severity: 'warning',
      notification: {
        channels: ['email'],
        recipients: [],
      },
    });
    setModalVisible(true);
  };
  
  // 编辑规则
  const handleEdit = (rule: AlertRule) => {
    setEditingRule({ ...rule });
    setModalVisible(true);
  };
  
  // 保存规则
  const handleSave = async () => {
    if (!editingRule) return;
    
    try {
      // 发送到后端
      await api.post('/api/v1/alert/rules', editingRule);
      
      message.success('告警规则已保存');
      setModalVisible(false);
      
      // 刷新列表
      const updatedRules = alertRuleManager.getRules();
      setRules(updatedRules);
    } catch (error) {
      message.error('保存失败: ' + error.message);
    }
  };
  
  // 删除规则
  const handleDelete = async (ruleId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条告警规则吗？',
      onOk: async () => {
        try {
          await api.delete(`/api/v1/alert/rules/${ruleId}`);
          message.success('告警规则已删除');
          
          const updatedRules = alertRuleManager.getRules();
          setRules(updatedRules);
        } catch (error) {
          message.error('删除失败: ' + error.message);
        }
      },
    });
  };
  
  // 切换启用状态
  const handleToggle = async (ruleId: string, enabled: boolean) => {
    try {
      await api.patch(`/api/v1/alert/rules/${ruleId}`, { enabled });
      
      const updatedRules = alertRuleManager.getRules();
      setRules(updatedRules);
    } catch (error) {
      message.error('更新失败: ' + error.message);
    }
  };
  
  return (
    <div className="alert-rule-editor">
      <div className="header">
        <h2>告警规则管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          新建规则
        </Button>
      </div>
      
      {/* 规则列表 */}
      <Table
        dataSource={rules}
        rowKey="id"
        columns={[
          {
            title: '规则名称',
            dataIndex: 'name',
            key: 'name',
          },
          {
            title: '监控指标',
            dataIndex: 'metric',
            key: 'metric',
          },
          {
            title: '条件',
            key: 'condition',
            render: (_, record) => (
              <span>
                {record.condition.operator} {record.condition.threshold}
              </span>
            ),
          },
          {
            title: '级别',
            dataIndex: 'severity',
            key: 'severity',
            render: (severity) => (
              <Tag color={
                severity === 'critical' ? 'red' :
                severity === 'warning' ? 'orange' : 'blue'
              }>
                {severity.toUpperCase()}
              </Tag>
            ),
          },
          {
            title: '状态',
            key: 'enabled',
            render: (_, record) => (
              <Switch
                checked={record.enabled}
                onChange={(checked) => handleToggle(record.id, checked)}
              />
            ),
          },
          {
            title: '操作',
            key: 'actions',
            render: (_, record) => (
              <Space>
                <Button size="small" onClick={() => handleEdit(record)}>
                  编辑
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() => handleDelete(record.id)}
                >
                  删除
                </Button>
              </Space>
            ),
          },
        ]}
      />
      
      {/* 编辑对话框 */}
      <Modal
        title={editingRule?.id ? '编辑告警规则' : '新建告警规则'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        width={800}
      >
        {editingRule && (
          <Form layout="vertical">
            <Form.Item label="规则名称" required>
              <Input
                value={editingRule.name}
                onChange={(e) =>
                  setEditingRule({ ...editingRule, name: e.target.value })
                }
                placeholder="例如: 页面加载慢"
              />
            </Form.Item>
            
            <Form.Item label="监控指标" required>
              <Select
                value={editingRule.metric}
                onChange={(value) =>
                  setEditingRule({ ...editingRule, metric: value })
                }
              >
                <Option value="page_load_time">页面加载时间</Option>
                <Option value="api_error_rate">API错误率</Option>
                <Option value="websocket_status">WebSocket状态</Option>
                <Option value="frontend_error_count">前端错误数</Option>
                <Option value="memory_usage">内存使用量</Option>
                <Option value="resource_load_error_rate">资源加载失败率</Option>
              </Select>
            </Form.Item>
            
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="比较操作符" required>
                  <Select
                    value={editingRule.condition.operator}
                    onChange={(value) =>
                      setEditingRule({
                        ...editingRule,
                        condition: { ...editingRule.condition, operator: value },
                      })
                    }
                  >
                    <Option value="gt">大于 (&gt;)</Option>
                    <Option value="gte">大于等于 (&gt;=)</Option>
                    <Option value="lt">小于 (&lt;)</Option>
                    <Option value="lte">小于等于 (&lt;=)</Option>
                    <Option value="eq">等于 (=)</Option>
                  </Select>
                </Form.Item>
              </Col>
              
              <Col span={8}>
                <Form.Item label="阈值" required>
                  <InputNumber
                    value={editingRule.condition.threshold}
                    onChange={(value) =>
                      setEditingRule({
                        ...editingRule,
                        condition: {
                          ...editingRule.condition,
                          threshold: value || 0,
                        },
                      })
                    }
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              
              <Col span={8}>
                <Form.Item label="持续时间(秒)" required>
                  <InputNumber
                    value={editingRule.condition.duration}
                    onChange={(value) =>
                      setEditingRule({
                        ...editingRule,
                        condition: {
                          ...editingRule.condition,
                          duration: value || 0,
                        },
                      })
                    }
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
            </Row>
            
            <Form.Item label="告警级别" required>
              <Radio.Group
                value={editingRule.severity}
                onChange={(e) =>
                  setEditingRule({ ...editingRule, severity: e.target.value })
                }
              >
                <Radio.Button value="info">信息</Radio.Button>
                <Radio.Button value="warning">警告</Radio.Button>
                <Radio.Button value="critical">严重</Radio.Button>
              </Radio.Group>
            </Form.Item>
            
            <Form.Item label="通知渠道" required>
              <Checkbox.Group
                value={editingRule.notification.channels}
                onChange={(values) =>
                  setEditingRule({
                    ...editingRule,
                    notification: {
                      ...editingRule.notification,
                      channels: values as string[],
                    },
                  })
                }
              >
                <Checkbox value="email">邮件</Checkbox>
                <Checkbox value="dingtalk">钉钉</Checkbox>
                <Checkbox value="webhook">Webhook</Checkbox>
              </Checkbox.Group>
            </Form.Item>
            
            <Form.Item label="接收人">
              <Select
                mode="tags"
                value={editingRule.notification.recipients}
                onChange={(values) =>
                  setEditingRule({
                    ...editingRule,
                    notification: {
                      ...editingRule.notification,
                      recipients: values,
                    },
                  })
                }
                placeholder="输入邮箱或钉钉ID"
              />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};
```

**后端API支持**:

```go
// 告警规则API
// POST /api/v1/alert/rules - 创建/更新规则
func CreateOrUpdateAlertRule(c *gin.Context) {
    var rule AlertRule
    if err := c.ShouldBindJSON(&rule); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    // 验证规则
    if err := validateAlertRule(&rule); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    // 保存到数据库
    if err := db.Save(&rule).Error; err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    // 通过WebSocket推送到所有在线用户
    wsHub.Broadcast("alert:rule:update", rule)
    
    // 记录审计日志
    auditLog.Log(c.GetString("userId"), "ALERT_RULE_UPDATE", rule.ID)
    
    c.JSON(200, rule)
}

// DELETE /api/v1/alert/rules/:id - 删除规则
func DeleteAlertRule(c *gin.Context) {
    ruleID := c.Param("id")
    
    // 从数据库删除
    if err := db.Delete(&AlertRule{}, "id = ?", ruleID).Error; err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    // 通过WebSocket通知所有用户
    wsHub.Broadcast("alert:rule:delete", ruleID)
    
    // 记录审计日志
    auditLog.Log(c.GetString("userId"), "ALERT_RULE_DELETE", ruleID)
    
    c.JSON(200, gin.H{"success": true})
}

// GET /api/v1/alert/rules - 获取所有规则
func GetAlertRules(c *gin.Context) {
    var rules []AlertRule
    if err := db.Find(&rules).Error; err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, rules)
}
```

**YAML配置文件作为备份机制**:

```yaml
# configs/alert_rules.yaml
# 当WebSocket/数据库不可用时，从此文件加载默认规则
alert_rules:
  - id: "rule-page-load"
    name: "页面加载慢"
    enabled: true
    metric: "page_load_time"
    condition:
      operator: "gt"
      threshold: 3000
      duration: 300
    severity: "warning"
    notification:
      channels: ["email", "dingtalk"]
      recipients: ["ops@example.com"]
  
  - id: "rule-api-error"
    name: "API请求失败率高"
    enabled: true
    metric: "api_error_rate"
    condition:
      operator: "gt"
      threshold: 0.05
      duration: 300
    severity: "critical"
    notification:
      channels: ["email", "dingtalk"]
      recipients: ["ops@example.com"]
```

### 10.3 日志规范

**日志级别**:

| 级别 | 使用场景 | 示例 |
|------|---------|------|
| DEBUG | 调试信息 | 组件渲染、状态变更 |
| INFO | 一般信息 | 用户操作、页面跳转 |
| WARN | 警告信息 | API请求慢、资源加载失败 |
| ERROR | 错误信息 | 运行时错误、网络错误 |

**日志格式**:

```typescript
// 统一日志格式
interface LogEntry {
  timestamp: string;           // ISO 8601格式
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;             // 日志消息
  context: {
    userId?: string;           // 用户ID
    sessionId?: string;        // 会话ID
    page: string;              // 当前页面
    action?: string;           // 用户操作
  };
  error?: {
    message: string;           // 错误消息
    stack?: string;            // 错误堆栈
    code?: string;             // 错误代码
  };
  metadata?: Record<string, any>; // 额外元数据
}

// 日志工具类
class Logger {
  private static instance: Logger;
  
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }
  
  private log(level: string, message: string, context?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: level as any,
      message,
      context: {
        userId: getCurrentUserId(),
        sessionId: getSessionId(),
        page: window.location.pathname,
        ...context,
      },
    };
    
    // 控制台输出
    console[level.toLowerCase()](entry);
    
    // 上报到后端
    if (level === 'ERROR' || level === 'WARN') {
      this.sendToBackend(entry);
    }
  }
  
  debug(message: string, context?: any) {
    this.log('DEBUG', message, context);
  }
  
  info(message: string, context?: any) {
    this.log('INFO', message, context);
  }
  
  warn(message: string, context?: any) {
    this.log('WARN', message, context);
  }
  
  error(message: string, error?: Error, context?: any) {
    this.log('ERROR', message, {
      ...context,
      error: {
        message: error?.message,
        stack: error?.stack,
      },
    });
  }
  
  private sendToBackend(entry: LogEntry) {
    // 批量发送，避免频繁请求
    navigator.sendBeacon('/api/v1/logs/frontend', JSON.stringify(entry));
  }
}

// 使用示例
const logger = Logger.getInstance();
logger.info('用户登录成功', { userId: 'user-123' });
logger.error('API请求失败', new Error('Network error'), { endpoint: '/api/logs' });
```

### 10.4 运维手册

**常见问题处理**:

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 页面白屏 | JS加载失败、运行时错误 | 1. 检查CDN<br>2. 查看浏览器控制台<br>3. 回滚版本 |
| 搜索无结果 | API服务异常、ES集群问题 | 1. 检查API健康状态<br>2. 检查ES集群<br>3. 查看后端日志 |
| WebSocket断开 | 网络问题、服务重启 | 1. 检查网络连接<br>2. 查看服务状态<br>3. 等待自动重连 |
| 内存泄漏 | 组件未清理、事件监听器未移除 | 1. 使用Chrome DevTools分析<br>2. 检查useEffect清理函数<br>3. 检查事件监听器 |
| 性能下降 | 数据量过大、渲染优化不足 | 1. 启用虚拟滚动<br>2. 减少渲染数据量<br>3. 使用React.memo |

**健康检查**:

```typescript
// 前端健康检查端点
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      api: checkAPIConnection(),
      websocket: checkWebSocketConnection(),
      localStorage: checkLocalStorage(),
    },
  };
  
  const allHealthy = Object.values(health.checks).every(c => c.status === 'ok');
  
  res.status(allHealthy ? 200 : 503).json(health);
});
```

**性能优化检查清单**:

- [ ] 启用Gzip/Brotli压缩
- [ ] 配置CDN缓存
- [ ] 启用HTTP/2
- [ ] 代码分割和懒加载
- [ ] 图片优化(WebP格式)
- [ ] 使用虚拟滚动
- [ ] 防抖节流优化
- [ ] React.memo优化
- [ ] 移除未使用的依赖
- [ ] 启用Tree Shaking

---

## 11. 配置热更新详细设计

### 11.1 可热更新配置项

**UI配置**:

| 配置项 | 类型 | 默认值 | 说明 | 更新方式 | 生效时间 | 是否推荐热更新 |
|--------|------|--------|------|----------|----------|---------------|
| ui_theme | string | "light" | 默认主题(light/dark) | WebSocket推送 | 立即 | ✅ 推荐 |
| animation_enabled | bool | true | 是否启用动画 | WebSocket推送 | 立即 | ✅ 推荐 |
| animation_duration | int | 300 | 动画时长(毫秒) | WebSocket推送 | 下次动画 | ✅ 推荐 |
| virtual_scroll_enabled | bool | true | 是否启用虚拟滚动 | WebSocket推送 | 刷新页面 | ✅ 推荐 |
| virtual_scroll_overscan | int | 10 | 虚拟滚动预渲染行数 | WebSocket推送 | 刷新页面 | ✅ 推荐 |
| lazy_load_enabled | bool | true | 是否启用懒加载 | WebSocket推送 | 刷新页面 | ✅ 推荐 |
| skeleton_enabled | bool | true | 是否显示骨架屏 | WebSocket推送 | 立即 | ✅ 推荐 |

**搜索配置**:

| 配置项 | 类型 | 默认值 | 说明 | 更新方式 | 生效时间 | 是否推荐热更新 |
|--------|------|--------|------|----------|----------|---------------|
| search_enabled | bool | true | 是否启用搜索功能 | WebSocket推送 | 立即 | ✅ 推荐 |
| autocomplete_enabled | bool | true | 是否启用自动补全 | WebSocket推送 | 立即 | ✅ 推荐 |
| autocomplete_delay | int | 100 | 自动补全延迟(毫秒) | WebSocket推送 | 下次输入 | ✅ 推荐 |
| search_history_size | int | 20 | 搜索历史保留数量 | WebSocket推送 | 立即 | ✅ 推荐 |
| highlight_enabled | bool | true | 是否高亮搜索结果 | WebSocket推送 | 下次搜索 | ✅ 推荐 |
| regex_search_enabled | bool | true | 是否支持正则搜索 | WebSocket推送 | 立即 | ✅ 推荐 |

**实时更新配置**:

| 配置项 | 类型 | 默认值 | 说明 | 更新方式 | 生效时间 | 是否推荐热更新 |
|--------|------|--------|------|----------|----------|---------------|
| realtime_enabled | bool | true | 是否启用实时更新 | WebSocket推送 | 立即 | ✅ 推荐 |
| websocket_url | string | "" | WebSocket服务地址 | YAML + 刷新 | 刷新页面 | ⚠️ 不推荐(需要重建WebSocket连接) |
| reconnect_attempts | int | 5 | 最大重连次数 | WebSocket推送 | 下次重连 | ✅ 推荐 |
| reconnect_delay | int | 3000 | 重连延迟(毫秒) | WebSocket推送 | 下次重连 | ✅ 推荐 |
| max_realtime_logs | int | 1000 | 实时日志最大数量 | WebSocket推送 | 立即 | ✅ 推荐 |
| auto_scroll_enabled | bool | true | 是否默认启用自动滚动 | WebSocket推送 | 立即 | ✅ 推荐 |

**批量操作配置**:

| 配置项 | 类型 | 默认值 | 说明 | 更新方式 | 生效时间 | 是否推荐热更新 |
|--------|------|--------|------|----------|----------|---------------|
| batch_operation_enabled | bool | true | 是否启用批量操作 | WebSocket推送 | 立即 | ✅ 推荐 |
| batch_size_limit | int | 1000 | 批量操作最大数量 | WebSocket推送 | 下次操作 | ✅ 推荐 |
| undo_timeout | int | 30 | 撤销超时时间(秒) | WebSocket推送 | 立即 | ✅ 推荐 |
| export_formats | array | ["json","csv","txt"] | 支持的导出格式 | WebSocket推送 | 下次导出 | ✅ 推荐 |

**告警规则配置**:

| 配置项 | 类型 | 默认值 | 说明 | 更新方式 | 生效时间 | 是否推荐热更新 |
|--------|------|--------|------|----------|----------|---------------|
| alert_rules | array | [] | 自定义告警规则列表 | WebSocket推送 | 立即 | ✅ 推荐 |
| alert_evaluation_interval | int | 30 | 告警评估间隔(秒) | WebSocket推送 | 下次评估 | ✅ 推荐 |
| alert_notification_enabled | bool | true | 是否启用告警通知 | WebSocket推送 | 立即 | ✅ 推荐 |
| alert_notification_channels | array | ["email"] | 默认通知渠道 | WebSocket推送 | 下次通知 | ✅ 推荐 |
| alert_history_retention | int | 30 | 告警历史保留天数 | WebSocket推送 | 立即 | ✅ 推荐 |

**备用机制（YAML文件）**:

当WebSocket连接不可用或数据库故障时，系统会从以下YAML文件加载配置：

```yaml
# configs/frontend_config.yaml
ui:
  theme: "light"
  animation_enabled: true
  animation_duration: 300
  virtual_scroll_enabled: true
  virtual_scroll_overscan: 10

search:
  enabled: true
  autocomplete_enabled: true
  autocomplete_delay: 100
  history_size: 20

realtime:
  enabled: true
  websocket_url: "ws://localhost:8080/ws"
  reconnect_attempts: 5
  reconnect_delay: 3000

alerts:
  evaluation_interval: 30
  notification_enabled: true
  notification_channels: ["email", "dingtalk"]
  history_retention: 30
  
  # 默认告警规则
  rules:
    - id: "rule-page-load"
      name: "页面加载慢"
      enabled: true
      metric: "page_load_time"
      condition:
        operator: "gt"
        threshold: 3000
        duration: 300
      severity: "warning"
```

### 11.2 热更新实现

**配置订阅机制**:

```typescript
// 配置管理器
class ConfigManager {
  private config: UIConfig;
  private socket: Socket;
  private listeners: Map<string, Set<(value: any) => void>>;
  
  constructor() {
    this.config = this.loadFromLocalStorage();
    this.listeners = new Map();
    this.initWebSocket();
  }
  
  // 初始化WebSocket连接
  private initWebSocket() {
    this.socket = io(process.env.REACT_APP_WS_URL, {
      auth: {
        token: getAuthToken(),
      },
    });
    
    // 订阅配置更新
    this.socket.on('config:update', (update: ConfigUpdate) => {
      this.handleConfigUpdate(update);
    });
    
    // 连接成功后请求最新配置
    this.socket.on('connect', () => {
      this.socket.emit('config:request');
    });
  }
  
  // 处理配置更新
  private handleConfigUpdate(update: ConfigUpdate) {
    const { key, value, version } = update;
    
    // 验证配置
    if (!this.validateConfig(key, value)) {
      console.error('配置验证失败:', key, value);
      return;
    }
    
    // 更新配置
    const oldValue = this.config[key];
    this.config[key] = value;
    
    // 保存到LocalStorage
    this.saveToLocalStorage();
    
    // 通知监听器
    this.notifyListeners(key, value, oldValue);
    
    // 记录审计日志
    this.logConfigChange(key, oldValue, value, version);
    
    // 显示通知
    message.info(`配置已更新: ${key}`);
  }
  
  // 验证配置
  private validateConfig(key: string, value: any): boolean {
    const validators: Record<string, (v: any) => boolean> = {
      animation_duration: (v) => typeof v === 'number' && v >= 100 && v <= 1000,
      batch_size_limit: (v) => typeof v === 'number' && v >= 1 && v <= 10000,
      search_history_size: (v) => typeof v === 'number' && v >= 1 && v <= 100,
      reconnect_attempts: (v) => typeof v === 'number' && v >= 1 && v <= 10,
      max_realtime_logs: (v) => typeof v === 'number' && v >= 100 && v <= 10000,
    };
    
    const validator = validators[key];
    return validator ? validator(value) : true;
  }
  
  // 获取配置值
  get<K extends keyof UIConfig>(key: K): UIConfig[K] {
    return this.config[key];
  }
  
  // 监听配置变更
  subscribe<K extends keyof UIConfig>(
    key: K,
    listener: (value: UIConfig[K], oldValue: UIConfig[K]) => void
  ): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    
    this.listeners.get(key)!.add(listener as any);
    
    // 返回取消订阅函数
    return () => {
      this.listeners.get(key)?.delete(listener as any);
    };
  }
  
  // 通知监听器
  private notifyListeners(key: string, value: any, oldValue: any) {
    const listeners = this.listeners.get(key);
    if (listeners) {
      listeners.forEach(listener => listener(value, oldValue));
    }
  }
  
  // 保存到LocalStorage
  private saveToLocalStorage() {
    localStorage.setItem('uiConfig', JSON.stringify(this.config));
  }
  
  // 从LocalStorage加载
  private loadFromLocalStorage(): UIConfig {
    const saved = localStorage.getItem('uiConfig');
    return saved ? JSON.parse(saved) : defaultConfig;
  }
  
  // 记录配置变更
  private logConfigChange(key: string, oldValue: any, newValue: any, version: string) {
    api.post('/api/v1/audit/config-change', {
      key,
      oldValue,
      newValue,
      version,
      timestamp: Date.now(),
      userId: getCurrentUserId(),
    });
  }
}

// 全局配置管理器实例
export const configManager = new ConfigManager();
```

**React Hook集成**:

```typescript
// 使用配置的Hook
export function useConfig<K extends keyof UIConfig>(key: K): UIConfig[K] {
  const [value, setValue] = useState(() => configManager.get(key));
  
  useEffect(() => {
    // 订阅配置变更
    const unsubscribe = configManager.subscribe(key, (newValue) => {
      setValue(newValue);
    });
    
    return unsubscribe;
  }, [key]);
  
  return value;
}

// 使用示例
const MyComponent: React.FC = () => {
  const animationEnabled = useConfig('animation_enabled');
  const animationDuration = useConfig('animation_duration');
  
  return (
    <motion.div
      animate={animationEnabled ? { opacity: 1 } : {}}
      transition={{ duration: animationDuration / 1000 }}
    >
      内容
    </motion.div>
  );
};
```

**配置更新API**:

```typescript
// 后端配置更新接口
app.put('/api/v1/ui/config', async (req, res) => {
  const { key, value } = req.body;
  
  // 验证权限
  if (!req.user.hasPermission('ui.config.write')) {
    return res.status(403).json({ error: '无权限' });
  }
  
  // 验证配置
  if (!validateConfig(key, value)) {
    return res.status(400).json({ error: '配置验证失败' });
  }
  
  // 保存到数据库
  await db.uiConfig.upsert({
    where: { key },
    update: { value, version: uuid() },
    create: { key, value, version: uuid() },
  });
  
  // 通过WebSocket推送到所有在线用户
  io.emit('config:update', {
    key,
    value,
    version: uuid(),
    timestamp: Date.now(),
  });
  
  // 记录审计日志
  await db.auditLog.create({
    data: {
      userId: req.user.id,
      action: 'CONFIG_UPDATE',
      resource: `ui.config.${key}`,
      details: { key, value },
    },
  });
  
  res.json({ success: true });
});
```

### 11.3 配置热更新灰度发布策略

**灰度发布流程**:

```typescript
// 配置灰度发布管理器
class ConfigCanaryManager {
  private canaryConfig: Map<string, CanaryConfig>;
  
  constructor() {
    this.canaryConfig = new Map();
  }
  
  // 创建灰度发布
  async createCanary(config: {
    key: string;              // 配置项
    value: any;               // 新值
    percentage: number;       // 灰度比例(0-100)
    targetUsers?: string[];   // 目标用户ID列表
    targetGroups?: string[];  // 目标用户组
    duration: number;         // 灰度持续时间(秒)
  }): Promise<string> {
    const canaryId = uuid();
    
    const canary: CanaryConfig = {
      id: canaryId,
      key: config.key,
      oldValue: configManager.get(config.key),
      newValue: config.value,
      percentage: config.percentage,
      targetUsers: config.targetUsers || [],
      targetGroups: config.targetGroups || [],
      startTime: Date.now(),
      endTime: Date.now() + config.duration * 1000,
      status: 'active',
      metrics: {
        totalUsers: 0,
        canaryUsers: 0,
        errorCount: 0,
        successCount: 0,
      },
    };
    
    this.canaryConfig.set(canaryId, canary);
    
    // 保存到后端
    await api.post('/api/v1/config/canary', canary);
    
    // 开始推送灰度配置
    this.startCanaryDeployment(canary);
    
    return canaryId;
  }
  
  // 开始灰度部署
  private startCanaryDeployment(canary: CanaryConfig) {
    // 通过WebSocket推送灰度配置
    io.emit('config:canary:start', {
      canaryId: canary.id,
      key: canary.key,
      value: canary.newValue,
      percentage: canary.percentage,
      targetUsers: canary.targetUsers,
      targetGroups: canary.targetGroups,
    });
    
    // 设置自动完成定时器
    setTimeout(() => {
      this.checkCanaryCompletion(canary.id);
    }, canary.endTime - canary.startTime);
  }
  
  // 检查灰度完成条件
  private async checkCanaryCompletion(canaryId: string) {
    const canary = this.canaryConfig.get(canaryId);
    if (!canary || canary.status !== 'active') return;
    
    // 检查错误率
    const errorRate = canary.metrics.errorCount / canary.metrics.canaryUsers;
    
    if (errorRate > 0.05) {
      // 错误率超过5%，自动回滚
      await this.rollbackCanary(canaryId, '错误率过高');
    } else {
      // 灰度成功，全量发布
      await this.promoteCanary(canaryId);
    }
  }
  
  // 全量发布
  async promoteCanary(canaryId: string): Promise<boolean> {
    const canary = this.canaryConfig.get(canaryId);
    if (!canary) return false;
    
    try {
      // 更新配置为新值
      await api.put('/api/v1/ui/config', {
        key: canary.key,
        value: canary.newValue,
      });
      
      // 推送到所有用户
      io.emit('config:update', {
        key: canary.key,
        value: canary.newValue,
        version: uuid(),
      });
      
      // 更新灰度状态
      canary.status = 'completed';
      this.canaryConfig.set(canaryId, canary);
      
      // 记录审计日志
      await api.post('/api/v1/audit/canary-promote', {
        canaryId,
        key: canary.key,
        metrics: canary.metrics,
      });
      
      message.success(`配置 ${canary.key} 已全量发布`);
      return true;
    } catch (error) {
      message.error('全量发布失败: ' + error.message);
      return false;
    }
  }
  
  // 回滚灰度
  async rollbackCanary(canaryId: string, reason: string): Promise<boolean> {
    const canary = this.canaryConfig.get(canaryId);
    if (!canary) return false;
    
    try {
      // 通知所有灰度用户回滚
      io.emit('config:canary:rollback', {
        canaryId,
        key: canary.key,
        value: canary.oldValue,
      });
      
      // 更新灰度状态
      canary.status = 'rolled_back';
      this.canaryConfig.set(canaryId, canary);
      
      // 记录审计日志
      await api.post('/api/v1/audit/canary-rollback', {
        canaryId,
        key: canary.key,
        reason,
        metrics: canary.metrics,
      });
      
      message.warning(`配置 ${canary.key} 灰度已回滚: ${reason}`);
      return true;
    } catch (error) {
      message.error('回滚失败: ' + error.message);
      return false;
    }
  }
  
  // 手动停止灰度
  async stopCanary(canaryId: string): Promise<boolean> {
    return this.rollbackCanary(canaryId, '手动停止');
  }
  
  // 获取灰度状态
  getCanaryStatus(canaryId: string): CanaryConfig | undefined {
    return this.canaryConfig.get(canaryId);
  }
  
  // 获取所有活跃的灰度
  getActiveCanaries(): CanaryConfig[] {
    return Array.from(this.canaryConfig.values())
      .filter(c => c.status === 'active');
  }
}

// 客户端灰度配置应用
class ClientCanaryHandler {
  private activeCanaries: Map<string, CanaryConfig>;
  
  constructor() {
    this.activeCanaries = new Map();
    this.initWebSocket();
  }
  
  private initWebSocket() {
    socket.on('config:canary:start', (canary: CanaryConfig) => {
      this.handleCanaryStart(canary);
    });
    
    socket.on('config:canary:rollback', (data: any) => {
      this.handleCanaryRollback(data);
    });
  }
  
  // 处理灰度开始
  private handleCanaryStart(canary: CanaryConfig) {
    // 判断当前用户是否在灰度范围内
    if (this.isUserInCanary(canary)) {
      // 应用灰度配置
      configManager.applyConfig(canary.key, canary.newValue);
      
      // 记录灰度用户
      this.activeCanaries.set(canary.id, canary);
      
      // 上报指标
      this.reportCanaryMetric(canary.id, 'applied');
      
      // 显示灰度提示
      message.info(`您正在体验新配置: ${canary.key}`, 5);
    }
  }
  
  // 判断用户是否在灰度范围
  private isUserInCanary(canary: CanaryConfig): boolean {
    const userId = getCurrentUserId();
    const userGroup = getCurrentUserGroup();
    
    // 1. 检查是否在目标用户列表
    if (canary.targetUsers.includes(userId)) {
      return true;
    }
    
    // 2. 检查是否在目标用户组
    if (canary.targetGroups.includes(userGroup)) {
      return true;
    }
    
    // 3. 按百分比随机选择
    if (canary.percentage > 0) {
      const hash = this.hashUserId(userId);
      return (hash % 100) < canary.percentage;
    }
    
    return false;
  }
  
  // 用户ID哈希（保证同一用户每次结果一致）
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  // 处理灰度回滚
  private handleCanaryRollback(data: any) {
    const canary = this.activeCanaries.get(data.canaryId);
    if (canary) {
      // 恢复旧配置
      configManager.applyConfig(data.key, data.value);
      
      // 移除灰度记录
      this.activeCanaries.delete(data.canaryId);
      
      // 上报指标
      this.reportCanaryMetric(data.canaryId, 'rolled_back');
      
      message.warning('配置已回滚到之前的版本');
    }
  }
  
  // 上报灰度指标
  private reportCanaryMetric(canaryId: string, event: string) {
    api.post('/api/v1/config/canary/metrics', {
      canaryId,
      userId: getCurrentUserId(),
      event,
      timestamp: Date.now(),
    });
  }
}

// 全局实例
export const canaryManager = new ConfigCanaryManager();
export const clientCanaryHandler = new ClientCanaryHandler();
```

**灰度发布UI界面**:

```typescript
// 灰度发布管理界面
const CanaryManagement: React.FC = () => {
  const [canaries, setCanaries] = useState<CanaryConfig[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  
  // 加载灰度列表
  useEffect(() => {
    loadCanaries();
  }, []);
  
  const loadCanaries = async () => {
    const response = await api.get('/api/v1/config/canary');
    setCanaries(response.data);
  };
  
  // 创建灰度发布
  const handleCreate = async (values: any) => {
    try {
      await canaryManager.createCanary({
        key: values.key,
        value: values.value,
        percentage: values.percentage,
        targetUsers: values.targetUsers?.split(',').map((s: string) => s.trim()),
        targetGroups: values.targetGroups,
        duration: values.duration * 3600, // 小时转秒
      });
      
      message.success('灰度发布已创建');
      setModalVisible(false);
      loadCanaries();
    } catch (error) {
      message.error('创建失败: ' + error.message);
    }
  };
  
  // 全量发布
  const handlePromote = async (canaryId: string) => {
    Modal.confirm({
      title: '确认全量发布',
      content: '确定要将此灰度配置推广到所有用户吗？',
      onOk: async () => {
        const success = await canaryManager.promoteCanary(canaryId);
        if (success) {
          loadCanaries();
        }
      },
    });
  };
  
  // 停止灰度
  const handleStop = async (canaryId: string) => {
    Modal.confirm({
      title: '确认停止灰度',
      content: '停止后将回滚到原配置，确定继续吗？',
      onOk: async () => {
        const success = await canaryManager.stopCanary(canaryId);
        if (success) {
          loadCanaries();
        }
      },
    });
  };
  
  return (
    <div className="canary-management">
      <div className="header">
        <h2>配置灰度发布</h2>
        <Button type="primary" onClick={() => setModalVisible(true)}>
          创建灰度发布
        </Button>
      </div>
      
      <Table
        dataSource={canaries}
        rowKey="id"
        columns={[
          {
            title: '配置项',
            dataIndex: 'key',
            key: 'key',
          },
          {
            title: '灰度比例',
            dataIndex: 'percentage',
            key: 'percentage',
            render: (percentage) => `${percentage}%`,
          },
          {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status) => (
              <Tag color={
                status === 'active' ? 'blue' :
                status === 'completed' ? 'green' : 'red'
              }>
                {status === 'active' ? '进行中' :
                 status === 'completed' ? '已完成' : '已回滚'}
              </Tag>
            ),
          },
          {
            title: '指标',
            key: 'metrics',
            render: (_, record) => (
              <Space direction="vertical" size="small">
                <span>灰度用户: {record.metrics.canaryUsers}</span>
                <span>成功: {record.metrics.successCount}</span>
                <span>失败: {record.metrics.errorCount}</span>
                <span>错误率: {
                  record.metrics.canaryUsers > 0
                    ? ((record.metrics.errorCount / record.metrics.canaryUsers) * 100).toFixed(2)
                    : 0
                }%</span>
              </Space>
            ),
          },
          {
            title: '剩余时间',
            key: 'remaining',
            render: (_, record) => {
              if (record.status !== 'active') return '-';
              const remaining = Math.max(0, record.endTime - Date.now());
              const hours = Math.floor(remaining / 3600000);
              const minutes = Math.floor((remaining % 3600000) / 60000);
              return `${hours}小时${minutes}分钟`;
            },
          },
          {
            title: '操作',
            key: 'actions',
            render: (_, record) => (
              <Space>
                {record.status === 'active' && (
                  <>
                    <Button
                      size="small"
                      type="primary"
                      onClick={() => handlePromote(record.id)}
                    >
                      全量发布
                    </Button>
                    <Button
                      size="small"
                      danger
                      onClick={() => handleStop(record.id)}
                    >
                      停止灰度
                    </Button>
                  </>
                )}
              </Space>
            ),
          },
        ]}
      />
      
      <Modal
        title="创建灰度发布"
        open={modalVisible}
        onOk={() => form.submit()}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            label="配置项"
            name="key"
            rules={[{ required: true, message: '请选择配置项' }]}
          >
            <Select placeholder="选择要灰度的配置项">
              <Option value="ui_theme">主题</Option>
              <Option value="animation_duration">动画时长</Option>
              <Option value="virtual_scroll_enabled">虚拟滚动</Option>
              <Option value="batch_size_limit">批量操作限制</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            label="新值"
            name="value"
            rules={[{ required: true, message: '请输入新值' }]}
          >
            <Input placeholder="输入新的配置值" />
          </Form.Item>
          
          <Form.Item
            label="灰度比例(%)"
            name="percentage"
            initialValue={10}
            rules={[{ required: true, message: '请输入灰度比例' }]}
          >
            <Slider min={0} max={100} marks={{ 0: '0%', 50: '50%', 100: '100%' }} />
          </Form.Item>
          
          <Form.Item
            label="目标用户ID（可选，逗号分隔）"
            name="targetUsers"
          >
            <Input.TextArea
              placeholder="user-1,user-2,user-3"
              rows={2}
            />
          </Form.Item>
          
          <Form.Item
            label="目标用户组（可选）"
            name="targetGroups"
          >
            <Select mode="multiple" placeholder="选择用户组">
              <Option value="admin">管理员</Option>
              <Option value="developer">开发者</Option>
              <Option value="tester">测试人员</Option>
              <Option value="beta">Beta用户</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            label="灰度持续时间（小时）"
            name="duration"
            initialValue={24}
            rules={[{ required: true, message: '请输入持续时间' }]}
          >
            <InputNumber min={1} max={168} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
```

**灰度发布策略说明**:

| 策略 | 说明 | 适用场景 |
|------|------|----------|
| 百分比灰度 | 按用户ID哈希随机选择指定比例的用户 | 大规模配置变更 |
| 白名单灰度 | 指定特定用户ID列表 | 内部测试、VIP用户 |
| 用户组灰度 | 按用户组（管理员/开发者/测试等）灰度 | 分组测试 |
| 混合灰度 | 组合以上策略 | 复杂场景 |

**灰度监控指标**:

| 指标 | 说明 | 告警阈值 |
|------|------|----------|
| 错误率 | 灰度用户中出现错误的比例 | > 5% 自动回滚 |
| 成功率 | 配置成功应用的比例 | < 95% 告警 |
| 响应时间 | 配置应用的平均响应时间 | > 500ms 告警 |
| 用户反馈 | 用户主动反馈的问题数量 | > 10 告警 |

**自动决策规则**:

```typescript
// 自动决策引擎
class CanaryDecisionEngine {
  // 检查是否应该自动全量发布
  shouldPromote(canary: CanaryConfig): boolean {
    const metrics = canary.metrics;
    
    // 1. 错误率低于1%
    const errorRate = metrics.errorCount / metrics.canaryUsers;
    if (errorRate > 0.01) return false;
    
    // 2. 至少有100个灰度用户
    if (metrics.canaryUsers < 100) return false;
    
    // 3. 灰度时间超过最小时长（4小时）
    const elapsed = Date.now() - canary.startTime;
    if (elapsed < 4 * 3600 * 1000) return false;
    
    // 4. 成功率高于99%
    const successRate = metrics.successCount / metrics.canaryUsers;
    if (successRate < 0.99) return false;
    
    return true;
  }
  
  // 检查是否应该自动回滚
  shouldRollback(canary: CanaryConfig): boolean {
    const metrics = canary.metrics;
    
    // 1. 错误率超过5%
    const errorRate = metrics.errorCount / metrics.canaryUsers;
    if (errorRate > 0.05) return true;
    
    // 2. 连续10个用户失败
    if (this.hasConsecutiveFailures(canary.id, 10)) return true;
    
    // 3. 用户投诉超过阈值
    if (this.getUserComplaints(canary.id) > 5) return true;
    
    return false;
  }
}
```

### 11.4 热更新验收标准

**功能验收**:

1. ✅ THE System SHALL 在配置变更后通过WebSocket推送到所有在线用户
2. ✅ WHEN 主题配置变更时，THE System SHALL 立即应用新主题(无需刷新)
3. ✅ WHEN 动画时长变更时，THE System SHALL 在下次动画时生效
4. ✅ THE System SHALL 支持通过API查询当前生效的UI配置
5. ✅ THE System SHALL 记录所有UI配置变更的审计日志
6. ✅ WHEN 配置验证失败时，THE System SHALL 保持原配置并显示错误提示
7. ✅ THE System SHALL 支持配置回滚到历史版本
8. ✅ WHEN WebSocket断开时，THE System SHALL 使用LocalStorage中的配置
9. ✅ THE System SHALL 在配置更新后显示通知提示用户
10. ✅ THE System SHALL 支持批量更新多个配置项

**告警规则热更新验收（新增）**:

1. ✅ THE System SHALL 支持通过Web界面创建、编辑、删除告警规则
2. ✅ WHEN 告警规则变更时，THE System SHALL 通过WebSocket立即推送到所有在线用户
3. ✅ THE System SHALL 在告警规则更新后立即生效，无需重启服务
4. ✅ THE System SHALL 支持启用/禁用告警规则，变更立即生效
5. ✅ THE System SHALL 验证告警规则的合理性（阈值、持续时间等）
6. ✅ WHEN 告警规则验证失败时，THE System SHALL 拒绝更新并显示错误信息
7. ✅ THE System SHALL 记录所有告警规则变更的审计日志
8. ✅ THE System SHALL 支持自定义告警通知渠道（邮件/钉钉/Webhook）
9. ✅ THE System SHALL 支持自定义告警级别（info/warning/critical）
10. ✅ WHEN WebSocket不可用时，THE System SHALL 从YAML文件加载默认告警规则

**灰度发布验收（新增）**:

1. ✅ THE System SHALL 支持按百分比进行配置灰度发布
2. ✅ THE System SHALL 支持按用户ID白名单进行灰度发布
3. ✅ THE System SHALL 支持按用户组进行灰度发布
4. ✅ THE System SHALL 在灰度期间实时监控错误率、成功率等指标
5. ✅ WHEN 灰度错误率超过5%时，THE System SHALL 自动回滚配置
6. ✅ THE System SHALL 支持手动停止灰度并回滚配置
7. ✅ THE System SHALL 支持手动将灰度配置全量发布
8. ✅ THE System SHALL 在灰度完成后自动决策是否全量发布或回滚
9. ✅ THE System SHALL 记录灰度发布的完整审计日志
10. ✅ THE System SHALL 在灰度期间向灰度用户显示提示信息
11. ✅ THE System SHALL 保证同一用户每次都在或不在灰度范围（基于用户ID哈希）
12. ✅ THE System SHALL 支持设置灰度持续时间，到期后自动决策

**性能验收**:

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 配置推送延迟 | < 100ms | WebSocket消息时间戳 |
| 配置应用时间 | < 50ms | Performance.now() |
| 配置验证时间 | < 10ms | 函数执行时间 |
| LocalStorage读写 | < 5ms | Performance.now() |
| 告警规则推送延迟 | < 100ms | WebSocket消息时间戳 |
| 告警规则评估时间 | < 50ms | 单个规则评估耗时 |

**可靠性验收**:

1. ✅ 配置更新失败时自动回滚
2. ✅ WebSocket断开时使用本地缓存配置
3. ✅ 配置验证失败时保持原配置
4. ✅ 支持配置版本管理和回滚
5. ✅ 配置变更有完整的审计日志
6. ✅ 告警规则更新失败时保持原规则
7. ✅ 告警规则支持版本管理和回滚
8. ✅ 数据库故障时从YAML文件加载默认配置

**降级策略**:

```typescript
// 配置加载优先级
const loadConfig = async (): Promise<UIConfig> => {
  try {
    // 1. 优先从WebSocket获取最新配置
    const wsConfig = await loadFromWebSocket();
    if (wsConfig) {
      return wsConfig;
    }
  } catch (error) {
    console.warn('从WebSocket加载配置失败:', error);
  }
  
  try {
    // 2. 从LocalStorage加载缓存配置
    const cachedConfig = loadFromLocalStorage();
    if (cachedConfig) {
      return cachedConfig;
    }
  } catch (error) {
    console.warn('从LocalStorage加载配置失败:', error);
  }
  
  try {
    // 3. 从API加载配置
    const apiConfig = await loadFromAPI();
    if (apiConfig) {
      return apiConfig;
    }
  } catch (error) {
    console.warn('从API加载配置失败:', error);
  }
  
  // 4. 使用默认配置
  console.warn('使用默认配置');
  return defaultConfig;
};
```

---

## 12. 风险与回滚

### 12.1 风险识别

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 浏览器兼容性问题 | 中 | 高 | 1. 使用Babel转译<br>2. 添加Polyfill<br>3. 浏览器兼容性测试 |
| 性能问题(大数据量) | 中 | 高 | 1. 虚拟滚动<br>2. 分页加载<br>3. 数据缓存 |
| WebSocket连接不稳定 | 高 | 中 | 1. 自动重连机制<br>2. 降级到轮询<br>3. 本地缓存 |
| 第三方依赖漏洞 | 中 | 中 | 1. 定期更新依赖<br>2. 安全扫描<br>3. 使用Snyk监控 |
| 内存泄漏 | 低 | 高 | 1. 代码审查<br>2. 内存监控<br>3. 定期性能测试 |
| CDN故障 | 低 | 高 | 1. 多CDN备份<br>2. 本地降级<br>3. 监控告警 |
| 配置错误导致功能异常 | 中 | 中 | 1. 配置验证<br>2. 灰度发布<br>3. 快速回滚 |

### 12.2 回滚方案

**版本回滚流程**:

```bash
# 1. 确认需要回滚的版本
kubectl get deployments log-management-web -o yaml | grep image

# 2. 回滚到上一个版本
kubectl rollout undo deployment/log-management-web

# 3. 回滚到指定版本
kubectl rollout undo deployment/log-management-web --to-revision=3

# 4. 查看回滚状态
kubectl rollout status deployment/log-management-web

# 5. 验证回滚结果
kubectl get pods -l app=log-management-web
```

**配置回滚**:

```typescript
// 配置版本管理
interface ConfigVersion {
  version: string;
  config: UIConfig;
  timestamp: number;
  userId: string;
}

class ConfigVersionManager {
  private versions: ConfigVersion[] = [];
  private maxVersions = 10;
  
  // 保存配置版本
  saveVersion(config: UIConfig) {
    const version: ConfigVersion = {
      version: uuid(),
      config: { ...config },
      timestamp: Date.now(),
      userId: getCurrentUserId(),
    };
    
    this.versions.unshift(version);
    
    // 保留最近10个版本
    if (this.versions.length > this.maxVersions) {
      this.versions = this.versions.slice(0, this.maxVersions);
    }
    
    // 持久化到后端
    api.post('/api/v1/config/versions', version);
  }
  
  // 回滚到指定版本
  async rollback(version: string): Promise<boolean> {
    const targetVersion = this.versions.find(v => v.version === version);
    
    if (!targetVersion) {
      message.error('版本不存在');
      return false;
    }
    
    try {
      // 应用配置
      await api.put('/api/v1/ui/config/rollback', {
        version: targetVersion.version,
      });
      
      message.success('配置已回滚');
      return true;
    } catch (error) {
      message.error('回滚失败: ' + error.message);
      return false;
    }
  }
  
  // 获取版本历史
  getVersionHistory(): ConfigVersion[] {
    return this.versions;
  }
}
```

**灰度发布策略**:

```yaml
# k8s/canary-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: log-management-web-canary
spec:
  replicas: 1  # 灰度版本只部署1个副本
  selector:
    matchLabels:
      app: log-management-web
      version: canary
  template:
    metadata:
      labels:
        app: log-management-web
        version: canary
    spec:
      containers:
      - name: web
        image: log-management-web:canary
---
apiVersion: v1
kind: Service
metadata:
  name: log-management-web
spec:
  selector:
    app: log-management-web  # 同时路由到stable和canary
  ports:
  - port: 80
```

**应急预案**:

| 场景 | 应急措施 | 恢复时间 |
|------|---------|---------|
| 新版本严重Bug | 立即回滚到上一版本 | < 5分钟 |
| CDN故障 | 切换到备用CDN | < 10分钟 |
| API服务异常 | 显示降级页面，提示稍后重试 | 立即 |
| WebSocket服务异常 | 降级到HTTP轮询 | 立即 |
| 数据库故障 | 使用只读副本 | < 5分钟 |

### 12.3 监控与告警

**关键指标监控**:

```typescript
// 健康检查
const healthCheck = {
  // 前端健康状态
  frontend: {
    status: 'healthy',
    version: '1.0.0',
    uptime: process.uptime(),
  },
  
  // 依赖服务健康状态
  dependencies: {
    api: await checkAPIHealth(),
    websocket: await checkWebSocketHealth(),
    cdn: await checkCDNHealth(),
  },
  
  // 性能指标
  performance: {
    pageLoadTime: getAveragePageLoadTime(),
    apiResponseTime: getAverageAPIResponseTime(),
    errorRate: getErrorRate(),
  },
};
```

**告警通知**:

```typescript
// 告警通知
const sendAlert = (alert: Alert) => {
  // 发送到钉钉
  axios.post(DINGTALK_WEBHOOK, {
    msgtype: 'markdown',
    markdown: {
      title: alert.title,
      text: `
### ${alert.title}
- **级别**: ${alert.level}
- **时间**: ${new Date().toLocaleString()}
- **描述**: ${alert.description}
- **影响**: ${alert.impact}
- **处理建议**: ${alert.suggestion}
      `,
    },
  });
  
  // 发送邮件
  sendEmail({
    to: ON_CALL_EMAIL,
    subject: `[${alert.level}] ${alert.title}`,
    body: alert.description,
  });
};
```

---

## 13. 附录

### 13.1 术语表

| 术语 | 说明 |
|------|------|
| SPA | Single Page Application，单页应用 |
| SSR | Server-Side Rendering，服务端渲染 |
| CSR | Client-Side Rendering，客户端渲染 |
| FCP | First Contentful Paint，首次内容绘制 |
| LCP | Largest Contentful Paint，最大内容绘制 |
| FID | First Input Delay，首次输入延迟 |
| CLS | Cumulative Layout Shift，累积布局偏移 |
| TTFB | Time to First Byte，首字节时间 |
| Tree Shaking | 移除未使用的代码 |
| Code Splitting | 代码分割 |
| Lazy Loading | 懒加载 |
| Virtual Scrolling | 虚拟滚动 |
| Debounce | 防抖 |
| Throttle | 节流 |
| Memoization | 记忆化 |
| HOC | Higher-Order Component，高阶组件 |
| Render Props | 渲染属性 |
| Hooks | React钩子 |

### 13.2 参考文档

**官方文档**:
- [React官方文档](https://react.dev/)
- [TypeScript官方文档](https://www.typescriptlang.org/)
- [Ant Design官方文档](https://ant.design/)
- [Vite官方文档](https://vitejs.dev/)
- [Framer Motion官方文档](https://www.framer.com/motion/)
- [Socket.io官方文档](https://socket.io/)

**最佳实践**:
- [React性能优化指南](https://react.dev/learn/render-and-commit)
- [Web性能优化](https://web.dev/performance/)
- [前端安全最佳实践](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)
- [无障碍设计指南](https://www.w3.org/WAI/WCAG21/quickref/)

**工具文档**:
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [Webpack Bundle Analyzer](https://github.com/webpack-contrib/webpack-bundle-analyzer)

### 13.3 浏览器兼容性

**支持的浏览器**:

| 浏览器 | 最低版本 | 说明 |
|--------|---------|------|
| Chrome | 90+ | 推荐使用 |
| Firefox | 88+ | 完全支持 |
| Safari | 14+ | 完全支持 |
| Edge | 90+ | 完全支持 |
| Opera | 76+ | 完全支持 |

**不支持的浏览器**:
- Internet Explorer (所有版本)
- Chrome < 90
- Firefox < 88
- Safari < 14

**Polyfill配置**:

```javascript
// vite.config.ts
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  plugins: [
    legacy({
      targets: ['defaults', 'not IE 11'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
    }),
  ],
});
```

### 13.4 开发环境搭建

**环境要求**:
- Node.js 18+
- pnpm 8+
- Git 2.30+

**安装步骤**:

```bash
# 1. 克隆代码
git clone https://github.com/your-org/log-management.git
cd log-management/web

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
cp .env.example .env.local
# 编辑.env.local，配置API地址等

# 4. 启动开发服务器
pnpm dev

# 5. 运行测试
pnpm test

# 6. 构建生产版本
pnpm build

# 7. 预览生产版本
pnpm preview
```

### 13.5 配置热更新扩展接口设计

**扩展接口定义**:

```typescript
// 配置热更新扩展接口
interface ConfigHotReloadExtension {
  // 配置加载器接口
  loader?: {
    // 从自定义源加载配置
    load: (key: string) => Promise<any>;
    // 批量加载配置
    loadBatch: (keys: string[]) => Promise<Record<string, any>>;
  };
  
  // 配置验证器接口
  validator?: {
    // 验证配置值
    validate: (key: string, value: any) => boolean | Promise<boolean>;
    // 自定义验证规则
    addRule: (key: string, rule: ValidationRule) => void;
  };
  
  // 配置转换器接口
  transformer?: {
    // 配置值转换
    transform: (key: string, value: any) => any;
    // 配置迁移
    migrate: (oldConfig: any, newVersion: string) => any;
  };
  
  // 配置监听器接口
  listener?: {
    // 配置变更前回调
    beforeUpdate: (key: string, oldValue: any, newValue: any) => boolean | Promise<boolean>;
    // 配置变更后回调
    afterUpdate: (key: string, oldValue: any, newValue: any) => void | Promise<void>;
    // 配置变更失败回调
    onError: (key: string, error: Error) => void;
  };
  
  // 配置持久化接口
  persister?: {
    // 保存配置
    save: (key: string, value: any) => Promise<void>;
    // 删除配置
    delete: (key: string) => Promise<void>;
    // 清空所有配置
    clear: () => Promise<void>;
  };
  
  // 配置同步接口
  syncer?: {
    // 同步到其他节点
    sync: (key: string, value: any, targets: string[]) => Promise<void>;
    // 从其他节点拉取
    pull: (key: string, source: string) => Promise<any>;
  };
}

// 扩展接口注册
class ConfigExtensionRegistry {
  private extensions: Map<string, ConfigHotReloadExtension> = new Map();
  
  // 注册扩展
  register(name: string, extension: ConfigHotReloadExtension) {
    this.extensions.set(name, extension);
  }
  
  // 获取扩展
  get(name: string): ConfigHotReloadExtension | undefined {
    return this.extensions.get(name);
  }
  
  // 移除扩展
  unregister(name: string) {
    this.extensions.delete(name);
  }
}

// 全局扩展注册表
export const extensionRegistry = new ConfigExtensionRegistry();
```

**扩展使用示例**:

```typescript
// 示例1: 自定义配置加载器（从Redis加载）
extensionRegistry.register('redis-loader', {
  loader: {
    load: async (key: string) => {
      const redis = getRedisClient();
      const value = await redis.get(`config:${key}`);
      return value ? JSON.parse(value) : null;
    },
    loadBatch: async (keys: string[]) => {
      const redis = getRedisClient();
      const pipeline = redis.pipeline();
      keys.forEach(key => pipeline.get(`config:${key}`));
      const results = await pipeline.exec();
      
      const config: Record<string, any> = {};
      results.forEach((result, index) => {
        if (result[1]) {
          config[keys[index]] = JSON.parse(result[1]);
        }
      });
      return config;
    },
  },
});

// 示例2: 自定义配置验证器
extensionRegistry.register('custom-validator', {
  validator: {
    validate: (key: string, value: any) => {
      // 自定义验证逻辑
      if (key === 'animation_duration') {
        return typeof value === 'number' && value >= 100 && value <= 1000;
      }
      return true;
    },
    addRule: (key: string, rule: ValidationRule) => {
      // 添加自定义验证规则
      validationRules.set(key, rule);
    },
  },
});

// 示例3: 配置变更监听器
extensionRegistry.register('audit-listener', {
  listener: {
    beforeUpdate: async (key: string, oldValue: any, newValue: any) => {
      // 变更前检查权限
      const hasPermission = await checkPermission('config.update', key);
      if (!hasPermission) {
        message.error('无权限修改此配置');
        return false;
      }
      return true;
    },
    afterUpdate: async (key: string, oldValue: any, newValue: any) => {
      // 记录审计日志
      await api.post('/api/v1/audit/config-change', {
        key,
        oldValue,
        newValue,
        timestamp: Date.now(),
        userId: getCurrentUserId(),
      });
      
      // 发送通知
      if (isImportantConfig(key)) {
        await sendNotification({
          title: '重要配置已变更',
          message: `配置项 ${key} 已从 ${oldValue} 变更为 ${newValue}`,
          level: 'warning',
        });
      }
    },
    onError: (key: string, error: Error) => {
      // 错误处理
      console.error(`配置 ${key} 更新失败:`, error);
      message.error(`配置更新失败: ${error.message}`);
    },
  },
});

// 示例4: 配置转换器（版本迁移）
extensionRegistry.register('version-migrator', {
  transformer: {
    transform: (key: string, value: any) => {
      // 配置值转换
      if (key === 'theme' && typeof value === 'number') {
        // 旧版本使用数字表示主题，新版本使用字符串
        return value === 0 ? 'light' : 'dark';
      }
      return value;
    },
    migrate: (oldConfig: any, newVersion: string) => {
      // 配置结构迁移
      const newConfig = { ...oldConfig };
      
      if (newVersion === '2.0.0') {
        // v2.0.0 将 ui.theme 移动到顶层
        if (oldConfig.ui?.theme) {
          newConfig.theme = oldConfig.ui.theme;
          delete newConfig.ui.theme;
        }
      }
      
      return newConfig;
    },
  },
});

// 示例5: 配置同步器（多实例同步）
extensionRegistry.register('cluster-syncer', {
  syncer: {
    sync: async (key: string, value: any, targets: string[]) => {
      // 同步到其他实例
      await Promise.all(
        targets.map(target =>
          axios.post(`${target}/api/v1/config/sync`, { key, value })
        )
      );
    },
    pull: async (key: string, source: string) => {
      // 从其他实例拉取配置
      const response = await axios.get(`${source}/api/v1/config/${key}`);
      return response.data.value;
    },
  },
});
```

**扩展接口集成到ConfigManager**:

```typescript
// 增强的配置管理器
class EnhancedConfigManager extends ConfigManager {
  private extensions: ConfigExtensionRegistry;
  
  constructor() {
    super();
    this.extensions = extensionRegistry;
  }
  
  // 重写配置更新方法，集成扩展
  async updateConfig(key: string, value: any): Promise<boolean> {
    try {
      // 1. 执行自定义验证器
      const validator = this.getExtension('validator');
      if (validator?.validate) {
        const isValid = await validator.validate(key, value);
        if (!isValid) {
          throw new Error('配置验证失败');
        }
      }
      
      // 2. 执行配置转换器
      const transformer = this.getExtension('transformer');
      if (transformer?.transform) {
        value = transformer.transform(key, value);
      }
      
      // 3. 执行变更前监听器
      const listener = this.getExtension('listener');
      if (listener?.beforeUpdate) {
        const shouldContinue = await listener.beforeUpdate(key, this.config[key], value);
        if (!shouldContinue) {
          return false;
        }
      }
      
      // 4. 更新配置
      const oldValue = this.config[key];
      this.config[key] = value;
      
      // 5. 执行自定义持久化
      const persister = this.getExtension('persister');
      if (persister?.save) {
        await persister.save(key, value);
      } else {
        this.saveToLocalStorage();
      }
      
      // 6. 同步到其他节点
      const syncer = this.getExtension('syncer');
      if (syncer?.sync) {
        const targets = this.getClusterNodes();
        await syncer.sync(key, value, targets);
      }
      
      // 7. 执行变更后监听器
      if (listener?.afterUpdate) {
        await listener.afterUpdate(key, oldValue, value);
      }
      
      // 8. 通知订阅者
      this.notifyListeners(key, value, oldValue);
      
      return true;
    } catch (error) {
      // 执行错误监听器
      const listener = this.getExtension('listener');
      if (listener?.onError) {
        listener.onError(key, error);
      }
      
      throw error;
    }
  }
  
  // 获取扩展
  private getExtension(type: keyof ConfigHotReloadExtension): any {
    for (const extension of this.extensions.extensions.values()) {
      if (extension[type]) {
        return extension[type];
      }
    }
    return null;
  }
  
  // 获取集群节点列表
  private getClusterNodes(): string[] {
    // 从配置或服务发现获取其他节点地址
    return process.env.CLUSTER_NODES?.split(',') || [];
  }
}
```

**扩展接口文档**:

| 扩展类型 | 用途 | 使用场景 |
|---------|------|----------|
| loader | 自定义配置加载源 | 从Redis/Etcd/Consul等加载配置 |
| validator | 自定义验证规则 | 复杂的业务验证逻辑 |
| transformer | 配置值转换 | 版本迁移、格式转换 |
| listener | 配置变更监听 | 审计日志、通知、权限检查 |
| persister | 自定义持久化 | 保存到数据库、文件系统 |
| syncer | 多实例同步 | 集群环境配置同步 |

### 13.6 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-01-31 | v1.0 | 初稿，完整设计方案 | 系统架构团队 |
| 2026-02-01 | v1.1 | 添加配置热更新机制、告警规则热更新、灰度发布策略、扩展接口设计 | 系统架构团队 |

---

**文档结束**
