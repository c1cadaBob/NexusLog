# M1~M3 逐周落地清单（接口/表/页面级，排期估算版）

## 1. 文档头信息

| 项 | 内容 |
|---|---|
| 目标 | 输出可直接执行的 6 周清单，覆盖 M1~M3 全部 P0 目标，细化到页面、API、数据表、测试、回滚、角色与人天估算。 |
| 范围 | `apps/frontend-console`、`apps/bff-service`、`services/api-service`、`services/control-plane`、`services/data-services/*`、`agents/collector-agent`、`gateway/openresty`、`storage/postgresql/migrations`。 |
| 输入基线 | `05-next-priority-development-plan.md`、`03-frontend-api-data-coverage-matrix.md`、`04-frontend-pages-functional-workflow-dataflow.md`、`08-schema-gap-and-extension-plan.md`、现有迁移 `000012~000015`。 |
| 排除项 | 不新增页面数量；不在本轮引入第二迁移真相源；不在 M1~M3 强制接入 Keycloak 完整联动；不扩展 P2 能力。 |
| 周期表达 | 使用相对周次 `Week1~Week6`，不绑定自然日期。 |
| 估算口径 | 1 人天 = 1 人 1 工作日，估算用于排期与容量管理，不用于绩效。 |

## 2. 六周总览（Week1~Week6）

| Week | 里程碑 | 本周主题 | 核心输出 | 预计人天 |
|---|---|---|---|---:|
| Week1 | M1 | 迁移真相源门禁 + 登录注册主链路开通 | 登录注册 API、网关路由修正、迁移 `000012/000015` 双向验收 | 14 |
| Week2 | M1 | 认证闭环完成 + 策略热配置化 + 热更新基线启用 | refresh/logout/重置密码 API、前端受保护路由鉴权、`config_*` 生效、`docker-compose.override.yml + make dev-*` 启用 | 15 |
| Week3 | M2 | 远端拉取最小闭环 + Agent 在线基线 | `ingest_pull_sources/tasks` 接口与状态机、Agent 注册/心跳、前端接入源与状态页最小可用 | 16 |
| Week4 | M2 | Agent 增量包与回执闭环 + 升级治理 | 包、回执、死信、checkpoint 链路可追溯；升级计划/ACK/回滚演练可复用 | 18 |
| Week5 | M3 | 检索与分析闭环去 Mock | `query-api` 检索 + 分析接口、检索历史与收藏、前端检索/分析主路径替换 mock | 20 |
| Week6 | M3 | 治理闭环 + 容器热更新门禁 | `audit-api` 查询、`api-service` 安全与告警管理、Dashboard 聚合增强、dev 热更新回归 | 18 |

总计：`101` 人天。

## 3. 逐周落地清单（每周一张细化表）

### Week1（M1）

| 维度 | 任务项 | 具体范围 | 责任角色 | 估算(人天) | 验收证据 | 回滚动作 |
|---|---|---|---|---:|---|---|
| 页面 | 登录/注册改真实调用 | `/login`、`/register` 改为调用 `POST /api/v1/auth/register|login`；不改页面结构 | FE | 3 | 前端联调录屏；接口调用日志；页面不再写死模拟用户 | 回退到上一前端镜像版本；保留 API 开关以便灰度 |
| API | 认证入口上线 | `api-service` 新增 `POST /api/v1/auth/register`、`POST /api/v1/auth/login` | BE | 4 | OpenAPI 契约与接口测试；成功/失败响应一致 | 关闭新路由并回退到健康壳版本 |
| API | 网关路由修正 | 网关增加 `/api/v1/query/*`、`/api/v1/audit/*`、`/api/v1/export/*` 定向；修正 upstream 端口映射到 `8082/8083/8084` | BE + DevOps | 2 | 网关配置 diff；路由冒烟结果；5xx 监控稳定 | 恢复上版 nginx/lua 配置并 reload |
| 数据表 | 迁移双向演练 | 执行 `000012`、`000015` 的 `up/down` 演练；明确唯一入口 `storage/postgresql/migrations` | DBA | 2 | 演练记录；回滚日志；初始化脚本输出 | 执行 `down` 回退到演练前版本 |
| 测试 | M1-Week1 基线测试 | 认证接口最小集成测试、网关路由连通测试、前端登录 E2E 烟测 | QA | 2 | 测试报告；失败用例清单与修复单 | 回滚前端入口开关 + 网关路由 |
| 发布 | 灰度与放量 | 认证 API 先灰度 10%，确认后全量 | DevOps | 1 | 变更单；灰度指标（错误率/延迟） | 立即切回旧版本服务与配置 |

