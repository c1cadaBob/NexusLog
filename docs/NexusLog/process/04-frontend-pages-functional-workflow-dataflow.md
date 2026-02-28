# 前端逐页功能清单、业务流程与数据流向

> 基于当前 `apps/frontend-console/src/pages` 全量页面（59 页）整理。  
> 文档目标：给每个页面定义“应实现功能、业务流程、数据流向、关键接口与实体”，用于后续逐页打通。

## 1. 总览

- 页面总数：59
- 扫描现状：`mock=36`、`table=30`、`form=16`、`chart=7`、`drawer=4`、`modal=18`
- 当前问题：页面层较完整，但多数页面尚未形成稳定的 API-服务-数据存储闭环。

统一数据流基线（推荐）：

1. 页面 UI 触发动作（查询/提交/编辑/发布）
2. 前端 API/BFF 层封装请求（鉴权、租户、重试、错误处理）
3. 后端服务层执行业务（校验、权限、事务、审计）
4. 数据层写入/读取（PostgreSQL 元数据 + Elasticsearch 查询数据 + Redis 缓存）
5. 结果回传页面并记录操作审计

---

## 2. 认证模块

| 页面（路由 / 文件） | 需实现功能 | 业务流程 | 数据流向（目标） | 关键接口与实体 |
|---|---|---|---|---|
| `/login` `auth/LoginPage.tsx` | 用户登录、SSO入口、社交登录跳转、登录后重定向 | 输入账号密码 -> 校验 -> 登录 -> 存储会话 -> 跳转 Dashboard | UI -> `POST /api/v1/auth/login` -> Auth Service -> PG `users/user_roles` + 会话存储 -> UI | `users`, `roles`, `user_roles`, 建议 `user_sessions` |
| `/register` `auth/RegisterPage.tsx` | 新用户注册、基础校验、注册后自动登录/引导登录 | 填写注册信息 -> 校验唯一性 -> 创建账号 -> 绑定默认角色 | UI -> `POST /api/v1/auth/register` -> Auth Service -> PG `users` + `user_roles` | `users`, `user_roles` |
| `/forgot-password` `auth/ForgotPasswordPage.tsx` | 发起重置、验证码/链接校验、重置密码 | 输入邮箱/用户名 -> 发送重置令牌 -> 提交新密码 | UI -> `POST /api/v1/auth/password/reset-request` + `POST /reset-confirm` -> Auth Service -> PG | 建议 `password_reset_tokens`, `users` |

---

## 3. Dashboard

| 页面（路由 / 文件） | 需实现功能 | 业务流程 | 数据流向（目标） | 关键接口与实体 |
|---|---|---|---|---|
| `/` `Dashboard.tsx` | KPI卡片、趋势图、告警摘要、服务健康总览、快捷跳转 | 进入页面 -> 拉取聚合数据 -> 展示卡片/图表 -> 点击跳转子模块 | UI -> `GET /api/v1/dashboard/overview` -> BFF 聚合（Alerts/Incidents/Search/Health）-> PG+ES+Prometheus -> UI | `alert_event`, `incident`, `health_check_result`, ES 聚合 |

---

## 4. 日志检索模块

| 页面（路由 / 文件） | 需实现功能 | 业务流程 | 数据流向（目标） | 关键接口与实体 |
|---|---|---|---|---|
| `/search/realtime` `search/RealtimeSearch.tsx` | 实时查询、过滤、分页、详情抽屉、导出 | 输入查询语句 -> 执行查询 -> 返回列表 -> 查看详情/导出 | UI -> `POST /api/v1/search/query` -> Query API -> ES -> UI | ES 日志索引，建议 `search_query_log` |
| `/search/history` `search/SearchHistory.tsx` | 历史查询列表、复用查询、删除历史 | 页面加载 -> 查询历史 -> 复用/清理 | UI -> `GET/DELETE /api/v1/search/history` -> API -> PG | 建议 `query_history` |
| `/search/saved` `search/SavedQueries.tsx` | 收藏查询 CRUD、标签管理、一键执行 | 新建收藏 -> 保存 -> 列表管理 -> 调用实时查询 | UI -> `GET/POST/PUT/DELETE /api/v1/search/saved` -> API -> PG | 建议 `saved_query`, `saved_query_tag` |

---

## 5. 日志分析模块

| 页面（路由 / 文件） | 需实现功能 | 业务流程 | 数据流向（目标） | 关键接口与实体 |
|---|---|---|---|---|
| `/analysis/aggregate` `analysis/AggregateAnalysis.tsx` | 聚合维度分析、趋势对比、TopN分组 | 选择时间/维度 -> 聚合查询 -> 渲染图表/表格 | UI -> `POST /api/v1/analysis/aggregate` -> Query/Flink -> ES/缓存 -> UI | ES 聚合结果，建议 `analysis_snapshot` |
| `/analysis/anomaly` `analysis/AnomalyDetection.tsx` | 异常检测列表、异常明细、确认/误报反馈 | 拉取异常 -> 查看详情 -> 标注处理状态 | UI -> `GET /api/v1/analysis/anomalies` -> ML Service -> PG/ES -> UI | 建议 `anomaly_event`, `anomaly_feedback` |
| `/analysis/clustering` `analysis/LogClustering.tsx` | 日志聚类、模板提取、聚类对比 | 选择窗口 -> 执行聚类 -> 查看簇详情 -> 导出结论 | UI -> `POST /api/v1/analysis/clusters` -> Analysis Service -> ES/向量检索 -> UI | 建议 `cluster_job`, `cluster_result` |

---

## 6. 告警中心模块

| 页面（路由 / 文件） | 需实现功能 | 业务流程 | 数据流向（目标） | 关键接口与实体 |
|---|---|---|---|---|
| `/alerts/list` `alerts/AlertList.tsx` | 告警列表、筛选、确认、关闭、跳转事件 | 加载列表 -> 筛选 -> ACK/CLOSE -> 回写状态 | UI -> `GET /api/v1/alerts/events`, `POST /ack`, `POST /close` -> Alert Service -> PG | `alert_event`, `alert_ack` |
| `/alerts/rules` `alerts/AlertRules.tsx` | 规则 CRUD、启停、阈值与表达式管理 | 新建/编辑规则 -> 保存 -> 启停 -> 立即校验 | UI -> `GET/POST/PUT/DELETE /api/v1/alerts/rules` -> Alert Service -> PG | 实际 `alert_rules`（或统一 `alert_rule`） |
| `/alerts/notifications` `alerts/NotificationConfig.tsx` | 通知渠道管理（邮箱/Webhook/IM）、测试发送 | 创建渠道 -> 绑定规则 -> 测试发送 -> 启停 | UI -> `GET/POST/PUT/DELETE /api/v1/alerts/channels`, `POST /test` -> Notify Service -> PG + 外部通道 | 建议 `notification_channel`, `notification_binding` |
| `/alerts/silence` `alerts/SilencePolicy.tsx` | 静默策略 CRUD、时间窗管理、匹配器管理 | 创建静默 -> 匹配规则 -> 生效/失效 -> 审计 | UI -> `GET/POST/PUT/DELETE /api/v1/alerts/silences` -> Alert Service -> PG | 建议 `silence_policy`, `silence_matcher` |

