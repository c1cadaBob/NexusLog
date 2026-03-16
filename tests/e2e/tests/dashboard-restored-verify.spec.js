/**
 * 验证 Dashboard 已恢复当前真实状态，并将关键模块作为回归门禁。
 * 运行: E2E_BASE_URL=http://localhost:3000 npx playwright test dashboard-restored-verify.spec.js --retries=0
 */
const { test, expect } = require("@playwright/test");

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";
const { resolveE2ETenantId } = require("./support/runtimeTenant");
const { E2E_LOGIN_USERNAME } = require("./support/runtimeUser");
const { resolveRuntimeAuthSession } = require("./support/runtimeAuthSession");

const TENANT_ID = resolveE2ETenantId();
const AUTH_SESSION = resolveRuntimeAuthSession({ tenantId: TENANT_ID, username: E2E_LOGIN_USERNAME });

test("Dashboard 原始状态验证", async ({ page }) => {
  const consoleErrors = [];

  page.on("console", (msg) => {
    if (msg.type() !== "error") {
      return;
    }

    const text = msg.text();
    if (text.includes("net::ERR_NETWORK_CHANGED")) {
      return;
    }

    consoleErrors.push(text);
  });

  await page.addInitScript((session) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("nexuslog-tenant-id", session.tenantId);
    window.sessionStorage.setItem("nexuslog-auth-storage-scope", "session");
    window.sessionStorage.setItem("nexuslog-access-token", session.accessToken);
    window.sessionStorage.setItem("nexuslog-refresh-token", session.refreshToken);
    window.sessionStorage.setItem("nexuslog-token-expires-at", String(session.expiresAtMs));
    window.sessionStorage.setItem(
      "nexuslog-auth",
      JSON.stringify({
        state: {
          isAuthenticated: true,
          user: {
            id: session.userId,
            username: session.username,
            email: session.email,
            role: session.role,
          },
        },
        version: 0,
      }),
    );
  }, AUTH_SESSION);

  const overviewResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" && response.url().includes("/api/v1/query/stats/overview"),
    { timeout: 15000 },
  );
  const metricsResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" && response.url().includes("/api/v1/metrics/overview"),
    { timeout: 15000 },
  );
  const auditResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" && response.url().includes("/api/v1/audit/logs"),
    { timeout: 15000 },
  );

  const [overviewResponse, metricsResponse, auditResponse] = await Promise.all([
    overviewResponsePromise,
    metricsResponsePromise,
    auditResponsePromise,
    page.goto(`${BASE_URL}/#/`, { waitUntil: "domcontentloaded" }),
  ]);

  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);

  await page.screenshot({ path: "test-results/dashboard-restored.png", fullPage: true });

  expect(overviewResponse.status()).toBe(200);
  expect(metricsResponse.status()).toBe(200);
  expect(auditResponse.status()).toBe(200);
  expect(consoleErrors).toEqual([]);

  const kpiCount = await page.locator(".ant-statistic").count();
  expect.soft(kpiCount, "应至少渲染 6 个 KPI 卡片").toBeGreaterThanOrEqual(6);

  await expect.soft(page.getByText(/最后更新:/)).toBeVisible();
  await expect.soft(page.getByRole("combobox")).toBeVisible();
  await expect.soft(page.getByRole("button", { name: /刷新/ })).toBeVisible();

  await expect.soft(page.getByText("总日志量", { exact: true })).toBeVisible();
  await expect.soft(page.getByText("错误率", { exact: true })).toBeVisible();
  await expect.soft(page.getByText("告警中", { exact: true })).toBeVisible();
  await expect.soft(page.getByText("已解决告警", { exact: true })).toBeVisible();
  await expect.soft(page.getByText("活跃来源", { exact: true })).toBeVisible();
  await expect.soft(page.getByText("级别覆盖", { exact: true })).toBeVisible();

  await expect.soft(page.getByText("系统基础设施监控")).toBeVisible();
  await expect.soft(page.getByText("平均 CPU 使用率")).toBeVisible();
  await expect.soft(page.getByText("平均内存使用率")).toBeVisible();
  await expect.soft(page.getByText("平均磁盘使用率")).toBeVisible();
  await expect.soft(page.getByText("最近窗口入站")).toBeVisible();
  await expect.soft(page.getByText("最近窗口出站")).toBeVisible();
  await expect.soft(page.getByText("累计入站")).toBeVisible();
  await expect.soft(page.getByText("累计出站")).toBeVisible();

  await expect.soft(page.getByText("日志量趋势")).toBeVisible();
  await expect.soft(page.getByText("活跃主机 / 服务 Top 5")).toBeVisible();
  await expect.soft(page.getByText("主机名").first()).toBeVisible();
  await expect.soft(page.getByText("服务名").first()).toBeVisible();

  await expect.soft(page.getByText("新建采集源").first()).toBeVisible();
  await expect.soft(page.getByText("新建告警规则")).toBeVisible();
  await expect.soft(page.getByText("创建索引")).toBeVisible();
  await expect.soft(page.getByText("生成报表")).toBeVisible();
  await expect.soft(page.getByText("最近审计活动")).toBeVisible();

  console.log("\n========== Dashboard 原始状态验证 ==========");
  console.log("URL:", `${BASE_URL}/#/`);
  console.log("overview status:", overviewResponse.status());
  console.log("metrics status:", metricsResponse.status());
  console.log("audit status:", auditResponse.status());
  console.log("kpi count:", kpiCount);
  console.log("console errors:", consoleErrors.length);

  if (test.info().errors.length > 0) {
    throw new Error(`dashboard assertions failed: ${test.info().errors.length}`);
  }
});
