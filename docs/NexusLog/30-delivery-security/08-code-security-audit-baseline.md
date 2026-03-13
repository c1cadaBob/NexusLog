# NexusLog 代码安全审计基线（第一轮静态审查）

## 1. 文档定位

本文基于仓库现有代码、网关脚本、服务配置与 `docker-compose.yml` 的静态审查结果整理，形成当前版本的安全审计基线。

- 审查日期：`2026-03-13`
- 审查方式：静态代码审阅 + 配置审阅 + 架构信任边界分析
- 审查范围：`gateway/openresty`、`services/api-service`、`services/control-plane`、`services/data-services/*`、`apps/frontend-console`、`docker-compose.yml`
- 未覆盖内容：动态渗透验证、依赖组件 CVE 扫描、主机基线扫描、云资源暴露面核查

> 结论应视为“第一轮代码安全基线”，用于指导整改优先级，不替代正式的渗透测试报告或上线安全测评报告。

---

## 2. 执行摘要

从当前代码状态看，NexusLog 已具备基础的认证、密码散列、多租户字段传递与部分加密能力，但仍存在数个可导致越权访问或租户隔离失效的高风险问题。

### 2.1 总体判断

- 最大风险不在单点 SQL 注入，而在**信任边界失效**与**多租户隔离不闭环**
- 若攻击者可绕过网关直连内部服务，或可伪造 / 篡改租户标识，请求有机会跨租户读取、检索或导出数据
- 当前网关 JWT 校验存在“验签失败后降级为仅解析 Claims”的危险行为，属于典型 **fail-open** 设计缺陷
- 认证链路还存在默认密钥、会话撤销不闭环、登录限流未接线等问题，导致凭证泄露后的控制能力不足
- 通知配置与测试发送接口同时带来**敏感信息泄露**与**服务端请求伪造（SSRF）** 风险

### 2.2 风险分布

- `P0`：4 组高风险问题，直接影响租户隔离、身份真实性与核心边界控制
- `P1`：5 组中风险问题，影响凭证撤销、密钥保密、错误暴露与部署安全
- `P2`：1 组低到中风险问题，主要集中在前端令牌存储与应急开关治理

### 2.3 优先级结论

建议先处置以下四类问题，再推进其余治理项：

1. 关闭或收敛内部服务直暴露端口，强制流量经过统一鉴权入口
2. 修复所有默认租户回退与缺失租户过滤的查询 / 统计 / 导出路径
3. 将网关 JWT 校验改为严格 `fail-close`，禁止任何“只解码不验签”路径进入业务
4. 移除默认 JWT 密钥与其他开发态弱配置

---

## 3. 风险分级标准

| 等级 | 定义 | 典型影响 | 建议时效 |
|---|---|---|---|
| `P0` | 可直接导致身份伪造、越权访问、跨租户数据泄露或核心边界失效 | 核心数据泄露、租户隔离失效、认证失效 | 立即修复 |
| `P1` | 暂不一定直接导致全面沦陷，但会显著放大攻击面或降低响应能力 | 凭证滥用、内部信息泄露、横向利用 | 短期修复 |
| `P2` | 安全成熟度与防御深度问题，需要纳入版本治理 | 安全韧性不足、依赖环境假设 | 中期修复 |

---

## 4. 问题总览

| 编号 | 等级 | 问题主题 | 主要影响 |
|---|---|---|---|
| `P0-1` | `P0` | 内部服务直暴露，网关信任边界可被绕过 | 可绕过统一鉴权直达业务服务 |
| `P0-2` | `P0` | 多租户隔离存在默认租户回退与缺失租户过滤 | 存在跨租户读取、统计、导出风险 |
| `P0-3` | `P0` | JWT 校验存在降级验签与弱鉴权分支 | 可伪造身份或伪造租户上下文 |
| `P0-4` | `P0` | 默认 JWT 密钥硬编码 | 开发态密钥可被利用伪造令牌 |
| `P1-1` | `P1` | 通知配置暴露敏感字段，测试发送接口可被滥用 | 凭据泄露、SSRF、内网探测 |
| `P1-2` | `P1` | Access Token 撤销链路不闭环 | 注销后令牌可能继续有效 |
| `P1-3` | `P1` | 登录锁定逻辑未接入实际登录流程 | 暴力破解防护不足 |
| `P1-4` | `P1` | 多处接口直接返回内部错误 | 暴露内部实现、SQL/ES/路径信息 |
| `P1-5` | `P1` | 部署默认项偏弱 | 明文开发凭据、数据库链路未强制 TLS |
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
- 这类问题会放大后续所有“默认租户回退”“缺失租户过滤”的破坏范围

**整改建议**

