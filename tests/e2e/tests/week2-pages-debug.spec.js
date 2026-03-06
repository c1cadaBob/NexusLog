/**
 * Week 2 页面调试：User Management, Role Permissions, Alert Rules, Alert List, Notification Config, Menu Permissions
 *
 * 运行: E2E_BASE_URL=http://localhost:3000 npx playwright test week2-pages-debug.spec.js --retries=0
 */
const { test } = require("@playwright/test");

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";
const TENANT_ID = process.env.E2E_TENANT_ID || "00000000-0000-0000-0000-000000000001";

const MOCK_INDICATORS = ["mock", "Mock", "演示数据", "fake", "Fake", "假数据", "测试数据"];

function hasMockIndicator(text) {
  if (!text) return false;
  return MOCK_INDICATORS.some((m) => text.includes(m));
}

test.describe("Week 2 页面调试", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((tenantId) => {
      window.localStorage.clear();
      window.localStorage.setItem("nexuslog-tenant-id", tenantId);
    }, TENANT_ID);
  });

  test("完整调试流程：6 个页面 + 菜单权限", async ({ page }) => {
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

    // 2. User Management
    await page.goto(`${BASE_URL}/#/security/users`);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);

    const usersBody = await page.textContent("body").catch(() => "");
    const usersEmpty = (await page.locator(".ant-empty").count()) > 0;
    const usersTable = (await page.locator(".ant-table-tbody").count()) > 0;
    const usersSpin = (await page.locator(".ant-spin-spinning").count()) > 0;
    const usersErrorMsg = (await page.locator(".ant-message-error").count()) > 0;

    await page.screenshot({ path: "test-results/w2-01-users.png", fullPage: true });

    report.push({
      page: "User Management",
      url: "/security/users",
      consoleErrors: [...consoleErrors],
      empty: usersEmpty,
      table: usersTable,
      loading: usersSpin,
      errorMsg: usersErrorMsg,
      mockGone: !hasMockIndicator(usersBody),
    });

    // 3. Role Permissions
    await page.goto(`${BASE_URL}/#/security/roles`);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);

    const rolesBody = await page.textContent("body").catch(() => "");
    const rolesEmpty = (await page.locator(".ant-empty").count()) > 0;
    const rolesTable = (await page.locator(".ant-table-tbody").count()) > 0;
    const rolesSpin = (await page.locator(".ant-spin-spinning").count()) > 0;
    const rolesErrorMsg = (await page.locator(".ant-message-error").count()) > 0;

    await page.screenshot({ path: "test-results/w2-02-roles.png", fullPage: true });

    report.push({
      page: "Role Permissions",
      url: "/security/roles",
      consoleErrors: [...consoleErrors],
      empty: rolesEmpty,
      table: rolesTable,
      loading: rolesSpin,
      errorMsg: rolesErrorMsg,
      mockGone: !hasMockIndicator(rolesBody),
    });

    // 4. Alert Rules
    await page.goto(`${BASE_URL}/#/alerts/rules`);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);

    const rulesBody = await page.textContent("body").catch(() => "");
    const rulesEmpty = (await page.locator(".ant-empty").count()) > 0;
    const rulesTable = (await page.locator(".ant-table-tbody").count()) > 0;
    const rulesSpin = (await page.locator(".ant-spin-spinning").count()) > 0;
    const rulesErrorMsg = (await page.locator(".ant-message-error").count()) > 0;

    await page.screenshot({ path: "test-results/w2-03-alert-rules.png", fullPage: true });

    report.push({
      page: "Alert Rules",
      url: "/alerts/rules",
      consoleErrors: [...consoleErrors],
      empty: rulesEmpty,
      table: rulesTable,
      loading: rulesSpin,
      errorMsg: rulesErrorMsg,
      mockGone: !hasMockIndicator(rulesBody),
    });

    // 5. Alert List
    await page.goto(`${BASE_URL}/#/alerts/list`);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);

    const listBody = await page.textContent("body").catch(() => "");
    const listEmpty = (await page.locator(".ant-empty").count()) > 0;
    const listTable = (await page.locator(".ant-table-tbody").count()) > 0;
    const listSpin = (await page.locator(".ant-spin-spinning").count()) > 0;
    const listErrorMsg = (await page.locator(".ant-message-error").count()) > 0;

    await page.screenshot({ path: "test-results/w2-04-alert-list.png", fullPage: true });

    report.push({
      page: "Alert List",
      url: "/alerts/list",
      consoleErrors: [...consoleErrors],
      empty: listEmpty,
      table: listTable,
      loading: listSpin,
      errorMsg: listErrorMsg,
      mockGone: !hasMockIndicator(listBody),
    });

    // 6. Notification Config
    await page.goto(`${BASE_URL}/#/alerts/notifications`);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);

    const notifBody = await page.textContent("body").catch(() => "");
    const notifEmpty = (await page.locator(".ant-empty").count()) > 0;
    const notifTable = (await page.locator(".ant-table-tbody").count()) > 0;
    const notifSpin = (await page.locator(".ant-spin-spinning").count()) > 0;
    const notifErrorMsg = (await page.locator(".ant-message-error").count()) > 0;

    await page.screenshot({ path: "test-results/w2-05-notifications.png", fullPage: true });

    report.push({
      page: "Notification Config",
      url: "/alerts/notifications",
      consoleErrors: [...consoleErrors],
      empty: notifEmpty,
      table: notifTable,
      loading: notifSpin,
      errorMsg: notifErrorMsg,
      mockGone: !hasMockIndicator(notifBody),
    });

    // 7. Menu Permission - 回到 Dashboard 检查侧边栏
    await page.goto(`${BASE_URL}/#/`);
    await page.waitForTimeout(2000);

    const menuItems = await page.locator(".ant-menu-item, .ant-menu-submenu-title").allTextContents();
    const hasUsersMenu = menuItems.some((t) => t.includes("用户管理"));
    const hasRolesMenu = menuItems.some((t) => t.includes("角色权限"));
    const hasAlertsMenu = menuItems.some((t) => t.includes("告警") || t.includes("告警列表") || t.includes("告警规则"));

    await page.screenshot({ path: "test-results/w2-06-menu.png", fullPage: false });

    report.push({
      page: "Menu Permission (demo-admin)",
      url: "/",
      menusVisible: { users: hasUsersMenu, roles: hasRolesMenu, alerts: hasAlertsMenu },
    });

    // 输出报告
    console.log("\n========== Week 2 页面调试报告 ==========\n");

    report.forEach((r, i) => {
      if (r.page === "Menu Permission (demo-admin)") {
        console.log(`\n--- ${r.page} ---`);
        console.log("URL:", BASE_URL + "/#/" + (r.url === "/" ? "" : r.url.slice(1)));
        console.log("用户管理可见:", r.menusVisible.users);
        console.log("角色权限可见:", r.menusVisible.roles);
        console.log("告警相关可见:", r.menusVisible.alerts);
      } else {
        console.log(`\n--- ${r.page} (${r.url}) ---`);
        console.log("URL:", BASE_URL + "/#" + r.url);
        console.log("Console 错误:", r.consoleErrors?.length > 0 ? r.consoleErrors : "无");
        console.log("Empty 状态:", r.empty ? "可见" : "不可见");
        console.log("数据表格:", r.table ? "可见" : "不可见");
        console.log("Loading:", r.loading ? "可见" : "不可见");
        console.log("API 错误弹窗:", r.errorMsg ? "可见" : "不可见");
        console.log("Mock 已清除:", r.mockGone ? "是" : "否");
      }
    });

    console.log("\n========== 网络失败请求 ==========");
    failedRequests.forEach((r) => console.log(r.url, "->", r.failure));

    console.log("\n========== API 调用摘要 ==========");
    const uniqueApis = [...new Set(apiCalls.map((a) => a.method + " " + a.url))];
    uniqueApis.slice(0, 30).forEach((u) => console.log(u));
  });
});
