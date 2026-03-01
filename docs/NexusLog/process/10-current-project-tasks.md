# 当前项目适配任务文档（任务基线，细化执行版）

## 1. 文档定位

本文件将需求 `R1~R9` 与差异项 `GAP-001~GAP-018` 转化为可直接执行的任务清单，并细化到：

1. 具体实施动作（可打勾）。
2. 明确验收标准（DoD）。
3. 验收证据与回滚要求。

与其他文档关系：

1. 周排期与人天：`06-m1-m3-weekly-delivery-checklist.md`
2. 接口契约：`12-current-project-api-interface-design.md`
3. 差异闭环：`07-document-code-gap-matrix.md`

## 2. 状态说明

- `[ ]` 未开始
- `[~]` 进行中
- `[x]` 已完成
- `[-]` 阻塞

## 3. 任务清单（细化到执行动作 + 验收标准）

### M1：认证与迁移一致性（Week1~Week2）

#### 任务 1（R1）：统一迁移真相源并完成演练

责任角色：DBA + BE  
目标周次：Week1

- [x] 1.1 明确运行时唯一迁移入口为 `storage/postgresql/migrations`
- [x] 1.2 执行 `000012`、`000015` 的 `up` 演练
- [x] 1.3 执行 `000015`、`000012` 的 `down` 回滚演练
- [x] 1.4 记录迁移命令、执行顺序、执行结果与失败恢复步骤
- [x] 1.5 同步更新文档中的“迁移执行态”（文件存在 vs 环境已执行）

验收标准（DoD）：
1. 任一开发环境可通过单一入口完成初始化迁移。
2. `up/down` 双向演练完整通过，且回滚后可再次 `up` 成功。
3. 应用在回滚后能够正常启动并通过健康检查。

验收证据：
1. 迁移执行日志（含 SQL 输出或命令输出）。
2. 回滚后应用健康检查截图/日志。
3. 文档更新记录（PR 或 commit）。

执行状态（2026-03-01）：
1. 已完成：运行时统一入口脚本 `scripts/db-migrate.sh`。
2. 已完成：Makefile 统一命令 `db-migrate-*` 接入。
3. 已完成：CI 门禁 `db-migration-guard.yml` 与 `check-migration-single-source.sh`。
4. 已完成：`000012`、`000015` 的 `up` 实库演练与证据归档（任务 1.2）。
5. 已完成：`000015`、`000012` 的 `down` 回滚演练（通过 `down 4` 覆盖 `000015~000012`），并已 `up 4` 恢复到 `schema_migrations=15/dirty=false`（任务 1.3）。
6. 阻塞已解除：`000013` 原始脚本使用保留字 `offset` 导致迁移失败，已修复为 `checkpoint_offset` 并重新演练通过。
7. 已完成：任务 1.2 二次复核通过（`schema_migrations=15`、`dirty=false`、关键表存在），证据已归档。
8. 已完成：任务 1.3 核心服务健康检查复跑通过；使用 `.env.mirrors` 的 `GOPROXY=https://goproxy.cn,direct` 完成镜像构建，并通过无端口发布容器验证 `control-plane/api-service/query-api/audit-api/export-api` 的 `/healthz` 均返回 `200`。
9. 已完成：任务 1.4 已完成，迁移命令顺序、执行结果与失败恢复步骤已形成执行文档并补齐 2026-03-01 重跑证据。
10. 已完成：任务 1.5 已完成，已同步 `03/07/09/11/17` 文档口径，明确区分“迁移文件存在态”与“环境执行态”，并补齐 2026-03-01 执行态证据。

