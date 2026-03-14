# NexusLog 代码安全审计基线（静态审查复核版）

## 1. 文档定位

本文基于仓库现有代码、网关脚本、服务配置、部署文档与 `docker-compose.yml` 的静态审查结果整理，形成当前版本的安全审计基线。

- 审查日期：`2026-03-14`
- 审查方式：静态代码审阅 + 配置审阅 + 架构信任边界分析
- 审查范围：`gateway/openresty`、`services/api-service`、`services/control-plane`、`services/data-services/*`、`apps/frontend-console`、`docker-compose.yml`、`DEPLOYMENT.md`
- 审查重点：身份认证、会话安全、多租户隔离、注入风险、敏感信息保护、出网能力、部署弱配置
- 未覆盖内容：动态渗透验证、依赖组件 CVE 扫描、镜像扫描、主机基线扫描、云资源暴露面核查

> 本文档是第一轮静态代码安全基线与复核补充版，适用于指导整改优先级与回归验证范围，不替代正式渗透测试报告或上线安全测评报告。

---

## 2. 执行摘要

从当前代码状态看，NexusLog 已具备基础的密码散列、随机令牌生成、多租户字段传递与部分加密处理能力，但系统在**信任边界、身份真实性、租户隔离与控制面访问控制**方面仍存在多处高风险缺口。

### 2.1 总体判断

- 当前最核心的风险不在单一 SQL 注入，而在**边界信任失效**与**多租户隔离不闭环**
- 若攻击者可以绕过网关直连内部服务，或利用网关的弱鉴权 / 降级鉴权分支，则有机会伪造身份、伪造租户并跨租户读取或导出数据
- `control-plane` 当前缺少可靠的服务端鉴权，且直接信任 `X-Tenant-ID`、`X-User-ID` 等头部，意味着可达该服务的调用方可能伪造租户、用户与审计主体
- 认证链路还存在默认 JWT 密钥、公开 logout 接口可滥用、access token 不可及时撤销、登录锁定未接线等问题，导致凭证泄露后缺乏有效控制能力
- 通知测试与 pull-source 出网能力同时带来**敏感信息泄露**与**SSRF / 内网探测** 风险
- 前端令牌存储与开发态应急开关进一步放大了 XSS 或配置误用后的攻击面

### 2.2 风险分布

- `P0`：5 组高风险问题，直接影响身份真实性、访问控制与租户隔离
- `P1`：7 组中风险问题，影响会话撤销、SSRF、敏感配置保护、错误暴露与部署安全
- `P2`：1 组低到中风险问题，主要集中在前端会话存储与应急开关治理

### 2.3 优先级结论

建议先处置以下五类问题，再推进其余治理项：

1. 关闭或收敛内部服务直暴露端口，强制核心流量经过统一鉴权入口
2. 为 `control-plane`、数据服务和网关统一补齐严格的服务端鉴权与租户一致性校验
3. 修复所有默认租户回退与缺失租户过滤的检索、统计、导出路径
4. 将网关 JWT 校验改为严格 `fail-close`，禁止任何“只解码不验签”路径进入业务
5. 移除默认 JWT 密钥，并修复 logout / session / jti / lockout 等认证链路问题

---

## 3. 风险分级标准

| 等级 | 定义 | 典型影响 | 建议时效 |
|---|---|---|---|
| `P0` | 可直接导致身份伪造、越权访问、跨租户数据泄露或核心边界失效 | 核心数据泄露、租户隔离失效、认证失效 | 立即修复 |
| `P1` | 暂不一定直接导致全面沦陷，但会显著放大攻击面或降低事件响应能力 | SSRF、凭证滥用、内部信息泄露、运维面暴露 | 短期修复 |
| `P2` | 防御深度与安全成熟度问题，需要纳入版本治理 | 会话暴露面偏大、环境误用风险 | 中期修复 |

---

## 4. 问题总览

