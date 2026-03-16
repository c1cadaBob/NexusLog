/**
 * Week 2 前端页面调试
 * User Management, Role Permissions, Alert Rules, Alert List, Notification Config, Menu Permissions
 *
 * 运行: E2E_BASE_URL=http://localhost:3000 npx playwright test week2-debug.spec.js --retries=0
 */
const { test } = require("@playwright/test");

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";
const { resolveE2ETenantId } = require("./support/runtimeTenant");
const { E2E_LOGIN_USERNAME, E2E_LOGIN_PASSWORD } = require("./support/runtimeUser");

const TENANT_ID = resolveE2ETenantId();

const PAGES = [
  { name: "User Management", path: "/security/users", url: `${BASE_URL}/#/security/users` },
  { name: "Role Permissions", path: "/security/roles", url: `${BASE_URL}/#/security/roles` },
  { name: "Alert Rules", path: "/alerts/rules", url: `${BASE_URL}/#/alerts/rules` },
  { name: "Alert List", path: "/alerts/list", url: `${BASE_URL}/#/alerts/list` },
  { name: "Notification Config", path: "/alerts/notifications", url: `${BASE_URL}/#/alerts/notifications` },
];

const MOCK_INDICATORS = ["mock", "Mock", "演示数据", "fake", "假数据", "placeholder"];

test.describe("Week 2 前端页面调试", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((tenantId) => {
      window.localStorage.clear();
      window.localStorage.setItem("nexuslog-tenant-id", tenantId);
    }, TENANT_ID);
  });

  test("完整调试流程：登录 -> 6 个页面检查", async ({ page }) => {
    const consoleErrors = [];
    const failedRequests = [];
    const apiRequests = [];

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
        apiRequests.push({ url: url.split("?")[0], method: req.method() });
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
      await page.waitForTimeout(4000); // 等待 syncPermissions
    }

    const report = [];

    // 2. 依次访问各页面
    for (const p of PAGES) {
      const pageErrorsBefore = consoleErrors.length;

      await page.goto(p.url);
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2500);

      const emptyEl = await page.locator(".ant-empty").count() > 0;
      const tableEl = await page.locator(".ant-table-tbody").count() > 0;
      const spinEl = await page.locator(".ant-spin-spinning").count() > 0;
      const errorMsg = await page.locator(".ant-message-error").count() > 0;

      const bodyText = await page.textContent("body").catch(() => "") || "";
      const hasMock = MOCK_INDICATORS.some((m) => bodyText.includes(m));

      const newErrors = consoleErrors.slice(pageErrorsBefore);

      await page.screenshot({
        path: `test-results/week2-${p.path.replace(/\//g, "-")}.png`,
        fullPage: true,
      });

      report.push({
        page: p.name,
        url: p.url,
        consoleErrors: newErrors,
        empty: emptyEl,
        table: tableEl,
        loading: spinEl,
        apiErrorPopup: errorMsg,
        mockGone: !hasMock,
      });
    }

    // 3. 菜单权限检查：sys-superadmin 应有 * 权限，所有菜单可见
    await page.goto(`${BASE_URL}/#/`);
    await page.waitForTimeout(2000);

    const sidebar = page.locator("aside.ant-layout-sider, [class*='sidebar']");
    const menuItems = page.locator(".ant-menu-item, .ant-menu-submenu-title");
    const menuCount = await menuItems.count();

    await page.screenshot({
      path: "test-results/week2-menu-permission.png",
      fullPage: false,
    });

    // 检查关键菜单是否存在
    const hasAlerts = (await page.locator("text=告警中心").count()) > 0;
    const hasUsers = (await page.locator("text=用户管理").count()) > 0;
    const hasRoles = (await page.locator("text=角色权限").count()) > 0;

    report.push({
      page: "Menu Permission",
      url: `${BASE_URL}/#/`,
      menuItemsCount: menuCount,
      hasAlertsMenu: hasAlerts,
      hasUsersMenu: hasUsers,
      hasRolesMenu: hasRoles,
    });

    // 输出报告
    console.log("\n" + "=".repeat(60));
    console.log("Week 2 前端页面调试报告");
    console.log("=".repeat(60));

    report.forEach((r) => {
      console.log("\n---", r.page, "---");
      console.log("URL:", r.url);
      if (r.consoleErrors?.length) console.log("Console 错误:", r.consoleErrors);
      if (r.empty !== undefined) console.log("Empty 状态:", r.empty ? "可见" : "不可见");
      if (r.table !== undefined) console.log("数据表格:", r.table ? "可见" : "不可见");
      if (r.loading !== undefined) console.log("Loading:", r.loading ? "可见" : "不可见");
      if (r.apiErrorPopup !== undefined) console.log("API 错误弹窗:", r.apiErrorPopup ? "可见" : "不可见");
      if (r.mockGone !== undefined) console.log("Mock 已清除:", r.mockGone ? "是" : "否");
      if (r.menuItemsCount !== undefined) console.log("菜单项数量:", r.menuItemsCount);
      if (r.hasAlertsMenu !== undefined) console.log("告警中心菜单:", r.hasAlertsMenu ? "可见" : "不可见");
      if (r.hasUsersMenu !== undefined) console.log("用户管理菜单:", r.hasUsersMenu ? "可见" : "不可见");
      if (r.hasRolesMenu !== undefined) console.log("角色权限菜单:", r.hasRolesMenu ? "可见" : "不可见");
    });

    console.log("\n--- 网络失败请求 ---");
    failedRequests.forEach((r) => console.log(r.url, "->", r.failure));
  });
});