---

## 7. 事件管理模块

| 页面（路由 / 文件） | 需实现功能 | 业务流程 | 数据流向（目标） | 关键接口与实体 |
|---|---|---|---|---|
| `/incidents/list` `incidents/IncidentList.tsx` | 事件列表、分级筛选、状态流转入口 | 加载事件 -> 过滤排序 -> 进入详情/变更状态 | UI -> `GET /api/v1/incidents` -> Incident Service -> PG | `incident` |
| `/incidents/detail/:id` `incidents/IncidentDetail.tsx` | 事件详情、关联告警、处置动作、证据查看 | 拉取详情 -> 执行动作 -> 写入时间线与审计 | UI -> `GET /api/v1/incidents/:id`, `POST /actions` -> Incident Service -> PG + 对外动作系统 | `incident`, `incident_action`, `incident_alert_link`, `incident_log_bundle` |
| `/incidents/timeline` `incidents/IncidentTimeline.tsx` | 全流程时间线、按事件类型过滤 | 选择事件 -> 查询时间线 -> 查看节点细节 | UI -> `GET /api/v1/incidents/:id/timeline` -> Incident Service -> PG | `incident_timeline` |
| `/incidents/analysis` `incidents/IncidentAnalysis.tsx` | 根因分析、影响范围、改进项记录 | 填写分析 -> 审核 -> 发布结论 | UI -> `GET/PUT /api/v1/incidents/:id/analysis` -> Incident Service -> PG | `incident_analysis` |
| `/incidents/sla` `incidents/IncidentSLA.tsx` | MTTA/MTTR、SLA违约统计、超时追踪 | 拉取SLA指标 -> 展示统计 -> 导出报表 | UI -> `GET /api/v1/incidents/sla` -> Incident Service -> PG | `incident_response_sla`, `incident_sla_policy` |
| `/incidents/archive` `incidents/IncidentArchive.tsx` | 事件归档、保留期、取证文件索引 | 选择归档 -> 写入归档记录 -> 生成可追溯索引 | UI -> `GET/POST /api/v1/incidents/archive` -> Incident Service -> PG + Object Storage | `incident_archive`, `incident_postmortem` |

---

## 8. 采集与接入模块

| 页面（路由 / 文件） | 需实现功能 | 业务流程 | 数据流向（目标） | 关键接口与实体 |
|---|---|---|---|---|
| `/ingestion/sources` `ingestion/SourceManagement.tsx` | 数据源 CRUD、启停、配置校验 | 新建数据源 -> 校验连通性 -> 保存 -> 启停 | UI -> `GET/POST/PUT/DELETE /api/v1/ingestion/sources` -> Ingestion Service -> PG | 建议 `data_source`（或复用 `collector_rule/collector_target`） |
| `/ingestion/agents` `ingestion/AgentManagement.tsx` | Agent 注册、升级、分组、在线状态 | 注册/导入 Agent -> 分组 -> 发布升级 | UI -> `GET/POST /api/v1/ingestion/agents`, `POST /upgrade` -> Agent Service -> PG + Agent Control Channel | `agent_node`, `agent_group`, `agent_group_member` |
| `/ingestion/wizard` `ingestion/AccessWizard.tsx` | 接入向导、模板化配置、步骤校验 | 选择数据源类型 -> 填写参数 -> 预检 -> 生成配置 | UI -> `POST /api/v1/ingestion/wizard/preview`, `POST /apply` -> Ingestion Service -> PG | `collector_rule`, `collector_target` |
| `/ingestion/status` `ingestion/SourceStatus.tsx` | 数据源运行状态、吞吐、延迟、积压监控 | 轮询状态 -> 展示图表 -> 异常告警跳转 | UI -> `GET /api/v1/ingestion/status` -> Ingestion Service -> Kafka/Agent metrics + PG -> UI | `agent_node`, Kafka lag 指标 |

---

## 9. 解析与字段模块

| 页面（路由 / 文件） | 需实现功能 | 业务流程 | 数据流向（目标） | 关键接口与实体 |
|---|---|---|---|---|
| `/parsing/mapping` `parsing/FieldMapping.tsx` | 字段映射规则 CRUD、版本管理 | 编辑映射 -> 预览转换结果 -> 发布版本 | UI -> `GET/POST/PUT /api/v1/parsing/mappings` -> Parsing Service -> PG | 建议 `field_mapping`, `mapping_version` |
| `/parsing/rules` `parsing/ParsingRules.tsx` | 解析规则管理、样本测试、灰度发布 | 编辑规则 -> 测试样本 -> 发布到采集链路 | UI -> `GET/POST/PUT /api/v1/parsing/rules`, `POST /test` -> Parsing Service -> PG + Agent/Flink 配置 | 建议 `parsing_rule`, `parsing_rule_version` |
| `/parsing/masking` `parsing/MaskingRules.tsx` | 脱敏规则 CRUD、优先级与范围配置 | 创建规则 -> 绑定字段/索引 -> 发布生效 | UI -> `GET/POST/PUT/DELETE /api/v1/parsing/masking-rules` -> Security/Parsing Service -> PG | 建议 `masking_rule`, `masking_scope` |
| `/parsing/dictionary` `parsing/FieldDictionary.tsx` | 字段字典管理、标准定义、引用追踪 | 维护字段定义 -> 标注状态 -> 检查引用 | UI -> `GET/POST/PUT /api/v1/parsing/field-dictionary` -> Parsing Service -> PG | 建议 `field_dictionary`, `field_reference` |

---

## 10. 索引与存储模块