| 编号 | 等级 | 问题主题 | 主要影响 |
|---|---|---|---|
| `P0-1` | `P0` | 内部服务直暴露，网关信任边界可被绕过 | 可绕过统一鉴权直达业务服务 |
| `P0-2` | `P0` | `control-plane` 缺失服务端鉴权并信任客户端身份头 | 可伪造租户、用户与审计主体 |
| `P0-3` | `P0` | 多租户隔离存在默认租户回退与缺失租户过滤 | 存在跨租户检索、统计、导出风险 |
| `P0-4` | `P0` | JWT 校验存在降级验签与路径租户弱鉴权分支 | 可伪造身份或伪造租户上下文 |
| `P0-5` | `P0` | 默认 JWT 密钥硬编码 | 开发态密钥可被利用伪造令牌 |
| `P1-1` | `P1` | `pull-sources.agent_base_url` 可触发 SSRF | 内网探测、服务代请求、元数据访问 |
| `P1-2` | `P1` | 通知配置暴露敏感字段，测试发送接口可被滥用 | 凭据泄露、SSRF、对外滥发 |
| `P1-3` | `P1` | Logout 公开路由信任 `X-User-ID` | 任意用户会话撤销 / DoS |
| `P1-4` | `P1` | Access Token 撤销链路不闭环且 `jti` 记录不一致 | 注销后令牌仍可继续使用 |
| `P1-5` | `P1` | 登录锁定逻辑未接入实际登录流程 | 暴力破解防护不足 |
| `P1-6` | `P1` | 多处接口直接返回内部错误 | 暴露内部实现、SQL/ES/路径信息 |
| `P1-7` | `P1` | 部署默认项偏弱 | 明文开发凭据、管理面直接暴露、数据库链路未强制 TLS |
| `P2-1` | `P2` | 前端长期令牌存储与应急 mock 开关治理不足 | XSS 后令牌窃取风险放大 |

---

## 5. 详细问题

### 5.1 `P0-1` 内部服务直暴露，网关信任边界可被绕过

**现象**

当前编排配置中，多项内部服务直接映射到宿主机端口；与此同时，部分服务自身并未实现独立的服务间认证，默认依赖前置网关或入口层的上下文。

**代码证据**

- `docker-compose.yml:35`
- `docker-compose.yml:71`
- `docker-compose.yml:136`
- `docker-compose.yml:158`
- `docker-compose.yml:176`
- `services/control-plane/cmd/api/main.go:39`
- `services/control-plane/internal/alert/rule_handler.go:57`

**风险说明**

- 一旦内网、跳板机、容器宿主机或边车网络被触达，攻击者可能直接访问业务服务而不经过网关统一认证链路
- 若下游服务仅相信 `X-Tenant-ID` 或其他头部，则可伪造租户上下文，扩大越权面
- 这类问题会放大后续所有“默认租户回退”“缺失租户过滤”“头部信任”的破坏范围

**整改建议**

- 非必要服务取消宿主端口映射，仅保留网关对外暴露
- 服务间调用改为私网 + mTLS 或至少服务级共享签名认证
- 对所有内部 API 增加“来源校验 + 服务身份认证”，而不是只信任透传头
- 为接入层与服务层分别增加集成测试，验证“绕过网关直连”必须失败

### 5.2 `P0-2` `control-plane` 缺失服务端鉴权并信任客户端身份头

**现象**

`control-plane` 当前以基础 `gin.Default()` 启动，审查范围内未见统一的服务端认证中间件；多处写接口和审计逻辑直接信任请求头中的 `X-Tenant-ID`、`X-User-ID`，从而将客户端可控头部视为真实身份来源。

**代码证据**

- `services/control-plane/cmd/api/main.go:39`
- `services/control-plane/cmd/api/main.go:188`
- `services/control-plane/cmd/api/ingest_runtime.go:86`
- `services/control-plane/internal/notification/channel_handler.go:69`
- `services/control-plane/internal/notification/channel_handler.go:191`
- `services/control-plane/internal/middleware/audit_middleware.go:110`
- `services/control-plane/internal/middleware/audit_middleware.go:120`
- `services/control-plane/internal/middleware/audit_middleware.go:183`

