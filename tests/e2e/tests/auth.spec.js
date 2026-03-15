const { test, expect } = require("@playwright/test");

// 认证接口要求租户头；前端会从 localStorage 读取该值并透传到 X-Tenant-ID。
const { resolveE2ETenantId } = require("./support/runtimeTenant");

const TENANT_ID = resolveE2ETenantId();

function uniqueSuffix() {
  return `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

async function ensureRegisteredUser(request, { username, email, password }) {
  const response = await request.post("/api/v1/auth/register", {
    headers: {
      "X-Tenant-ID": TENANT_ID,
      "Content-Type": "application/json",
    },
    data: {
      username,
      email,
      password,
      display_name: username,
    },
  });

  // 幂等化处理：允许首次创建（201/200）和偶发冲突（409）。
  expect([200, 201, 409]).toContain(response.status());
}

test.beforeEach(async ({ page }) => {
  // 每次测试前清理本地状态，避免持久化登录态影响公开认证页面行为。
  await page.addInitScript((tenantId) => {
    window.localStorage.clear();
    window.localStorage.setItem("nexuslog-tenant-id", tenantId);
  }, TENANT_ID);
});

test.describe("认证功能链路", () => {
  test("注册", async ({ page }) => {
    const suffix = uniqueSuffix();
    const username = `e2e_reg_${suffix}`;
    const email = `e2e_reg_${suffix}@example.com`;
    const password = "Password123";

    await page.goto("/#/register");
    await expect(page.getByRole("heading", { name: "创建账号" })).toBeVisible();

    await page.getByLabel("用户名").fill(username);
    await page.getByLabel("邮箱").fill(email);
    await page.getByPlaceholder("请输入密码（至少 8 位）").fill(password);
    await page.getByPlaceholder("请再次输入密码").fill(password);
    await page.getByRole("checkbox", { name: /我已阅读并同意/ }).check();

    await page.getByRole("button", { name: "创建账号" }).click();

    await expect(page).toHaveURL(/#\/login$/);
    await expect(page.locator("#login-username")).toBeVisible();
  });

  test("登录", async ({ page, request }) => {
    const suffix = uniqueSuffix();
    const username = `e2e_login_${suffix}`;
    const email = `e2e_login_${suffix}@example.com`;
    const password = "Password123";

    await ensureRegisteredUser(request, { username, email, password });

    await page.goto("/#/login");
    await expect(page.getByRole("button", { name: /^\s*登\s*录\s*$/ })).toBeVisible();
    await page.locator("#login-username").fill(username);
    await page.getByPlaceholder("请输入密码").fill(password);
    await page.getByRole("button", { name: /^\s*登\s*录\s*$/ }).click();

    await expect(page).toHaveURL(/#\/$/);

    const accessToken = await page.evaluate(() => window.localStorage.getItem("nexuslog-access-token"));
    expect(accessToken).toBeTruthy();
  });

  test("忘记密码", async ({ page, request }) => {
    const suffix = uniqueSuffix();
    const username = `e2e_reset_${suffix}`;
    const email = `e2e_reset_${suffix}@example.com`;
    const password = "Password123";

    await ensureRegisteredUser(request, { username, email, password });

    await page.goto("/#/forgot-password");
    await page.getByPlaceholder("请输入注册邮箱或用户名").fill(email);
    await page.getByRole("button", { name: "发送重置链接" }).click();

    await expect(page.getByText("邮件已发送")).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
  });
});