证据链接（代码）：
1. `scripts/db-migrate.sh`
2. `scripts/check-migration-single-source.sh`
3. `.github/workflows/db-migration-guard.yml`
4. `Makefile`（`db-migrate-*` 目标）
5. `docs/runbooks/rollback-playbook.md`
6. `docs/NexusLog/process/evidence/task-1.2-migration-up-20260228.log`（首次执行，发现阻塞）
7. `docs/NexusLog/process/evidence/task-1.2-migration-up-remediation-20260228.log`（修复后通过）
8. `storage/postgresql/migrations/000013_mvp_ingest_pull_and_incremental_package.up.sql`（阻塞修复）
9. `docs/NexusLog/process/evidence/task-1.2-migration-up-recheck-20260228.log`（二次复核通过）
10. `docs/NexusLog/process/evidence/task-1.3-migration-down-rollback-20260228.log`（回滚演练、恢复与健康检查日志）
11. `docs/NexusLog/process/16-task-1.4-migration-execution-record.md`（任务 1.4 执行记录文档）
12. `docs/NexusLog/process/evidence/task-1.4-migration-command-sequence-20260301.log`（迁移命令顺序与执行结果重跑日志）
13. `docs/NexusLog/process/evidence/task-1.4-migration-failure-recovery-20260301.log`（失败恢复步骤与可执行参考日志）
14. `docs/NexusLog/process/17-migration-execution-state-baseline.md`（迁移执行态基线文档，区分文件态/执行态）
15. `docs/NexusLog/process/evidence/task-1.5-migration-execution-state-sync-20260301.log`（任务 1.5 执行态同步证据）

关联差异：`GAP-015`

#### 任务 2（R2）：实现认证最小闭环 API

责任角色：BE  
目标周次：Week1~Week2

- [x] 2.1 实现 `POST /api/v1/auth/register`
- [x] 2.2 实现 `POST /api/v1/auth/login`
- [x] 2.3 实现 `POST /api/v1/auth/refresh`
- [x] 2.4 实现 `POST /api/v1/auth/logout`
- [x] 2.5 实现 `POST /api/v1/auth/password/reset-request`
- [x] 2.6 实现 `POST /api/v1/auth/password/reset-confirm`
- [x] 2.7 统一认证接口响应结构与错误码
- [x] 2.8 写入并验证 `user_sessions/password_reset_tokens/login_attempts`
- [x] 2.9 启用开发环境容器热更新基线：`docker compose -f docker-compose.yml -f docker-compose.override.yml up`
- [x] 2.10 提供统一开发命令：`make dev-up/dev-down/dev-logs/dev-test-smoke`（从任务 2 开始作为默认开发入口）

验收标准（DoD）：
1. 六个接口都可被网关路由并返回统一响应结构。
2. 登录成功写 `user_sessions`，失败写 `login_attempts`。
3. refresh 能续期并使旧 token 生命周期符合策略。
4. logout 后令牌失效，受保护接口不再可访问。
5. reset token 过期与无效场景返回稳定错误码。
6. 从任务 2 开始，后续任务默认在容器热更新环境中开发与联调。

验收证据：
1. 接口测试报告（成功/失败场景）。
2. 数据库核验 SQL 结果（会话、重置、登录尝试）。
3. 错误码对照表与示例响应。
4. `dev-up` 启动日志与至少 1 条代码变更热更新生效记录。

关联差异：`GAP-001`, `GAP-008`

#### 任务 3（R2）：改造前端认证主路径

责任角色：FE  
目标周次：Week1~Week2

- [ ] 3.1 `LoginForm` 从本地模拟状态改为真实 API 调用
- [ ] 3.2 `Register` 页面改为真实注册调用并处理错误提示
- [ ] 3.3 `ProtectedRoute` 增加 token 检查、过期跳转与清理逻辑
- [ ] 3.4 `/forgot-password` 页面调用 reset-request/reset-confirm
- [ ] 3.5 去除主路径中的 mock 登录分支（仅保留应急开关）

验收标准（DoD）：
1. 主链路 `/login -> /` 可在真实接口下成功完成。
2. token 过期后访问受保护页会自动跳回登录页。
3. 忘记密码流程可完成，过期 token 场景有可读错误提示。

验收证据：
1. 前端 E2E 用例结果与录屏。
2. 浏览器网络请求日志（真实 API 路径）。
3. 前端异常提示截图（失败场景）。

关联差异：`GAP-001`

#### 任务 4（R3）：修正网关路由与白名单一致性

责任角色：BE + DevOps  
目标周次：Week1~Week2

- [ ] 4.1 配置 `/api/v1/query/* -> query-api:8082`
- [ ] 4.2 配置 `/api/v1/audit/* -> audit-api:8083`
- [ ] 4.3 配置 `/api/v1/export/* -> export-api:8084`
- [ ] 4.4 保持 `/api/v1/auth/*`、`/api/v1/bff/*` 正常转发
- [ ] 4.5 将白名单从 `forgot-password` 迁移为 `password/reset-request|reset-confirm`
- [ ] 4.6 统一鉴权失败错误体（401/403）