**风险说明**

- 任意可达 `control-plane` 监听地址的调用方都有机会伪造租户、用户和审计主体
- 一旦与内部端口直暴露叠加，攻击者可能绕过前置网关直接对控制面写接口发起伪造操作
- 审计链路也会被污染，导致安全事件发生后难以还原真实操作者

**整改建议**

- 为 `control-plane` 全量接入严格的服务端认证中间件
- 所有租户与用户上下文仅允许从已验证 token 或内部可信服务身份派生
- 审计中间件禁止使用未经验证的头部作为主体标识
- 对控制面写接口补齐鉴权、授权与审计一致性测试

### 5.3 `P0-3` 多租户隔离存在默认租户回退与缺失租户过滤

**现象**

代码中存在多处“租户为空则退回默认租户”的分支，且查询、统计、导出若未显式注入租户条件，则存在跨租户读取的可能。

**代码证据**

- 默认租户回退：
  - `services/data-services/query-api/internal/service/service.go:27`
  - `services/data-services/query-api/internal/service/service.go:609`
  - `services/data-services/audit-api/internal/handler/audit_handler.go:101`
  - `services/data-services/export-api/internal/handler/export_handler.go:157`
  - `services/data-services/query-api/internal/handler/stats_handler.go:23`
  - `services/data-services/query-api/internal/service/stats_service.go:373`
- `query-api` 搜索链路未强制携带租户字段：
  - `services/data-services/query-api/internal/service/service.go:193`
  - `services/data-services/query-api/internal/service/service.go:220`
  - `services/data-services/query-api/internal/repository/repository.go:440`
- `export-api` 导出查询未内建租户约束：
  - `services/data-services/export-api/internal/service/export_service.go:69`
  - `services/data-services/export-api/internal/service/export_service.go:100`
  - `services/data-services/export-api/internal/service/export_service.go:142`
  - `services/data-services/export-api/internal/repository/es_export_repository.go:67`
  - `services/data-services/export-api/internal/repository/es_export_repository.go:182`
- `query-api` 还会从未验签 claims 中回填身份：
  - `services/data-services/query-api/internal/handler/handler.go:271`
  - `services/data-services/query-api/internal/handler/handler.go:290`

**风险说明**

- 攻击者可通过省略租户、伪造租户、触发默认租户分支或利用未过滤查询访问不属于自己的数据
- 该问题影响范围覆盖检索、统计与导出三个关键读路径，属于多租户平台中的核心隔离缺陷
- 如果与 `P0-1` 或 `P0-4` 联动，破坏效果会从“逻辑缺陷”升级为“边界级数据泄露”

**整改建议**

- 彻底移除默认租户兜底逻辑，租户缺失即拒绝请求
- 在 handler、service、repository 三层同时强制注入租户过滤条件，避免只在入口层传递
- 对 ES / SQL / 导出任务统一设计 `tenant_id` 必填约束对象
- 建立安全测试用例：空租户、伪造租户、跨租户导出、跨租户统计必须全部失败

### 5.4 `P0-4` JWT 校验存在降级验签与路径租户弱鉴权分支

**现象**

网关当前存在在 JWKS 获取失败时退化为“只校验格式 / Claims”的逻辑；另外，路径租户路由链路使用了更弱的 helper，仅解析 token payload 与 `exp`，未完成签名真实性验证，也未校验 token 中租户与路径租户的一致性。

**代码证据**

- JWKS 失败后降级解析 Claims：
  - `gateway/openresty/lua/auth_check.lua:147`
  - `gateway/openresty/lua/auth_check.lua:153`
  - `gateway/openresty/lua/auth_check.lua:155`
  - `gateway/openresty/lua/auth_check.lua:205`
  - `gateway/openresty/lua/auth_check.lua:289`
- Claims 校验未严格校验 `issuer` / `audience`：
  - `gateway/openresty/lua/auth_check.lua:183`
- 路径租户路由使用弱 helper：
  - `gateway/openresty/nginx.conf:168`
  - `gateway/openresty/lua/auth_check_helper.lua:51`
  - `gateway/openresty/lua/auth_check_helper.lua:79`
