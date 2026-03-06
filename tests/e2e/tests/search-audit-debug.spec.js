/**
 * 日志检索 + 安全审计 页面调试
 *
 * 运行: E2E_BASE_URL=http://localhost:3000 npx playwright test search-audit-debug.spec.js --retries=0
 */
const { test } = require("@playwright/test");

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";
const TENANT_ID = process.env.E2E_TENANT_ID || "00000000-0000-0000-0000-000000000001";

test.describe("日志检索 & 安全审计 调试", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((tenantId) => {
      window.localStorage.clear();
      window.localStorage.setItem("nexuslog-tenant-id", tenantId);
    }, TENANT_ID);
  });

  test("完整调试：日志检索 + 搜索操作 + 审计日志", async ({ page }) => {
    const consoleLogs = [];
    const consoleErrors = [];
    const failedRequests = [];
    const apiResponses = [];

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
        method: req.method(),
        failure: req.failure()?.errorText || "unknown",
      });
    });

    page.on("response", async (res) => {
      const url = res.url();
      if (url.includes("/api/") && !url.includes("favicon")) {
        const status = res.status();
        let bodyPreview = "";
        try {
          const ct = res.headers()["content-type"] || "";
          if (ct.includes("json")) {
            const json = await res.json().catch(() => null);
            bodyPreview = json ? JSON.stringify(json).slice(0, 300) : "(parse failed)";
          } else {
            bodyPreview = "(non-json)";
          }
        } catch {
          bodyPreview = "(read failed)";
        }
        apiResponses.push({
          url: url.split("?")[0],
          method: res.request().method(),
          status,
          bodyPreview,
        });
      }
    });

    // 1. 登录
    await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

    const isLoginPage =
      (await page.locator('input[id="login-username"], input[name="username"]').count()) > 0;

    if (isLoginPage) {
      await page.locator("#login-username").fill("demo-admin");
      await page.getByPlaceholder("请输入密码").fill("Demo@2026");
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(3500);
    }

    // ========== 2. 日志检索页面 ==========
    await page.goto(`${BASE_URL}/#/search/realtime`);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);

    await page.screenshot({ path: "test-results/debug-01-search-initial.png", fullPage: true });

    const searchInitialBody = await page.textContent("body").catch(() => "");
    const searchEmpty = (await page.locator(".ant-empty").count()) > 0;
    const searchTable = (await page.locator(".ant-table-tbody").count()) > 0;
    const searchErrorMsg = (await page.locator(".ant-message-error").count()) > 0;

    // ========== 3. 执行搜索操作 ==========
    const searchInput = page.locator('#realtime-query-input, input[placeholder*="查询"]').first();
    await searchInput.fill("error");
    await page.waitForTimeout(500);
    await page.locator('button:has([class*="play"]), button:has-text("执行")').first().click();
    await page.waitForTimeout(4000);

    await page.screenshot({ path: "test-results/debug-02-search-after-query.png", fullPage: true });

    const searchAfterEmpty = (await page.locator(".ant-empty").count()) > 0;
    const searchAfterTable = (await page.locator(".ant-table-tbody").count()) > 0;
    const searchAfterErrorMsg = (await page.locator(".ant-message-error").count()) > 0;
    const searchResultCount = await page.locator('span:has-text("共"), span:has-text("条")').first().textContent().catch(() => "");

    // ========== 4. 审计日志页面 ==========
    await page.goto(`${BASE_URL}/#/security/audit`);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(4000);

    await page.screenshot({ path: "test-results/debug-03-audit-page.png", fullPage: true });

    const auditBody = await page.textContent("body").catch(() => "");
    const auditEmpty = (await page.locator(".ant-empty").count()) > 0;
    const auditTable = (await page.locator(".ant-table-tbody").count()) > 0;
    const auditSpin = (await page.locator(".ant-spin-spinning").count()) > 0;
    const auditErrorMsg = (await page.locator(".ant-message-error").count()) > 0;

    // ========== 输出报告 ==========
    console.log("\n========== 日志检索 & 安全审计 调试报告 ==========\n");

    console.log("--- 1. 日志检索页面 (/#/search/realtime) ---");
    console.log("目标 URL:", BASE_URL + "/#/search/realtime");
    console.log("页面渲染: 初始 Empty:", searchEmpty, "| 表格:", searchTable, "| 错误弹窗:", searchErrorMsg);
    console.log("");

    console.log("--- 2. 搜索操作 (关键词: error) ---");
    console.log("搜索后 Empty:", searchAfterEmpty, "| 表格:", searchAfterTable, "| 错误弹窗:", searchAfterErrorMsg);
    console.log("结果摘要:", searchResultCount || "(未获取)");
    console.log("");

    console.log("--- 3. 审计日志页面 (/#/security/audit) ---");
    console.log("目标 URL:", BASE_URL + "/#/security/audit");
    console.log("页面渲染: Empty:", auditEmpty, "| 表格:", auditTable, "| Loading:", auditSpin, "| 错误弹窗:", auditErrorMsg);
    console.log("");

    console.log("========== Console 错误 ==========");
    consoleErrors.forEach((e) => console.log(e));
    if (consoleErrors.length === 0) console.log("(无)");

    console.log("\n========== Console 警告 (部分) ==========");
    const warnings = consoleLogs.filter((l) => l.startsWith("[warning]"));
    warnings.slice(0, 10).forEach((w) => console.log(w));

    console.log("\n========== 网络失败请求 ==========");
    failedRequests.forEach((r) => console.log(r.method, r.url, "->", r.failure));
    if (failedRequests.length === 0) console.log("(无)");

    console.log("\n========== API 请求与响应 ==========");
    apiResponses.forEach((r) => {
      const statusStr = r.status >= 400 ? `[${r.status}]` : `[${r.status}]`;
      console.log(r.method, r.url, statusStr);
      if (r.status >= 400 || r.bodyPreview) {
        console.log("  响应摘要:", r.bodyPreview.slice(0, 200));
      }
    });

    console.log("\n========== 可复现步骤 ==========");
    console.log("1. 打开", BASE_URL);
    console.log("2. 使用 demo-admin / Demo@2026 登录");
    console.log("3. 侧边栏 日志检索 -> 实时检索，或直接访问", BASE_URL + "/#/search/realtime");
    console.log("4. 输入 error，点击执行");
    console.log("5. 侧边栏 安全与审计 -> 审计日志，或直接访问", BASE_URL + "/#/security/audit");
  });
});
