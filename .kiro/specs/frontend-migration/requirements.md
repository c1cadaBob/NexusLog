# 需求文档：NexusLog 前端迁移与 Monorepo 全栈项目搭建

## 简介

将 `logscale-pro-recreated` 项目的前端页面迁移到新的全栈 Monorepo 项目 `NexusLog` 中。迁移过程中需要完成技术栈替换：Tailwind CSS → Ant Design 5.x、Recharts → ECharts 5.x、Context API → Zustand 4.x，保持 React 19。包管理工具使用 pnpm。

项目采用业务域+平台域分层的 Monorepo 架构，包含前端控制台、多个 Go 微服务、API 网关、IAM 安全体系、消息传输、流计算、存储层、可观测性、平台治理等完整域。所有组件的配置变更遵循三级审批体系（无需审批/常规审批/高危变更 CAB），配置优先采用热更新机制。

## 术语表

- **Source_Project**: 源项目 `logscale-pro-recreated`，基于 React 19 + Tailwind CSS + Recharts 的前端日志管理系统
- **Target_Project**: 目标项目 `NexusLog`，基于 Monorepo 架构的全栈日志管理系统，使用 pnpm 管理前端依赖
- **Frontend_Console**: Target_Project 中的前端控制台子项目，位于 `apps/frontend-console/` 目录下
- **Control_Plane**: Target_Project 中的控制面服务，位于 `services/control-plane/`，Go Gin + gRPC
- **Health_Worker**: Target_Project 中的健康检测服务，位于 `services/health-worker/`，Go 实现
- **Data_Services**: Target_Project 中的数据服务集合，位于 `services/data-services/`，包含 query-api、audit-api、export-api
- **API_Service**: Target_Project 中的 API 服务，位于 `services/api-service/`，Go Gin 实现
- **BFF_Service**: Target_Project 中可选的 BFF 层，位于 `apps/bff-service/`，NestJS 实现
- **Gateway**: Target_Project 中的 API 网关，位于 `gateway/openresty/`，基于 OpenResty（Nginx+Lua）
- **IAM**: 身份认证与授权域，位于 `iam/`，包含 Keycloak、OPA、Vault
- **Collector_Agent**: 日志采集代理，位于 `agents/collector-agent/`，Go 实现
- **Migration_Engine**: 迁移过程中负责将 Source_Project 组件适配到新技术栈的转换逻辑
- **Ant_Design**: Ant Design 5.x UI 组件库，替代 Tailwind CSS 提供企业级 UI 组件
- **ECharts**: Apache ECharts 5.x 图表库，替代 Recharts 提供数据可视化能力
- **Zustand**: Zustand 4.x 轻量级状态管理库，替代 React Context API
- **Route_Structure**: 源项目中基于 react-router-dom 的 HashRouter 路由配置，包含 15 个模块、50+ 页面
- **Lazy_Loading**: 基于 React.lazy 和 Suspense 的按需加载机制
- **Hot_Reload**: 配置文件热更新机制，支持运行时修改配置无需重启服务
- **CAB**: Change Advisory Board，高危变更审批委员会
- **change_level**: 变更级别字段，取值 `none`（无需审批）/ `normal`（常规审批）/ `cab`（高危变更）

## 技术栈总览（严格生产版）