- 路径租户未校验与 token 租户一致性：
  - `gateway/openresty/lua/tenant_router.lua:25`
  - `gateway/openresty/lua/tenant_router.lua:202`
  - `gateway/openresty/lua/tenant_router.lua:212`

**风险说明**

- 该设计允许在上游密钥获取异常、配置失误或依赖故障时进入“失败放行”状态
- 只要攻击者能构造带任意 claims 的伪 token，就可能伪装用户身份或租户身份
- 对 `/t/{tenant}/api/...` 路径而言，攻击者甚至可能直接伪造未签名 JWT 或切换路径租户访问其他租户资源

**整改建议**

- JWT 校验必须改为严格 `fail-close`：JWKS 拉取失败、签名失败、发行方不符、受众不符时全部拒绝
- 删除或停用只做 payload 解码的 helper，统一走一个强校验实现
- 在网关强制比对 `token.tenant_id`、路径租户、头部租户三者一致性
- 为网关补齐单元测试与集成测试，覆盖签名篡改、过期 token、错误 issuer、错误 audience、错误租户等场景

### 5.5 `P0-5` 默认 JWT 密钥硬编码

**现象**

认证服务存在默认 JWT 密钥常量，且未在当前编排中确认强制覆盖。

**代码证据**

- `services/api-service/cmd/api/main.go:33`
- `services/api-service/internal/service/auth_service.go:84`
- `services/api-service/internal/handler/auth_middleware.go:64`
- `services/api-service/internal/handler/auth_middleware.go:124`
- 审查期间未在 `docker-compose.yml` 中发现对 `JWT_SECRET` 的可靠覆盖

**风险说明**

- 默认密钥一旦进入测试、预发或生产环境，攻击者可离线伪造合法 token
- 该问题与 `P0-4` 叠加时，会显著降低身份伪造门槛

**整改建议**

- 禁止任何默认生产可用密钥存在于代码中
- 启动时若 `JWT_SECRET` 为空或命中弱值，则服务必须拒绝启动
- 使用密钥管理系统或至少使用环境变量 + 密钥轮换机制

### 5.6 `P1-1` `pull-sources.agent_base_url` 可触发 SSRF

**现象**

`pull-sources` 的 `agent_base_url` 可由请求直接写入，后端运行时会主动基于该地址向 agent 发起请求，形成服务端可控出网能力。

**代码证据**

- `services/control-plane/internal/ingest/pull_sources.go:98`
- `services/control-plane/internal/ingest/pull_sources.go:620`
- `services/control-plane/internal/ingest/pull_sources.go:713`
- `services/control-plane/internal/ingest/agent_client.go:64`
- `services/control-plane/internal/ingest/agent_client.go:97`
- `services/control-plane/internal/ingest/agent_client.go:152`
- `services/control-plane/cmd/api/ingest_runtime.go:93`

**风险说明**

- 若攻击者可调用相关接口，即可借助服务端访问内网地址、云元数据地址或任意对外主机
- 该问题可被用作内网探测、端口探测、回连跳板或敏感元数据访问入口
- 由于 `control-plane` 本身又存在身份头信任问题，利用门槛进一步降低

**整改建议**

- 对 `agent_base_url` 增加协议、域名、IP 段和端口白名单校验
- 默认禁止访问回环、链路本地、私有网段和云元数据地址
- 为主动出网请求补齐超时、重试上限、审计日志与访问审批控制

### 5.7 `P1-2` 通知配置暴露敏感字段，测试发送接口可被滥用

**现象**

通知渠道的 `config` 在查询列表与详情接口中直接返回，配置内包含 SMTP、Webhook 等敏感字段；测试发送接口又会真实触发对外网络请求，形成敏感信息泄露与 SSRF 的复合风险。

**代码证据**