| 页面（路由 / 文件） | 需实现功能 | 业务流程 | 数据流向（目标） | 关键接口与实体 |
|---|---|---|---|---|
| `/storage/indices` `storage/IndexManagement.tsx` | 索引列表、健康状态、分片信息、维护动作 | 查询索引 -> 筛选 -> 执行维护（只读/扩缩容） | UI -> `GET /api/v1/storage/indices`, `POST /actions` -> Storage Service -> ES -> UI | ES 索引元信息 |
| `/storage/ilm` `storage/LifecyclePolicy.tsx` | 生命周期策略查看/编辑/发布 | 编辑 ILM 策略 -> 校验 -> 发布 -> 查看影响面 | UI -> `GET/PUT /api/v1/storage/ilm-policies` -> Storage Service -> ES + PG 元数据 | ES ILM policy |
| `/storage/backup` `storage/BackupRecovery.tsx` | 备份任务、快照列表、恢复流程 | 创建备份任务 -> 查看快照 -> 发起恢复 | UI -> `GET/POST /api/v1/storage/backups`, `POST /recover` -> Storage Service -> ES Snapshot + Object Storage | 建议 `backup_job`, `backup_snapshot` |
| `/storage/capacity` `storage/CapacityMonitoring.tsx` | 存储容量趋势、告警阈值、扩容建议 | 拉取容量指标 -> 趋势分析 -> 触发扩容建议 | UI -> `GET /api/v1/storage/capacity` -> Storage Service -> Prometheus/ES -> UI | 容量时序指标 |

---

## 11. 性能与高可用模块

| 页面（路由 / 文件） | 需实现功能 | 业务流程 | 数据流向（目标） | 关键接口与实体 |
|---|---|---|---|---|
| `/performance/monitoring` `performance/PerformanceMonitoring.tsx` | 系统性能总览、节点性能明细、瓶颈定位 | 拉取性能指标 -> 多维展示 -> 识别热点节点 | UI -> `GET /api/v1/performance/overview` -> Perf Service -> Prometheus -> UI | 性能时序指标 |
| `/performance/health` `performance/HealthCheck.tsx` | 健康检查状态、失败原因、处理建议 | 拉取健康目标结果 -> 标注异常 -> 跳转处置 | UI -> `GET /api/v1/health/targets` -> Health Worker -> PG `health_check_*` + Prometheus | `health_check_target`, `health_check_rule`, `health_check_result` |
| `/performance/scaling` `performance/AutoScaling.tsx` | 自动扩缩容策略配置、阈值管理、执行记录 | 配置策略 -> 发布 -> 查看扩缩容记录 | UI -> `GET/PUT /api/v1/performance/scaling-policies` -> Platform Service -> K8s HPA/VPA + PG | 建议 `scaling_policy`, `scaling_event` |
| `/performance/dr` `performance/DisasterRecovery.tsx` | 灾备拓扑、RTO/RPO、演练计划管理 | 查看灾备状态 -> 发起演练 -> 记录结果 | UI -> `GET/POST /api/v1/performance/dr` -> Platform Service -> PG + 外部灾备系统 | 建议 `dr_plan`, `dr_drill_record` |

---

## 12. 分布式追踪模块

| 页面（路由 / 文件） | 需实现功能 | 业务流程 | 数据流向（目标） | 关键接口与实体 |
|---|---|---|---|---|
| `/tracing/search` `tracing/TraceSearch.tsx` | Trace 检索、条件过滤、慢请求识别 | 输入筛选条件 -> 查询 trace 列表 -> 定位异常 | UI -> `GET /api/v1/tracing/traces` -> Trace Service -> Jaeger/OTel Storage -> UI | Trace/Span 存储 |
| `/tracing/analysis` `tracing/TraceAnalysis.tsx` | 调用链耗时拆解、错误节点定位 | 选择 trace -> 展示调用树 -> 逐 span 分析 | UI -> `GET /api/v1/tracing/traces/:id` -> Trace Service -> Jaeger -> UI | Trace 详情 |
| `/tracing/topology` `tracing/ServiceTopology.tsx` | 服务拓扑图、依赖关系、调用健康 | 拉取拓扑快照 -> 渲染依赖图 -> 节点钻取 | UI -> `GET /api/v1/tracing/topology` -> Trace/ServiceGraph Service -> OTel 指标 -> UI | 服务依赖图数据 |

---

## 13. 报表中心模块

| 页面（路由 / 文件） | 需实现功能 | 业务流程 | 数据流向（目标） | 关键接口与实体 |
|---|---|---|---|---|
| `/reports/management` `reports/ReportManagement.tsx` | 报表模板管理、生成参数配置 | 新建模板 -> 配置维度 -> 触发生成 | UI -> `GET/POST/PUT /api/v1/reports/definitions` -> Report Service -> PG | 建议 `report_definition` |
| `/reports/scheduled` `reports/ScheduledTasks.tsx` | 定时任务管理、执行状态监控、重试 | 配置 cron -> 保存任务 -> 查看执行历史/失败重试 | UI -> `GET/POST/PUT /api/v1/reports/schedules` -> Report Scheduler -> PG + Queue | 建议 `report_schedule`, `report_job` |
| `/reports/downloads` `reports/DownloadRecords.tsx` | 下载记录、过期管理、再次下载 | 查看下载记录 -> 下载文件 -> 处理过期策略 | UI -> `GET /api/v1/reports/downloads` -> Export Service -> Object Storage + PG | 建议 `report_download` |

---

## 14. 安全与审计模块

| 页面（路由 / 文件） | 需实现功能 | 业务流程 | 数据流向（目标） | 关键接口与实体 |
|---|---|---|---|---|
| `/security/users` `security/UserManagement.tsx` | 用户 CRUD、状态管理、角色绑定 | 新建/编辑用户 -> 分配角色 -> 启停用户 | UI -> `GET/POST/PUT /api/v1/security/users` -> IAM Service -> PG | `users`, `user_roles` |
| `/security/roles` `security/RolePermissions.tsx` | 角色权限管理、权限包配置 | 编辑角色权限 -> 发布 -> 生效验证 | UI -> `GET/POST/PUT /api/v1/security/roles` -> IAM/OPA Service -> PG + OPA Bundle | `roles`, `opa_policy_*` |
| `/security/audit` `security/AuditLogs.tsx` | 审计日志检索、按资源/操作者过滤、导出 | 输入过滤条件 -> 查询日志 -> 导出 | UI -> `GET /api/v1/security/audit-logs` -> Audit Service -> PG | 实际 `audit_logs` 或 `operation_audit_log` |
| `/security/login-policy` `security/LoginPolicy.tsx` | 登录策略（密码复杂度、锁定、MFA）配置 | 编辑策略 -> 发布 -> 策略版本化 | UI -> `GET/PUT /api/v1/security/login-policy` -> IAM Service -> PG + Keycloak | 建议 `login_policy`, `login_policy_version` |

---

## 15. 集成与开放平台模块

