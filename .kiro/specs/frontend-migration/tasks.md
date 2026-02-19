# 实施计划：NexusLog 前端迁移与 Monorepo 全栈项目搭建

## 概述

基于业务域+平台域分层的 Monorepo 架构，自底向上完成前端迁移和全栈项目搭建。先搭建 Monorepo 骨架和基础设施配置，再迁移前端底层模块，最后迁移上层页面。

## 任务

- [x] 1. Monorepo 根目录和公共配置搭建
  - [x] 1.1 创建 Monorepo 根目录结构和根配置文件
    - 创建根目录 `README.md`、`LICENSE`、`CHANGELOG.md`、`.gitignore`、`.editorconfig`
    - 创建 `Makefile`（统一构建/测试命令入口）
    - 创建 `go.work`（Go 多模块工作区，引用 services/ 和 agents/ 下的模块）
    - 创建 `package.json`（pnpm workspace 配置，引用 apps/ 下的前端项目）
    - 创建 `configs/common/`、`configs/dev/`、`configs/staging/`、`configs/prod/` 目录（三个环境目录结构一致）
    - _需求: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 1.2 创建项目文档体系目录结构
    - 创建 `docs/architecture/`（含 01-system-context.md、02-logical-architecture.md、03-deployment-architecture.md、04-dataflow.md、05-security-architecture.md 模板）
    - 创建 `docs/adr/ADR-0001-monorepo.md`
    - 创建 `docs/runbooks/`（含 kafka-lag-high.md、es-write-reject.md、rollback-playbook.md 模板）
    - 创建 `docs/oncall/`、`docs/security/`、`docs/sla-slo/` 目录
    - _需求: 25.1, 25.2, 25.3, 25.4_

  - [x] 1.3 创建脚本和测试目录
    - 创建 `scripts/`（含 bootstrap.sh、lint.sh、test.sh、build.sh、release.sh、rollback.sh）
    - 创建 `tests/e2e/`、`tests/integration/`、`tests/performance/`、`tests/chaos/` 目录
    - _需求: 1.1_

- [x] 2. 前端控制台初始化
  - [x] 2.1 创建前端项目结构和依赖安装
    - 在 `apps/frontend-console/` 下创建 `package.json`（pnpm）
    - 安装核心依赖：react@19、react-dom@19、react-router-dom、antd、echarts、zustand
    - 安装开发依赖：typescript、@types/react@19、@types/react-dom@19、vite、@vitejs/plugin-react、vitest、fast-check
    - 创建 `index.html` 入口文件
    - 创建 `src/` 下子目录：components/（charts/、common/、layout/、auth/）、pages/、stores/、hooks/、services/、types/、utils/、constants/、config/
    - 创建 `public/config/app-config.json` 运行时配置文件
    - 创建 `tests/` 测试目录
    - _需求: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 2.2 配置 TypeScript（tsconfig.json）
    - 配置严格模式：strict、noImplicitAny、strictNullChecks
    - 配置路径别名：`@/*` → `src/*`
    - 配置 React 19 JSX：jsx: "react-jsx"
    - _需求: 2.8_

  - [x] 2.3 配置 Vite（vite.config.ts）
    - 配置开发服务器（端口、HMR、CORS）
    - 配置路径别名解析
    - 配置生产构建代码分割策略（React、Ant Design、ECharts 独立 vendor chunk）
    - 配置 Gzip/Brotli 压缩插件
    - 配置生产环境移除 console/debugger
    - _需求: 12.1, 12.2, 12.3, 12.4_

  - [x] 2.4 配置环境变量和运行时配置
    - 创建 `.env.development` 和 `.env.production`
    - 创建 `src/config/appConfig.ts` 运行时配置加载模块
    - _需求: 12.5, 22.1, 22.3_

  - [x] 2.5 配置 Vitest 测试框架
    - 创建 `vitest.config.ts`
    - 创建 `src/test/setup.ts` 测试初始化文件
    - _需求: 2.7_

  - [x] 2.6 创建前端 Dockerfile
    - 创建 `apps/frontend-console/Dockerfile`（多阶段构建：pnpm install → build → nginx 静态服务）
    - _需求: 19.7_

