# 开发问题记录与解决方案

> 本文档用于记录 NexusLog 项目开发过程中遇到的问题、根因分析和修复方案。
> 每个问题按统一格式记录，目的是形成可检索的经验库，避免同类问题重复发生。

---

## 目录

- [ISSUE-001: admin 用户 403 权限拒绝 — user_roles 未分配](#issue-001-admin-用户-403-权限拒绝--user_roles-未分配)
- [ISSUE-002: Vite 代理在 Docker 容器内使用 localhost 导致 404](#issue-002-vite-代理在-docker-容器内使用-localhost-导致-404)
- [ISSUE-003: control-plane 容器运行旧镜像导致新 API 404](#issue-003-control-plane-容器运行旧镜像导致新-api-404)

---

## ISSUE-001: admin 用户 403 权限拒绝 — user_roles 未分配

| 属性 | 内容 |
|------|------|
| **发现时间** | 2026-03-06 |
| **发现阶段** | W4 前端功能验证 |
| **严重程度** | 高（阻塞所有 api-service 受保护接口） |
| **影响范围** | 用户管理、角色管理、/users/me 等所有需要 RBAC 权限的页面 |

### 现象

通过 `192.168.0.202:3000` 访问前端，登录成功后：

- 用户管理页面（`/#/security/users`）表格空白，加载动画不停
- 浏览器 Console 大量 `Failed to load resource: 403 (Forbidden)` 错误
- Network 面板显示 `/api/v1/users`、`/api/v1/roles`、`/api/v1/users/me` 全部返回 403
- 响应体：`{"code":"FORBIDDEN","message":"insufficient permissions"}`

### 误导点

- 日志检索（`/api/v1/query/logs`）和审计日志（`/api/v1/audit/logs`）页面正常（200），容易误判为"部分页面坏了"
- 实际上 `query-api` 和 `audit-api` 是独立服务，**没有 RBAC 中间件**，不受影响
- 问题仅出在 `api-service` 的受保护路由上

### 根因分析

1. `api-service` 的 `AuthRequired` 中间件验证 JWT 后，会调用 `userRepo.GetUserRoles()` 从数据库加载用户角色
2. `RequirePermission("users:read")` 中间件检查用户权限列表，如果为空则返回 403
3. **admin 用户在 `user_roles` 表中没有任何角色记录**

```sql
-- 验证命令
SELECT ur.user_id, ur.role_id, r.name, r.permissions
FROM user_roles ur JOIN roles r ON r.id = ur.role_id
WHERE ur.user_id = '8dd2a568-5bcd-46c6-b051-65f9cd7e8b7e';
-- 结果: (0 rows)
```

4. JWT Token 结构中只包含 `user_id` 和 `tenant_id`，**不包含 `role` 字段**（角色在请求时从 DB 动态查询）
5. 数据库中存在 `admin` 角色（权限为 `["*"]`），但没有关联到该用户

### 修复方案

```sql
INSERT INTO user_roles (user_id, role_id)
VALUES ('8dd2a568-5bcd-46c6-b051-65f9cd7e8b7e', '10000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;
```

修复后无需重启服务、无需重新登录，因为角色是每次请求时从 DB 动态查询的。

### 验证证据（chrome-devtools MCP）

| 证据类型 | 修复前 | 修复后 |
|----------|--------|--------|
| 目标 URL | `http://192.168.0.202:3000/#/security/users` | 同 |
| Console | 大量 `403 Forbidden` 错误 | 无错误 |
| Network | `/api/v1/users` 403, `/api/v1/roles` 403, `/api/v1/users/me` 403 | 全部 200 |
| 页面内容 | 空白表格 + 加载动画 | 正常显示 16 条用户记录 |

### 预防措施

1. **Seed 数据完整性检查**：在 `storage/postgresql/seed/` 中确保所有预置用户都有对应的 `user_roles` 关联记录
2. **注册流程增强**：用户注册时应自动分配默认角色（如 `viewer`），避免新用户无权限
3. **中间件友好提示**：`RequirePermission` 返回 403 时，在 `details` 中包含 `required_permission` 和 `user_roles`，便于调试
4. **E2E 测试覆盖**：添加 "登录后访问受保护页面" 的 E2E 用例，验证 RBAC 链路完整性

### 关联代码

| 文件 | 说明 |
|------|------|
| `services/api-service/internal/handler/auth_middleware.go` | `AuthRequired` + `RequirePermission` 中间件 |
| `services/api-service/internal/service/auth_service.go` | JWT Token 生成（不含 role） |
| `services/api-service/cmd/api/main.go` | 路由权限配置 |
| `services/api-service/internal/repository/user_repository.go` | `GetUserRoles` 查询 |

---

## ISSUE-002: Vite 代理在 Docker 容器内使用 localhost 导致 404

| 属性 | 内容 |
|------|------|
| **发现时间** | 2026-03-05 |
| **发现阶段** | W4 前端集成调试 |
| **严重程度** | 高（audit-api 和 export-api 前端页面全部 404） |
| **影响范围** | 审计日志、下载记录页面 |

### 现象

- 审计日志页面（`/#/security/audit`）和下载记录页面（`/#/reports/downloads`）API 返回 404
- Network 面板显示 `/api/v1/audit/logs` 和 `/api/v1/export/jobs` 请求被发送到了 `api-service:8080`，而非正确的 `audit-api:8083` / `export-api:8084`

### 根因分析

1. `vite.config.ts` 中新增了 `/api/v1/audit` 和 `/api/v1/export` 代理规则，但默认回退到 `localhost:8083` / `localhost:8084`
2. Vite dev server 运行在 Docker 容器内，容器内的 `localhost` 指的是容器自身，**不是宿主机或其他 Docker 服务**
3. 需要通过 Docker 服务名（如 `http://audit-api:8083`）访问其他容器

### 修复方案

**vite.config.ts** — 新增环境变量支持：

```typescript
const auditProxyTarget = process.env.VITE_DEV_AUDIT_PROXY_TARGET || 'http://localhost:8083'
const exportProxyTarget = process.env.VITE_DEV_EXPORT_PROXY_TARGET || 'http://localhost:8084'
```

**docker-compose.override.yml** — 为前端容器注入正确的代理目标：

```yaml
environment:
  - VITE_DEV_AUDIT_PROXY_TARGET=http://audit-api:8083
  - VITE_DEV_EXPORT_PROXY_TARGET=http://export-api:8084
```

### 预防措施

1. **统一代理模式**：所有新增的后端服务代理都必须同时在 `vite.config.ts` 和 `docker-compose.override.yml` 中配置
2. **代理规则顺序**：Vite proxy 按配置顺序匹配，更具体的路径（如 `/api/v1/audit`）必须放在通用路径（`/api`）之前
3. **检查清单**：每次新增微服务时，按以下清单操作：
   - [ ] `vite.config.ts` 添加代理规则 + 环境变量
   - [ ] `docker-compose.override.yml` 添加 `VITE_DEV_*_PROXY_TARGET` 环境变量
   - [ ] 验证容器内代理能正确连通目标服务

---

## ISSUE-003: control-plane 容器运行旧镜像导致新 API 404

| 属性 | 内容 |
|------|------|
| **发现时间** | 2026-03-05 |
| **发现阶段** | W3 前端功能验证 |
| **严重程度** | 高（W3 所有新增 API 不可用） |
| **影响范围** | 事件管理、资源监控、资源阈值等 W3 新增接口 |

### 现象

- 事件列表（`/api/v1/incidents`）、资源指标（`/api/v1/metrics`）、资源阈值（`/api/v1/resource/thresholds`）全部 404
- 这些接口的代码已写好并通过编译，但运行中的 `control-plane` 容器是旧版本

### 根因分析

1. 后端代码修改后，Docker 容器仍在运行旧的构建镜像
2. Go 服务在 Docker 中是编译后运行的二进制文件，代码修改不会自动生效
3. 需要重新构建并重启容器

### 修复方案

```bash
export MIRROR_DOCKER_HUB=docker.io
export MIRROR_ELASTIC=docker.elastic.co
docker compose build control-plane
docker compose up -d control-plane
```

### 预防措施

1. **修改后端代码后必须重新构建容器**：Go 服务不像前端有 HMR，每次修改都需要 `docker compose build <service> && docker compose up -d <service>`
2. **验证流程**：代码修改 → 构建 → 重启 → 验证 API（用 `curl` 或 MCP 工具）
3. **容器日志检查**：通过 `docker compose logs <service> --tail=20` 确认新路由已注册

---

## ISSUE-004: collector-agent 与 control-plane 网络隔离导致日志无法自动拉取

| 属性 | 内容 |
|------|------|
| **发现时间** | 2026-03-06 |
| **发现阶段** | 采集 Agent 本地部署与测试 |
| **严重程度** | 高（端到端日志采集链路完全断开） |
| **影响范围** | 所有依赖 control-plane 自动拉取的日志采集源 |

### 现象

- control-plane 日志显示每 30 秒创建拉取任务（`ingest scheduler created task`），但无拉取结果日志
- Agent Pull API 通过宿主机 `curl localhost:9091` 可正常访问
- ES 中没有新采集的 v2 结构化日志数据
- Agent 容器日志中没有来自 control-plane 的 HTTP 请求记录

### 根因分析

1. `docker-compose.yml` 中所有核心服务（control-plane、api-service、elasticsearch 等）配置了 `networks: [nexuslog-net]`
2. `docker-compose.override.yml` 中 `collector-agent` 和 `collector-agent-remote` **没有配置网络**
3. Docker Compose 的行为：未指定 network 的服务会被分配到自动生成的 `default` 网络
4. 结果：`control-plane`（172.29.x, nexuslog-net）与 `collector-agent`（172.30.x, default）在不同网络上，DNS 解析失败

```bash
# 验证命令
docker inspect nexuslog-control-plane-1 --format '{{range $net, $conf := .NetworkSettings.Networks}}{{$net}}{{end}}'
# 输出: nexuslog_nexuslog-net

docker inspect nexuslog-collector-agent-1 --format '{{range $net, $conf := .NetworkSettings.Networks}}{{$net}}{{end}}'
# 输出: nexuslog_default  ← 不在同一网络！
```

### 修复方案

在 `docker-compose.override.yml` 中为两个 Agent 服务添加网络配置：

```yaml
collector-agent:
  # ...existing config...
  networks:
    - nexuslog-net

collector-agent-remote:
  # ...existing config...
  networks:
    - nexuslog-net
```

修复后重启：`docker compose up -d collector-agent collector-agent-remote`

### 验证证据（chrome-devtools MCP）

| 证据类型 | 修复前 | 修复后 |
|----------|--------|--------|
| 目标 URL | `http://192.168.0.202:3000/#/search/realtime` | 同 |
| Console | 无错误但无数据 | 无错误 |
| Network | `/api/v1/query/logs` 200 但结果 0 条 | 200 且显示 5 条 E2E 测试日志 |
| ES 数据 | 搜索"E2E验证日志"返回 0 条 | 返回 5 条，含 v2 结构化字段（如 `@timestamp` / `message` / `event.id` / `log.level` / `service.name` / `nexuslog.*`） |

### 预防措施

1. **网络配置统一规则**：在 `docker-compose.override.yml` 中定义的所有服务，如果需要与主 compose 文件中的服务通信，**必须显式加入 `nexuslog-net` 网络**
2. **新服务接入检查清单**：
   - [ ] 确认目标网络配置
   - [ ] 从依赖服务容器内 `curl` 测试连通性
   - [ ] 验证 DNS 解析（`nslookup <service-name>` 或 `getent hosts <service-name>`）
3. **CI/CD 网络验证**：在 compose 启动后添加自动化网络连通性检查脚本
4. **日志结构验收**：网络恢复后，除检查日志条数外，还应确认写入的是 v2 结构化字段，而不是旧扁平字段

### 关联代码

| 文件 | 说明 |
|------|------|
| `docker-compose.yml` L446-448 | `nexuslog-net` 网络定义 |
| `docker-compose.override.yml` L212-244 | collector-agent 服务定义（已修复） |
| `docker-compose.override.yml` L246-296 | collector-agent-remote 服务定义（已修复） |

---

## 问题记录模板

新增问题时请使用以下模板：

```markdown
## ISSUE-XXX: [简短标题]

| 属性 | 内容 |
|------|------|
| **发现时间** | YYYY-MM-DD |
| **发现阶段** | 哪个阶段/任务 |
| **严重程度** | 高/中/低 |
| **影响范围** | 受影响的模块/页面 |

### 现象

[用户/测试人员看到了什么？包括页面行为、Console 错误、Network 状态码]

### 根因分析

[技术根因，逐层深入分析]

### 修复方案

[具体的修复步骤和代码/命令]

### 验证证据

[使用 chrome-devtools MCP 的四类证据：目标 URL、Console、Network、可复现步骤]

### 预防措施

[如何避免同类问题再次发生]

### 关联代码

[相关文件路径]
```

---

## 问题分类索引

| 分类 | 问题编号 | 简述 |
|------|----------|------|
| RBAC/权限 | ISSUE-001 | user_roles 未分配导致 403 |
| Docker/网络 | ISSUE-002 | 容器内 localhost 代理目标错误 |
| Docker/构建 | ISSUE-003 | 旧镜像未重建导致 API 404 |
| Docker/网络 | ISSUE-004 | Agent 与 control-plane 网络隔离，日志无法自动拉取 |