| 页面（路由 / 文件） | 需实现功能 | 业务流程 | 数据流向（目标） | 关键接口与实体 |
|---|---|---|---|---|
| `/integration/api` `integration/ApiDocs.tsx` | API 文档展示、调试台、示例生成 | 选择接口 -> 查看参数 -> 在线调试 | UI -> `GET /api/v1/integration/openapi` + 调试请求 -> API Gateway -> 各服务 | `api_definition`, `api_consumer`, OpenAPI 文档 |
| `/integration/webhook` `integration/WebhookManagement.tsx` | Webhook CRUD、签名密钥、触发测试 | 新建 webhook -> 设置触发事件 -> 测试/启停 | UI -> `GET/POST/PUT/DELETE /api/v1/integration/webhooks` -> Integration Service -> PG | 建议 `webhook_subscription`, `webhook_delivery_log` |
| `/integration/sdk` `integration/SdkDownload.tsx` | SDK 版本展示、下载、校验 | 选择语言和版本 -> 下载 -> 校验 checksum | UI -> `GET /api/v1/integration/sdk/releases` -> Integration Service -> Artifact Storage | 建议 `sdk_release` |
| `/integration/plugins` `integration/PluginMarket.tsx` | 插件市场、安装/卸载、版本升级 | 浏览插件 -> 安装或升级 -> 生效校验 | UI -> `GET/POST /api/v1/integration/plugins` -> Plugin Service -> PG + Agent 插件仓库 | `agent_plugin`, `agent_plugin_release` |

---

## 16. 成本管理模块

| 页面（路由 / 文件） | 需实现功能 | 业务流程 | 数据流向（目标） | 关键接口与实体 |
|---|---|---|---|---|
| `/cost/overview` `cost/CostOverview.tsx` | 成本总览、分项目/分索引成本分摊 | 选择时间范围 -> 拉取成本明细 -> 展示趋势和分布 | UI -> `GET /api/v1/cost/overview` -> Cost Service -> PG + 计费源数据 | 建议 `cost_usage_daily` |
| `/cost/budgets` `cost/BudgetAlerts.tsx` | 预算规则配置、超预算告警 | 创建预算规则 -> 阈值校验 -> 告警触发与通知 | UI -> `GET/POST/PUT /api/v1/cost/budgets` -> Cost Service -> PG + Alert Service | 建议 `budget_rule`, `budget_alert_event` |
| `/cost/optimization` `cost/OptimizationSuggestions.tsx` | 成本优化建议、执行建议追踪 | 拉取优化建议 -> 采纳/忽略 -> 跟踪收益 | UI -> `GET/POST /api/v1/cost/recommendations` -> Cost/ML Service -> PG | 建议 `cost_optimization_recommendation` |

---

## 17. 系统设置模块

| 页面（路由 / 文件） | 需实现功能 | 业务流程 | 数据流向（目标） | 关键接口与实体 |
|---|---|---|---|---|
| `/settings/parameters` `settings/SystemParameters.tsx` | 系统参数配置、校验、灰度发布 | 修改参数 -> 校验 -> 提交发布 -> 回滚可用 | UI -> `GET/PUT /api/v1/settings/parameters` -> Config Service -> PG + 发布系统 | `config_namespace`, `config_item` |
| `/settings/global` `settings/GlobalConfig.tsx` | 全局配置管理（日志、存储、安全） | 读取全局配置 -> 分组修改 -> 发布 | UI -> `GET/PUT /api/v1/settings/global` -> Config Service -> PG | `config_item`, `config_publish` |
| `/settings/versions` `settings/ConfigVersions.tsx` | 配置版本历史、对比、回滚 | 查看版本 -> 对比差异 -> 执行回滚 | UI -> `GET /api/v1/settings/versions`, `POST /rollback` -> Config Service -> PG | `config_version`, `config_publish` |

---

## 18. 帮助中心模块

| 页面（路由 / 文件） | 需实现功能 | 业务流程 | 数据流向（目标） | 关键接口与实体 |
|---|---|---|---|---|
| `/help/syntax` `help/QuerySyntax.tsx` | 查询语法文档、示例复制、快速跳转 | 浏览语法 -> 搜索关键字 -> 复制示例 | UI -> `GET /api/v1/help/syntax`（可静态化） -> 文档服务 -> UI | 建议 `knowledge_article` |
| `/help/faq` `help/FAQ.tsx` | FAQ 检索、分类过滤、反馈有用性 | 输入关键字 -> 筛选 FAQ -> 点赞/反馈 | UI -> `GET /api/v1/help/faq`, `POST /feedback` -> Help Service -> PG | 建议 `faq_item`, `faq_feedback` |
| `/help/tickets` `help/TicketPortal.tsx` | 工单创建、状态追踪、会话记录 | 提交工单 -> 分派处理 -> 反馈关闭 | UI -> `GET/POST /api/v1/help/tickets` -> Ticket Service -> PG + 通知系统 | 建议 `support_ticket`, `support_ticket_comment` |

---

## 19. 页面打通优先顺序（建议）

按“业务价值高 + 依赖少 + 可快速闭环”排序：

1. `alerts/AlertRules`：规则 CRUD 闭环（`alert_rules` 可先复用实际迁移）
2. `security/AuditLogs`：审计查询闭环（`audit_logs` 可先复用）
3. `security/UserManagement` + `security/RolePermissions`：用户角色闭环（`users/roles/user_roles`）
4. `search/RealtimeSearch`：替换 mock 为真实查询链路（先只做检索与详情）
5. `incidents/IncidentList` + `incidents/IncidentSLA`：最小事件管理闭环




## 20. 页面功能点级清单（逐页功能拆分）

> 本章节将每个页面拆为多个功能点，避免仅停留在模块级描述。

### 认证模块

#### 页面：/login auth/LoginPage.tsx
- 功能点清单：
  - F1 用户登录
  - F2 SSO入口
  - F3 社交登录跳转
  - F4 登录后重定向
- 页面业务流程：输入账号密码 -> 校验 -> 登录 -> 存储会话 -> 跳转 Dashboard
- 页面数据流向：UI -> `POST /api/v1/auth/login` -> Auth Service -> PG `users/user_roles` + 会话存储 -> UI
- 关键接口与实体：`users`, `roles`, `user_roles`, 建议 `user_sessions`

#### 页面：/register auth/RegisterPage.tsx
- 功能点清单：
  - F1 新用户注册
  - F2 基础校验
  - F3 注册后自动登录/引导登录
- 页面业务流程：填写注册信息 -> 校验唯一性 -> 创建账号 -> 绑定默认角色
- 页面数据流向：UI -> `POST /api/v1/auth/register` -> Auth Service -> PG `users` + `user_roles`
- 关键接口与实体：`users`, `user_roles`

#### 页面：/forgot-password auth/ForgotPasswordPage.tsx
- 功能点清单：
  - F1 发起重置
  - F2 验证码/链接校验
  - F3 重置密码