- [x] 3. 类型系统迁移
  - [x] 3.1 迁移核心类型定义文件
    - 迁移 `types/common.ts`、`types/user.ts`、`types/log.ts`、`types/alert.ts`、`types/dashboard.ts`、`types/api.ts`、`types/notification.ts`、`types/navigation.ts`
    - _需求: 10.1, 10.2_

  - [x] 3.2 迁移并调整需适配的类型文件
    - 迁移 `types/theme.ts`，新增 `antdTheme: ThemeConfig` 类型
    - 迁移 `types/components.ts`，调整 TableColumn 等类型适配 Ant Design
    - _需求: 10.3_

  - [x] 3.3 创建类型统一导出入口
    - 创建 `types/index.ts`
    - _需求: 10.4_

- [x] 4. 工具函数和常量迁移
  - [x] 4.1 迁移工具函数模块
    - 迁移 `utils/formatters.ts`、`utils/validators.ts`、`utils/date.ts`、`utils/cache.ts`、`utils/sanitize.ts`、`utils/helpers.ts`
    - 迁移其余工具函数：env、accessibility、colorContrast、globalErrorHandler、routePreloader、mobileOptimization
    - 创建 `utils/index.ts` 统一导出
    - _需求: 11.1, 11.4_

  - [x] 4.2 迁移常量定义
    - 迁移 `constants/auth.ts` 和其他常量文件
    - 创建菜单配置常量 `constants/menu.ts`

- [x] 5. Zustand 状态管理迁移
  - [x] 5.1 创建 useAuthStore（替代 AuthContext）
    - 实现 AuthState 和 AuthActions 接口
    - 包含 login、logout、refreshToken、updateUser、clearError 方法
    - _需求: 7.1_

  - [x] 5.2 编写 useAuthStore 属性测试
    - **Property 9: useAuthStore 状态管理**
    - **Validates: Requirements 7.1**

  - [x] 5.3 创建 useThemeStore（替代 ThemeContext）
    - 实现 ThemeState 和 ThemeActions 接口
    - 包含 antdTheme 派生属性
    - 支持 dark/light/auto/high-contrast 模式
    - _需求: 7.2_

  - [x] 5.4 编写 useThemeStore 属性测试
    - **Property 10: useThemeStore 状态管理**
    - **Validates: Requirements 7.2**

  - [x] 5.5 创建 useNotificationStore（替代 NotificationContext）
    - 实现通知的增删查、标记已读、未读计数功能
    - 集成 Ant Design message/notification API
    - _需求: 7.3_

  - [x] 5.6 编写 useNotificationStore 属性测试
    - **Property 11: useNotificationStore 状态管理**
    - **Validates: Requirements 7.3**

  - [x] 5.7 创建 useCacheStore 和 useOfflineStore
    - 迁移 CacheContext 和 OfflineContext 功能
    - _需求: 7.4_

  - [x] 5.8 创建 stores 统一导出入口
    - 创建 `stores/index.ts`
    - _需求: 7.5_

- [x] 6. API 服务层迁移
  - [x] 6.1 迁移 API 客户端和服务模块
    - 迁移 `services/api/client.ts`（HTTP 客户端封装）
    - 迁移 `services/api/auth.ts`、`services/api/logs.ts`、`services/api/alerts.ts`、`services/api/dashboard.ts`
    - 迁移 `services/api/cachedApi.ts`
    - 创建 `services/api/index.ts` 统一导出
    - _需求: 11.1_

  - [x] 6.2 迁移 WebSocket 和监控服务
    - 迁移 `services/websocket.ts`
    - 迁移 `services/monitoring/` 目录下的 analytics、errorTracking、performance、init 模块
    - 创建 `services/index.ts` 统一导出
    - _需求: 11.1_