Week1 完成定义：
- 登录注册可走通；
- 迁移命令单入口；
- 网关路由与端口一致；
- 无高优先级阻塞缺陷。

### Week2（M1）

| 维度 | 任务项 | 具体范围 | 责任角色 | 估算(人天) | 验收证据 | 回滚动作 |
|---|---|---|---|---:|---|---|
| 页面 | 忘记密码 + 鉴权路由 | `/forgot-password` 接入真实流程；`ProtectedRoute` 增加 token 有效性校验与失效跳转 | FE | 3 | 页面流程录像；token 失效跳转用例通过 | 回退 FE 版本并关闭新鉴权逻辑 |
| API | 认证闭环接口 | `POST /api/v1/auth/refresh`、`POST /api/v1/auth/logout`、`POST /api/v1/auth/password/reset-request`、`POST /api/v1/auth/password/reset-confirm` | BE | 5 | 接口契约与集成测试；失效 token 拦截正确 | 逐接口降级到只读/关闭 |
| API | 登录策略热配置 | 登录策略读取 `config_namespace/config_item/config_version/config_publish`；支持发布后生效 | BE | 2 | 配置发布日志；运行时参数变化可观测 | 回滚 `config_publish` 到上一版本 |
| 基线 | 启用容器热更新开发入口 | 从任务 2 开始默认使用 `docker compose -f docker-compose.yml -f docker-compose.override.yml up` 与 `make dev-*` 进行开发联调 | DevOps + BE + FE | 1 | `dev-up` 日志；前端与后端各 1 次热更新生效记录 | 关闭 dev 编排，回退到生产式 compose 联调 |
| 数据表 | 会话与安全落库验证 | `user_sessions/password_reset_tokens/login_attempts/config_*` 落库与查询链路验证 | DBA | 1 | SQL 验证脚本；字段完整性检查 | 执行对应 down 迁移并恢复基线 |
| 测试 | 认证全链路场景 | 登录成功/失败锁定、refresh 续期、logout 失效、重置成功与过期失败 | QA | 3 | 测试报告；链路追踪与审计日志 | 触发认证开关降级，阻断高风险入口 |
| 发布 | 策略发布演练 | 热配置发布失败自动回滚演练 | DevOps | 1 | 发布回放记录；回滚成功证据 | 恢复上一配置版本并通知业务 |

Week2 完成定义：
- 认证闭环完成；
- 受保护 API 可鉴权；
- 策略可热更新；
- 容器热更新开发环境已启用，任务 2 起默认使用 `dev` 编排联调；
- 回滚路径经演练可执行。

### Week3（M2）

| 维度 | 任务项 | 具体范围 | 责任角色 | 估算(人天) | 验收证据 | 回滚动作 |
|---|---|---|---|---:|---|---|
| 页面 | 接入源与任务状态最小可用 | `/ingestion/sources` 支持新增/编辑/启停；`/ingestion/status` 展示拉取任务状态 | FE | 3 | 页面操作录屏；状态刷新成功 | 前端回退到只读视图 |
| API | 拉取源与任务接口 | `control-plane` 新增 `GET/POST/PUT /api/v1/ingest/pull-sources`、`POST /api/v1/ingest/pull-tasks/run`、`GET /api/v1/ingest/pull-tasks` | BE | 6 | 接口自动化测试；任务状态流转日志 | 关闭任务触发接口，保留查询 |
| API | Agent 注册与心跳最小接口 | `control-plane` 新增 `POST /api/v1/agents/register`、`POST /api/v1/agents/heartbeat`、`GET /api/v1/agents` | BE | 1 | 在线清单可查询；心跳更新 `last_seen` | 关闭写接口，保留只读列表 |
| 数据表 | 任务状态机落库 | 启用 `ingest_pull_sources/ingest_pull_tasks`；实现 `pending/running/success/failed/canceled` 状态流转 | DBA | 1 | 状态机 SQL 验证；异常重入验证 | 回退 `000013` 对应对象到前态 |
| 测试 | 拉取链路验证 | 远端拉取成功、远端不可达失败、任务重试策略验证 | QA | 2 | 用例报告；失败任务可追溯 | 关闭调度器触发并保留手动模式 |
| 测试 | Agent 在线判定验证 | 注册成功、心跳续期、超时离线与恢复上线场景验证 | QA | 1 | 状态转换测试报告与日志 | 暂停自动离线判定，启用人工标记 |
| 发布 | 调度最小放量 | 调度器按低频率灰度启用 | DevOps | 1 | 调度负载指标；错误率未劣化 | 降回人工触发任务模式 |
| 对齐 | 任务契约冻结 | 接口字段与前端提交结构冻结，避免 Week4 返工 | BE + FE | 1 | 契约文档版本号；变更记录 | 回滚到上一契约版本并通知前端 |