- 原始配置直接返回：
  - `services/control-plane/internal/notification/channel_repository.go:26`
  - `services/control-plane/internal/notification/channel_repository.go:64`
  - `services/control-plane/internal/notification/channel_repository.go:111`
  - `services/control-plane/internal/notification/channel_handler.go:121`
  - `services/control-plane/internal/notification/channel_handler.go:154`
- 敏感字段来源：
  - `services/control-plane/internal/notification/channel_service.go:49`
  - `services/control-plane/internal/notification/channel_service.go:86`
  - `services/control-plane/internal/notification/dingtalk_sender.go:65`
  - `services/control-plane/internal/notification/dingtalk_sender.go:108`
  - `services/control-plane/internal/notification/smtp_sender.go:93`
  - `services/control-plane/internal/notification/smtp_sender.go:121`
- 测试发送触发真实出网：
  - `services/control-plane/internal/notification/channel_handler.go:289`
  - `services/control-plane/internal/notification/channel_handler.go:342`
  - `services/control-plane/internal/notification/channel_handler.go:358`
- 前端页面直接消费完整配置：
  - `apps/frontend-console/src/pages/alerts/NotificationConfig.tsx:105`
  - `apps/frontend-console/src/pages/alerts/NotificationConfig.tsx:113`
  - `apps/frontend-console/src/pages/alerts/NotificationConfig.tsx:117`
  - `apps/frontend-console/src/pages/alerts/NotificationConfig.tsx:118`

**风险说明**

- 管理端接口返回的配置若被越权访问，可能直接泄露 SMTP 凭据、Webhook 地址、签名材料与 access token
- 测试发送能力若缺少目标限制，可被用于探测内网地址、打外部目标或向攻击者控制域发请求
- 敏感配置一旦回传前端，安全边界将从“服务端可控”扩散到“浏览器可见”

**整改建议**

- 列表 / 详情接口仅返回脱敏字段，敏感配置分离存储并加密
- 测试发送能力增加目标白名单、协议限制、超时限制、审计日志与权限控制
- Webhook、SMTP 目标只允许经过校验的受信地址，禁止明文 `http` 与高风险目标

### 5.8 `P1-3` Logout 公开路由信任 `X-User-ID`

**现象**

`/api/v1/auth/logout` 当前处于公开路由上；当请求体中未提供 `refresh_token` 时，服务会信任请求头中的 `X-User-ID`，并按该用户撤销活动会话。

**代码证据**

- `services/api-service/cmd/api/router.go:56`
- `services/api-service/internal/handler/auth_handler.go:182`
- `services/api-service/internal/service/auth_service.go:313`
- `services/api-service/internal/service/auth_service.go:332`
- `services/api-service/internal/service/auth_service.go:341`

**风险说明**

- 攻击者可在不具备真实用户身份的情况下，通过伪造 `X-User-ID` 触发任意用户会话撤销
- 该问题主要造成会话层 DoS、强制下线与运维干扰
- 若日志审计依赖同类头部，还会造成溯源失真

**整改建议**

- 将 logout 放入 `AuthRequired` 之后，仅允许当前认证主体注销自身会话
- 若设计上允许 refresh token 登出，则必须要求提供有效 refresh token 并校验其所属主体
- 对 logout 行为补齐主体一致性与回归测试

### 5.9 `P1-4` Access Token 撤销链路不闭环且 `jti` 记录不一致

**现象**

认证中间件只校验 JWT 签名、过期时间和用户是否存在，不校验 `user_sessions`、`session_status` 或 token 对应的 `jti`；同时，JWT 中写入的 `jti` 与会话表存储的 `access_token_jti` 不是同一个值，导致按 token 精确撤销与审计追踪失效。

**代码证据**

- JWT 中间件未校验活动会话：
  - `services/api-service/internal/handler/auth_middleware.go:64`
  - `services/api-service/internal/handler/auth_middleware.go:80`
- 会话撤销只落在 session / refresh 层：
  - `services/api-service/internal/repository/auth_repository.go:341`
  - `services/api-service/internal/repository/auth_repository.go:481`
  - `services/api-service/internal/repository/auth_repository.go:503`