- 非必要服务取消宿主端口映射，仅保留网关对外暴露
- 服务间调用改为私网 + mTLS 或至少服务级共享签名认证
- 对所有内部 API 增加“来源校验 + 服务身份认证”，而不是只信任透传头
- 对接入层和服务层分别增加集成测试，验证“绕过网关直连”必须失败

### 5.2 `P0-2` 多租户隔离存在默认租户回退与缺失租户过滤

**现象**

代码中存在多处“租户为空则退回默认租户”的分支，且查询、统计、导出若未显式注入租户条件，则存在跨租户读取的可能。

**代码证据**

- 默认租户回退：
  - `services/data-services/query-api/internal/service/service.go:27`
  - `services/data-services/query-api/internal/service/service.go:612`
  - `services/data-services/audit-api/internal/handler/audit_handler.go:24`
  - `services/data-services/audit-api/internal/handler/audit_handler.go:107`
  - `services/data-services/export-api/internal/handler/export_handler.go:155`
  - `services/data-services/export-api/internal/handler/export_handler.go:163`
- `query-api` 搜索条件未携带租户字段：
  - `services/data-services/query-api/internal/repository/repository.go:31`
  - `services/data-services/query-api/internal/service/service.go:220`
  - `services/data-services/query-api/internal/repository/repository.go:440`
- `query-api` 统计在默认租户分支跳过租户过滤：
  - `services/data-services/query-api/internal/handler/stats_handler.go:25`
  - `services/data-services/query-api/internal/service/stats_service.go:375`
- `export-api` 导出查询未内建租户约束：
  - `services/data-services/export-api/internal/repository/es_export_repository.go:32`
  - `services/data-services/export-api/internal/repository/es_export_repository.go:182`

**风险说明**

- 攻击者可通过省略租户、构造默认租户、伪造头部或利用未过滤查询访问不属于自己的数据
- 该问题影响范围覆盖检索、统计与导出三个关键读路径，属于多租户平台中的核心隔离缺陷
- 如果与 `P0-1` 联动，破坏效果会从“逻辑缺陷”升级为“边界级数据泄露”

**整改建议**

- 彻底移除默认租户兜底逻辑，租户缺失即拒绝请求
- 在 service 层与 repository 层同时强制注入租户过滤条件，避免只在 handler 层传递
- 对 ES / SQL / 导出任务统一设计 `tenant_id` 必填约束对象
- 建立安全测试用例：空租户、伪造租户、跨租户导出、跨租户统计必须全部失败

### 5.3 `P0-3` JWT 校验存在降级验签与弱鉴权分支

**现象**

网关当前存在在 JWKS 获取失败时退化为“只校验格式 / Claims”的逻辑；另外，路径租户路由链路使用了更弱的 helper，仅解析 token payload 与 `exp`，未完成签名真实性验证，也未校验 token 中租户与路径租户的一致性。

**代码证据**

- JWKS 失败后降级解析 Claims：
  - `gateway/openresty/lua/auth_check.lua:152`
  - `gateway/openresty/lua/auth_check.lua:154`
  - `gateway/openresty/lua/auth_check.lua:229`
  - `gateway/openresty/lua/auth_check.lua:232`
- Claims 校验未严格校验 `issuer` / `audience`：
  - `gateway/openresty/lua/auth_check.lua:183`
- 路由入口接入弱 helper：
  - `gateway/openresty/nginx.conf:168`
  - `gateway/openresty/lua/auth_check_helper.lua:25`
  - `gateway/openresty/lua/auth_check_helper.lua:79`
- 租户路由未校验 token tenant 与 path/header tenant 一致性：
  - `gateway/openresty/lua/tenant_router.lua:25`
  - `gateway/openresty/lua/tenant_router.lua:33`
  - `gateway/openresty/lua/tenant_router.lua:203`

**风险说明**

- 该设计允许在上游密钥获取异常、配置失误或被动失败时进入“失败放行”状态
- 只要攻击者能构造带任意 claims 的伪 token，就可能伪装用户身份或租户身份
- 路径租户与 token 租户不一致时仍可能被继续路由，造成授权语义错位

**整改建议**

- JWT 校验必须改为严格 `fail-close`：JWKS 拉取失败、签名失败、发行方不符、受众不符时全部拒绝
- 删除或停用只做 payload 解码的 helper，统一走一个强校验实现
- 在网关强制比对 `token.tenant_id`、路径租户、头部租户三者一致性
- 为网关补齐单元测试与集成测试，覆盖签名篡改、过期 token、错误 issuer、错误 audience、错误租户等场景

### 5.4 `P0-4` 默认 JWT 密钥硬编码

**现象**

认证服务存在默认 JWT 密钥常量，且未在当前编排中确认强制覆盖。

**代码证据**

- `services/api-service/cmd/api/main.go:33`
- 审查期间未在 `docker-compose.yml` 中发现对 `JWT_SECRET` 的可靠覆盖