Week3 完成定义：
- 远端拉取配置到任务执行链路打通；
- 远程 Agent 在线清单可用并可判定离线；
- 任务状态机稳定落库；
- 失败任务可观测可定位。

### Week4（M2）

| 维度 | 任务项 | 具体范围 | 责任角色 | 估算(人天) | 验收证据 | 回滚动作 |
|---|---|---|---|---:|---|---|
| 页面 | Agent 包与回执状态展示 | `/ingestion/agents` 最小展示包状态、ACK/NACK、失败重放入口 | FE | 2 | 页面状态与后端一致；重放按钮可用 | 回退为只读展示，无操作入口 |
| API | 包与回执控制接口 | `GET /api/v1/ingest/packages`、`POST /api/v1/ingest/receipts`、`POST /api/v1/ingest/dead-letters/replay` | BE | 5 | 接口测试；回执写入与重放结果一致 | 关闭写接口，仅保留查询 |
| API | Agent 升级计划与 ACK 接口 | `POST /api/v1/agents/{agent_id}/upgrade-plan`、`POST /api/v1/agents/{agent_id}/upgrade-ack`、`POST /api/v1/agents/{agent_id}/decommission` | BE | 1 | 升级计划可下发并记录 ACK/NACK | 关闭升级写接口并冻结批次 |
| Agent | 主链路能力补全 | 实现真实文件增量读取、拉取接口 `GET /agent/v1/meta`、`POST /agent/v1/logs/pull`、`POST /agent/v1/logs/ack`、API Key 鉴权（保留 Kafka 为兼容项） | BE | 4 | Agent 集成验证；pull/ack/鉴权失败用例通过 | 关闭拉取接口写能力并回退为只读健康探针 |
| 数据表 | 全链路写入验证 | `agent_incremental_packages/agent_package_files/ingest_delivery_receipts/ingest_file_checkpoints/ingest_dead_letters` 连续写入 | DBA | 1 | 包到文件到回执全链路追踪 SQL | 回滚新写入路径到任务模式 |
| 测试 | at-least-once 场景 | 包重复幂等、ACK 推进 checkpoint、NACK 入死信并重放成功 | QA | 3 | 幂等校验报告；重放报告 | 关闭重放入口并隔离异常数据 |
| 测试 | 升级成功/失败回滚演练 | 至少一次升级成功与一次失败回滚可复现并有审计日志 | QA | 1 | 演练报告；回滚后状态一致性校验 | 暂停升级入口，保留手工回滚方案 |
| 发布 | 主动拉取链路灰度 | 服务端定时主动拉取按低频率验证后放量；校验 API Key 轮换窗口 | DevOps | 1 | 拉取成功率、重试率、失败率看板 | 降低拉取频率并回退到手动拉取模式 |

Week4 完成定义：
- ACK/NACK、重试、断点、死信闭环成立；
- 远程 Agent 升级计划、ACK 与失败回滚链路可演练；
- 采集链路满足 at-least-once；
- 关键失败路径可补偿。

### Week5（M3）

