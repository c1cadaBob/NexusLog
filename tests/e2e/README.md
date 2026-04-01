# NexusLog E2E Tests (Playwright)

本目录用于维护 NexusLog 前端端到端测试。

## 目录说明

- `playwright.config.js`: Playwright 主配置
- `tests/smoke.spec.js`: 基础用例模板

## 快速开始

```bash
cd tests/e2e
pnpm install
npx playwright install --with-deps chromium
E2E_BASE_URL=http://127.0.0.1:4173 pnpm test
```

或直接在仓库根目录执行统一入口：

```bash
make e2e-list
make e2e-list-regression
make e2e-list-debug
make e2e-list-full
make e2e-smoke
make e2e-regression
make e2e-debug
make e2e-full
```

默认会使用 `E2E_BASE_URL=http://127.0.0.1:3000` 与 `playwright.config.js`；如需切到系统 Chrome，可显式传入：

```bash
make e2e-list E2E_PLAYWRIGHT_CONFIG=playwright.chrome.config.js
make e2e-smoke E2E_PLAYWRIGHT_CONFIG=playwright.chrome.config.js
```

或直接使用单独的系统 Chrome 入口：

```bash
make e2e-list-chrome
make e2e-smoke-chrome
```

当前默认分组如下：

- `smoke`: `tests/smoke.spec.js`（2 条）
- `regression`: `tests/auth.spec.js`、`tests/dashboard-restored-verify.spec.js`、`tests/verify-fixed-pages.spec.js`（5 条）
- `debug`: `tests/dashboard-screenshot.spec.js`、`tests/ingestion-debug.spec.js`、`tests/search-audit-debug.spec.js`、`tests/tasks1-7-debug.spec.js`、`tests/week2-debug.spec.js`、`tests/week2-pages-debug.spec.js`、`tests/week3-pages-debug.spec.js`、`tests/week4-pages-debug.spec.js`（12 条）
- `full`: 以上全部 19 条

如需在无桌面环境里跑“有界面”模式，可直接使用：

```bash
make e2e-smoke-headed
make e2e-smoke-headed-chrome
make e2e-smoke-ci
```

> `E2E_BASE_URL` 默认为 `http://127.0.0.1:4173`，可按环境覆盖。
>
> `make e2e-smoke-ci` 会先构建前端，再通过 `vite preview` 启动静态站点并执行 smoke，默认显式关闭租户自动同步，适合作为 CI / 发布前门禁入口。
>
> 如目标环境的登录账号不是默认演示账号，可显式设置 `E2E_LOGIN_USERNAME` 与 `E2E_LOGIN_PASSWORD`；GitHub Actions 手动工作流 `Playwright Regression Suites` 也会透传这两个环境变量。
>
> `tests/auth.spec.js` 中的注册用例会在断言完成后自动清理自己创建的 `e2e_reg_*` 测试账号；如历史环境已残留 `e2e_login_* / e2e_reg_* / e2e_reset_*` 账号，可在仓库根目录执行 `scripts/cleanup-e2e-users.sh --dry-run` 或 `scripts/cleanup-e2e-users.sh --apply` 进行治理。
>
> Playwright 入口现在会先执行一次本地租户自校验：若未显式传入 `E2E_TENANT_ID`，会调用仓库根目录下的 `scripts/local/ensure-local-tenant-config.sh`，自动修正 `./.runtime/tenant/local-tenant-id` 与 `app-config.local.json` 的漂移问题，再把修正后的租户注入测试进程。
>
> 优先级如下：`E2E_TENANT_ID` > 自动同步结果 > `INGEST_DEFAULT_TENANT_ID` > `./.runtime/tenant/local-tenant-id`。
>
> 如需关闭这一步自动同步，可显式设置 `E2E_TENANT_AUTO_SYNC=false`。仓库内不再内置固定演示租户 UUID。