- 页面业务流程：输入邮箱/用户名 -> 发送重置令牌 -> 提交新密码
- 页面数据流向：UI -> `POST /api/v1/auth/password/reset-request` + `POST /reset-confirm` -> Auth Service -> PG
- 关键接口与实体：建议 `password_reset_tokens`, `users`


### Dashboard

#### 页面：/ Dashboard.tsx
- 功能点清单：
  - F1 KPI 卡片（日志量、告警数、事件数、健康评分）
  - F2 趋势图（时间窗口切换、同比/环比）
  - F3 告警摘要（最近告警、分级统计、快速跳转）
  - F4 服务健康概览（节点状态、异常组件定位）
  - F5 快捷入口（跳转检索/告警/事件/报表）
- 页面业务流程：进入 Dashboard -> 拉取聚合概览 -> 渲染卡片与图表 -> 用户点击卡片钻取到目标页面
- 页面数据流向：UI -> `GET /api/v1/dashboard/overview` -> BFF 聚合层 -> Alerts/Incidents/Search/Health 服务 -> PG + ES + Prometheus -> UI
- 关键接口与实体：`alert_event`, `incident`, `health_check_result`, ES 聚合结果


### 日志检索模块

#### 页面：/search/realtime search/RealtimeSearch.tsx
- 功能点清单：
  - F1 实时查询
  - F2 过滤
  - F3 分页
  - F4 详情抽屉
  - F5 导出
- 页面业务流程：输入查询语句 -> 执行查询 -> 返回列表 -> 查看详情/导出
- 页面数据流向：UI -> `POST /api/v1/search/query` -> Query API -> ES -> UI
- 关键接口与实体：ES 日志索引，建议 `search_query_log`

#### 页面：/search/history search/SearchHistory.tsx
- 功能点清单：
  - F1 历史查询列表
  - F2 复用查询
  - F3 删除历史
- 页面业务流程：页面加载 -> 查询历史 -> 复用/清理
- 页面数据流向：UI -> `GET/DELETE /api/v1/search/history` -> API -> PG
- 关键接口与实体：建议 `query_history`

#### 页面：/search/saved search/SavedQueries.tsx
- 功能点清单：
  - F1 收藏查询 CRUD
  - F2 标签管理
  - F3 一键执行
- 页面业务流程：新建收藏 -> 保存 -> 列表管理 -> 调用实时查询
- 页面数据流向：UI -> `GET/POST/PUT/DELETE /api/v1/search/saved` -> API -> PG
- 关键接口与实体：建议 `saved_query`, `saved_query_tag`


### 日志分析模块

#### 页面：/analysis/aggregate analysis/AggregateAnalysis.tsx
- 功能点清单：
  - F1 聚合维度分析
  - F2 趋势对比
  - F3 TopN分组
- 页面业务流程：选择时间/维度 -> 聚合查询 -> 渲染图表/表格
- 页面数据流向：UI -> `POST /api/v1/analysis/aggregate` -> Query/Flink -> ES/缓存 -> UI
- 关键接口与实体：ES 聚合结果，建议 `analysis_snapshot`

#### 页面：/analysis/anomaly analysis/AnomalyDetection.tsx
- 功能点清单：
  - F1 异常检测列表
  - F2 异常明细
  - F3 确认/误报反馈
- 页面业务流程：拉取异常 -> 查看详情 -> 标注处理状态
- 页面数据流向：UI -> `GET /api/v1/analysis/anomalies` -> ML Service -> PG/ES -> UI
- 关键接口与实体：建议 `anomaly_event`, `anomaly_feedback`

#### 页面：/analysis/clustering analysis/LogClustering.tsx
- 功能点清单：
  - F1 日志聚类
  - F2 模板提取
  - F3 聚类对比
- 页面业务流程：选择窗口 -> 执行聚类 -> 查看簇详情 -> 导出结论
- 页面数据流向：UI -> `POST /api/v1/analysis/clusters` -> Analysis Service -> ES/向量检索 -> UI
- 关键接口与实体：建议 `cluster_job`, `cluster_result`


### 告警中心模块

#### 页面：/alerts/list alerts/AlertList.tsx
- 功能点清单：
  - F1 告警列表
  - F2 筛选
  - F3 确认
  - F4 关闭
  - F5 跳转事件
- 页面业务流程：加载列表 -> 筛选 -> ACK/CLOSE -> 回写状态
- 页面数据流向：UI -> `GET /api/v1/alerts/events`, `POST /ack`, `POST /close` -> Alert Service -> PG
- 关键接口与实体：`alert_event`, `alert_ack`

#### 页面：/alerts/rules alerts/AlertRules.tsx
- 功能点清单：
  - F1 规则 CRUD
  - F2 启停
  - F3 阈值与表达式管理
- 页面业务流程：新建/编辑规则 -> 保存 -> 启停 -> 立即校验
- 页面数据流向：UI -> `GET/POST/PUT/DELETE /api/v1/alerts/rules` -> Alert Service -> PG
- 关键接口与实体：实际 `alert_rules`（或统一 `alert_rule`）

#### 页面：/alerts/notifications alerts/NotificationConfig.tsx
- 功能点清单：
  - F1 通知渠道管理（邮箱/Webhook/IM）
  - F2 测试发送
- 页面业务流程：创建渠道 -> 绑定规则 -> 测试发送 -> 启停
- 页面数据流向：UI -> `GET/POST/PUT/DELETE /api/v1/alerts/channels`, `POST /test` -> Notify Service -> PG + 外部通道
- 关键接口与实体：建议 `notification_channel`, `notification_binding`

#### 页面：/alerts/silence alerts/SilencePolicy.tsx
- 功能点清单：
  - F1 静默策略 CRUD
  - F2 时间窗管理
  - F3 匹配器管理
- 页面业务流程：创建静默 -> 匹配规则 -> 生效/失效 -> 审计
- 页面数据流向：UI -> `GET/POST/PUT/DELETE /api/v1/alerts/silences` -> Alert Service -> PG
- 关键接口与实体：建议 `silence_policy`, `silence_matcher`


### 事件管理模块

#### 页面：/incidents/list incidents/IncidentList.tsx
- 功能点清单：
  - F1 事件列表
  - F2 分级筛选
  - F3 状态流转入口
- 页面业务流程：加载事件 -> 过滤排序 -> 进入详情/变更状态
- 页面数据流向：UI -> `GET /api/v1/incidents` -> Incident Service -> PG
- 关键接口与实体：`incident`

#### 页面：/incidents/detail/:id incidents/IncidentDetail.tsx
- 功能点清单：
  - F1 事件详情
  - F2 关联告警
  - F3 处置动作
  - F4 证据查看