| 维度 | 任务项 | 具体范围 | 责任角色 | 估算(人天) | 验收证据 | 回滚动作 |
|---|---|---|---|---:|---|---|
| 页面 | 检索去 Mock | `/search/realtime` 替换 `MOCK_*` 主路径；`/search/history`、`/search/saved` 接真实接口 | FE | 4 | 前端请求链路抓包；页面功能回归 | 回退到 mock 开关（仅应急） |
| 页面 | 分析页面去 Mock | `/analysis/trend`、`/analysis/anomaly`、`/analysis/pattern` 接真实 API，统一空态与错误态 | FE | 1 | 三页主路径请求日志与回归录屏 | 回退分析页到只读态并保留应急开关 |
| API | 查询接口落地 | `query-api`：`POST /api/v1/query/logs`、`GET/DELETE /api/v1/query/history`、`GET/POST/PUT/DELETE /api/v1/query/saved` | BE | 6 | 接口契约测试；分页与筛选正确 | 关闭写接口并保留只读查询 |
| API | 分析接口最小闭环 | `query-api`：`POST /api/v1/query/analysis/trend`、`POST /api/v1/query/analysis/anomaly`、`POST /api/v1/query/analysis/pattern` | BE | 2 | 三类分析请求成功/超时/降级测试 | 关闭分析端点并保留检索主链路 |
| 网关 | 路由与鉴权联调 | 对齐 `/api/v1/query/*` 鉴权与转发规则 | BE | 1 | 网关日志、401/403 错误码一致性 | 恢复上版路由与鉴权脚本 |
| 数据表 | 查询元数据落库 | 执行 `000014`；`query_histories/saved_queries/saved_query_tags` 启用 | DBA | 1 | DDL 执行记录；CRUD 校验脚本 | 执行 `000014.down.sql` |
| 缓存 | 热点查询缓存 | Redis 缓存命中、失效策略、降级策略接入 | BE + DevOps | 2 | 命中率指标、超时降级日志 | 关闭缓存读取，直连查询 |
| 测试 | 检索闭环验证 | 查询成功分页、ES 超时降级、收藏 CRUD、鉴权失败错误码一致 | QA | 3 | 测试报告；性能基线对比 | 回退 query-api 到上一稳定镜像 |

Week5 完成定义：
- 检索主链路完成；
- 分析 API 与分析页面主路径完成去 mock；
- 前端检索主路径不再依赖 mock；
- 历史与收藏查询可稳定使用。

### Week6（M3）

| 维度 | 任务项 | 具体范围 | 责任角色 | 估算(人天) | 验收证据 | 回滚动作 |
|---|---|---|---|---:|---|---|
| 页面 | 安全与告警最小可用 | `/security/audit`、`/alerts/rules`、`/security/users`、`/security/roles` 接真实 API；Dashboard 复用 BFF overview 增强 | FE | 4 | 页面联调录屏；关键操作可落库可回查 | 回退对应页面到只读模式 |
| API | 审计查询接口 | `audit-api`：`GET /api/v1/audit/logs` | BE | 2 | 查询条件与分页测试；审计字段完整 | 回退到占位接口并提示只读维护 |
| API | 告警与用户角色接口 | `api-service`：`GET/POST/PUT/DELETE /api/v1/alerts/rules`、`GET/POST/PUT /api/v1/security/users`、`GET/POST/PUT /api/v1/security/roles` | BE | 4 | CRUD 测试；权限控制测试 | 关闭写接口仅保留查询 |
| API | BFF 聚合增强 | 保持 `GET /api/v1/bff/overview`，新增业务字段聚合 | BE | 2 | BFF 响应结构对比；缓存命中稳定 | 回退聚合字段，保留健康探针模式 |
| 数据表 | 复用与可选扩展 | 复用 `audit_logs/alert_rules/users/roles/user_roles`；可选新增 `000016_alert_rule_versions` | DBA | 1 | SQL 验证与变更记录 | 若 `000016` 执行则提供 down 回滚 |
| 测试 | M3 汇总验收 | 安全治理场景与端到端场景：`/login -> / -> /search/realtime`、`/security/*`、`/alerts/rules` | QA | 3 | M3 测试报告；发布评审结论 | 回切到 M2 稳定标签 |
| 门禁 | 容器热更新回归 | 验证 `docker compose -f docker-compose.yml -f docker-compose.override.yml up` 与 `make dev-*`；覆盖 frontend/api/control/query/audit/bff/export/health-worker/collector-agent | QA + DevOps | 1 | 热更新冒烟日志；dev/prod 编排隔离检查记录 | 仅关闭 dev 编排，生产编排保持现状 |
| 发布 | 里程碑收口 | M3 发布、监控观察、缺陷分级与顺延清单 | DevOps | 1 | 发布后 30 分钟关键指标报告 | 触发应急回滚流程并冻结放量 |

Week6 完成定义：
- 审计/告警/用户角色闭环完成；
- 开发热更新门禁通过且不影响生产式 compose 路径；
- M3 验收通过；
- 顺延项（如 `alert_rule_version`）有明确记录与目标周次。

## 4. API 与接口变更总表（按服务归档）