- JWT 与 session 中的 `jti` 不一致：
  - `services/api-service/internal/service/auth_service.go:75`
  - `services/api-service/internal/service/auth_service.go:81`
  - `services/api-service/internal/service/auth_service.go:480`
  - `services/api-service/internal/service/auth_service.go:534`
  - `services/api-service/internal/service/auth_service.go:539`
  - `services/api-service/internal/repository/auth_repository.go:364`

**风险说明**

- 用户退出登录、管理员撤销会话或密码重置后，已签发 access token 仍可能继续使用至过期
- 在凭据泄露场景下，缺少实时失效能力会明显扩大事件影响
- `jti` 账本失真还会削弱审计追踪与按 token 精确吊销能力

**整改建议**

- 保证 JWT `jti` 与会话存储 `jti` 一致且可追踪
- 鉴权链路增加“是否为有效会话 / 是否被撤销 / 是否与 tenant 一致”的检查
- 为 logout、密码修改、refresh rotation 后的旧 token 失效补齐自动化测试

### 5.10 `P1-5` 登录锁定逻辑未接入实际登录流程

**现象**

用户服务内存在失败锁定逻辑，但认证服务登录主流程未调用该能力；审查范围内也未见登录接口具备明确的账号 / IP 维度限流与退避控制。

**代码证据**

- 锁定逻辑存在：
  - `services/api-service/internal/repository/user_repository.go:479`
  - `services/api-service/internal/service/user_service.go:49`
- 登录流程未接线：
  - `services/api-service/internal/handler/auth_handler.go:85`
  - `services/api-service/internal/service/auth_service.go:171`
  - `services/api-service/cmd/api/main.go:31`
  - `services/api-service/cmd/api/router.go:54`

**风险说明**

- 攻击者可持续尝试撞库 / 暴力破解，而不会触发预期的风控阻断
- 管理后台、默认账号或弱密码用户面临更高被猜解风险

**整改建议**

- 将失败计数、锁定窗口、解锁逻辑接入真实登录流程
- 对登录接口叠加 IP / 账号维度限流与告警
- 补充验证码或二次验证作为高风险场景兜底

### 5.11 `P1-6` 多处接口直接返回内部错误

**现象**

多处 handler 直接将底层错误信息透传给客户端，可能暴露内部路径、ES / SQL 结构、异常栈语义或系统状态。

**代码证据**

- `services/data-services/query-api/internal/handler/handler.go:267`
- `services/data-services/query-api/internal/repository/repository.go:282`
- `services/data-services/audit-api/internal/handler/audit_handler.go:93`
- `services/data-services/export-api/internal/handler/export_handler.go:146`
- `services/control-plane/internal/backup/handler.go:42`

**风险说明**

- 错误回显会为攻击者提供字段名、查询结构、后端组件类型、路径与状态线索
- 在组合攻击中，这些细节会显著降低枚举与利用成本

**整改建议**

- 对外统一返回稳定错误码与用户可读消息，详细错误仅记录在服务端日志
- 对数据库、ES、文件系统、网络请求等错误建立分层映射
- 在日志中补齐 `trace_id`，避免为了排障再次扩大对外错误内容

### 5.12 `P1-7` 部署默认项偏弱

**现象**

多项服务连接数据库时默认使用 `sslmode=disable`；编排文件与部署文档中还存在开发态凭据、演示令牌、匿名管理能力和直接暴露的管理面入口。

**代码证据**

- `sslmode=disable` 默认值：
  - `services/api-service/cmd/api/main.go:58`
  - `services/data-services/query-api/cmd/api/main.go:49`
  - `services/data-services/audit-api/cmd/api/main.go:59`
  - `services/data-services/export-api/cmd/api/main.go:65`
- 编排中的开发态凭据 / token / 直接暴露入口：
  - `docker-compose.yml:16`
  - `docker-compose.yml:35`
  - `docker-compose.yml:54`
  - `docker-compose.yml:197`
  - `docker-compose.yml:209`
  - `docker-compose.yml:210`
  - `docker-compose.yml:244`
  - `docker-compose.yml:246`
  - `docker-compose.yml:269`
  - `docker-compose.yml:273`
  - `docker-compose.yml:600`
  - `docker-compose.yml:602`
  - `docker-compose.yml:603`
  - `docker-compose.yml:605`
  - `docker-compose.yml:606`
  - `docker-compose.yml:669`