- 页面业务流程：拉取详情 -> 执行动作 -> 写入时间线与审计
- 页面数据流向：UI -> `GET /api/v1/incidents/:id`, `POST /actions` -> Incident Service -> PG + 对外动作系统
- 关键接口与实体：`incident`, `incident_action`, `incident_alert_link`, `incident_log_bundle`

#### 页面：/incidents/timeline incidents/IncidentTimeline.tsx
- 功能点清单：
  - F1 全流程时间线
  - F2 按事件类型过滤
- 页面业务流程：选择事件 -> 查询时间线 -> 查看节点细节
- 页面数据流向：UI -> `GET /api/v1/incidents/:id/timeline` -> Incident Service -> PG
- 关键接口与实体：`incident_timeline`

#### 页面：/incidents/analysis incidents/IncidentAnalysis.tsx
- 功能点清单：
  - F1 根因分析
  - F2 影响范围
  - F3 改进项记录
- 页面业务流程：填写分析 -> 审核 -> 发布结论
- 页面数据流向：UI -> `GET/PUT /api/v1/incidents/:id/analysis` -> Incident Service -> PG
- 关键接口与实体：`incident_analysis`

#### 页面：/incidents/sla incidents/IncidentSLA.tsx
- 功能点清单：
  - F1 MTTA/MTTR
  - F2 SLA违约统计
  - F3 超时追踪
- 页面业务流程：拉取SLA指标 -> 展示统计 -> 导出报表
- 页面数据流向：UI -> `GET /api/v1/incidents/sla` -> Incident Service -> PG
- 关键接口与实体：`incident_response_sla`, `incident_sla_policy`

#### 页面：/incidents/archive incidents/IncidentArchive.tsx
- 功能点清单：
  - F1 事件归档
  - F2 保留期
  - F3 取证文件索引
- 页面业务流程：选择归档 -> 写入归档记录 -> 生成可追溯索引
- 页面数据流向：UI -> `GET/POST /api/v1/incidents/archive` -> Incident Service -> PG + Object Storage
- 关键接口与实体：`incident_archive`, `incident_postmortem`


### 采集与接入模块

#### 页面：/ingestion/sources ingestion/SourceManagement.tsx
- 功能点清单：
  - F1 数据源 CRUD
  - F2 启停
  - F3 配置校验
- 页面业务流程：新建数据源 -> 校验连通性 -> 保存 -> 启停
- 页面数据流向：UI -> `GET/POST/PUT/DELETE /api/v1/ingestion/sources` -> Ingestion Service -> PG
- 关键接口与实体：建议 `data_source`（或复用 `collector_rule/collector_target`）

#### 页面：/ingestion/agents ingestion/AgentManagement.tsx
- 功能点清单：
  - F1 Agent 注册
  - F2 升级
  - F3 分组
  - F4 在线状态
- 页面业务流程：注册/导入 Agent -> 分组 -> 发布升级
- 页面数据流向：UI -> `GET/POST /api/v1/ingestion/agents`, `POST /upgrade` -> Agent Service -> PG + Agent Control Channel
- 关键接口与实体：`agent_node`, `agent_group`, `agent_group_member`

#### 页面：/ingestion/wizard ingestion/AccessWizard.tsx
- 功能点清单：
  - F1 接入向导
  - F2 模板化配置
  - F3 步骤校验
- 页面业务流程：选择数据源类型 -> 填写参数 -> 预检 -> 生成配置
- 页面数据流向：UI -> `POST /api/v1/ingestion/wizard/preview`, `POST /apply` -> Ingestion Service -> PG
- 关键接口与实体：`collector_rule`, `collector_target`

#### 页面：/ingestion/status ingestion/SourceStatus.tsx
- 功能点清单：
  - F1 数据源运行状态
  - F2 吞吐
  - F3 延迟
  - F4 积压监控
- 页面业务流程：轮询状态 -> 展示图表 -> 异常告警跳转
- 页面数据流向：UI -> `GET /api/v1/ingestion/status` -> Ingestion Service -> Kafka/Agent metrics + PG -> UI
- 关键接口与实体：`agent_node`, Kafka lag 指标


### 解析与字段模块

#### 页面：/parsing/mapping parsing/FieldMapping.tsx
- 功能点清单：
  - F1 字段映射规则 CRUD
  - F2 版本管理
- 页面业务流程：编辑映射 -> 预览转换结果 -> 发布版本
- 页面数据流向：UI -> `GET/POST/PUT /api/v1/parsing/mappings` -> Parsing Service -> PG
- 关键接口与实体：建议 `field_mapping`, `mapping_version`

#### 页面：/parsing/rules parsing/ParsingRules.tsx
- 功能点清单：
  - F1 解析规则管理
  - F2 样本测试
  - F3 灰度发布
- 页面业务流程：编辑规则 -> 测试样本 -> 发布到采集链路
- 页面数据流向：UI -> `GET/POST/PUT /api/v1/parsing/rules`, `POST /test` -> Parsing Service -> PG + Agent/Flink 配置
- 关键接口与实体：建议 `parsing_rule`, `parsing_rule_version`

#### 页面：/parsing/masking parsing/MaskingRules.tsx
- 功能点清单：
  - F1 脱敏规则 CRUD
  - F2 优先级与范围配置
- 页面业务流程：创建规则 -> 绑定字段/索引 -> 发布生效
- 页面数据流向：UI -> `GET/POST/PUT/DELETE /api/v1/parsing/masking-rules` -> Security/Parsing Service -> PG
- 关键接口与实体：建议 `masking_rule`, `masking_scope`

#### 页面：/parsing/dictionary parsing/FieldDictionary.tsx
- 功能点清单：
  - F1 字段字典管理
  - F2 标准定义
  - F3 引用追踪
- 页面业务流程：维护字段定义 -> 标注状态 -> 检查引用
- 页面数据流向：UI -> `GET/POST/PUT /api/v1/parsing/field-dictionary` -> Parsing Service -> PG
- 关键接口与实体：建议 `field_dictionary`, `field_reference`


### 索引与存储模块

#### 页面：/storage/indices storage/IndexManagement.tsx
- 功能点清单：
  - F1 索引列表
  - F2 健康状态
  - F3 分片信息
  - F4 维护动作
- 页面业务流程：查询索引 -> 筛选 -> 执行维护（只读/扩缩容）
- 页面数据流向：UI -> `GET /api/v1/storage/indices`, `POST /actions` -> Storage Service -> ES -> UI
- 关键接口与实体：ES 索引元信息

#### 页面：/storage/ilm storage/LifecyclePolicy.tsx
- 功能点清单：
  - F1 生命周期策略查看/编辑/发布