- [x] 7. 自定义 Hooks 迁移
  - [x] 7.1 迁移核心 Hooks
    - 迁移 useApi、useDebounce、useLocalStorage、useDashboardData、useAutoSave
    - 将依赖 Context API 的 Hooks 改为从 Zustand Store 获取状态
    - _需求: 11.2, 11.3_

  - [x] 7.2 迁移其余 Hooks
    - 迁移 useApiCache、useDashboardLayout、useErrorRecovery、useFocusManagement
    - 迁移 useIdleTimeout、useIntersectionObserver、useKeyboardShortcuts、useMemoizedValue
    - 迁移 useMonitoring、useMutation、useOfflineCache、useOfflineQueue、useOnlineStatus
    - 迁移 usePageTitle、usePullToRefresh、useSanitizedInput、useScrollPreservation
    - 迁移 useSessionStorage、useSwipeGesture、useThemeStyles、useUrlSync
    - _需求: 11.2, 11.3_

  - [x] 7.3 创建 Hooks 统一导出入口
    - 创建 `hooks/index.ts`
    - _需求: 11.4_

  - [x] 7.4 编写 Hooks 无 Context API 依赖属性测试
    - **Property 15: Hooks 无 Context API 依赖**
    - **Validates: Requirements 11.3**

- [x] 8. 检查点 - 基础模块验证
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 9. ECharts 图表组件迁移
  - [x] 9.1 创建 BaseChart 通用包装组件
    - 实现 ECharts 实例的初始化、更新、销毁生命周期管理
    - 实现容器 resize 自动适配
    - 实现主题切换响应（dark/light）
    - _需求: 6.1, 6.3, 6.4, 6.5_

  - [x] 9.2 编写图表 resize 响应属性测试
    - **Property 8: 图表 resize 响应**
    - **Validates: Requirements 6.3**

  - [x] 9.3 迁移具体图表组件
    - 创建 TimeSeriesChart（ECharts line/area series）
    - 创建 BarChart（ECharts bar series）
    - 创建 PieChart（ECharts pie series）
    - 创建 ChartCard（Ant Design Card 包装 BaseChart）
    - 创建 `components/charts/index.ts` 统一导出
    - _需求: 6.2_

- [x] 10. 通用组件迁移（Ant Design 封装）
  - [x] 10.1 迁移 DataTable 组件
    - 基于 Ant Design Table 封装，保留排序、筛选、分页功能
    - _需求: 8.1_

  - [x] 10.2 编写 DataTable 排序属性测试
    - **Property 12: DataTable 排序正确性**
    - **Validates: Requirements 8.1**

  - [x] 10.3 迁移 Modal、Drawer 和 ErrorBoundary 组件
    - Modal 基于 Ant Design Modal 封装
    - Drawer 基于 Ant Design Drawer 封装
    - ErrorBoundary 使用 Ant Design Result 展示错误信息
    - _需求: 8.2, 8.3_

  - [x] 10.4 编写 ErrorBoundary 属性测试
    - **Property 13: ErrorBoundary 错误捕获**
    - **Validates: Requirements 8.3**

  - [x] 10.5 迁移 LoadingScreen、StatCard 和其余通用组件
    - LoadingScreen 使用 Ant Design Spin
    - StatCard 使用 Ant Design Card + Statistic
    - 迁移 SearchBar、FormField、Card、List、ContextMenu 等
    - 迁移 OfflineIndicator、OfflineQueueStatus、AutoSaveIndicator
    - 创建 `components/common/index.ts` 统一导出
    - _需求: 8.4, 8.5, 5.5_

  - [x] 10.6 编写 StatCard 属性测试
    - **Property 14: StatCard 数据展示完整性**
    - **Validates: Requirements 8.5**