- 部署文档中的默认入口提示：
  - `DEPLOYMENT.md:147`
  - `DEPLOYMENT.md:149`
  - `DEPLOYMENT.md:159`
  - `DEPLOYMENT.md:162`
  - `DEPLOYMENT.md:171`

**风险说明**

- 若数据库链路跨主机、跨网段或运行在不可信网络中，禁用 TLS 会暴露凭据与查询内容
- 匿名管理、默认口令、默认 token 与直接映射到宿主机的管理面会显著降低入侵门槛
- 运维文档若默认暴露这些入口，也会在部署复制过程中把开发态习惯带入更高环境

**整改建议**

- 生产环境数据库连接默认改为启用 TLS，并通过配置显式声明例外场景
- 从编排与示例文件中移除可直接使用的弱凭据，改为占位符与启动校验
- 收敛管理面端口，只保留必要出口并放在鉴权代理之后
- 为部署文档增加“仅限本地开发 / 禁止用于生产”的明显边界说明

### 5.13 `P2-1` 前端长期令牌存储与应急 mock 开关治理不足

**现象**

前端将 access token、refresh token 和认证态存储在 `localStorage` / `sessionStorage` 中，并存在本地 `emergency mock` 登录相关开关逻辑。

**代码证据**

- Web Storage 存储令牌：
  - `apps/frontend-console/src/utils/authStorage.ts:3`
  - `apps/frontend-console/src/utils/authStorage.ts:26`
  - `apps/frontend-console/src/utils/authStorage.ts:167`
  - `apps/frontend-console/src/utils/authStorage.ts:168`
  - `apps/frontend-console/src/stores/authStore.ts:58`
  - `apps/frontend-console/src/components/auth/ProtectedRoute.tsx:179`
- 应急 mock 登录开关：
  - `apps/frontend-console/src/components/auth/LoginForm.tsx:67`
  - `apps/frontend-console/src/components/auth/LoginForm.tsx:110`
  - `apps/frontend-console/src/components/auth/LoginForm.tsx:133`
  - `apps/frontend-console/src/components/auth/LoginForm.tsx:190`

**风险说明**

- 在发生 XSS 时，Web Storage 中的长期令牌更容易被直接窃取
- 应急 mock 若进入生产构建或可被错误开启，可能绕开真实认证路径
- 当后端又存在头部信任、默认密钥或弱鉴权问题时，前端令牌暴露造成的后果会被进一步放大

**整改建议**

- 优先评估改为 `HttpOnly + Secure + SameSite` Cookie 存储刷新态会话
- 对 mock 开关采用编译期剔除与多重环境守卫，禁止生产可达
- 同步补齐 CSP、依赖治理与前端 XSS 基线

---

## 6. 注入与加密审查结论

### 6.1 注入风险结论

- 在已抽查范围内，**未直接确认可利用的 SQL 注入点**
- `audit-api` 的动态排序字段有白名单约束，当前不构成直接 SQL 注入：
  - `services/data-services/audit-api/internal/repository/audit_repository.go:105`
  - `services/data-services/audit-api/internal/repository/audit_repository.go:207`
- 其他已抽查 SQL 路径主要通过占位符传参，暂未发现直接字符串拼接执行：
  - `services/data-services/query-api/internal/repository/metadata_repository.go:146`
  - `services/data-services/export-api/internal/repository/export_repository.go:70`
- **未直接确认 ES 原始 DSL 注入点**，查询体主要由服务端结构化组装后再 `json.Marshal`
- 但已直接确认更严重的问题：`query-api` / `export-api` 的 ES 查询**缺失不可绕过的租户过滤**，导致的是授权绕过与跨租户数据读取，而不是传统意义上的 DSL 注入

### 6.2 加密与凭证处理结论