| 层级 | 技术选型 | 版本 | 审批级别 | 配置策略 | 生效时间 |
|------|----------|------|----------|----------|----------|
| 入口层/API网关 | OpenResty (Nginx+Lua) | 1.25+ | CAB | 热更新优先；核心参数滚动 | 分钟级 |
| 身份认证 | Keycloak | 24+ | CAB | Realm/策略热更；SPI重启 | 分钟级 |
| 策略控制 | OPA | 0.6x+ | CAB | Policy Bundle 热更新 | 秒级 |
| 采集层 | Go Agent + 插件 | Go 1.22+ | 常规 | 规则热更；插件升级重启 | 分钟级 |
| 消息传输层 | Kafka | 3.7+ | CAB | 动态配置+核心参数重启 | 发布窗口 |
| 消息治理 | Schema Registry | 2.5+/7.x+ | CAB | Schema/兼容策略热更 | 分钟级 |
| 实时计算层 | Flink (SQL+CEP) | 1.19+ | CAB | 参数热更；作业 Savepoint 发布 | 发布窗口 |
| 检索存储 | Elasticsearch | 8.13+ | CAB | ILM热更；节点参数重启 | 发布窗口 |
| 冷存储 | MinIO/S3 | 稳定版 | 常规 | 生命周期策略热更 | 分钟级 |
| 元数据DB | PostgreSQL | 16+ | CAB | 业务配置热生效；核心参数重启 | 发布窗口 |
| PG高可用 | Patroni + etcd | 稳定版 | CAB | 拓扑变更维护窗口 | 发布窗口 |
| 连接池 | PgBouncer | 1.2x+ | 常规 | reload优先 | 分钟级 |
| 缓存层 | Redis Cluster | 7.2+ | CAB | TTL热更；拓扑变更重启 | 分钟级 |
| 控制面服务 | Go (Gin)+gRPC | Go 1.22+ | 常规 | 参数热更；镜像滚动 | 分钟级 |
| 健康检测层 | Go health-worker | Go 1.22+ | 无需审批 | 目标/阈值热更 | 分钟级 |
| API层 | Go (Gin) | Go 1.22+ | 常规 | 开关热更；版本滚动 | 分钟级 |
| Node.js层(可选) | NestJS (BFF) | Node 20 LTS | 常规 | 配置热更；升级重启 | 分钟级 |
| 前端层 | React + TS + AntD | React19/TS5.x | 常规 | 远程配置热更；其余发版 | 发布窗口 |
| 可视化 | ECharts | 5.x | 无需审批 | 图表配置热更 | 秒级 |
| 前端状态管理 | Zustand | 4.x | 无需审批 | 运行时热更新 | 秒级 |
| 密钥管理 | Vault | 1.15+ | CAB | Secret热更；后端变更重启 | 分钟级 |
| 容器编排 | Kubernetes | 1.28+ | CAB | 声明式变更+滚动 | 发布窗口 |
| 包管理 | Helm | 3.13+ | 常规 | YAML主通道 | 发布窗口 |
| GitOps | Argo CD | 2.1x+ | 常规 | Git为准，防配置漂移 | 发布窗口 |
| 指标监控 | Prometheus | 2.48+ | 无需审批 | 规则/目标 reload | 分钟级 |
| 告警中心 | Alertmanager | 0.27+ | 无需审批 | 配置热重载 | 秒级 |
| 可视化监控 | Grafana | 10.2+ | 无需审批 | Dashboard/规则热更 | 秒级 |
| 链路追踪 | Jaeger + OTel Collector | Jaeger1.50+/OTel0.9x+ | 常规 | 采样热更；结构变更滚动 | 分钟级 |
| CI/CD | GitLab CI / GitHub Actions | - | 常规 | Pipeline 即代码 | 分钟级 |
| 制品仓库 | Harbor | 2.10+ | 常规 | 策略热更 | 分钟级 |
| 安全扫描 | Trivy + SAST | 稳定版 | 无需审批 | 规则库热更 | 分钟级 |
| ML(可选) | Python+sklearn+PyTorch+ONNX+MLflow | Py3.11+ | 常规 | 模型热切换；服务滚动 | 分钟级 |
| NLP(可选) | LLM API + 规则引擎 | - | 常规 | Prompt/规则热更 | 秒级 |
| 向量检索(可选) | pgvector | 0.6+ | CAB | 索引分阶段；扩展升级窗口 | 发布窗口 |
| 边缘计算(可选) | MQTT 5.0 + SQLite/BoltDB | - | 常规 | 规则热更；分批升级 | 分钟级 |

## 需求

### 需求 1：Monorepo 项目结构搭建

**用户故事：** 作为开发者，我希望 NexusLog 采用业务域+平台域分层的 Monorepo 架构，以便各域可以独立开发、测试和部署。

