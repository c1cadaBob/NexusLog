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
make e2e-smoke
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

如需在无桌面环境里跑“有界面”模式，可直接使用：

```bash
make e2e-smoke-headed
make e2e-smoke-headed-chrome
```

> `E2E_BASE_URL` 默认为 `http://127.0.0.1:4173`，可按环境覆盖。
>
> Playwright 入口现在会先执行一次本地租户自校验：若未显式传入 `E2E_TENANT_ID`，会调用仓库根目录下的 `scripts/local/ensure-local-tenant-config.sh`，自动修正 `./.runtime/tenant/local-tenant-id` 与 `app-config.local.json` 的漂移问题，再把修正后的租户注入测试进程。
>
> 优先级如下：`E2E_TENANT_ID` > 自动同步结果 > `INGEST_DEFAULT_TENANT_ID` > `./.runtime/tenant/local-tenant-id`。
>
> 如需关闭这一步自动同步，可显式设置 `E2E_TENANT_AUTO_SYNC=false`。仓库内不再内置固定演示租户 UUID。
