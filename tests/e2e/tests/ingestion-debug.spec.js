/**
 * SourceManagement & AgentManagement 调试脚本 (W1-F3, W1-F4)
 *
 * 运行: E2E_BASE_URL=http://localhost:3000 npx playwright test ingestion-debug.spec.js
 */
const { test, expect } = require("@playwright/test");

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";
const TENANT_ID = process.env.E2E_TENANT_ID || "00000000-0000-0000-0000-000000000001";

test.describe("SourceManagement & AgentManagement 调试 - W1-F3 & W1-F4", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((tenantId) => {
      window.localStorage.clear();
      window.localStorage.setItem("nexuslog-tenant-id", tenantId);
    }, TENANT_ID);
  });

  test("完整调试流程：登录 -> 采集源管理 -> Agent 管理", async ({ page }) => {
    const consoleLogs = [];
    const consoleErrors = [];
    const failedRequests = [];
    const apiRequests = [];

    page.on("console", (msg) => {
      const text = msg.text();
      if (msg.type() === "error") {
        consoleErrors.push(text);
      }
      consoleLogs.push(`[${msg.type()}] ${text}`);
    });

    page.on("requestfailed", (req) => {
      failedRequests.push({
        url: req.url(),
        failure: req.failure()?.errorText || "unknown",
      });
    });

    page.on("request", (req) => {
      const url = req.url();
      if (url.includes("/api/") || url.includes("ingest") || url.includes("pull-sources")) {
        apiRequests.push({ url, method: req.method() });
      }
    });

    // 1. 导航并登录
    await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

    const isLoginPage =
      (await page.locator('input[id="login-username"], input[name="username"]').count()) > 0;

    if (isLoginPage) {
      await page.locator("#login-username").fill("sys-superadmin");
      await page.getByPlaceholder("请输入密码").fill("Demo@2026");
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(3000);
    }

    // 2. 采集源管理页面
    await page.goto(`${BASE_URL}/#/ingestion/sources`);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: "test-results/ingestion-01-sources.png",
      fullPage: true,
    });

    // 检查 pull-sources 请求
    const pullSourcesCalls = apiRequests.filter((r) => r.url.includes("pull-sources"));
    console.log("pull-sources API 调用:", JSON.stringify(pullSourcesCalls, null, 2));

    // 检查是否有 mock 数据特征（如硬编码的假数据）
    const sourcesPageText = await page.textContent("body");
    const hasMockIndicators =
      sourcesPageText?.includes("mock") ||
      sourcesPageText?.includes("Mock") ||
      sourcesPageText?.includes("演示数据") ||
      sourcesPageText?.includes("fake");

    // 检查 Empty 或表格
    const emptyEl = page.locator(".ant-empty");
    const tableEl = page.locator(".ant-table-tbody");
    const spinEl = page.locator(".ant-spin-spinning");
    const hasEmpty = (await emptyEl.count()) > 0;
    const hasTable = (await tableEl.count()) > 0;
    const hadSpin = (await spinEl.count()) > 0;

    // 3. Agent 管理页面
    await page.goto(`${BASE_URL}/#/ingestion/agents`);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: "test-results/ingestion-02-agents.png",
      fullPage: true,
    });

    // 再次检查 API 调用（agents 也调用 pull-sources）
    const allPullCalls = apiRequests.filter((r) => r.url.includes("pull-sources"));
    console.log("总 pull-sources 调用数:", allPullCalls.length);

    // 检查 message.error 是否可能被触发（需要 API 失败，此处仅验证页面结构）
    const messageError = page.locator(".ant-message-error");
    const hasErrorMsg = (await messageError.count()) > 0;

    // 输出报告
    console.log("\n=== Console Errors ===");
    consoleErrors.forEach((e) => console.log(e));
    console.log("\n=== Failed Network Requests ===");
    failedRequests.forEach((r) => console.log(r.url, r.failure));
    console.log("\n=== API Requests (ingest/pull-sources) ===");
    apiRequests.filter((r) => r.url.includes("ingest") || r.url.includes("pull-sources")).forEach((r) => console.log(r.method, r.url));

    // 断言：页面正常、无 mock、有 API 调用
    expect(consoleErrors.length).toBe(0);
    expect(hasMockIndicators).toBe(false);
    expect(allPullCalls.length).toBeGreaterThanOrEqual(1);
  });

  test("API 失败时显示 message.error", async ({ page }) => {
    // 拦截 pull-sources 请求并返回 500
    await page.route("**/api/v1/ingest/pull-sources**", (route) => {
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "INTERNAL_ERROR", message: "模拟 API 失败" }) });
    });

    await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

    const isLoginPage = (await page.locator('input[id="login-username"]').count()) > 0;
    if (isLoginPage) {
      await page.locator("#login-username").fill("sys-superadmin");
      await page.getByPlaceholder("请输入密码").fill("Demo@2026");
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(3000);
    }

    await page.goto(`${BASE_URL}/#/ingestion/sources`);
    await page.waitForTimeout(3000);

    // 检查是否出现 ant-message-error（错误提示）
    const errorMsg = page.locator(".ant-message-error");
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: "test-results/ingestion-03-error-handling.png", fullPage: false });
  });
});