#### 验收标准

1. THE Target_Project SHALL 包含以下顶层目录：`apps/`（应用层）、`services/`（微服务层）、`gateway/`（API 网关）、`iam/`（身份认证与授权）、`agents/`（采集代理）、`stream/`（流计算）、`messaging/`（消息传输）、`contracts/`（契约定义）、`storage/`（存储配置）、`observability/`（可观测性）、`platform/`（平台治理）、`infra/`（基础设施即代码）、`ml/`（机器学习，可选）、`edge/`（边缘计算，可选）、`configs/`（公共配置）、`docs/`（项目文档）、`scripts/`（脚本工具）、`tests/`（集成/E2E/性能/混沌测试）
2. THE Target_Project SHALL 在根目录包含 `go.work` 文件管理多个 Go 模块的工作区
3. THE Target_Project SHALL 在根目录包含 `Makefile` 作为统一构建/测试命令入口
4. THE Target_Project SHALL 在根目录包含 `package.json` 管理前端相关的 pnpm workspace
5. THE Target_Project SHALL 在根目录包含统一的 `README.md` 描述 Monorepo 结构、各域职责和技术选型
6. THE Target_Project SHALL 在 `configs/` 目录下包含 `common/`、`dev/`、`staging/`、`prod/` 环境配置，且三个环境目录结构完全一致

### 需求 2：前端控制台初始化

**用户故事：** 作为前端开发者，我希望 Frontend_Console 使用 React 19 + TypeScript + Ant Design + ECharts + Zustand 技术栈，以便获得企业级 UI 组件和高性能图表能力。

#### 验收标准

1. THE Frontend_Console SHALL 位于 `apps/frontend-console/` 目录下，包含独立的 `package.json`、`tsconfig.json`、`vite.config.ts` 和 `Dockerfile`
2. THE Frontend_Console SHALL 使用 React 19.x 和 TypeScript 5.0+ 作为基础框架
3. THE Frontend_Console SHALL 集成 Ant Design 5.x 作为 UI 组件库，并配置中文语言包（zh_CN）
4. THE Frontend_Console SHALL 集成 ECharts 5.x 作为图表库
5. THE Frontend_Console SHALL 集成 Zustand 4.x 作为全局状态管理方案
6. THE Frontend_Console SHALL 保留 react-router-dom 作为路由方案，使用 HashRouter 模式
7. THE Frontend_Console SHALL 配置 Vitest 作为单元测试框架，配置 fast-check 作为属性测试库
8. THE Frontend_Console SHALL 配置 TypeScript 严格模式，包含 strict、noImplicitAny、strictNullChecks 等选项

### 需求 3：路由结构迁移

**用户故事：** 作为用户，我希望 NexusLog 保留源项目的完整路由结构和页面导航，以便访问所有功能模块。

#### 验收标准

1. THE Frontend_Console SHALL 迁移 Source_Project 的全部 15 个路由模块：日志检索、日志分析、告警中心、采集接入、解析字段、索引存储、性能高可用、分布式追踪、报表中心、安全审计、集成平台、成本管理、系统设置、帮助中心、认证模块
2. THE Frontend_Console SHALL 保留 Source_Project 的嵌套路由结构，每个模块包含 index 路由和子路由
3. THE Frontend_Console SHALL 对非首页路由使用 React.lazy 实现代码分割和懒加载
4. WHEN 用户访问未匹配的路由路径时，THE Frontend_Console SHALL 回退显示 Dashboard 首页
5. THE Frontend_Console SHALL 保留公开路由（登录、注册、忘记密码）和受保护路由的区分

### 需求 4：布局组件迁移

**用户故事：** 作为用户，我希望 NexusLog 拥有与源项目一致的布局结构（侧边栏、顶部栏、主内容区），以便获得熟悉的操作体验。

#### 验收标准