验收标准（DoD）：
1. 五类业务前缀可正确到达目标服务，不出现 502 误路由。
2. reset 新路径可匿名访问，非白名单接口仍被鉴权保护。
3. 网关错误码与错误体在各服务场景下保持一致。

验收证据：
1. 网关配置 diff。
2. 路由冒烟测试记录。
3. 401/403 示例响应与 `request_id` 追踪样例。

关联差异：`GAP-002`, `GAP-011`, `GAP-012`

#### 任务 5（R8）：M1 测试与发布门禁

责任角色：QA + DevOps  
目标周次：Week2

- [ ] 5.1 完成认证链路自动化测试（成功/失败）
- [ ] 5.2 完成网关路由与鉴权冒烟测试
- [ ] 5.3 完成 M1 发布前回滚演练（服务与配置）
- [ ] 5.4 发布后观察 30 分钟并记录关键指标
- [ ] 5.5 增加容器热更新门禁（从任务 2 开始持续执行）：前端与核心后端改动可在开发容器内自动生效

验收标准（DoD）：
1. M1 所有 P0 测试通过率达到 100%。
2. 发布后无 P0/P1 新阻塞缺陷。
3. 回滚脚本可在非生产环境一次成功执行。
4. 热更新门禁通过且不影响生产式 compose 路径。

验收证据：
1. 自动化测试报告。
2. 发布观察报告（错误率、延迟、登录成功率）。
3. 回滚演练记录。
4. 热更新冒烟报告（frontend + api-service 至少各 1 次）。

关联差异：`GAP-016`

### M2：接入与可追溯闭环（Week3~Week4）

#### 任务 6（R4）：实现接入控制面接口

责任角色：BE  
目标周次：Week3~Week4

- [ ] 6.1 实现 `GET/POST/PUT /api/v1/ingest/pull-sources`
- [ ] 6.2 实现 `POST /api/v1/ingest/pull-tasks/run`
- [ ] 6.3 实现 `GET /api/v1/ingest/pull-tasks`
- [ ] 6.4 实现 `GET /api/v1/ingest/packages`
- [ ] 6.5 实现 `POST /api/v1/ingest/receipts`
- [ ] 6.6 实现 `POST /api/v1/ingest/dead-letters/replay`
- [ ] 6.7 对齐请求字段、分页与错误码（按 `12` 文档）

验收标准（DoD）：
1. 接口路径、方法、字段与接口设计文档一致。
2. 拉取任务状态机可从 `pending -> running -> success|failed|canceled` 正常流转。
3. 回执接口可正确区分 ACK/NACK 并触发后续处理。

验收证据：
1. 接口自动化测试（含参数校验失败场景）。
2. 状态流转日志与数据库记录。
3. OpenAPI 或契约文档更新记录。

关联差异：`GAP-009`

#### 任务 7（R4）：实现 Agent 最小安装与主动拉取主路径

责任角色：BE  
目标周次：Week4

- [ ] 7.1 完成文件增量读取（checkpoint 增量扫描）
- [ ] 7.2 实现 `GET /agent/v1/meta`、`POST /agent/v1/logs/pull`、`POST /agent/v1/logs/ack`
- [ ] 7.3 增加 Agent 拉取接口鉴权：`X-Agent-Key`（必填）与 `X-Key-Id`（可选）
- [ ] 7.4 交付双安装模式：预编译二进制 + systemd、Docker 运行
- [ ] 7.5 将 Kafka 主推链路标记为 P1 兼容项，不作为 M2 P0 门禁
- [ ] 7.6 提供可配置日志采集范围能力（包含路径 include/exclude），并在 systemd 与 Docker 两种运行方式下可独立配置

验收标准（DoD）：
1. Agent 重启后可从 checkpoint 继续，不重复全量读取。
2. 拉取接口可按游标返回批次并支持 ACK 后提交 checkpoint。
3. 远端安装不依赖 Go/GCC 编译工具，systemd 与 Docker 两种方式均可启动。
4. `X-Agent-Key` 错误场景返回 401 且不泄露内部信息。
5. 远端可按目录/文件模式配置采集范围，且修改配置后在重启 Agent 后生效。

验收证据：
1. Agent 拉取接口集成测试报告（pull/ack/鉴权失败）。
2. 预编译包 + systemd 启动记录与 Docker 启动记录。
3. checkpoint 提交与重复拉取行为日志样例。
4. 两种安装模式下的采集范围配置示例与生效验证记录（systemd 配置文件、Docker volume/环境变量）。