- [x] 11. 布局组件迁移
  - [x] 11.1 创建 AppLayout 布局组件
    - 使用 Ant Design Layout、Sider、Header、Content 组件
    - 实现侧边栏折叠/展开功能
    - 实现响应式：屏幕宽度 < 768px 时转为抽屉式导航
    - 在侧边栏顶部显示 "NexusLog" 品牌标识
    - _需求: 4.1, 4.2, 4.3, 4.4, 4.6_

  - [x] 11.2 编写侧边栏折叠状态切换属性测试
    - **Property 7: 侧边栏折叠状态切换**
    - **Validates: Requirements 4.3**

  - [x] 11.3 创建侧边栏菜单组件
    - 使用 Ant Design Menu 实现多级菜单导航
    - 根据当前路由自动高亮对应菜单项
    - 从 `constants/menu.ts` 读取菜单配置
    - _需求: 4.5_

  - [x] 11.4 编写菜单高亮与路由匹配属性测试
    - **Property 5: 菜单高亮与路由匹配**
    - **Validates: Requirements 4.5**

  - [x] 11.5 创建 Header 顶部导航组件
    - 包含面包屑导航、用户信息下拉、主题切换按钮
    - _需求: 4.1_

- [-] 12. 认证组件和 Ant Design 主题配置
  - [x] 12.1 迁移 ProtectedRoute 组件
    - 从 useAuthStore 获取认证状态，未认证重定向到 /login
    - _需求: 3.5_

  - [x] 12.2 迁移登录相关页面和组件
    - 迁移 LoginForm（Ant Design Form）、RegisterForm、ForgotPasswordForm
    - 迁移 LoginPage、RegisterPage、ForgotPasswordPage
    - 迁移 PasswordInput、SocialLoginButtons、SSOLoginForm、RememberMeCheckbox
    - 创建 `components/auth/index.ts` 统一导出
    - _需求: 3.5, 9.4_

  - [x] 12.3 配置 Ant Design 主题 Token 和 ConfigProvider
    - 定义主色调、暗色/亮色模式色彩方案
    - 在 App.tsx 中使用 ConfigProvider 包裹应用
    - 配置中文语言包 zh_CN
    - _需求: 5.2, 5.3, 2.3_

  - [x] 12.4 编写主题切换一致性属性测试
    - **Property 6: 主题切换一致性**
    - **Validates: Requirements 5.3, 6.5**

- [-] 13. 路由结构和应用入口迁移
  - [x] 13.1 创建 App.tsx 应用入口
    - 配置 HashRouter
    - 配置 Ant Design ConfigProvider（主题、语言）
    - 移除 Context Provider 嵌套，改用 Zustand Store
    - _需求: 2.6, 5.3_

  - [x] 13.2 迁移完整路由结构
    - 迁移全部 15 个路由模块的嵌套路由配置
    - 对非首页路由使用 React.lazy 实现懒加载
    - 配置 404 回退到 Dashboard
    - 配置公开路由和受保护路由
    - _需求: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 13.3 编写路由模块完整性属性测试
    - **Property 2: 路由模块完整性和嵌套结构**
    - **Validates: Requirements 3.1, 3.2**

  - [x] 13.4 编写非首页路由懒加载属性测试
    - **Property 3: 非首页路由懒加载**
    - **Validates: Requirements 3.3**

  - [x] 13.5 编写公开/受保护路由分类属性测试
    - **Property 4: 公开路由与受保护路由分类**
    - **Validates: Requirements 3.5**

  - [x] 13.6 创建 main.tsx 入口文件
    - 初始化应用监控
    - 渲染 React 应用到 DOM
    - _需求: 2.1_

- [x] 14. 检查点 - 前端框架验证
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 15. Dashboard 首页迁移
  - [x] 15.1 迁移 Dashboard 页面
    - 使用 Ant Design Card + Statistic 实现 KPI 卡片
    - 使用 ECharts TimeSeriesChart 实现日志趋势图表
    - 迁移 InfrastructureMonitor 基础设施监控面板
    - _需求: 9.1_