1. THE Frontend_Console SHALL 实现 Layout 组件，包含侧边栏导航、顶部导航栏和主内容区域
2. THE Frontend_Console SHALL 使用 Ant Design 的 Layout、Sider、Header 组件替代 Tailwind CSS 自定义布局
3. WHEN 用户点击侧边栏折叠按钮时，THE Frontend_Console SHALL 切换侧边栏的折叠/展开状态
4. WHEN 屏幕宽度小于 768px 时，THE Frontend_Console SHALL 将侧边栏转换为抽屉式导航
5. THE Frontend_Console SHALL 实现多级菜单导航，支持菜单项展开/折叠，并根据当前路由自动高亮对应菜单项
6. THE Frontend_Console SHALL 在侧边栏顶部显示品牌 Logo 和项目名称 "NexusLog"

### 需求 5：Tailwind CSS 到 Ant Design 的样式迁移

**用户故事：** 作为前端开发者，我希望将所有 Tailwind CSS 样式转换为 Ant Design 组件和主题配置，以便统一 UI 风格并减少自定义 CSS。

#### 验收标准

1. THE Migration_Engine SHALL 将 Source_Project 中的 Tailwind CSS 工具类替换为 Ant Design 组件的对应属性和内置样式
2. THE Frontend_Console SHALL 配置 Ant Design 主题 Token，定义主色调、暗色模式和亮色模式的色彩方案
3. THE Frontend_Console SHALL 支持暗色模式和亮色模式切换，使用 Ant Design 的 ConfigProvider 和 theme.algorithm 实现
4. WHEN 用户切换主题模式时，THE Frontend_Console SHALL 在 200ms 内完成全局主题切换，且页面无闪烁
5. THE Frontend_Console SHALL 使用 Ant Design 的 Table、Modal、Form、Button、Card、Drawer 等组件替代源项目中的自定义通用组件

### 需求 6：Recharts 到 ECharts 的图表迁移

**用户故事：** 作为用户，我希望 NexusLog 的图表使用 ECharts 渲染，以便获得更丰富的交互能力和更好的大数据量性能。

#### 验收标准

1. THE Frontend_Console SHALL 创建通用的 ECharts 包装组件，封装 ECharts 实例的初始化、更新和销毁生命周期
2. THE Frontend_Console SHALL 将 Source_Project 中的 BarChart、PieChart、TimeSeriesChart 组件迁移为基于 ECharts 的等效实现
3. WHEN 图表容器尺寸变化时，THE Frontend_Console SHALL 自动调用 ECharts 的 resize 方法适配新尺寸
4. THE Frontend_Console SHALL 为 ECharts 图表组件提供统一的主题配置，与 Ant Design 主题色保持一致
5. WHEN 用户切换暗色/亮色模式时，THE Frontend_Console SHALL 同步更新 ECharts 图表的配色方案

### 需求 7：Context API 到 Zustand 的状态管理迁移

**用户故事：** 作为前端开发者，我希望使用 Zustand 替代 Context API 管理全局状态，以便减少不必要的重渲染并简化状态管理代码。

#### 验收标准

1. THE Frontend_Console SHALL 将 Source_Project 的 AuthContext 迁移为 Zustand useAuthStore，保留用户认证、登录、登出、Token 刷新等功能
2. THE Frontend_Console SHALL 将 Source_Project 的 ThemeContext 迁移为 Zustand useThemeStore，保留主题模式切换和密度配置功能
3. THE Frontend_Console SHALL 将 Source_Project 的 NotificationContext 迁移为 Zustand useNotificationStore，保留通知的增删查和未读计数功能
4. THE Frontend_Console SHALL 将 Source_Project 的 CacheContext 和 OfflineContext 迁移为对应的 Zustand Store
5. WHEN Zustand Store 中的状态发生变化时，THE Frontend_Console SHALL 仅重渲染订阅了该状态切片的组件

### 需求 8：通用组件迁移

**用户故事：** 作为前端开发者，我希望将源项目的通用组件（DataTable、Modal、ErrorBoundary 等）迁移到新技术栈，以便在各页面中复用。

#### 验收标准