| 服务 | 接口路径 | 方法 | 计划周次 | 用途 |
|---|---|---|---|---|
| Gateway | `/api/v1/query/* -> query-api` | 路由转发 | Week1/Week5 | 查询流量定向与鉴权联调 |
| Gateway | `/api/v1/audit/* -> audit-api` | 路由转发 | Week1/Week6 | 审计流量定向与鉴权联调 |
| Gateway | `/api/v1/export/* -> export-api` | 路由转发 | Week1 | 导出流量定向基线 |
| Gateway | `/api/v1/auth/*`、`/api/v1/bff/*` | 保留 | Week1 | 保持既有入口不变 |
| api-service | `/api/v1/auth/register` | POST | Week1 | 注册 |
| api-service | `/api/v1/auth/login` | POST | Week1 | 登录 |
| api-service | `/api/v1/auth/refresh` | POST | Week2 | 刷新会话 |
| api-service | `/api/v1/auth/logout` | POST | Week2 | 注销会话 |
| api-service | `/api/v1/auth/password/reset-request` | POST | Week2 | 发起重置 |
| api-service | `/api/v1/auth/password/reset-confirm` | POST | Week2 | 确认重置 |
| control-plane | `/api/v1/ingest/pull-sources` | GET/POST/PUT | Week3 | 拉取源管理 |
| control-plane | `/api/v1/ingest/pull-tasks/run` | POST | Week3 | 触发拉取任务 |
| control-plane | `/api/v1/ingest/pull-tasks` | GET | Week3 | 查询任务状态 |
| control-plane | `/api/v1/agents/register` | POST | Week3 | Agent 注册 |
| control-plane | `/api/v1/agents/heartbeat` | POST | Week3 | Agent 心跳续期 |
| control-plane | `/api/v1/agents` | GET | Week3 | Agent 在线清单 |
| control-plane | `/api/v1/ingest/packages` | GET | Week4 | 查询增量包 |
| control-plane | `/api/v1/ingest/receipts` | POST | Week4 | 写入回执 |
| control-plane | `/api/v1/ingest/dead-letters/replay` | POST | Week4 | 死信重放 |
| control-plane | `/api/v1/agents/{agent_id}/upgrade-plan` | POST | Week4 | 下发升级计划 |
| control-plane | `/api/v1/agents/{agent_id}/upgrade-ack` | POST | Week4 | 升级 ACK 回执 |
| control-plane | `/api/v1/agents/{agent_id}/decommission` | POST | Week4 | Agent 下线归档 |
| query-api | `/api/v1/query/logs` | POST | Week5 | 实时检索 |
| query-api | `/api/v1/query/history` | GET/DELETE | Week5 | 查询历史 |
| query-api | `/api/v1/query/saved` | GET/POST/PUT/DELETE | Week5 | 收藏查询 |
| query-api | `/api/v1/query/analysis/trend` | POST | Week5 | 趋势分析 |
| query-api | `/api/v1/query/analysis/anomaly` | POST | Week5 | 异常分析 |
| query-api | `/api/v1/query/analysis/pattern` | POST | Week5 | 模式分析 |
| audit-api | `/api/v1/audit/logs` | GET | Week6 | 审计日志检索 |
| api-service | `/api/v1/alerts/rules` | GET/POST/PUT/DELETE | Week6 | 告警规则管理 |
| api-service | `/api/v1/security/users` | GET/POST/PUT | Week6 | 用户管理 |
| api-service | `/api/v1/security/roles` | GET/POST/PUT | Week6 | 角色管理 |
| bff-service | `/api/v1/bff/overview` | GET | Week6 | 聚合增强（保持兼容） |

开发环境运行契约（dev 专用）：
1. `docker compose -f docker-compose.yml -f docker-compose.override.yml up`
2. `make dev-up`
3. `make dev-down`
4. `make dev-logs`
5. `make dev-test-smoke`
6. 约束：`docker-compose.override.yml` 仅用于开发测试，不进入生产发布流水线。

## 5. 数据表变更总表（按迁移编号与业务域）

| 迁移编号 | 业务域 | 表 | 计划周次 | 说明 |
|---|---|---|---|---|
| 000012 | 认证与安全 | `user_sessions`、`password_reset_tokens`、`login_attempts` | Week1~Week2 | 认证闭环核心表 |
| 000013 | 采集与接入 | `ingest_pull_sources`、`ingest_pull_tasks` | Week3 | 远端拉取主链路 |
| 000013 | 采集与接入 | `agent_incremental_packages`、`agent_package_files`、`ingest_delivery_receipts`、`ingest_file_checkpoints`、`ingest_dead_letters` | Week4 | 增量包与回执闭环 |
| 000014 | 检索元数据 | `query_histories`、`saved_queries`、`saved_query_tags` | Week5 | 检索历史与收藏 |
| 000015 | 配置中心 | `config_namespace`、`config_item`、`config_version`、`config_publish` | Week1~Week2 | 策略热配置 |
| 000015 | 配置分发 | `runtime_config_subscription`、`runtime_config_dispatch_log` | Week2 | 动态下发与回滚追踪 |
| 000001 复用 | 安全与告警 | `audit_logs`、`alert_rules`、`users`、`roles`、`user_roles` | Week6 | 最小闭环复用 |
| 000016 可选 | 告警版本化 | `alert_rule_versions` | Week6 可选 | 容量不足可顺延 P1 |