- [x] 16. 日志检索模块迁移
  - [x] 16.1 迁移日志检索页面
    - 迁移 RealtimeSearch 实时搜索页面（Ant Design Table、Input.Search）
    - 迁移 SearchHistory 搜索历史页面
    - 迁移 SavedQueries 保存的查询页面
    - 迁移 QueryBuilder 查询构建器组件
    - 创建 `pages/search/index.ts` 统一导出
    - _需求: 9.2_

- [x] 17. 告警中心模块迁移
  - [x] 17.1 迁移告警中心页面
    - 迁移 AlertList 告警列表页面（Ant Design Table）
    - 迁移 AlertRules 告警规则页面（Ant Design Form）
    - 迁移 NotificationConfig 通知配置页面
    - 迁移 SilencePolicy 静默策略页面
    - 创建 `pages/alerts/index.ts` 统一导出
    - _需求: 9.3_

- [-] 18. 安全审计模块迁移
  - [x] 18.1 迁移安全审计页面
    - 迁移 UserManagement 用户管理页面（Ant Design Table + Modal）
    - 迁移 RolePermissions 角色权限页面
    - 迁移 AuditLogs 审计日志页面
    - 迁移 LoginPolicy 登录策略页面
    - 创建 `pages/security/index.ts` 统一导出
    - _需求: 9.4_

- [x] 19. 其余页面模块骨架迁移
  - [x] 19.1 迁移日志分析模块页面骨架
    - 创建 AggregateAnalysis、AnomalyDetection、LogClustering 页面骨架
    - 创建 `pages/analysis/index.ts`
  - [x] 19.2 迁移采集接入模块页面骨架
    - 创建 SourceManagement、AgentManagement、AccessWizard、SourceStatus 页面骨架
    - 创建 `pages/ingestion/index.ts`
  - [x] 19.3 迁移解析字段模块页面骨架
    - 创建 FieldMapping、ParsingRules、MaskingRules、FieldDictionary 页面骨架
    - 创建 `pages/parsing/index.ts`
  - [x] 19.4 迁移索引存储模块页面骨架
    - 创建 IndexManagement、LifecyclePolicy、BackupRecovery、CapacityMonitoring 页面骨架
    - 创建 `pages/storage/index.ts`
  - [x] 19.5 迁移性能高可用模块页面骨架
    - 创建 PerformanceMonitoring、HealthCheck、AutoScaling、DisasterRecovery 页面骨架
    - 创建 `pages/performance/index.ts`
  - [x] 19.6 迁移分布式追踪模块页面骨架
    - 创建 TraceSearch、TraceAnalysis、ServiceTopology 页面骨架
    - 创建 `pages/tracing/index.ts`
  - [x] 19.7 迁移报表中心模块页面骨架
    - 创建 ReportManagement、ScheduledTasks、DownloadRecords 页面骨架
    - 创建 `pages/reports/index.ts`
  - [x] 19.8 迁移集成平台模块页面骨架
    - 创建 ApiDocs、WebhookManagement、SdkDownload、PluginMarket 页面骨架
    - 创建 `pages/integration/index.ts`
  - [x] 19.9 迁移成本管理模块页面骨架
    - 创建 CostOverview、BudgetAlerts、OptimizationSuggestions 页面骨架
    - 创建 `pages/cost/index.ts`
  - [x] 19.10 迁移系统设置模块页面骨架
    - 创建 SystemParameters、GlobalConfig、ConfigVersions 页面骨架
    - 创建 `pages/settings/index.ts`
  - [x] 19.11 迁移帮助中心模块页面骨架
    - 创建 QuerySyntax、FAQ、TicketPortal 页面骨架
    - 创建 `pages/help/index.ts`
  - _需求: 9.5_