1. THE Frontend_Console SHALL 将 Source_Project 的 DataTable 组件迁移为基于 Ant Design Table 的封装，保留排序、筛选、分页功能
2. THE Frontend_Console SHALL 将 Source_Project 的 Modal 组件迁移为基于 Ant Design Modal 的封装
3. THE Frontend_Console SHALL 迁移 ErrorBoundary 组件，在捕获错误时使用 Ant Design 的 Result 组件展示错误信息
4. THE Frontend_Console SHALL 迁移 LoadingScreen 组件，使用 Ant Design 的 Spin 组件实现加载状态展示
5. THE Frontend_Console SHALL 迁移 StatCard 组件，使用 Ant Design 的 Card 和 Statistic 组件展示 KPI 数据

### 需求 9：页面模块迁移

**用户故事：** 作为用户，我希望 NexusLog 包含源项目的所有功能页面，以便使用完整的日志管理功能。

#### 验收标准

1. THE Frontend_Console SHALL 迁移 Dashboard 首页，包含 KPI 卡片、日志趋势图表和基础设施监控面板
2. THE Frontend_Console SHALL 迁移日志检索模块的全部页面：实时搜索、搜索历史、保存的查询
3. THE Frontend_Console SHALL 迁移告警中心模块的全部页面：告警列表、告警规则、通知配置、静默策略
4. THE Frontend_Console SHALL 迁移安全审计模块的全部页面：用户管理、角色权限、审计日志、登录策略
5. THE Frontend_Console SHALL 迁移其余模块（日志分析、采集接入、解析字段、索引存储、性能高可用、分布式追踪、报表中心、集成平台、成本管理、系统设置、帮助中心）的页面骨架，每个页面包含标题和基本布局结构

### 需求 10：类型系统迁移

**用户故事：** 作为前端开发者，我希望 NexusLog 保留源项目完整的 TypeScript 类型定义，以便获得类型安全保障。

#### 验收标准

1. THE Frontend_Console SHALL 迁移 Source_Project 的全部类型定义文件，包括 common、user、theme、log、alert、dashboard、api、notification、navigation、components 类型模块
2. THE Frontend_Console SHALL 调整类型定义以适配 React 19 的类型系统
3. THE Frontend_Console SHALL 调整组件 Props 类型以适配 Ant Design 组件的属性接口
4. THE Frontend_Console SHALL 保留统一的类型导出入口文件 `types/index.ts`

### 需求 11：工具函数和 Hooks 迁移

**用户故事：** 作为前端开发者，我希望迁移源项目的工具函数和自定义 Hooks，以便在新项目中复用业务逻辑。

#### 验收标准

1. THE Frontend_Console SHALL 迁移 Source_Project 的工具函数模块：formatters、validators、date、cache、sanitize、helpers
2. THE Frontend_Console SHALL 迁移 Source_Project 的自定义 Hooks：useApi、useDebounce、useLocalStorage、useDashboardData、useAutoSave
3. WHEN 迁移的 Hooks 依赖 Context API 时，THE Frontend_Console SHALL 将其改为从对应的 Zustand Store 获取状态
4. THE Frontend_Console SHALL 保留工具函数和 Hooks 的统一导出入口文件

### 需求 12：构建和开发配置

**用户故事：** 作为开发者，我希望 NexusLog 前端拥有完善的构建和开发配置，以便高效开发和部署。

#### 验收标准

1. THE Frontend_Console SHALL 配置 Vite 开发服务器，支持热模块替换（HMR）和路径别名解析
2. THE Frontend_Console SHALL 配置生产构建的代码分割策略，将 React、Ant Design、ECharts 分别打包为独立的 vendor chunk
3. THE Frontend_Console SHALL 配置 Gzip 和 Brotli 压缩插件用于生产构建
4. THE Frontend_Console SHALL 在生产构建时移除 console 和 debugger 语句
5. THE Frontend_Console SHALL 配置环境变量文件（.env.development、.env.production），支持 API 地址等配置的环境隔离

### 需求 13：后端微服务目录结构

**用户故事：** 作为后端开发者，我希望 NexusLog 后端采用多服务架构，各服务拥有清晰的 Go 项目结构，以便独立开发和部署。

