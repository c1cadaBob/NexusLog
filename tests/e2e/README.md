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

> `E2E_BASE_URL` 默认为 `http://127.0.0.1:4173`，可按环境覆盖。
>
> `E2E_TENANT_ID` 建议显式传入；若未传入，测试会依次尝试读取 `INGEST_DEFAULT_TENANT_ID` 与仓库根目录下的 `./.runtime/tenant/local-tenant-id`。仓库内不再内置固定演示租户 UUID。