关联差异：`GAP-018`

#### 任务 8（R4）：完成接入链路落库与幂等

责任角色：BE + DBA  
目标周次：Week4

- [ ] 8.1 打通 `ingest_pull_sources/ingest_pull_tasks` 落库并补充拉取配置（`agent_base_url/pull_interval_sec/pull_timeout_sec/key_ref`）
- [ ] 8.2 新增并打通 `agent_pull_batches` 批次落库
- [ ] 8.3 新增并打通 `agent_pull_cursors`、`agent_pull_auth_keys` 与 `ingest_dead_letters` 联动
- [ ] 8.4 实施并验证 `batch_id + checksum` 幂等规则
- [ ] 8.5 增加链路追踪字段（如 `request_id/task_id/batch_id`）

验收标准（DoD）：
1. 拉取任务、批次、游标、ACK/NACK、死信之间可按 ID 全链路追踪。
2. 重复批次提交不会产生重复有效处理记录。
3. NACK 场景可进入死信并支持 replay 后转为成功。

验收证据：
1. 全链路 SQL 校验脚本输出（任务/批次/游标/死信）。
2. 幂等测试报告（重复批次场景）。
3. 死信重放成功样例。

关联差异：`GAP-018`

#### 任务 9（R8）：健康检测目标动态化

责任角色：BE  
目标周次：Week4

- [ ] 9.1 `health-worker` 支持从配置中心或数据库读取目标列表
- [ ] 9.2 支持定时刷新目标，不重启进程即可生效
- [ ] 9.3 增加失败兜底策略（读取失败时保留上一版本）
- [ ] 9.4 增加最小监控指标（目标数、成功率、失败数）

验收标准（DoD）：
1. `getTargets()` 不再返回固定空集合。
2. 新增目标可在刷新周期内被 worker 识别并执行。
3. 配置读取失败不会导致 worker 全量停摆。

验收证据：
1. 配置刷新日志。
2. 目标新增前后执行对比。
3. 失败兜底场景测试记录。

关联差异：`GAP-017`

#### 任务 10（R8）：M2 测试与发布门禁

责任角色：QA + DevOps  
目标周次：Week4

- [ ] 10.1 拉取任务成功/失败/重试测试
- [ ] 10.2 ACK/NACK/死信重放测试
- [ ] 10.3 at-least-once 语义验证
- [ ] 10.4 API Key 校验与双密钥轮换测试（active/next/revoke）
- [ ] 10.5 发布前后性能与积压观察（拉取队列、批次延迟）

验收标准（DoD）：
1. M2 主链路用例全部通过，失败路径可复现并可补偿。
2. 无静默丢数场景，且未 ACK 批次可重拉。
3. 发布后核心指标无异常飙升（拉取成功率、批次延迟、重试率）。

验收证据：
1. 测试报告与失败复盘单。
2. 拉取积压、重试、轮换结果指标截图。
3. 发布观察与回滚预案记录。

关联差异：`GAP-016`, `GAP-018`

### M3：检索与治理闭环（Week5~Week6）

#### 任务 11（R5）：实现 query-api 真实检索接口

责任角色：BE  
目标周次：Week5

- [ ] 11.1 实现 `POST /api/v1/query/logs`
- [ ] 11.2 实现 `GET /api/v1/query/history`
- [ ] 11.3 实现 `DELETE /api/v1/query/history/{history_id}`
- [ ] 11.4 实现 `GET/POST/PUT/DELETE /api/v1/query/saved`
- [ ] 11.5 实现分页、排序、过滤与超时错误码映射
- [ ] 11.6 写入 `query_histories/saved_queries/saved_query_tags`

验收标准（DoD）：
1. 检索接口支持分页与条件过滤，响应结构与约定一致。
2. 历史与收藏 CRUD 可完整运行，删除接口路径参数风格统一。
3. ES 超时场景返回稳定错误码，不暴露内部异常。

验收证据：
1. 接口测试报告（成功/失败/超时）。
2. 元数据表写入校验。
3. 错误码映射清单。

关联差异：`GAP-005`, `GAP-006`, `GAP-010`

#### 任务 12（R5）：完成前端检索模块去 Mock

责任角色：FE  
目标周次：Week5