#### 验收标准

1. THE Control_Plane SHALL 位于 `services/control-plane/` 目录下，包含 `cmd/api/`（入口）、`internal/`（含 app/、domain/、service/、repository/、transport/http/、transport/grpc/）、`api/`（含 openapi/、proto/）、`configs/`、`tests/` 和独立的 `Dockerfile`
2. THE Health_Worker SHALL 位于 `services/health-worker/` 目录下，包含 `cmd/worker/`（入口）、`internal/`（含 checker/、scheduler/、reporter/）、`configs/`、`tests/` 和独立的 `Dockerfile`
3. THE Data_Services SHALL 位于 `services/data-services/` 目录下，包含 `query-api/`、`audit-api/`、`export-api/`、`shared/` 子目录和独立的 `Dockerfile`
4. THE API_Service SHALL 位于 `services/api-service/` 目录下，包含 `cmd/api/`、`internal/`、`api/openapi/`、`configs/` 和独立的 `Dockerfile`
5. THE Target_Project SHALL 在根目录包含 `go.work` 文件，将所有 Go 服务模块纳入工作区管理
6. WHEN 新增 Go 服务时，THE Target_Project SHALL 遵循相同的目录结构约定（cmd/ + internal/ + configs/ + tests/ + Dockerfile）

### 需求 14：API 网关配置

**用户故事：** 作为架构师，我希望 NexusLog 包含基于 OpenResty 的 API 网关配置，以便统一管理流量入口、路由和安全策略。

#### 验收标准

1. THE Gateway SHALL 位于 `gateway/openresty/` 目录下，包含 `nginx.conf`、`conf.d/`、`lua/`、`tenants/`、`policies/`、`tests/` 和独立的 `Dockerfile`
2. THE Gateway SHALL 在 `nginx.conf` 中定义基础的反向代理配置，将 API 请求路由到后端服务
3. THE Gateway SHALL 在 `lua/` 目录下包含基础的 Lua 脚本模板（认证校验、限流、日志）

### 需求 15：IAM 安全体系配置

**用户故事：** 作为安全工程师，我希望项目包含 Keycloak、OPA、Vault 的完整配置结构，以便后续集成统一认证和授权。

#### 验收标准

1. THE IAM SHALL 在 `iam/keycloak/` 目录下包含 `realms/`、`clients/`、`roles/`、`mappers/` 子目录，并提供基础 Realm 导入配置模板（JSON 格式）
2. THE IAM SHALL 在 `iam/opa/` 目录下包含 `policies/`、`bundles/`、`tests/` 子目录，并提供基础 RBAC 授权策略示例（Rego 格式）
3. THE IAM SHALL 在 `iam/vault/` 目录下包含 `policies/`、`auth/`、`engines/` 子目录，并提供策略配置模板

### 需求 16：消息传输与契约配置

**用户故事：** 作为架构师，我希望项目包含 Kafka 消息传输和 Schema 契约的配置结构，以便实现可靠的异步消息通信。

#### 验收标准

1. THE Target_Project SHALL 在 `messaging/kafka/` 目录下包含 `topics/`、`quotas/`、`broker-config/` 子目录
2. THE Target_Project SHALL 在 `messaging/schema-registry/` 目录下包含 `config/`、`compatibility-rules/` 子目录
3. THE Target_Project SHALL 在 `messaging/dlq-retry/` 目录下包含 `retry-policies/`、`consumer-config/` 子目录
4. THE Target_Project SHALL 在 `contracts/schema-contracts/` 目录下包含 `avro/`、`protobuf/`、`jsonschema/`、`compatibility/`、`tests/` 子目录

### 需求 17：存储层配置

**用户故事：** 作为运维工程师，我希望项目包含 Elasticsearch、PostgreSQL、Redis、MinIO 等存储组件的配置结构，以便统一管理存储层。

#### 验收标准

