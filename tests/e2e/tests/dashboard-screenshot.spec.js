/**
 * Dashboard 首页截图
 * 运行: E2E_BASE_URL=http://localhost:3000 npx playwright test dashboard-screenshot.spec.js --retries=0
 */
const { test } = require("@playwright/test");

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";
const TENANT_ID = process.env.E2E_TENANT_ID || "00000000-0000-0000-0000-000000000001";

test("Dashboard 全页截图", async ({ page }) => {
  await page.addInitScript((tenantId) => {
    window.localStorage.clear();
    window.localStorage.setItem("nexuslog-tenant-id", tenantId);
  }, TENANT_ID);

  await page.goto(BASE_URL);
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

  const isLoginPage =
    (await page.locator('input[id="login-username"], input[name="username"]').count()) > 0;

  if (isLoginPage) {
    await page.locator("#login-username").fill("demo-admin");
    await page.getByPlaceholder("请输入密码").fill("Demo@2026");
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(4000);
  }

  await page.goto(`${BASE_URL}/#/`);
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);

  await page.screenshot({ path: "test-results/dashboard-full.png", fullPage: true });
});