## 6. 统一验收门禁

### 6.1 每周验收门禁

1. 页面主路径可执行，且关键按钮不依赖 mock 主数据。
2. 新增 API 具备契约、实现、最小集成测试（成功 + 失败路径至少各 1 条）。
3. 涉及迁移变更必须完成 `up/down` 双向验证并保留执行日志。
4. 关键链路具备追踪证据：请求日志、事件日志、表记录可关联。
5. 发布具备回滚动作，并完成一次非生产回滚演练。

### 6.2 里程碑验收门禁

| 里程碑 | 验收标准 |
|---|---|
| M1 | 认证全流程可用，网关鉴权一致，迁移单一入口可回滚演练。 |
| M2 | 日志服务器主动拉取与 Agent 增量采集双路径可追溯，ACK/NACK 与死信重放可验证，远程 Agent 生命周期最小闭环可用，且支持预编译二进制+systemd 与 Docker 双安装模式。 |
| M3 | 检索、分析、审计、告警、用户角色最小业务闭环打通，核心页面移除 mock 主路径。 |

## 7. 风险与依赖清单（阻塞/降级/回滚）

| 风险/依赖 | 阻塞条件 | 降级策略 | 回滚策略 |
|---|---|---|---|
| 网关 upstream 与服务端口不一致 | 路由 502 或误转发 | 暂时关闭新增路由，仅保留已验证路径 | 恢复上版 `nginx.conf` 与 `conf.d/upstream.conf` |
| 认证接口上线后异常率上升 | 登录失败率显著抬升 | 限流 + 灰度回退 + 只保留登录接口 | 回退 api-service 版本与 auth 配置 |
| 采集链路高峰积压 | 拉取周期过短或批次过大导致任务积压 | 调整拉取频率与批量大小，按 source 分片调度 | 停止自动调度，回退到手动拉取模式 |
| 查询链路压力过高 | ES 查询超时增多 | 启用缓存、缩小时间窗口、限制排序字段 | 回退 query-api 新能力到只读基础查询 |
| Agent 版本漂移 | 升级 ACK 与目标版本不一致 | 分批灰度、冻结高风险批次、限制跨版本通信 | 回退到上一稳定版本并暂停新批次 |
| API Key 轮换异常 | active/next 切换失败或 key 泄露 | 暂停自动拉取并切换只读健康探针，启用人工应急 | 立即 revoke 旧 key，提升 next key 并重建拉取任务 |
| 热更新与生产行为差异 | dev watch 正常但生产镜像启动失败 | 强制执行 dev/prod 双路径回归门禁 | 立即关闭 dev 编排入口，保留生产编排 |
| 迁移执行失败 | DDL 中断或约束冲突 | 暂停放量并锁定变更窗口 | 执行对应 `.down.sql` 回退 |
| 团队容量不足 | 当周任务无法收口 | 保护 P0 主链路，顺延可选项 | 固定冻结范围，次周补齐 |

## 8. 角色与产能假设

| 角色 | 职责边界 | 默认投入方式 |
|---|---|---|
| FE | 页面改造、接口联调、路由鉴权、E2E 配合 | 按周聚焦 2~4 人天 |
| BE | 接口设计与实现、网关联调、缓存与状态机 | 按周聚焦 4~9 人天 |
| QA | 场景测试、回归测试、发布验收 | 按周聚焦 2~3 人天 |
| DBA | 迁移执行、索引评估、回滚演练 | 按周聚焦 1~2 人天 |
| DevOps | 灰度放量、监控告警、发布回滚 | 按周聚焦 1 人天 |

默认假设：
1. 认证 MVP 先采用本地账号体系，Keycloak 深度联动后置。
2. 只做现有页面去 mock 与接口打通，不扩展页面总量。
3. 所有业务配置优先落 `config_*`，避免长期 YAML 固化。
4. `000016_alert_rule_versions` 为 Week6 可选项，若顺延必须在周报中给出顺延原因与目标周次。