- [ ] 12.1 `/search/realtime` 去除 `MOCK_*` 主路径
- [ ] 12.2 `/search/history` 对接真实历史接口
- [ ] 12.3 `/search/saved` 对接真实收藏接口
- [ ] 12.4 补全空态、错误态、超时态展示
- [ ] 12.5 增加分页、筛选、刷新交互校验

验收标准（DoD）：
1. 三个检索页面主路径均不依赖本地 mock 数据。
2. 错误与空态可读，且不出现页面卡死或白屏。
3. 查询参数变更会触发正确请求并更新结果。

验收证据：
1. 前端 E2E 测试结果。
2. 浏览器网络请求记录。
3. 页面回归截图/录屏。

关联差异：`GAP-005`, `GAP-006`

#### 任务 13（R5/R9）：统一检索接口命名并修正文档

责任角色：BE + FE + Docs  
目标周次：Week5

- [ ] 13.1 统一命名为 `/api/v1/query/*`
- [ ] 13.2 清理 `/api/v1/search/*` 等历史命名引用
- [ ] 13.3 同步更新 `04/05/06/07/08/09/10/11/12/13` 文档
- [ ] 13.4 形成命名冻结记录，避免重复分叉

验收标准（DoD）：
1. 核心文档中检索前缀不再出现冲突命名。
2. 前后端代码调用路径一致。
3. 联调环境不再依赖路径兼容分支。

验收证据：
1. 文档 diff 列表。
2. 全仓路径扫描结果（命名一致性）。
3. 联调记录。

关联差异：`GAP-003`

#### 任务 14（R6）：实现治理最小闭环 API

责任角色：BE  
目标周次：Week6

- [ ] 14.1 `audit-api` 实现 `GET /api/v1/audit/logs`
- [ ] 14.2 `api-service` 实现 `GET/POST/PUT/DELETE /api/v1/alerts/rules`
- [ ] 14.3 `api-service` 实现 `GET/POST/PUT /api/v1/security/users`
- [ ] 14.4 `api-service` 实现 `GET/POST/PUT /api/v1/security/roles`
- [ ] 14.5 增加管理接口 RBAC 校验与审计记录

验收标准（DoD）：
1. 审计查询支持用户、资源、时间范围过滤与分页。
2. 告警规则与用户角色管理接口可稳定 CRUD。
3. 无权限访问返回统一 403 错误码。

验收证据：
1. 接口测试报告（含鉴权失败场景）。
2. `audit_logs/alert_rules/users/roles/user_roles` 表核验。
3. 审计记录样例。

关联差异：`GAP-007`, `GAP-010`

#### 任务 15（R6）：完成前端治理模块接入

责任角色：FE  
目标周次：Week6

- [ ] 15.1 `/security/audit` 对接审计查询接口
- [ ] 15.2 `/alerts/rules` 对接规则 CRUD 接口
- [ ] 15.3 `/security/users`、`/security/roles` 对接真实接口
- [ ] 15.4 实现权限不足提示与按钮级禁用
- [ ] 15.5 完成治理页面最小回归

验收标准（DoD）：
1. 治理页面均可在真实接口下完成主流程操作。
2. 权限不足用户无法执行写操作且提示明确。
3. 页面刷新后数据与后端保持一致。

验收证据：
1. 页面联调录屏。
2. E2E 用例结果。
3. 权限场景测试截图。

关联差异：`GAP-007`

#### 任务 16（R6/R9）：Dashboard 聚合能力对齐

责任角色：BE + FE  
目标周次：Week6

- [ ] 16.1 统一 Dashboard 使用 `GET /api/v1/bff/overview`
- [ ] 16.2 补齐聚合字段：服务可用性、告警概览、接入状态、查询概览
- [ ] 16.3 明确 `/api/v1/dashboard/overview` 是否保留（若保留需仅作兼容）
- [ ] 16.4 同步文档中的 Dashboard API 命名

验收标准（DoD）：
1. Dashboard 不再依赖随机数据或常量假数据。
2. BFF 返回字段满足页面渲染，不再额外拼接 mock。
3. 命名策略在文档与代码中保持一致。

验收证据：
1. BFF 响应结构对比。
2. 页面请求日志与渲染截图。
3. 文档更新记录。

关联差异：`GAP-004`

#### 任务 17（R8）：M3 测试与发布门禁