1. THE Target_Project SHALL 在 `storage/elasticsearch/` 目录下包含 `index-templates/`、`ilm-policies/`、`ingest-pipelines/`、`snapshots/` 子目录
2. THE Target_Project SHALL 在 `storage/postgresql/` 目录下包含 `migrations/`、`seeds/`、`rls-policies/`、`patroni/`、`etcd/`、`pgbouncer/` 子目录
3. THE Target_Project SHALL 在 `storage/redis/` 目录下包含 `cluster-config/`、`lua-scripts/` 子目录
4. THE Target_Project SHALL 在 `storage/minio/` 目录下包含 `buckets/`、`lifecycle/` 子目录
5. THE Target_Project SHALL 在 `storage/glacier/` 目录下包含 `archive-policies/` 子目录

### 需求 18：可观测性配置

**用户故事：** 作为 SRE，我希望项目在独立的 `observability/` 域下包含 Prometheus、Alertmanager、Grafana、Jaeger、OTel Collector、Loki 的配置模板，以便快速搭建监控体系。

#### 验收标准

1. THE Target_Project SHALL 在 `observability/prometheus/` 目录下包含 `prometheus.yml`、`rules/`、`targets/` 子目录
2. THE Target_Project SHALL 在 `observability/alertmanager/` 目录下包含 `alertmanager.yml`、`templates/` 子目录
3. THE Target_Project SHALL 在 `observability/grafana/` 目录下包含 `dashboards/`、`datasources/` 子目录
4. THE Target_Project SHALL 在 `observability/jaeger/` 目录下包含 `config/` 子目录
5. THE Target_Project SHALL 在 `observability/otel-collector/` 目录下包含 `config/` 子目录
6. THE Target_Project SHALL 在 `observability/loki/` 目录下包含 `config/` 子目录

### 需求 19：平台治理与部署配置

**用户故事：** 作为运维工程师，我希望项目在 `platform/` 域下包含 Kubernetes、Helm、GitOps、CI、安全扫描、Istio 的配置结构，以便实现标准化的平台治理和部署。

#### 验收标准

1. THE Target_Project SHALL 在 `platform/kubernetes/` 目录下包含 `base/`、`namespaces/`、`rbac/`、`network-policies/`、`storageclasses/` 子目录
2. THE Target_Project SHALL 在 `platform/helm/` 目录下包含 `nexuslog-gateway/`、`nexuslog-control-plane/`、`nexuslog-data-plane/`、`nexuslog-storage/`、`nexuslog-observability/` Helm Chart 子目录
3. THE Target_Project SHALL 在 `platform/gitops/argocd/` 目录下包含 `projects/`、`applicationsets/` 子目录，在 `platform/gitops/apps/` 下包含各系统的 GitOps 应用定义，在 `platform/gitops/clusters/` 下包含 `dev/`、`staging/`、`prod/` 集群配置
4. THE Target_Project SHALL 在 `platform/ci/` 目录下包含 `templates/`、`scripts/` 子目录
5. THE Target_Project SHALL 在 `platform/security/` 目录下包含 `trivy/`、`sast/`、`image-sign/` 子目录
6. THE Target_Project SHALL 在 `platform/istio/` 目录下包含 `gateways/`、`virtualservices/`、`destinationrules/` 子目录
7. THE Frontend_Console SHALL 在 `apps/frontend-console/` 目录下包含独立的 `Dockerfile`，支持多阶段构建（pnpm install → build → nginx 静态服务）

### 需求 20：基础设施即代码

**用户故事：** 作为 DevOps 工程师，我希望项目包含 Terraform 和 Ansible 的基础设施代码结构，以便实现基础设施的声明式管理。

#### 验收标准

1. THE Target_Project SHALL 在 `infra/terraform/` 目录下包含 `modules/` 和 `envs/`（含 dev/、staging/、prod/）子目录
2. THE Target_Project SHALL 在 `infra/ansible/` 目录下包含 `inventories/`、`roles/` 子目录

### 需求 21：采集代理与流计算配置

**用户故事：** 作为架构师，我希望项目包含日志采集代理和 Flink 流计算的目录结构，以便后续开发数据采集和实时处理能力。