- [x] 20. 检查点 - 前端页面验证
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 21. 后端微服务目录结构搭建
  - [x] 21.1 创建 Control Plane 服务结构
    - 创建 `services/control-plane/cmd/api/main.go`（Gin + gRPC 入口，含 `/api/v1/health`）
    - 创建 `services/control-plane/internal/` 子目录：app/、domain/、service/、repository/、transport/http/、transport/grpc/
    - 创建 `services/control-plane/api/openapi/`、`services/control-plane/api/proto/`
    - 创建 `services/control-plane/configs/config.yaml`（含 change_level 标注）
    - 创建 `services/control-plane/tests/`
    - 创建 `services/control-plane/Dockerfile`
    - 创建 `services/control-plane/go.mod`
    - _需求: 13.1, 23.6_

  - [x] 21.2 创建 Health Worker 服务结构
    - 创建 `services/health-worker/cmd/worker/main.go`
    - 创建 `services/health-worker/internal/` 子目录：checker/、scheduler/、reporter/
    - 创建 `services/health-worker/configs/`、`services/health-worker/tests/`
    - 创建 `services/health-worker/Dockerfile`、`services/health-worker/go.mod`
    - _需求: 13.2_

  - [x] 21.3 创建 Data Services 结构
    - 创建 `services/data-services/query-api/`、`services/data-services/audit-api/`、`services/data-services/export-api/`、`services/data-services/shared/`
    - 创建 `services/data-services/Dockerfile`
    - _需求: 13.3_

  - [x] 21.4 创建 API Service 结构
    - 创建 `services/api-service/cmd/api/main.go`
    - 创建 `services/api-service/internal/`、`services/api-service/api/openapi/`、`services/api-service/configs/`
    - 创建 `services/api-service/Dockerfile`、`services/api-service/go.mod`
    - _需求: 13.4_

  - [x] 21.5 更新 go.work 文件
    - 将所有 Go 服务模块（control-plane、health-worker、api-service、collector-agent）纳入工作区
    - _需求: 13.5_

- [x] 22. API 网关配置
  - [x] 22.1 创建 OpenResty 网关配置
    - 创建 `gateway/openresty/nginx.conf`（基础反向代理配置）
    - 创建 `gateway/openresty/conf.d/` 目录
    - 创建 `gateway/openresty/lua/`（含 auth_check.lua、rate_limit.lua、logging.lua 模板）
    - 创建 `gateway/openresty/tenants/`、`gateway/openresty/policies/`、`gateway/openresty/tests/`
    - 创建 `gateway/openresty/Dockerfile`
    - _需求: 14.1, 14.2, 14.3_

- [x] 23. IAM 安全体系配置
  - [x] 23.1 创建 Keycloak 配置
    - 创建 `iam/keycloak/realms/`（含基础 Realm 导入配置 JSON）
    - 创建 `iam/keycloak/clients/`、`iam/keycloak/roles/`、`iam/keycloak/mappers/`
    - _需求: 15.1_

  - [x] 23.2 创建 OPA 策略配置
    - 创建 `iam/opa/policies/`（含基础 RBAC 策略 Rego 文件）
    - 创建 `iam/opa/bundles/`、`iam/opa/tests/`
    - _需求: 15.2_

  - [x] 23.3 创建 Vault 策略配置
    - 创建 `iam/vault/policies/`（含策略模板）
    - 创建 `iam/vault/auth/`、`iam/vault/engines/`
    - _需求: 15.3_