责任角色：QA + DevOps  
目标周次：Week6

- [ ] 17.1 检索链路测试：成功/超时/鉴权失败
- [ ] 17.2 治理链路测试：用户角色、告警规则、审计查询
- [ ] 17.3 E2E 主路径：`/login -> / -> /search/realtime`
- [ ] 17.4 E2E 治理路径：`/security/*` 与 `/alerts/rules`
- [ ] 17.5 发布后观察与缺陷分级

验收标准（DoD）：
1. M3 主链路测试全部通过。
2. 检索与治理场景均有至少 1 条失败用例覆盖。
3. 发布后无新增 P0 差异项。

验收证据：
1. 测试报告与缺陷关闭记录。
2. 发布观察报告。
3. 回滚演练记录（如触发）。

关联差异：`GAP-016`

### 跨里程碑治理任务（Week1~Week6）

#### 任务 18（R9）：修正 README 与本地运行事实一致性

责任角色：Docs + DevOps + FE  
目标周次：Week1~Week2

- [ ] 18.1 说明本地 compose 的 gateway 运行模式与联调入口
- [ ] 18.2 修正前端目录结构描述偏差
- [ ] 18.3 校对 README、process 索引与当前文档链接有效性

验收标准（DoD）：
1. 新成员可按 README 完成本地启动与联调。
2. README 中目录树与仓库实际结构一致。
3. 索引链接无失效路径。

验收证据：
1. README diff。
2. 本地启动验证记录。
3. 链接检查结果。

关联差异：`GAP-013`, `GAP-014`

#### 任务 19（R9）：每周更新差异状态与证据

责任角色：PM + QA + 各模块负责人  
目标周次：Week1~Week6（每周固定）

- [ ] 19.1 更新 `07` 中 `GAP-001~018` 状态
- [ ] 19.2 维护证据链接（PR、测试报告、监控截图）
- [ ] 19.3 对未关闭 P0 项给出阻塞原因与解法
- [ ] 19.4 周会输出“关闭项/遗留项/顺延项”清单

验收标准（DoD）：
1. 每周都有一次状态快照与证据更新。
2. 所有标记 `closed` 的 GAP 都有可追踪证据。
3. 未关闭 P0 项不会被误标为里程碑完成。

验收证据：
1. 周报记录。
2. GAP 更新提交记录。
3. 风险与顺延说明。

关联差异：`GAP-001~GAP-018`

## 4. 里程碑级验收任务（任务 20~22）

#### 任务 20：M1 验收

- [ ] 20.1 认证全流程可用（注册/登录/refresh/logout/reset）
- [ ] 20.2 网关鉴权与路由一致（无路径分叉）
- [ ] 20.3 迁移单入口且完成回滚演练

M1 验收标准：
1. 认证接口与前端主路径联调通过。
2. 网关前缀和 upstream 与 compose 一致。
3. `000012/000015` 演练完成且可回退。

#### 任务 21：M2 验收

- [ ] 21.1 主动拉取链路可用（配置 -> 任务 -> 状态）
- [ ] 21.2 批次拉取 + ACK/NACK + 死信重放可用
- [ ] 21.3 链路可追溯且满足 at-least-once
- [ ] 21.4 远程 Agent 生命周期最小闭环可用（注册/心跳/离线判定 + API Key 鉴权）
- [ ] 21.5 最小安装双模式可用（预编译二进制 + systemd、Docker），且远端不依赖 Go/GCC 等编译工具
- [ ] 21.6 远端日志采集范围配置可验证（至少 1 个 include 与 1 个 exclude 场景）

M2 验收标准：
1. 接入控制接口与 Agent 拉取接口可操作并稳定返回。
2. 失败场景可补偿，无静默丢失。
3. 数据表可完整追踪任务、批次与游标状态。
4. 可查看 Agent 在线清单并验证超时离线判定。
5. API Key 双密钥轮换可验证。
6. systemd 与 Docker 两种安装模式均可完成主动拉取链路联调，且无需安装编译工具。
7. 日志采集范围配置生效并可通过拉取结果验证。

#### 任务 22：M3 验收

- [ ] 22.1 检索闭环可用且前端去 mock
- [ ] 22.2 审计/告警/用户角色闭环可用
- [ ] 22.3 关键 P0 差异项全部关闭
- [ ] 22.4 分析链路闭环 + 可视化闭环完成（trend/anomaly/pattern）

