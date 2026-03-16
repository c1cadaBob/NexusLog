/**
 * 验证修复后的页面：审计日志、实时检索、下载记录
 *
 * 运行: E2E_BASE_URL=http://localhost:3000 npx playwright test verify-fixed-pages.spec.js --retries=0
 */
const { test } = require("@playwright/test");

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";
const { resolveE2ETenantId } = require("./support/runtimeTenant");
const { E2E_LOGIN_USERNAME, E2E_LOGIN_PASSWORD } = require("./support/runtimeUser");

const TENANT_ID = resolveE2ETenantId();

test.describe("验证修复后的页面", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((tenantId) => {
      window.localStorage.clear();
      window.localStorage.setItem("nexuslog-tenant-id", tenantId);
    }, TENANT_ID);
  });

  test("审计日志 + 实时检索 + 下载记录", async ({ page }) => {
    const consoleErrors = [];
    const apiResponses = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
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
            bodyPreview = json ? JSON.stringify(json).slice(0, 400) : "(parse failed)";
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
      await page.locator("#login-username").fill(E2E_LOGIN_USERNAME);
      await page.getByPlaceholder("请输入密码").fill(E2E_LOGIN_PASSWORD);
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(3500);
    }

    const report = { audit: {}, search: {}, download: {} };

    // ========== 2. 审计日志 ==========
    await page.goto(`${BASE_URL}/#/security/audit`);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3500);

    const auditApi = apiResponses.find((r) => r.url.includes("/audit/logs"));
    const auditErrorMsg = (await page.locator(".ant-message-error").count()) > 0;
    const auditTable = (await page.locator(".ant-table-tbody").count()) > 0;
    const auditFilter = (await page.locator(".ant-select, .ant-picker").count()) > 0;

    await page.screenshot({ path: "test-results/verify-01-audit.png", fullPage: true });

    report.audit = {
      url: BASE_URL + "/#/security/audit",
      apiStatus: auditApi?.status ?? "no-call",
      apiUrl: auditApi?.url ?? "-",
      tableVisible: auditTable,
      filterVisible: auditFilter,
      errorPopup: auditErrorMsg,
      consoleErrors: [...consoleErrors],
    };

    // ========== 3. 实时检索 ==========
    await page.goto(`${BASE_URL}/#/search/realtime`);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const searchInput = page.locator('#realtime-query-input, input[placeholder*="查询"]').first();
    await searchInput.fill("error");
    await page.locator('button:has([class*="play"]), button:has-text("执行")').first().click();
    await page.waitForTimeout(4000);

    const searchApi = apiResponses.filter((r) => r.url.includes("/query/logs"));
    const lastSearchApi = searchApi[searchApi.length - 1];
    const searchErrorMsg = (await page.locator(".ant-message-error").count()) > 0;
    const searchResultText = await page.locator('span:has-text("共"), span:has-text("条")').first().textContent().catch(() => "");

    await page.screenshot({ path: "test-results/verify-02-search.png", fullPage: true });

    report.search = {
      url: BASE_URL + "/#/search/realtime",
      apiStatus: lastSearchApi?.status ?? "no-call",
      apiUrl: lastSearchApi?.url ?? "-",
      resultSummary: searchResultText || "(未获取)",
      errorPopup: searchErrorMsg,
      consoleErrors: [...consoleErrors],
    };

    // ========== 4. 下载记录 ==========
    await page.goto(`${BASE_URL}/#/reports/downloads`);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3500);

    const exportApi = apiResponses.find((r) => r.url.includes("/export/jobs"));
    const downloadErrorMsg = (await page.locator(".ant-message-error").count()) > 0;
    const downloadTable = (await page.locator(".ant-table-tbody").count()) > 0;
    const downloadEmpty = (await page.locator(".ant-empty").count()) > 0;

    await page.screenshot({ path: "test-results/verify-03-downloads.png", fullPage: true });

    report.download = {
      url: BASE_URL + "/#/reports/downloads",
      apiStatus: exportApi?.status ?? "no-call",
      apiUrl: exportApi?.url ?? "-",
      tableVisible: downloadTable,
      emptyVisible: downloadEmpty,
      errorPopup: downloadErrorMsg,
      consoleErrors: [...consoleErrors],
    };

    // ========== 输出报告 ==========
    console.log("\n========== 修复验证报告 ==========\n");

    console.log("--- 1. 审计日志 ---");
    console.log("URL:", report.audit.url);
    console.log("API:", report.audit.apiUrl);
    console.log("API 状态码:", report.audit.apiStatus);
    console.log("表格可见:", report.audit.tableVisible);
    console.log("筛选器可见:", report.audit.filterVisible);
    console.log("错误弹窗:", report.audit.errorPopup);
    console.log("");

    console.log("--- 2. 实时检索 ---");
    console.log("URL:", report.search.url);
    console.log("API:", report.search.apiUrl);
    console.log("API 状态码:", report.search.apiStatus);
    console.log("结果摘要:", report.search.resultSummary);
    console.log("错误弹窗:", report.search.errorPopup);
    console.log("");

    console.log("--- 3. 下载记录 ---");
    console.log("URL:", report.download.url);
    console.log("API:", report.download.apiUrl);
    console.log("API 状态码:", report.download.apiStatus);
    console.log("表格可见:", report.download.tableVisible);
    console.log("Empty 可见:", report.download.emptyVisible);
    console.log("错误弹窗:", report.download.errorPopup);
    console.log("");

    console.log("========== Console 错误 ==========");
    const uniqueErrors = [...new Set(consoleErrors)];
    uniqueErrors.forEach((e) => console.log(e));
    if (uniqueErrors.length === 0) console.log("(无)");

    console.log("\n========== 关键 API 响应 ==========");
    [auditApi, lastSearchApi, exportApi].filter(Boolean).forEach((r) => {
      if (r) {
        console.log(r.method, r.url, "[", r.status, "]");
        if (r.status >= 400 || r.bodyPreview?.includes("code")) {
          console.log("  摘要:", r.bodyPreview?.slice(0, 200));
        }
      }
    });
  });
});
