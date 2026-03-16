/**
 * 验证 Dashboard 已恢复原始状态
 * 运行: E2E_BASE_URL=http://localhost:3000 npx playwright test dashboard-restored-verify.spec.js --retries=0
 */
const { test } = require("@playwright/test");

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";
const { resolveE2ETenantId } = require("./support/runtimeTenant");
const { E2E_LOGIN_USERNAME, E2E_LOGIN_PASSWORD } = require("./support/runtimeUser");

const TENANT_ID = resolveE2ETenantId();

test("Dashboard 原始状态验证", async ({ page }) => {
  await page.addInitScript((tenantId) => {
    window.localStorage.clear();
    window.localStorage.setItem("nexuslog-tenant-id", tenantId);
  }, TENANT_ID);

  await page.goto(BASE_URL);
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

  const isLoginPage =
    (await page.locator('input[id="login-username"], input[name="username"]').count()) > 0;

  if (isLoginPage) {
    await page.locator("#login-username").fill(E2E_LOGIN_USERNAME);
    await page.getByPlaceholder("请输入密码").fill(E2E_LOGIN_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(4000);
  }

  await page.goto(`${BASE_URL}/#/`);
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3500);

  await page.screenshot({ path: "test-results/dashboard-restored.png", fullPage: true });

  const body = await page.textContent("body").catch(() => "");

  const checks = {
    refreshControl: body?.includes("最后更新") && body?.includes("刷新"),
    refreshIntervalSelect: (await page.locator(".ant-select").first().count()) > 0,
    kpiCards: (await page.locator(".ant-statistic").count()) >= 6,
    storageBar: body?.includes("热") && body?.includes("温") && body?.includes("冷"),
    infraMonitor: body?.includes("系统基础设施监控") || body?.includes("Infrastructure"),
    cpuLoad: body?.includes("CPU Load") || body?.includes("负载"),
    memory: body?.includes("内存") || body?.includes("Memory"),
    connections: body?.includes("连接数") || body?.includes("传输连接"),
    bandwidth: body?.includes("带宽") || body?.includes("流量统计"),
    logTrend: body?.includes("日志量趋势"),
    abnormalServiceTop5: body?.includes("异常服务排行") && body?.includes("Top 5"),
    quickActionCollect: body?.includes("新建采集源"),
    quickActionAlert: body?.includes("新建告警规则"),
    quickActionIndex: body?.includes("创建索引"),
    quickActionReport: body?.includes("生成报表"),
    auditActivity: body?.includes("最近审计活动"),
  };

  console.log("\n========== Dashboard 原始状态验证 ==========\n");
  Object.entries(checks).forEach(([k, v]) => {
    console.log(`${k}: ${v ? "✓" : "✗"}`);
  });
  const allPass = Object.values(checks).every(Boolean);
  console.log("\n全部通过:", allPass ? "是" : "否");
});