**风险说明**

- 默认密钥一旦进入测试、预发或生产环境，攻击者可离线伪造合法 token
- 该问题与 `P0-3` 叠加时，会显著降低身份伪造门槛

**整改建议**

- 禁止任何默认生产可用密钥存在于代码中
- 启动时若 `JWT_SECRET` 为空或命中弱值，则服务必须拒绝启动
- 使用密钥管理系统或至少使用环境变量 + 密钥轮换机制

### 5.5 `P1-1` 通知配置暴露敏感字段，测试发送接口可被滥用

**现象**

通知渠道的 `config` 在查询列表与详情接口中直接返回，配置内包含 SMTP、Webhook 等敏感字段；测试发送接口又会真实触发对外网络请求，形成 SSRF / 凭据泄露的复合风险。

**代码证据**

- 原始配置直接返回：
  - `services/control-plane/internal/notification/channel_repository.go:26`
  - `services/control-plane/internal/notification/channel_handler.go:127`
  - `services/control-plane/internal/notification/channel_handler.go:154`
- 敏感字段来源：
  - `services/control-plane/internal/notification/smtp_sender.go:17`
  - `services/control-plane/internal/notification/dingtalk_sender.go:19`
- 测试发送触发真实出网：
  - `services/control-plane/internal/notification/channel_handler.go:289`
  - `services/control-plane/internal/notification/channel_handler.go:342`
  - `services/control-plane/internal/notification/channel_handler.go:358`
- DingTalk Webhook 允许 `http`：
  - `services/control-plane/internal/notification/dingtalk_sender.go:70`

**风险说明**

- 管理端接口返回的配置若被越权访问，可能直接泄露 SMTP 凭据、Webhook 地址、签名材料
- 测试发送能力若缺少目标限制，可被用于探测内网地址、打外部目标或向攻击者控制域发请求
- 允许 `http` webhook 会导致中间人篡改与凭据泄露风险上升

**整改建议**

- 列表 / 详情接口仅返回脱敏字段，敏感配置分离存储并加密
- 测试发送能力增加目标白名单、协议限制、超时限制、审计日志与权限控制
- 禁止明文 `http` webhook，仅允许 `https`

### 5.6 `P1-2` Access Token 撤销链路不闭环

**现象**

JWT 中的 `jti` 与会话表记录的 `jti` 生成路径不一致，且认证中间件未强制检查 token 是否仍绑定有效会话。

**代码证据**

- JWT 生成 `jti`：`services/api-service/internal/service/auth_service.go:75`
- 会话表另存不同 `jti`：`services/api-service/internal/service/auth_service.go:533`
- 鉴权中间件未校验活动会话：`services/api-service/internal/handler/auth_middleware.go:48`

**风险说明**

- 用户退出登录、管理员撤销会话或密钥轮换后，已签发 access token 仍可能继续使用至过期
- 在凭据泄露场景下，缺少实时失效能力会明显扩大事件影响

**整改建议**

- 保证 token `jti` 与会话存储 `jti` 一致且可追踪
- 鉴权链路增加“是否为有效会话 / 是否被撤销”的检查
- 为注销、踢出、密码修改后失效增加自动化测试

### 5.7 `P1-3` 登录锁定逻辑未接入实际登录流程

**现象**

用户服务内存在失败锁定逻辑，但认证服务登录主流程未调用该能力。

**代码证据**

- 锁定逻辑存在：`services/api-service/internal/service/user_service.go:49`
- 登录流程未接线：`services/api-service/internal/service/auth_service.go:171`

**风险说明**

- 攻击者可持续尝试撞库 / 暴力破解，而不会触发预期的风控阻断
- 管理后台、默认账号或弱密码用户面临更高被猜解风险

**整改建议**

- 将失败计数、锁定窗口、解锁逻辑接入实际登录流程
- 对登录接口叠加 IP / 账号维度限流与告警
- 补充验证码或二次验证作为高风险场景兜底

### 5.8 `P1-4` 多处接口直接返回内部错误

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
- 在日志中补齐 trace id，避免为了排障再次扩大对外错误内容

### 5.9 `P1-5` 部署默认项偏弱

**现象**

多项服务连接数据库时默认使用 `sslmode=disable`；编排文件中还存在开发态凭据、演示令牌或示例配置留存。

**代码证据**

- `sslmode=disable` 默认值：
  - `services/api-service/cmd/api/main.go:58`
  - `services/data-services/query-api/cmd/api/main.go:49`
  - `services/data-services/audit-api/cmd/api/main.go:59`
  - `services/data-services/export-api/cmd/api/main.go:65`
- 编排中的开发态凭据 / token：
  - `docker-compose.yml:203`
  - `docker-compose.yml:246`
  - `docker-compose.yml:669`