- 页面业务流程：编辑 ILM 策略 -> 校验 -> 发布 -> 查看影响面
- 页面数据流向：UI -> `GET/PUT /api/v1/storage/ilm-policies` -> Storage Service -> ES + PG 元数据
- 关键接口与实体：ES ILM policy

#### 页面：/storage/backup storage/BackupRecovery.tsx
- 功能点清单：
  - F1 备份任务
  - F2 快照列表
  - F3 恢复流程
- 页面业务流程：创建备份任务 -> 查看快照 -> 发起恢复
- 页面数据流向：UI -> `GET/POST /api/v1/storage/backups`, `POST /recover` -> Storage Service -> ES Snapshot + Object Storage
- 关键接口与实体：建议 `backup_job`, `backup_snapshot`

#### 页面：/storage/capacity storage/CapacityMonitoring.tsx
- 功能点清单：
  - F1 存储容量趋势
  - F2 告警阈值
  - F3 扩容建议
- 页面业务流程：拉取容量指标 -> 趋势分析 -> 触发扩容建议
- 页面数据流向：UI -> `GET /api/v1/storage/capacity` -> Storage Service -> Prometheus/ES -> UI
- 关键接口与实体：容量时序指标


### 性能与高可用模块

#### 页面：/performance/monitoring performance/PerformanceMonitoring.tsx
- 功能点清单：
  - F1 系统性能总览
  - F2 节点性能明细
  - F3 瓶颈定位
- 页面业务流程：拉取性能指标 -> 多维展示 -> 识别热点节点
- 页面数据流向：UI -> `GET /api/v1/performance/overview` -> Perf Service -> Prometheus -> UI
- 关键接口与实体：性能时序指标

#### 页面：/performance/health performance/HealthCheck.tsx
- 功能点清单：
  - F1 健康检查状态
  - F2 失败原因
  - F3 处理建议
- 页面业务流程：拉取健康目标结果 -> 标注异常 -> 跳转处置
- 页面数据流向：UI -> `GET /api/v1/health/targets` -> Health Worker -> PG `health_check_*` + Prometheus
- 关键接口与实体：`health_check_target`, `health_check_rule`, `health_check_result`

#### 页面：/performance/scaling performance/AutoScaling.tsx
- 功能点清单：
  - F1 自动扩缩容策略配置
  - F2 阈值管理
  - F3 执行记录
- 页面业务流程：配置策略 -> 发布 -> 查看扩缩容记录
- 页面数据流向：UI -> `GET/PUT /api/v1/performance/scaling-policies` -> Platform Service -> K8s HPA/VPA + PG
- 关键接口与实体：建议 `scaling_policy`, `scaling_event`

#### 页面：/performance/dr performance/DisasterRecovery.tsx
- 功能点清单：
  - F1 灾备拓扑
  - F2 RTO/RPO
  - F3 演练计划管理
- 页面业务流程：查看灾备状态 -> 发起演练 -> 记录结果
- 页面数据流向：UI -> `GET/POST /api/v1/performance/dr` -> Platform Service -> PG + 外部灾备系统
- 关键接口与实体：建议 `dr_plan`, `dr_drill_record`


### 分布式追踪模块

#### 页面：/tracing/search tracing/TraceSearch.tsx
- 功能点清单：
  - F1 Trace 检索
  - F2 条件过滤
  - F3 慢请求识别
- 页面业务流程：输入筛选条件 -> 查询 trace 列表 -> 定位异常
- 页面数据流向：UI -> `GET /api/v1/tracing/traces` -> Trace Service -> Jaeger/OTel Storage -> UI
- 关键接口与实体：Trace/Span 存储

#### 页面：/tracing/analysis tracing/TraceAnalysis.tsx
- 功能点清单：
  - F1 调用链耗时拆解
  - F2 错误节点定位
- 页面业务流程：选择 trace -> 展示调用树 -> 逐 span 分析
- 页面数据流向：UI -> `GET /api/v1/tracing/traces/:id` -> Trace Service -> Jaeger -> UI
- 关键接口与实体：Trace 详情

#### 页面：/tracing/topology tracing/ServiceTopology.tsx
- 功能点清单：
  - F1 服务拓扑图
  - F2 依赖关系
  - F3 调用健康
- 页面业务流程：拉取拓扑快照 -> 渲染依赖图 -> 节点钻取
- 页面数据流向：UI -> `GET /api/v1/tracing/topology` -> Trace/ServiceGraph Service -> OTel 指标 -> UI
- 关键接口与实体：服务依赖图数据


### 报表中心模块

#### 页面：/reports/management reports/ReportManagement.tsx
- 功能点清单：
  - F1 报表模板管理
  - F2 生成参数配置
- 页面业务流程：新建模板 -> 配置维度 -> 触发生成
- 页面数据流向：UI -> `GET/POST/PUT /api/v1/reports/definitions` -> Report Service -> PG
- 关键接口与实体：建议 `report_definition`

#### 页面：/reports/scheduled reports/ScheduledTasks.tsx
- 功能点清单：
  - F1 定时任务管理
  - F2 执行状态监控
  - F3 重试
- 页面业务流程：配置 cron -> 保存任务 -> 查看执行历史/失败重试
- 页面数据流向：UI -> `GET/POST/PUT /api/v1/reports/schedules` -> Report Scheduler -> PG + Queue
- 关键接口与实体：建议 `report_schedule`, `report_job`

#### 页面：/reports/downloads reports/DownloadRecords.tsx
- 功能点清单：
  - F1 下载记录
  - F2 过期管理
  - F3 再次下载
- 页面业务流程：查看下载记录 -> 下载文件 -> 处理过期策略
- 页面数据流向：UI -> `GET /api/v1/reports/downloads` -> Export Service -> Object Storage + PG
- 关键接口与实体：建议 `report_download`


### 安全与审计模块

#### 页面：/security/users security/UserManagement.tsx
- 功能点清单：
  - F1 用户 CRUD
  - F2 状态管理
  - F3 角色绑定
- 页面业务流程：新建/编辑用户 -> 分配角色 -> 启停用户
- 页面数据流向：UI -> `GET/POST/PUT /api/v1/security/users` -> IAM Service -> PG
- 关键接口与实体：`users`, `user_roles`

#### 页面：/security/roles security/RolePermissions.tsx
- 功能点清单：
  - F1 角色权限管理
  - F2 权限包配置
- 页面业务流程：编辑角色权限 -> 发布 -> 生效验证
- 页面数据流向：UI -> `GET/POST/PUT /api/v1/security/roles` -> IAM/OPA Service -> PG + OPA Bundle
- 关键接口与实体：`roles`, `opa_policy_*`

