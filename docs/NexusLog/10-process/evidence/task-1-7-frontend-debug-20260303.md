# 任务 1~7 前端联调证据（2026-03-03）

## 1. 范围与结论

- 范围：`10-current-project-tasks.md` 中任务 `1~7`，按“前端页面可观测行为”进行联调验证。
- 结论：在当前环境下，任务 `1~7` 的前端可验证链路已跑通；认证、受保护路由、ingest 代理、agent 代理均符合预期。
- 说明：当前 Codex 会话未加载 `puppeteer-debugger-mcp`，因此浏览器联调使用 Playwright 等价执行并留存证据。

## 2. 环境说明

- 日期：2026-03-03
- 前端：本机 `vite dev`，`http://127.0.0.1:3000`
- API（认证）：本机 `services/api-service`，`http://127.0.0.1:8080`
- Control Plane（ingest）：本机 `services/control-plane`，`http://127.0.0.1:18080`
- Agent（pull API）：本机 `agents/collector-agent`，`http://127.0.0.1:9091`
- 存储依赖：rootless Docker 运行 `postgres/redis/elasticsearch`
- 数据库迁移：`make db-migrate-up` -> 版本 `16`
- 租户初始化：插入 `obs.tenant(id='00000000-0000-0000-0000-000000000001', status='active')`

## 3. 任务逐项证据

### 任务 1：迁移真相源与演练（前端侧联调前置）

- 执行：
  - `export DB_DSN='postgres://nexuslog:nexuslog_dev@127.0.0.1:5432/nexuslog?sslmode=disable'`
  - `make db-migrate-up`
  - `make db-migrate-version`
- 结果：迁移到 `16`，无失败。

### 任务 2：认证最小闭环 API

- 通过前端代理验证（`http://127.0.0.1:3000/api/v1/auth/*`）：
  - `POST /auth/register` -> `201`
  - `POST /auth/login` -> `200`
  - `POST /auth/password/reset-request` -> `200`
  - `POST /auth/password/reset-confirm`（invalid token）-> `400`
- 响应样例（节选）：
  - register: `{"code":"OK","data":{"user_id":"...","username":"debug_..."}}`
  - login: `{"code":"OK","data":{"access_token":"...","refresh_token":"...","expires_in":900}}`
  - reset-confirm invalid: `{"code":"AUTH_RESET_CONFIRM_INVALID_TOKEN","message":"reset token invalid or expired"}`

### 任务 3：前端认证主路径

- 执行 Playwright 认证与路由守卫用例（页面级）：
  - `tests/e2e/tests/auth.spec.js`
  - `tests/e2e/tests/tasks1-7-debug.spec.js`
- 覆盖：注册、登录、忘记密码、未登录访问受保护页重定向、token 过期清理并跳转登录。
- 结果：全部通过。

### 任务 4：路由与白名单一致性（前端可观察项）

- 前端路由行为：`/#/forgot-password` 可访问，受保护路由在未认证时跳转 `/#/login`。
- 鉴权失败体（可观察）：
  - `GET /agent/v1/meta`（无 key）-> `401`，`{"code":"AUTH_MISSING_TOKEN","message":"unauthorized"}`

### 任务 5：M1 测试门禁（前端链路部分）

- 自动化执行：
  - `E2E_BASE_URL=http://127.0.0.1:3000 E2E_TENANT_ID=00000000-0000-0000-0000-000000000001 npx playwright test tests/auth.spec.js tests/tasks1-7-debug.spec.js --reporter=html`
- 结果：`7 passed`
- 报告：`tests/e2e/playwright-report/index.html`

### 任务 6：接入控制面接口（前端页面代理验证）

- 页面上下文请求：`GET /api/v1/ingest/pull-sources`
- 结果：`200`
- 响应样例：
  - `{"code":"OK","data":{"items":[]},"meta":{"page":1,"page_size":20,"total":0,"has_next":false}}`

### 任务 7：Agent 主动拉取最小主路径（前端页面代理验证）

- 页面上下文请求：`GET /agent/v1/meta`
  - 无鉴权头 -> `401`（`AUTH_MISSING_TOKEN`）
  - 带 `X-Agent-Key: dev-agent-key` + `X-Key-Id: active` -> `200`
- 响应样例（成功）：
  - `{"agent_id":"collector-agent-local","version":"0.1.0","status":"online","capabilities":["file_incremental","pull_api","ack_checkpoint"]}`

## 4. MCP 状态说明

- `list_mcp_resources` 返回空。
- `list_mcp_resources(server='puppeteer-debugger-mcp')` 返回 `unknown MCP server`。
- 因此本次采用 Playwright 作为浏览器联调替代手段；待 MCP server 在会话层成功挂载后可补跑同一组用例。

## 5. 相关变更与脚本

- 新增用例：`tests/e2e/tests/tasks1-7-debug.spec.js`
- 代理增强：`apps/frontend-console/vite.config.ts`
- 容器联调变量：`docker-compose.override.yml`