#### 验收标准

1. THE Collector_Agent SHALL 位于 `agents/collector-agent/` 目录下，包含 `cmd/agent/`、`internal/`（含 collector/、pipeline/、checkpoint/、retry/）、`plugins/`（含 grpc/、wasm/）、`configs/`、`tests/` 和独立的 `Dockerfile`
2. THE Target_Project SHALL 在 `stream/flink/` 目录下包含 `jobs/`（含 sql/、cep/）、`udf/`、`libs/`、`savepoints/`、`configs/`、`tests/` 子目录

### 需求 22：配置热更新机制

**用户故事：** 作为运维工程师，我希望 NexusLog 的配置支持热更新，以便在不重启服务的情况下修改运行时配置。

#### 验收标准

1. THE Frontend_Console SHALL 通过环境变量和运行时配置文件（`/config/app-config.json`）支持配置热更新
2. THE Control_Plane SHALL 在配置模板中预留文件监听（file watcher）机制的接口定义
3. WHEN 运行时配置文件发生变化时，THE Frontend_Console SHALL 在下次页面刷新时加载最新配置

### 需求 23：变更管理体系

**用户故事：** 作为运维工程师和开发者，我希望项目内置变更管理规范文档和配置模板，以便所有变更遵循统一的审批和回滚流程。

#### 验收标准

1. THE Target_Project SHALL 在 `docs/` 目录下包含变更管理规范文档，定义三级审批体系：无需审批（none）、常规审批（normal）、高危变更（cab）
2. THE Target_Project SHALL 在变更管理文档中包含 CAB 判定规则表，定义 7 条硬规则（涉及认证链路、存储拓扑、入口流量、密钥证书、不可逆数据、跨机房切换、5分钟不可回滚）
3. THE Target_Project SHALL 在变更管理文档中包含风险评分矩阵（影响范围、业务关键性、复杂度、可回滚性、可观测性，各 0-3 分），总分 ≤5 无需审批、6-10 常规、≥11 CAB
4. THE Target_Project SHALL 在变更管理文档中包含回滚 SLA 模板：T+5分钟回滚决策、T+15分钟核心恢复、T+30分钟根因初判、T+24小时复盘报告
5. THE Target_Project SHALL 在变更管理文档中包含变更单模板（字段级），含风险评分自动计算规则、CAB 自动路由逻辑、非窗口发布判定规则
6. THE Target_Project SHALL 在后端配置模板中为每个组件标注 `change_level` 字段（none/normal/cab）和推荐生效时间

### 需求 24：CI/CD 和 GitOps 配置

**用户故事：** 作为 DevOps 工程师，我希望项目包含 CI/CD 流水线和 GitOps 配置模板，以便实现自动化构建、测试和部署。

#### 验收标准

1. THE Target_Project SHALL 包含 GitHub Actions 工作流配置（`.github/workflows/`），定义前端构建测试、后端构建测试、镜像构建推送流水线
2. THE Target_Project SHALL 在 `platform/gitops/argocd/` 下包含 Argo CD Application 配置模板，定义 GitOps 发布流程
3. THE Target_Project SHALL 在 CI 流水线中集成 Trivy 镜像安全扫描步骤

### 需求 25：项目文档体系

**用户故事：** 作为团队成员，我希望项目包含完善的架构文档、ADR、运维手册等文档体系，以便快速了解系统设计和运维流程。

#### 验收标准

1. THE Target_Project SHALL 在 `docs/architecture/` 目录下包含系统上下文、逻辑架构、部署架构、数据流、安全架构文档模板
2. THE Target_Project SHALL 在 `docs/adr/` 目录下包含 ADR-0001-monorepo 架构决策记录
3. THE Target_Project SHALL 在 `docs/runbooks/` 目录下包含 Kafka 消费延迟、ES 写入拒绝、回滚操作手册模板
4. THE Target_Project SHALL 在 `docs/` 目录下包含 `oncall/`、`security/`、`sla-slo/` 子目录