M3 验收标准：
1. 检索、治理主路径具备 E2E 通过证据。
2. 关键管理接口具备鉴权与审计证据。
3. `GAP` 中所有 P0 项状态为 `closed`。
4. 分析接口与前端分析页主路径不依赖 mock 数据。

### 任务包补齐（任务 23~28，覆盖全链路与开发基线）

#### 任务 23（R4/R8）：远程 Agent 拉取接口与在线状态

责任角色：BE + DevOps  
目标周次：Week3

- [ ] 23.1 设计并实现 `POST /api/v1/agents/register`、`POST /api/v1/agents/heartbeat`、`GET /api/v1/agents` 最小接口契约
- [ ] 23.2 设计并实现 Agent 侧 `GET /agent/v1/meta`、`POST /agent/v1/logs/pull`、`POST /agent/v1/logs/ack`
- [ ] 23.3 定义 Agent 在线状态机：`online/degraded/offline/decommissioned`
- [ ] 23.4 记录并可查询 `agent_id/host/fingerprint/version/last_seen`
- [ ] 23.5 实现超时离线判定与恢复上线判定
- [ ] 23.6 增加 `X-Agent-Key` 鉴权与 `active/next` 双密钥轮换
- [ ] 23.7 增加远端日志采集范围元信息上报（include/exclude）并支持控制面查询

验收标准（DoD）：
1. 远程 Agent 首次注册后可在在线清单中查询。
2. 心跳续期可更新 `last_seen`，超时后状态可切换为 `offline`。
3. 拉取接口可返回批次 + `next_cursor`，ACK 可提交 checkpoint。
4. 状态变更具备审计记录并可追踪到 `agent_id`。
5. 控制面可查看 Agent 当前采集范围配置摘要，用于远端范围核对。

验收证据：
1. 接口测试报告（注册/心跳/列表/pull/ack）。
2. 状态机转换日志与数据库查询结果。
3. 超时离线判定与密钥轮换演示记录。
4. 采集范围配置上报与查询结果截图/日志。

关联差异：`GAP-009`, `GAP-018`

#### 任务 24（R4/R8）：远程 Agent 升级、回滚与下线流程（P1）

责任角色：BE + DevOps + QA  
目标周次：Week4（P1）

- [ ] 24.1 实现 `POST /api/v1/agents/{agent_id}/upgrade-plan` 与 `POST /api/v1/agents/{agent_id}/upgrade-ack`
- [ ] 24.2 定义灰度升级批次、重试次数与失败回滚策略
- [ ] 24.3 实现 `POST /api/v1/agents/{agent_id}/decommission` 下线流程
- [ ] 24.4 补齐升级成功、升级失败回滚、下线归档三类演练脚本

验收标准（DoD）：
1. 至少 1 次升级成功与 1 次失败回滚可复现。
2. 升级 ACK/NACK 可被控制面正确记录并更新状态。
3. 下线后的 Agent 不再参与调度，且有完整审计记录。
4. 本任务不作为 M2 P0 里程碑阻塞项。

验收证据：
1. 升级批次执行日志与 ACK 明细。
2. 回滚演练记录与恢复时间统计。
3. 下线操作审计日志与查询截图。

关联差异：`GAP-018`

#### 任务 25（R5）：分析链路 API 最小闭环

责任角色：BE  
目标周次：Week5

- [ ] 25.1 实现 `POST /api/v1/query/analysis/trend`
- [ ] 25.2 实现 `POST /api/v1/query/analysis/anomaly`
- [ ] 25.3 实现 `POST /api/v1/query/analysis/pattern`
- [ ] 25.4 定义分析接口超时与降级错误码（`ANALYSIS_TIMEOUT`、`ANALYSIS_DOWNGRADED`）

验收标准（DoD）：
1. 三个分析接口可稳定返回，响应结构与接口文档一致。
2. 分析超时与降级场景返回统一错误码与可读提示。
3. 分析请求具备最小鉴权与限流保护。

验收证据：
1. 接口自动化测试报告（成功/失败/超时）。
2. 统一错误码样例响应。
3. 下游异常时的降级日志样例。

关联差异：`GAP-005`, `GAP-010`

#### 任务 26（R5）：前端分析页面去 Mock

责任角色：FE + QA  
目标周次：Week5