- [x] 24. 消息传输、契约和存储配置
  - [x] 24.1 创建消息传输配置
    - 创建 `messaging/kafka/topics/`、`messaging/kafka/quotas/`、`messaging/kafka/broker-config/`
    - 创建 `messaging/schema-registry/config/`、`messaging/schema-registry/compatibility-rules/`
    - 创建 `messaging/dlq-retry/retry-policies/`、`messaging/dlq-retry/consumer-config/`
    - _需求: 16.1, 16.2, 16.3_

  - [x] 24.2 创建契约定义配置
    - 创建 `contracts/schema-contracts/avro/`、`contracts/schema-contracts/protobuf/`、`contracts/schema-contracts/jsonschema/`
    - 创建 `contracts/schema-contracts/compatibility/`、`contracts/schema-contracts/tests/`
    - _需求: 16.4_

  - [x] 24.3 创建存储层配置
    - 创建 `storage/elasticsearch/`（index-templates/、ilm-policies/、ingest-pipelines/、snapshots/）
    - 创建 `storage/postgresql/`（migrations/、seeds/、rls-policies/、patroni/、etcd/、pgbouncer/）
    - 创建 `storage/redis/`（cluster-config/、lua-scripts/）
    - 创建 `storage/minio/`（buckets/、lifecycle/）
    - 创建 `storage/glacier/`（archive-policies/）
    - _需求: 17.1, 17.2, 17.3, 17.4, 17.5_

- [x] 25. 采集代理和流计算配置
  - [x] 25.1 创建 Collector Agent 结构
    - 创建 `agents/collector-agent/cmd/agent/`
    - 创建 `agents/collector-agent/internal/`（collector/、pipeline/、checkpoint/、retry/）
    - 创建 `agents/collector-agent/plugins/`（grpc/、wasm/）
    - 创建 `agents/collector-agent/configs/`、`agents/collector-agent/tests/`
    - 创建 `agents/collector-agent/Dockerfile`、`agents/collector-agent/go.mod`
    - _需求: 21.1_

  - [x] 25.2 创建 Flink 流计算配置
    - 创建 `stream/flink/jobs/`（sql/、cep/）
    - 创建 `stream/flink/udf/`、`stream/flink/libs/`、`stream/flink/savepoints/`
    - 创建 `stream/flink/configs/`、`stream/flink/tests/`
    - _需求: 21.2_

- [x] 26. 可观测性配置
  - [x] 26.1 创建 Prometheus 和 Alertmanager 配置
    - 创建 `observability/prometheus/prometheus.yml`（服务发现、告警规则路径）
    - 创建 `observability/prometheus/rules/`、`observability/prometheus/targets/`
    - 创建 `observability/alertmanager/alertmanager.yml`（告警路由、通知渠道）
    - 创建 `observability/alertmanager/templates/`
    - _需求: 18.1, 18.2_

  - [x] 26.2 创建 Grafana、Jaeger、OTel、Loki 配置
    - 创建 `observability/grafana/dashboards/`、`observability/grafana/datasources/`
    - 创建 `observability/jaeger/config/`
    - 创建 `observability/otel-collector/config/`
    - 创建 `observability/loki/config/`
    - _需求: 18.3, 18.4, 18.5, 18.6_

- [x] 27. 平台治理与部署配置
  - [x] 27.1 创建 Kubernetes 基础配置
    - 创建 `platform/kubernetes/base/`、`platform/kubernetes/namespaces/`、`platform/kubernetes/rbac/`
    - 创建 `platform/kubernetes/network-policies/`、`platform/kubernetes/storageclasses/`
    - _需求: 19.1_

  - [x] 27.2 创建 Helm Charts
    - 创建 `platform/helm/nexuslog-gateway/`（Chart.yaml、values.yaml、templates/）
    - 创建 `platform/helm/nexuslog-control-plane/`
    - 创建 `platform/helm/nexuslog-data-plane/`
    - 创建 `platform/helm/nexuslog-storage/`
    - 创建 `platform/helm/nexuslog-observability/`
    - _需求: 19.2_

  - [x] 27.3 创建 GitOps 配置
    - 创建 `platform/gitops/argocd/projects/`、`platform/gitops/argocd/applicationsets/`
    - 创建 `platform/gitops/apps/`（ingress-system/、iam-system/、control-plane/、data-plane/、storage-system/、observability/）
    - 创建 `platform/gitops/clusters/`（dev/、staging/、prod/）
    - _需求: 19.3_

  - [x] 27.4 创建 CI、安全扫描和 Istio 配置
    - 创建 `platform/ci/templates/`、`platform/ci/scripts/`
    - 创建 `platform/security/trivy/`、`platform/security/sast/`、`platform/security/image-sign/`
    - 创建 `platform/istio/gateways/`、`platform/istio/virtualservices/`、`platform/istio/destinationrules/`
    - _需求: 19.4, 19.5, 19.6_