- 密码散列采用 `bcrypt`，成本因子与实现方向整体合理：
  - `services/api-service/internal/service/auth_service.go:24`
  - `services/api-service/internal/service/auth_service.go:120`
  - `services/api-service/internal/service/auth_service.go:443`
  - `services/api-service/internal/service/auth_service.go:586`
- Refresh Token / Reset Token 使用高熵随机值并以 `SHA-256` 哈希存储，整体做法合理：
  - `services/api-service/internal/service/auth_service.go:717`
  - `services/api-service/internal/repository/auth_repository.go:247`
  - `services/api-service/internal/repository/auth_repository.go:374`
  - `services/api-service/internal/repository/auth_repository.go:572`
- 采集侧解密流程实现相对稳健：
  - `services/control-plane/internal/ingest/crypto/decrypt.go:67`
- 当前真正的短板不在密码哈希算法本身，而在**JWT 密钥管理、会话绑定、边界鉴权与敏感配置保护**

---

## 7. 建议整改路线图

### 7.1 第一阶段：立即修复（`P0`）

1. 关闭内部服务对宿主机的不必要端口暴露
2. 为 `control-plane`、数据服务和网关统一接入严格服务端鉴权
3. 删除默认租户回退，所有查询 / 统计 / 导出强制注入租户过滤
4. 将网关 JWT 校验改为严格验签、严格 `issuer/audience` 校验与租户一致性校验
5. 移除默认 JWT 密钥，并增加启动失败保护

### 7.2 第二阶段：短期修复（`P1`）

1. 对 `pull-sources`、通知测试发送等主动出网能力增加白名单与 SSRF 防护
2. 对通知渠道配置做脱敏、加密与最小返回
3. 将 logout 收口到认证主体下，并修复 session / `jti` 撤销闭环
4. 将登录失败锁定、限流与审计接入真实登录流程
5. 统一错误码，去除底层错误直出
6. 收敛编排中的弱配置、样例密钥与非 TLS 默认项

### 7.3 第三阶段：中期加固（`P2`）

1. 优化前端会话存储模型，减少长期令牌暴露面
2. 为前端构建、网关、认证服务和数据服务补齐安全自动化测试
3. 增加依赖漏洞扫描、镜像扫描、IaC 扫描与动态验证流程

---

## 8. 建议补充的验证用例

为避免“代码已改但风险未真正闭合”，建议后续补齐以下验证：

- 绕过网关直连 `control-plane`、`query-api`、`audit-api`、`export-api` 是否仍能访问
- 直接访问 `control-plane` 写接口并伪造 `X-Tenant-ID`、`X-User-ID` 是否会被拒绝
- 构造错误签名、空签名、错误 `issuer`、错误 `audience` 的 JWT 是否被网关拒绝
- 伪造未签名 JWT 访问 `/t/{other-tenant}/api/...` 是否被拒绝
- 省略租户头、伪造租户 ID、跨租户条件检索 / 统计 / 导出是否全部被拒绝
- 利用 `pull-sources` 与通知测试接口访问内网地址、回环地址、云元数据地址、明文 `http` 地址是否被阻断
- 向 logout 接口伪造 `X-User-ID` 是否无法撤销其他用户会话
- 用户注销、密码修改、refresh rotation、管理员踢出后，旧 access token 是否立即失效
- 连续登录失败是否触发锁定、限流、告警与审计记录
- 生产配置缺失 `JWT_SECRET` 或命中弱默认值时，服务是否拒绝启动

---

## 9. 结论

当前版本最需要优先处理的并不是单一编码细节，而是**身份真实性、多租户隔离、控制面访问控制、网关边界与默认配置安全性**。这些问题一旦被组合利用，可能产生比传统 SQL 注入更广的业务级破坏面，包括跨租户数据读取、伪造身份访问、任意会话撤销以及对内网资产的服务端探测。

建议将本文作为后续安全整改、测试验收与上线门禁的基线文档，先完成 `P0` 问题闭环，再推进 `P1` / `P2` 的系统性治理。