- [ ] 26.1 `/analysis/trend`、`/analysis/anomaly`、`/analysis/pattern` 切换真实 API
- [ ] 26.2 统一空态、超时态、错误态展示与重试交互
- [ ] 26.3 移除分析页面主路径本地样例数据依赖，仅保留应急开关
- [ ] 26.4 增加分析页面主路径 E2E 用例

验收标准（DoD）：
1. 三个分析页面主路径不依赖 mock 数据。
2. 错误和超时场景不白屏，可提示可重试。
3. 分析页面 E2E 主流程通过并可回放。

验收证据：
1. 页面联调录屏与请求抓包。
2. E2E 报告与失败重试截图。
3. mock 开关默认关闭证明记录。

关联差异：`GAP-005`, `GAP-006`

#### 任务 27（R8）：容器热更新开发基线（从任务 2 开始生效）

责任角色：DevOps + BE + FE  
目标周次：Week2~Week6

- [ ] 27.1 定义 `docker-compose.override.yml` 开发专用编排与服务覆盖范围（Week2 启用）
- [ ] 27.2 前端容器化 HMR：`pnpm dev --host 0.0.0.0` + 源码挂载
- [ ] 27.3 Go 服务与 Agent 容器化 Watch：`api/control/query/audit/bff/export/health-worker/collector-agent`
- [ ] 27.4 约束开发与生产隔离：开发 watch 行为不进入生产发布路径
- [ ] 27.5 统一开发命令契约：`make dev-up/dev-down/dev-logs/dev-test-smoke`（任务 2 起强制使用）

验收标准（DoD）：
1. 从任务 2 开始，代码变更后容器内服务可自动生效并可即时联调。
2. 开发编排与生产编排隔离，`docker-compose.yml` 发布行为不变。
3. 启停开发编排不影响现有生产式 compose 启动流程。

验收证据：
1. 开发编排说明文档与命令演示日志。
2. 前端与 Go/Agent 热更新演示录屏。
3. dev/prod 编排隔离回归记录。

关联差异：`GAP-016`, `GAP-017`

#### 任务 28（R8）：容器热更新测试门禁

责任角色：QA + DevOps  
目标周次：Week2~Week6（持续门禁）

- [ ] 28.1 前端热更新冒烟测试（页面改动 10 秒内生效，Week2 起每周执行）
- [ ] 28.2 后端与 Agent 热更新冒烟测试（自动重编译恢复，Week2 起每周执行）
- [ ] 28.3 回归验证 dev 编排不影响生产式 compose 启动（Week2 起每周执行）
- [ ] 28.4 固化门禁结果并纳入每周验收与里程碑验收证据

验收标准（DoD）：
1. 前端、后端、Agent 热更新冒烟全部通过。
2. dev 与 prod 编排路径均可独立通过启动与健康检查。
3. 门禁报告可直接支撑 M3 交付验收。

验收证据：
1. 热更新冒烟报告与执行日志。
2. dev/prod 双路径健康检查记录。
3. 门禁清单与缺陷关闭记录。

关联差异：`GAP-016`

## 5. 统一执行规则

1. 任一任务标记 `[x]` 前必须附证据链接。
2. 任一发布任务必须包含回滚动作与触发条件。
3. 接口与数据表变更必须同步更新 `08/09/10/11/12/13`。
4. 每周必须完成一次“测试门禁 + 回滚检查 + GAP 更新”。

## 6. 每周更新模板（复制即用）

```md
### WeekX 任务更新
- 已完成任务：1, 2, 4
- 进行中任务：3, 5
- 阻塞任务：9（阻塞原因：...）
- 本周验收结论：通过/不通过
- 风险与顺延：...
- 证据链接：
  - 任务1：<PR/日志/截图>
  - 任务2：<测试报告>
```

## 7. 版本记录

- `v1.3`（2026-03-01）：将远端 Agent 主路径固定为“最小安装 + 主动拉取”，补充采集范围配置要求，完善 M2 验收中的双安装模式与无编译工具约束。
- `v1.2`（2026-03-01）：补齐任务包（23~28），覆盖远程 Agent 生命周期、分析链路闭环与 Docker 热更新开发基线。
- `v1.1`（2026-02-28）：细化任务到执行动作与 DoD，补充每项验收证据要求。
- `v1.0`（2026-02-28）：首次生成任务基线，映射 M1~M3 与 GAP 闭环。
