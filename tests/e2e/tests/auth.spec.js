const { test, expect } = require("@playwright/test");

// 认证接口要求租户头；前端会从 localStorage 读取该值并透传到 X-Tenant-ID。
const { resolveE2ETenantId } = require("./support/runtimeTenant");
const { E2E_LOGIN_USERNAME, E2E_LOGIN_PASSWORD } = require("./support/runtimeUser");
const { purgeRuntimeTestUserById } = require("./support/runtimeUserCleanup");

const TENANT_ID = resolveE2ETenantId();
const REGISTER_ACCEPTABLE_STATUSES = [200, 201, 429];
const LOGIN_ACCEPTABLE_STATUSES = [200, 429];
const RESET_REQUEST_ACCEPTABLE_STATUSES = [200, 429];

function uniqueSuffix() {
  return `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
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
    let createdUserId = "";

    try {
      await page.goto("/#/register");
      await expect(page.getByRole("heading", { name: "创建账号" })).toBeVisible();

      await page.getByLabel("用户名").fill(username);
      await page.getByLabel("邮箱").fill(email);
      await page.getByPlaceholder("请输入密码（至少 8 位）").fill(password);
      await page.getByPlaceholder("请再次输入密码").fill(password);
      await page.getByRole("checkbox", { name: /我已阅读并同意/ }).check();

      const submitButton = page.getByRole("button", { name: "创建账号" });
      const [registerResponse] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.request().method() === "POST" && response.url().includes("/api/v1/auth/register"),
          { timeout: 15000 },
        ),
        submitButton.click(),
      ]);

      const status = registerResponse.status();
      expect(REGISTER_ACCEPTABLE_STATUSES).toContain(status);

      const body = await registerResponse.json().catch(() => null);
      if (status === 429) {
        expect(body?.code).toBe("AUTH_REGISTER_RATE_LIMITED");
        await expect(page).toHaveURL(/#\/register$/);
        return;
      }

      createdUserId = body?.data?.user_id || "";
      expect(createdUserId).toBeTruthy();
      await expect(page).toHaveURL(/#\/login$/, { timeout: 10000 });
      await expect(page.locator("#login-username")).toBeVisible();
    } finally {
      if (createdUserId) {
        purgeRuntimeTestUserById({ tenantId: TENANT_ID, userId: createdUserId, username });
      }
    }
  });

  test("登录", async ({ page }) => {
    await page.goto("/#/login");
    await expect(page.getByRole("button", { name: /^\s*登\s*录\s*$/ })).toBeVisible();
    await page.locator("#login-username").fill(E2E_LOGIN_USERNAME);
    await page.getByPlaceholder("请输入密码").fill(E2E_LOGIN_PASSWORD);

    const submitButton = page.getByRole("button", { name: /^\s*登\s*录\s*$/ });
    const [loginResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" && response.url().includes("/api/v1/auth/login"),
        { timeout: 15000 },
      ),
      submitButton.click(),
    ]);

    const status = loginResponse.status();
    expect(LOGIN_ACCEPTABLE_STATUSES).toContain(status);

    if (status === 429) {
      const body = await loginResponse.json().catch(() => null);
      expect(body?.code).toBe("AUTH_LOGIN_RATE_LIMITED");
      await expect(page).toHaveURL(/#\/login$/);
      return;
    }

    await expect(page).toHaveURL(/#\/$/);

    const authSession = await page.evaluate(() => ({
      accessToken:
        window.localStorage.getItem("nexuslog-access-token") ??
        window.sessionStorage.getItem("nexuslog-access-token"),
      storageScope:
        window.localStorage.getItem("nexuslog-auth-storage-scope") ??
        window.sessionStorage.getItem("nexuslog-auth-storage-scope"),
    }));
    expect(authSession.accessToken).toBeTruthy();
    expect(["local", "session"]).toContain(authSession.storageScope);
  });

  test("忘记密码", async ({ page }) => {
    await page.goto("/#/forgot-password");
    await page.getByPlaceholder("请输入注册邮箱或用户名").fill(E2E_LOGIN_USERNAME);

    const submitButton = page.getByRole("button", { name: "发送重置链接" });
    const [resetResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.url().includes("/api/v1/auth/password/reset-request"),
        { timeout: 15000 },
      ),
      submitButton.click(),
    ]);

    const status = resetResponse.status();
    expect(RESET_REQUEST_ACCEPTABLE_STATUSES).toContain(status);

    if (status === 429) {
      const body = await resetResponse.json().catch(() => null);
      expect(body?.code).toBe("AUTH_RESET_REQUEST_RATE_LIMITED");
      await expect(page).toHaveURL(/#\/forgot-password$/);
      return;
    }

    await expect(page.getByText("邮件已发送")).toBeVisible();
    await expect(page.getByText(E2E_LOGIN_USERNAME)).toBeVisible();
  });
});