- [x] 28. 基础设施即代码和可选域
  - [x] 28.1 创建 Terraform 和 Ansible 配置
    - 创建 `infra/terraform/modules/`
    - 创建 `infra/terraform/envs/`（dev/、staging/、prod/）
    - 创建 `infra/ansible/inventories/`、`infra/ansible/roles/`
    - _需求: 20.1, 20.2_

  - [x] 28.2 创建可选域目录结构
    - 创建 `ml/training/`、`ml/inference/`、`ml/models/`、`ml/mlflow/`、`ml/nlp/`（prompts/、rules/）
    - 创建 `edge/mqtt/`、`edge/sqlite/`、`edge/boltdb/`
    - _需求: 1.1_

- [x] 29. 变更管理规范文档
  - [x] 29.1 创建变更管理规范文档
    - 创建 `docs/change-management.md`
    - 包含三级审批体系定义（none/normal/cab）
    - 包含 CAB 判定规则表（7 条硬规则）
    - 包含风险评分矩阵（5 维度，各 0-3 分）
    - 包含回滚 SLA 模板（T+5/15/30分钟/24小时）
    - 包含变更单模板（字段级），含风险评分自动计算规则、CAB 自动路由逻辑
    - _需求: 23.1, 23.2, 23.3, 23.4, 23.5_

  - [x] 29.2 创建技术栈总览文档
    - 创建 `docs/tech-stack.md`
    - _需求: 23.6_

- [x] 30. CI/CD 和 GitOps 配置
  - [x] 30.1 创建 GitHub Actions 工作流
    - 创建 `.github/workflows/frontend-ci.yml`（前端构建测试流水线）
    - 创建 `.github/workflows/backend-ci.yml`（后端构建测试流水线）
    - 创建 `.github/workflows/docker-build.yml`（镜像构建推送 + Trivy 安全扫描）
    - _需求: 24.1, 24.3_

  - [x] 30.2 创建 Argo CD 配置模板
    - 创建 `platform/gitops/argocd/applicationsets/` 下的应用配置
    - _需求: 24.2_

- [x] 31. 配置热更新机制
  - [x] 31.1 实现前端运行时配置热更新
    - 完善 `src/config/appConfig.ts` 配置加载逻辑
    - _需求: 22.1, 22.3_

  - [x] 31.2 编写配置热更新 round-trip 属性测试
    - **Property 16: 配置热更新 round-trip**
    - **Validates: Requirements 22.3**

  - [x] 31.3 创建后端配置 file watcher 接口
    - 在 Control Plane 配置模块中预留 file watcher 接口定义
    - _需求: 22.2_

- [x] 32. 环境目录一致性验证
  - [x] 32.1 编写环境目录结构一致性属性测试
    - **Property 1: 环境目录结构一致性**
    - **Validates: Requirements 1.6**

- [x] 33. 最终检查点 - 全项目验证
  - 确保所有测试通过，如有问题请向用户确认。

## 说明

- 标记 `*` 的任务为可选测试任务，可跳过以加速 MVP 交付
- 每个任务引用了具体的需求编号以确保可追溯性
- 检查点任务确保增量验证
- 属性测试验证通用正确性属性
- 单元测试验证具体示例和边界情况
