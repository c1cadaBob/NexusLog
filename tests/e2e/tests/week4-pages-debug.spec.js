/**
 * Week 4 页面调试：Dashboard、下载记录、备份恢复、聚合分析、审计日志、静默策略
 *
 * 运行: E2E_BASE_URL=http://localhost:3000 npx playwright test week4-pages-debug.spec.js --retries=0
 */
const { test } = require("@playwright/test");

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";
const TENANT_ID = process.env.E2E_TENANT_ID || "00000000-0000-0000-0000-000000000001";

const MOCK_INDICATORS = ["mock", "Mock", "演示数据", "fake", "Fake", "假数据", "测试数据"];

function hasMockIndicator(text) {
  if (!text) return false;
  return MOCK_INDICATORS.some((m) => text.includes(m));
}

test.describe("Week 4 页面调试", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((tenantId) => {
      window.localStorage.clear();
      window.localStorage.setItem("nexuslog-tenant-id", tenantId);
    }, TENANT_ID);
  });

  test("完整调试流程：6 个页面", async ({ page }) => {
    const consoleErrors = [];
    const failedRequests = [];
    const apiCalls = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    page.on("requestfailed", (req) => {
      failedRequests.push({
        url: req.url(),
        failure: req.failure()?.errorText || "unknown",
      });
    });

    page.on("request", (req) => {
      const url = req.url();
      if (url.includes("/api/") && !url.includes("favicon")) {
        apiCalls.push({ url: url.split("?")[0], method: req.method() });
      }
    });

    // 1. 登录
    await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

    const isLoginPage =
      (await page.locator('input[id="login-username"], input[name="username"]').count()) > 0;

    if (isLoginPage) {
      await page.locator("#login-username").fill("sys-superadmin");
      await page.getByPlaceholder("请输入密码").fill("Demo@2026");
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(3500);
    }

    const report = [];

    // 2. Dashboard
    await page.goto(`${BASE_URL}/#/`);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);

    const dashBody = await page.textContent("body").catch(() => "");
    const dashEmpty = (await page.locator(".ant-empty").count()) > 0;
    const dashChart = (await page.locator("canvas, [class*='echarts']").count()) > 0;
    const dashSpin = (await page.locator(".ant-spin-spinning").count()) > 0;
    const dashErrorMsg = (await page.locator(".ant-message-error").count()) > 0;
    const dashRefreshBtn = (await page.locator('button:has([class*="reload"]), button:has-text("刷新")').count()) > 0;

    await page.screenshot({ path: "test-results/w4-01-dashboard.png", fullPage: true });

    report.push({
      page: "Dashboard",
      url: "/",
      consoleErrors: [...consoleErrors],
      empty: dashEmpty,
      hasChart: dashChart,
      loading: dashSpin,
      errorMsg: dashErrorMsg,
      hasRefreshBtn: dashRefreshBtn,
      mockGone: !hasMockIndicator(dashBody),
    });

    // 3. 下载记录
    await page.goto(`${BASE_URL}/#/reports/downloads`);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);

    const downloadBody = await page.textContent("body").catch(() => "");
    const downloadEmpty = (await page.locator(".ant-empty").count()) > 0;
    const downloadTable = (await page.locator(".ant-table-tbody, [class*='table']").count()) > 0;
    const downloadSpin = (await page.locator(".ant-spin-spinning").count()) > 0;
    const downloadErrorMsg = (await page.locator(".ant-message-error").count()) > 0;
    const downloadCreateBtn = (await page.locator('button:has-text("新建导出"), button:has-text("新建")').count()) > 0;

    await page.screenshot({ path: "test-results/w4-02-download-records.png", fullPage: true });

    report.push({
      page: "下载记录 DownloadRecords",
      url: "/reports/downloads",
      consoleErrors: [...consoleErrors],
      empty: downloadEmpty,
      table: downloadTable,
      loading: downloadSpin,
      errorMsg: downloadErrorMsg,
      hasCreateBtn: downloadCreateBtn,
      mockGone: !hasMockIndicator(downloadBody),
    });

    // 4. 备份恢复
    await page.goto(`${BASE_URL}/#/storage/backup`);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);

    const backupBody = await page.textContent("body").catch(() => "");
    const backupEmpty = (await page.locator(".ant-empty").count()) > 0;
    const backupTable = (await page.locator(".ant-table-tbody").count()) > 0;
    const backupSpin = (await page.locator(".ant-spin-spinning").count()) > 0;
    const backupErrorMsg = (await page.locator(".ant-message-error").count()) > 0;

    await page.screenshot({ path: "test-results/w4-03-backup-recovery.png", fullPage: true });

    report.push({
      page: "备份恢复 BackupRecovery",
      url: "/storage/backup",
      consoleErrors: [...consoleErrors],
      empty: backupEmpty,
      table: backupTable,
      loading: backupSpin,
      errorMsg: backupErrorMsg,
      mockGone: !hasMockIndicator(backupBody),
    });

    // 5. 聚合分析
    await page.goto(`${BASE_URL}/#/analysis/aggregate`);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);

    const aggBody = await page.textContent("body").catch(() => "");
    const aggEmpty = (await page.locator(".ant-empty").count()) > 0;
    const aggChart = (await page.locator("canvas, [class*='echarts']").count()) > 0;
    const aggSelect = (await page.locator(".ant-select").count()) > 0;
    const aggSpin = (await page.locator(".ant-spin-spinning").count()) > 0;
    const aggErrorMsg = (await page.locator(".ant-message-error").count()) > 0;

    await page.screenshot({ path: "test-results/w4-04-aggregate-analysis.png", fullPage: true });

    report.push({
      page: "聚合分析 AggregateAnalysis",
      url: "/analysis/aggregate",
      consoleErrors: [...consoleErrors],
      empty: aggEmpty,
      hasChart: aggChart,
      hasDimensionSelect: aggSelect,
      loading: aggSpin,
      errorMsg: aggErrorMsg,
      mockGone: !hasMockIndicator(aggBody),
    });

    // 6. 审计日志
    await page.goto(`${BASE_URL}/#/security/audit`);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);

    const auditBody = await page.textContent("body").catch(() => "");
    const auditEmpty = (await page.locator(".ant-empty").count()) > 0;
    const auditTable = (await page.locator(".ant-table-tbody").count()) > 0;
    const auditSpin = (await page.locator(".ant-spin-spinning").count()) > 0;
    const auditErrorMsg = (await page.locator(".ant-message-error").count()) > 0;
    const auditFilter = (await page.locator(".ant-select, .ant-picker").count()) > 0;

    await page.screenshot({ path: "test-results/w4-05-audit-logs.png", fullPage: true });

    report.push({
      page: "审计日志 AuditLogs",
      url: "/security/audit",
      consoleErrors: [...consoleErrors],
      empty: auditEmpty,
      table: auditTable,
      loading: auditSpin,
      errorMsg: auditErrorMsg,
      hasFilter: auditFilter,
      mockGone: !hasMockIndicator(auditBody),
    });

    // 7. 静默策略
    await page.goto(`${BASE_URL}/#/alerts/silence`);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);

    const silenceBody = await page.textContent("body").catch(() => "");
    const silenceEmpty = (await page.locator(".ant-empty").count()) > 0;
    const silenceTable = (await page.locator(".ant-table-tbody").count()) > 0;
    const silenceSpin = (await page.locator(".ant-spin-spinning").count()) > 0;
    const silenceErrorMsg = (await page.locator(".ant-message-error").count()) > 0;
    const silenceCreateBtn = (await page.locator('button:has-text("新建"), button:has-text("添加")').count()) > 0;

    await page.screenshot({ path: "test-results/w4-06-silence-policy.png", fullPage: true });

    report.push({
      page: "静默策略 SilencePolicy",
      url: "/alerts/silence",
      consoleErrors: [...consoleErrors],
      empty: silenceEmpty,
      table: silenceTable,
      loading: silenceSpin,
      errorMsg: silenceErrorMsg,
      hasCreateBtn: silenceCreateBtn,
      mockGone: !hasMockIndicator(silenceBody),
    });

    // 输出报告
    console.log("\n========== Week 4 页面调试报告 ==========\n");

    report.forEach((r) => {
      console.log(`\n--- ${r.page} (${r.url}) ---`);
      console.log("URL:", BASE_URL + "/#" + (r.url === "/" ? "" : r.url.slice(1)));
      console.log("Console 错误:", r.consoleErrors?.length > 0 ? r.consoleErrors : "无");
      console.log("Empty 状态:", r.empty ? "可见" : "不可见");
      if (r.table !== undefined) console.log("数据表格:", r.table ? "可见" : "不可见");
      if (r.hasChart !== undefined) console.log("图表:", r.hasChart ? "可见" : "不可见");
      if (r.hasDimensionSelect !== undefined) console.log("维度选择器:", r.hasDimensionSelect ? "可见" : "不可见");
      if (r.hasFilter !== undefined) console.log("筛选器:", r.hasFilter ? "可见" : "不可见");
      if (r.hasRefreshBtn !== undefined) console.log("刷新按钮:", r.hasRefreshBtn ? "可见" : "不可见");
      if (r.hasCreateBtn !== undefined) console.log("新建按钮:", r.hasCreateBtn ? "可见" : "不可见");
      console.log("Loading:", r.loading ? "可见" : "不可见");
      console.log("API 错误弹窗:", r.errorMsg ? "可见" : "不可见");
      console.log("Mock 已清除:", r.mockGone ? "是" : "否");
    });

    console.log("\n========== 网络失败请求 ==========");
    failedRequests.forEach((r) => console.log(r.url, "->", r.failure));

    console.log("\n========== API 调用摘要 ==========");
    const uniqueApis = [...new Set(apiCalls.map((a) => a.method + " " + a.url))];
    uniqueApis.slice(0, 50).forEach((u) => console.log(u));
  });
});
