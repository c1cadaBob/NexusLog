const { test, expect } = require("@playwright/test");

const TENANT_ID =
  process.env.E2E_TENANT_ID || "00000000-0000-0000-0000-000000000001";

function buildAuthStoragePayload(isAuthenticated = true) {
  return JSON.stringify({
    state: {
      isAuthenticated,
      user: isAuthenticated
        ? {
            id: "e2e-user",
            username: "e2e_user",
            email: "e2e_user@example.com",
            displayName: "E2E User",
            role: "admin",
          }
        : null,
    },
    version: 0,
  });
}

async function seedAuthStorage(page, { expired = false } = {}) {
  await page.addInitScript(
    ({ tenantId, isExpired, authStateJson }) => {
      window.localStorage.clear();
      window.localStorage.setItem("nexuslog-tenant-id", tenantId);
      window.localStorage.setItem("nexuslog-auth", authStateJson);
      window.localStorage.setItem("nexuslog-access-token", "e2e-access-token");
      window.localStorage.setItem("nexuslog-refresh-token", "e2e-refresh-token");

      const ttlMs = 6 * 60 * 60 * 1000;
      const expiresAt = Date.now() + (isExpired ? -60_000 : ttlMs);
      window.localStorage.setItem("nexuslog-token-expires-at", String(expiresAt));
    },
    {
      tenantId: TENANT_ID,
      isExpired: expired,
      authStateJson: buildAuthStoragePayload(true),
    },
  );
}

test.describe("任务1~7前端页面调试补充", () => {
  test("ProtectedRoute: 未登录访问受保护路由会跳转登录页", async ({ page }) => {
    await page.addInitScript((tenantId) => {
      window.localStorage.clear();
      window.localStorage.setItem("nexuslog-tenant-id", tenantId);
      window.localStorage.setItem(
        "nexuslog-auth",
        JSON.stringify({ state: { isAuthenticated: false, user: null }, version: 0 }),
      );
    }, TENANT_ID);

    await page.goto("/#/ingestion/sources");
    await expect(page).toHaveURL(/#\/login$/);
  });

  test("ProtectedRoute: 过期 token 会触发清理并跳转登录页", async ({ page }) => {
    await seedAuthStorage(page, { expired: true });

    await page.goto("/#/");
    await expect(page).toHaveURL(/#\/login$/);

    const storageState = await page.evaluate(() => ({
      accessToken: window.localStorage.getItem("nexuslog-access-token"),
      refreshToken: window.localStorage.getItem("nexuslog-refresh-token"),
      expiresAt: window.localStorage.getItem("nexuslog-token-expires-at"),
    }));

    expect(storageState.accessToken).toBeNull();
    expect(storageState.refreshToken).toBeNull();
    expect(storageState.expiresAt).toBeNull();
  });

  test("Ingest 页面: 通过前端代理访问 /api/v1/ingest/pull-sources", async ({ page }) => {
    await seedAuthStorage(page, { expired: false });

    await page.goto("/#/ingestion/sources");

    const response = await page.evaluate(async (tenantId) => {
      const res = await fetch("/api/v1/ingest/pull-sources", {
        headers: {
          "X-Tenant-ID": tenantId,
        },
      });
      return {
        status: res.status,
        body: await res.json(),
      };
    }, TENANT_ID);

    expect(response.status).toBe(200);
    expect(response.body.code).toBe("OK");
    expect(Array.isArray(response.body?.data?.items)).toBeTruthy();
  });

  test("Agent 页面: /agent/v1/meta 鉴权失败与成功路径", async ({ page }) => {
    await seedAuthStorage(page, { expired: false });

    await page.goto("/#/ingestion/agents");

    const unauthorized = await page.evaluate(async () => {
      const res = await fetch("/agent/v1/meta");
      return {
        status: res.status,
        body: await res.json(),
      };
    });
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.body.code).toBe("AUTH_MISSING_TOKEN");

    const authorized = await page.evaluate(async () => {
      const res = await fetch("/agent/v1/meta", {
        headers: {
          "X-Agent-Key": "nexuslog-local-dev-agent-key-20260314-change-before-production",
          "X-Key-Id": "active",
        },
      });
      return {
        status: res.status,
        body: await res.json(),
      };
    });
    expect(authorized.status).toBe(200);
    expect(authorized.body.agent_id).toBeTruthy();
    expect(Array.isArray(authorized.body.capabilities)).toBeTruthy();
  });
});