**风险说明**

- 若数据库链路跨主机、跨网段或运行在不可信网络中，禁用 TLS 会暴露凭据与查询内容
- 演示口令、样例 token 一旦沿用，会成为最容易被利用的入口之一

**整改建议**

- 生产环境数据库连接默认改为启用 TLS，并通过配置显式声明例外场景
- 从编排与示例文件中移除可直接使用的弱凭据，改为占位符与启动校验
- 为配置中心、密钥注入与环境分层建立基线模板

### 5.10 `P2-1` 前端长期令牌存储与应急 mock 开关治理不足

**现象**

前端将令牌存储在 Web Storage 中，并存在应急 mock 登录相关开关逻辑。

**代码证据**

- Web Storage 存储令牌：
  - `apps/frontend-console/src/utils/authStorage.ts:26`
  - `apps/frontend-console/src/utils/authStorage.ts:45`
  - `apps/frontend-console/src/components/auth/ProtectedRoute.tsx:125`
- 应急 mock 登录开关：
  - `apps/frontend-console/src/components/auth/LoginForm.tsx:108`
  - `apps/frontend-console/src/components/auth/LoginForm.tsx:180`
  - `apps/frontend-console/src/components/auth/LoginForm.tsx:196`

**风险说明**

- 在发生 XSS 时，Web Storage 中的长期令牌更容易被直接窃取
- 应急 mock 若进入生产构建或可被错误开启，可能绕开真实认证路径

**整改建议**

- 优先评估改为 `HttpOnly + Secure + SameSite` Cookie 存储刷新态会话
- 对 mock 开关采用编译期剔除与多重环境守卫，禁止生产可达
- 同步补齐 CSP、依赖治理与前端 XSS 基线

---

## 6. 正向发现

以下内容说明项目并非完全缺失安全基础，后续整改可在现有能力上推进，而非推倒重来。

- 在已抽查范围内，**未确认到直接可利用的 SQL 注入点**
- `audit-api` 的动态排序字段有白名单约束：`services/data-services/audit-api/internal/repository/audit_repository.go:207`
- 密码散列采用 `bcrypt`，实现方向合理：`services/api-service/internal/service/auth_service.go:120`
- Refresh Token / Reset Token 使用哈希存储，优于明文落库：
  - `services/api-service/internal/service/auth_service.go:717`
  - `services/api-service/internal/repository/auth_repository.go:572`
- 采集侧解密流程实现相对稳健：`services/control-plane/internal/ingest/crypto/decrypt.go:67`

---

## 7. 建议整改路线图

### 7.1 第一阶段：立即修复（`P0`）

1. 关闭内部服务对宿主机的不必要端口暴露
2. 删除默认租户回退，所有查询 / 统计 / 导出强制注入租户过滤
3. 将网关 JWT 校验改为严格验签与严格 claims 校验
4. 移除默认 JWT 密钥，并增加启动失败保护

### 7.2 第二阶段：短期修复（`P1`）

1. 对通知渠道配置做脱敏、加密与 SSRF 约束
2. 完成 access token 与 session 的一致性校验与撤销闭环
3. 将登录失败锁定、限流与审计接入真实登录流程
4. 统一错误码，去除底层错误直出
5. 收敛编排中的弱配置、样例密钥与非 TLS 默认项

### 7.3 第三阶段：中期加固（`P2`）

1. 优化前端会话存储模型，减少长期令牌暴露面
2. 为前端构建、网关、数据服务补齐安全自动化测试
3. 增加依赖漏洞扫描、镜像扫描、IaC 扫描与动态验证流程

---

## 8. 建议补充的验证用例

为避免“代码已改但风险未真正闭合”，建议后续补齐以下验证：

- 绕过网关直连 `control-plane`、`query-api`、`audit-api`、`export-api` 是否仍能访问
- 构造错误签名、空签名、错误 `issuer`、错误 `audience` 的 JWT 是否被网关拒绝
- 省略 `X-Tenant-ID`、伪造租户 ID、跨租户条件检索 / 统计 / 导出是否被拒绝
- 利用通知测试发送接口访问内网地址、回环地址、明文 `http` 地址是否被阻断
- 用户注销、密码修改、管理员踢出后，旧 access token 是否立即失效
- 连续登录失败是否触发锁定、告警与审计记录

---

## 9. 结论

当前版本最需要优先处理的并不是单一编码细节，而是**身份真实性、多租户隔离、网关边界与默认配置安全性**。这些问题一旦被组合利用，可能产生比传统 SQL 注入更广的业务级破坏面。

建议将本文作为后续安全整改、测试验收与上线门禁的基线文档，先完成 `P0` 问题闭环，再推进 `P1` / `P2` 的系统性治理。