#### 页面：/security/audit security/AuditLogs.tsx
- 功能点清单：
  - F1 审计日志检索
  - F2 按资源/操作者过滤
  - F3 导出
- 页面业务流程：输入过滤条件 -> 查询日志 -> 导出
- 页面数据流向：UI -> `GET /api/v1/security/audit-logs` -> Audit Service -> PG
- 关键接口与实体：实际 `audit_logs` 或 `operation_audit_log`

#### 页面：/security/login-policy security/LoginPolicy.tsx
- 功能点清单：
  - F1 登录策略配置（密码复杂度、锁定策略、MFA）
- 页面业务流程：编辑策略 -> 发布 -> 策略版本化
- 页面数据流向：UI -> `GET/PUT /api/v1/security/login-policy` -> IAM Service -> PG + Keycloak
- 关键接口与实体：建议 `login_policy`, `login_policy_version`


### 集成与开放平台模块

#### 页面：/integration/api integration/ApiDocs.tsx
- 功能点清单：
  - F1 API 文档展示
  - F2 调试台
  - F3 示例生成
- 页面业务流程：选择接口 -> 查看参数 -> 在线调试
- 页面数据流向：UI -> `GET /api/v1/integration/openapi` + 调试请求 -> API Gateway -> 各服务
- 关键接口与实体：`api_definition`, `api_consumer`, OpenAPI 文档

#### 页面：/integration/webhook integration/WebhookManagement.tsx
- 功能点清单：
  - F1 Webhook CRUD
  - F2 签名密钥
  - F3 触发测试
- 页面业务流程：新建 webhook -> 设置触发事件 -> 测试/启停
- 页面数据流向：UI -> `GET/POST/PUT/DELETE /api/v1/integration/webhooks` -> Integration Service -> PG
- 关键接口与实体：建议 `webhook_subscription`, `webhook_delivery_log`

#### 页面：/integration/sdk integration/SdkDownload.tsx
- 功能点清单：
  - F1 SDK 版本展示
  - F2 下载
  - F3 校验
- 页面业务流程：选择语言和版本 -> 下载 -> 校验 checksum
- 页面数据流向：UI -> `GET /api/v1/integration/sdk/releases` -> Integration Service -> Artifact Storage
- 关键接口与实体：建议 `sdk_release`

#### 页面：/integration/plugins integration/PluginMarket.tsx
- 功能点清单：
  - F1 插件市场
  - F2 安装/卸载
  - F3 版本升级
- 页面业务流程：浏览插件 -> 安装或升级 -> 生效校验
- 页面数据流向：UI -> `GET/POST /api/v1/integration/plugins` -> Plugin Service -> PG + Agent 插件仓库
- 关键接口与实体：`agent_plugin`, `agent_plugin_release`


### 成本管理模块

#### 页面：/cost/overview cost/CostOverview.tsx
- 功能点清单：
  - F1 成本总览
  - F2 分项目/分索引成本分摊
- 页面业务流程：选择时间范围 -> 拉取成本明细 -> 展示趋势和分布
- 页面数据流向：UI -> `GET /api/v1/cost/overview` -> Cost Service -> PG + 计费源数据
- 关键接口与实体：建议 `cost_usage_daily`

#### 页面：/cost/budgets cost/BudgetAlerts.tsx
- 功能点清单：
  - F1 预算规则配置
  - F2 超预算告警
- 页面业务流程：创建预算规则 -> 阈值校验 -> 告警触发与通知
- 页面数据流向：UI -> `GET/POST/PUT /api/v1/cost/budgets` -> Cost Service -> PG + Alert Service
- 关键接口与实体：建议 `budget_rule`, `budget_alert_event`

#### 页面：/cost/optimization cost/OptimizationSuggestions.tsx
- 功能点清单：
  - F1 成本优化建议
  - F2 执行建议追踪
- 页面业务流程：拉取优化建议 -> 采纳/忽略 -> 跟踪收益
- 页面数据流向：UI -> `GET/POST /api/v1/cost/recommendations` -> Cost/ML Service -> PG
- 关键接口与实体：建议 `cost_optimization_recommendation`


### 系统设置模块

#### 页面：/settings/parameters settings/SystemParameters.tsx
- 功能点清单：
  - F1 系统参数配置
  - F2 校验
  - F3 灰度发布
- 页面业务流程：修改参数 -> 校验 -> 提交发布 -> 回滚可用
- 页面数据流向：UI -> `GET/PUT /api/v1/settings/parameters` -> Config Service -> PG + 发布系统
- 关键接口与实体：`config_namespace`, `config_item`

#### 页面：/settings/global settings/GlobalConfig.tsx
- 功能点清单：
  - F1 全局配置管理（日志、存储、安全）
- 页面业务流程：读取全局配置 -> 分组修改 -> 发布
- 页面数据流向：UI -> `GET/PUT /api/v1/settings/global` -> Config Service -> PG
- 关键接口与实体：`config_item`, `config_publish`

#### 页面：/settings/versions settings/ConfigVersions.tsx
- 功能点清单：
  - F1 配置版本历史
  - F2 对比
  - F3 回滚
- 页面业务流程：查看版本 -> 对比差异 -> 执行回滚
- 页面数据流向：UI -> `GET /api/v1/settings/versions`, `POST /rollback` -> Config Service -> PG
- 关键接口与实体：`config_version`, `config_publish`


### 帮助中心模块

#### 页面：/help/syntax help/QuerySyntax.tsx
- 功能点清单：
  - F1 查询语法文档
  - F2 示例复制
  - F3 快速跳转
- 页面业务流程：浏览语法 -> 搜索关键字 -> 复制示例
- 页面数据流向：UI -> `GET /api/v1/help/syntax`（可静态化） -> 文档服务 -> UI
- 关键接口与实体：建议 `knowledge_article`

#### 页面：/help/faq help/FAQ.tsx
- 功能点清单：
  - F1 FAQ 检索
  - F2 分类过滤
  - F3 反馈有用性
- 页面业务流程：输入关键字 -> 筛选 FAQ -> 点赞/反馈
- 页面数据流向：UI -> `GET /api/v1/help/faq`, `POST /feedback` -> Help Service -> PG
- 关键接口与实体：建议 `faq_item`, `faq_feedback`

#### 页面：/help/tickets help/TicketPortal.tsx
- 功能点清单：
  - F1 工单创建
  - F2 状态追踪
  - F3 会话记录
- 页面业务流程：提交工单 -> 分派处理 -> 反馈关闭
- 页面数据流向：UI -> `GET/POST /api/v1/help/tickets` -> Ticket Service -> PG + 通知系统
- 关键接口与实体：建议 `support_ticket`, `support_ticket_comment`
