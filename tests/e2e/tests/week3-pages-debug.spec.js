/**
 * Week 3 页面调试：事件管理 + 性能监控
 *
 * 运行: E2E_BASE_URL=http://localhost:3000 npx playwright test week3-pages-debug.spec.js --retries=0
 */
const { test } = require("@playwright/test");

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";
const TENANT_ID = process.env.E2E_TENANT_ID || "00000000-0000-0000-0000-000000000001";

const MOCK_INDICATORS = ["mock", "Mock", "演示数据", "fake", "Fake", "假数据", "测试数据"];

function hasMockIndicator(text) {
  if (!text) return false;
  return MOCK_INDICATORS.some((m) => text.includes(m));
}

test.describe("Week 3 页面调试 - 事件管理 & 性能监控", () => {
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
      await page.locator("#login-username").fill("demo-admin");
      await page.getByPlaceholder("请输入密码").fill("Demo@2026");
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(3500);
    }

    const report = [];

    // 2. 事件列表
    await page.goto(`${BASE_URL}/#/incidents/list`);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);

    const listBody = await page.textContent("body").catch(() => "");
    const listEmpty = (await page.locator(".ant-empty").count()) > 0;
    const listTable = (await page.locator(".ant-table-tbody").count()) > 0;
    const listSpin = (await page.locator(".ant-spin-spinning").count()) > 0;
    const listErrorMsg = (await page.locator(".ant-message-error").count()) > 0;

    await page.screenshot({ path: "test-results/w3-01-incident-list.png", fullPage: true });

    report.push({
      page: "事件列表 IncidentList",
      url: "/incidents/list",
      consoleErrors: [...consoleErrors],
      empty: listEmpty,
      table: listTable,
      loading: listSpin,
      errorMsg: listErrorMsg,
      mockGone: !hasMockIndicator(listBody),
    });

    // 3. 事件详情（如果有事件行则点击第一条）
    const firstRow = page.locator(".ant-table-tbody tr:not(.ant-table-measure-row)").first();
    if ((await firstRow.count()) > 0) {
      await firstRow.click({ timeout: 5000 });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: "test-results/w3-02-incident-detail.png", fullPage: true });
      report.push({
        page: "事件详情 IncidentDetail",
        url: page.url(),
        visited: true,
      });
      await page.goto(`${BASE_URL}/#/incidents/list`);
      await page.waitForTimeout(1000);
    } else {
      report.push({
        page: "事件详情 IncidentDetail",
        url: "/incidents/detail/:id",
        visited: false,
        reason: "无事件数据，跳过",
      });
    }

    // 4. 事件时间线
    await page.goto(`${BASE_URL}/#/incidents/timeline`);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);

    const timelineBody = await page.textContent("body").catch(() => "");
    const timelineEmpty = (await page.locator(".ant-empty").count()) > 0;
    const timelineContent = (await page.locator(".ant-timeline, [class*='timeline']").count()) > 0;
    const timelineSpin = (await page.locator(".ant-spin-spinning").count()) > 0;
    const timelineErrorMsg = (await page.locator(".ant-message-error").count()) > 0;

    await page.screenshot({ path: "test-results/w3-03-incident-timeline.png", fullPage: true });

    report.push({
      page: "事件时间线 IncidentTimeline",
      url: "/incidents/timeline",
      consoleErrors: [...consoleErrors],
      empty: timelineEmpty,
      hasTimeline: timelineContent,
      loading: timelineSpin,
      errorMsg: timelineErrorMsg,
      mockGone: !hasMockIndicator(timelineBody),
    });

    // 5. 事件归档
    await page.goto(`${BASE_URL}/#/incidents/archive`);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);

    const archiveBody = await page.textContent("body").catch(() => "");
    const archiveEmpty = (await page.locator(".ant-empty").count()) > 0;
    const archiveTable = (await page.locator(".ant-table-tbody").count()) > 0;
    const archiveSpin = (await page.locator(".ant-spin-spinning").count()) > 0;
    const archiveErrorMsg = (await page.locator(".ant-message-error").count()) > 0;

    await page.screenshot({ path: "test-results/w3-04-incident-archive.png", fullPage: true });

    report.push({
      page: "事件归档 IncidentArchive",
      url: "/incidents/archive",
      consoleErrors: [...consoleErrors],
      empty: archiveEmpty,
      table: archiveTable,
      loading: archiveSpin,
      errorMsg: archiveErrorMsg,
      mockGone: !hasMockIndicator(archiveBody),
    });

    // 6. 性能监控
    await page.goto(`${BASE_URL}/#/performance/monitoring`);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);

    const perfBody = await page.textContent("body").catch(() => "");
    const perfEmpty = (await page.locator(".ant-empty").count()) > 0;
    const perfChart = (await page.locator("canvas, [class*='echarts'], [class*='chart']").count()) > 0;
    const perfSpin = (await page.locator(".ant-spin-spinning").count()) > 0;
    const perfErrorMsg = (await page.locator(".ant-message-error").count()) > 0;

    await page.screenshot({ path: "test-results/w3-05-performance-monitoring.png", fullPage: true });

    report.push({
      page: "性能监控 PerformanceMonitoring",
      url: "/performance/monitoring",
      consoleErrors: [...consoleErrors],
      empty: perfEmpty,
      hasChart: perfChart,
      loading: perfSpin,
      errorMsg: perfErrorMsg,
      mockGone: !hasMockIndicator(perfBody),
    });

    // 7. 健康检查
    await page.goto(`${BASE_URL}/#/performance/health`);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);

    const healthBody = await page.textContent("body").catch(() => "");
    const healthEmpty = (await page.locator(".ant-empty").count()) > 0;
    const healthTable = (await page.locator(".ant-table-tbody").count()) > 0;
    const healthSpin = (await page.locator(".ant-spin-spinning").count()) > 0;
    const healthErrorMsg = (await page.locator(".ant-message-error").count()) > 0;

    await page.screenshot({ path: "test-results/w3-06-health-check.png", fullPage: true });

    report.push({
      page: "健康检查 HealthCheck",
      url: "/performance/health",
      consoleErrors: [...consoleErrors],
      empty: healthEmpty,
      table: healthTable,
      loading: healthSpin,
      errorMsg: healthErrorMsg,
      mockGone: !hasMockIndicator(healthBody),
    });

    // 输出报告
    console.log("\n========== Week 3 页面调试报告 ==========\n");

    report.forEach((r) => {
      console.log(`\n--- ${r.page} (${r.url}) ---`);
      if (r.visited !== undefined) {
        console.log("已访问:", r.visited, r.reason || "");
      } else {
        console.log("URL:", BASE_URL + "/#" + r.url);
        console.log("Console 错误:", r.consoleErrors?.length > 0 ? r.consoleErrors : "无");
        console.log("Empty 状态:", r.empty ? "可见" : "不可见");
        if (r.table !== undefined) console.log("数据表格:", r.table ? "可见" : "不可见");
        if (r.hasTimeline !== undefined) console.log("时间线:", r.hasTimeline ? "可见" : "不可见");
        if (r.hasChart !== undefined) console.log("图表:", r.hasChart ? "可见" : "不可见");
        console.log("Loading:", r.loading ? "可见" : "不可见");
        console.log("API 错误弹窗:", r.errorMsg ? "可见" : "不可见");
        console.log("Mock 已清除:", r.mockGone ? "是" : "否");
      }
    });

    console.log("\n========== 网络失败请求 ==========");
    failedRequests.forEach((r) => console.log(r.url, "->", r.failure));

    console.log("\n========== API 调用摘要 ==========");
    const uniqueApis = [...new Set(apiCalls.map((a) => a.method + " " + a.url))];
    uniqueApis.slice(0, 40).forEach((u) => console.log(u));
  });
});
