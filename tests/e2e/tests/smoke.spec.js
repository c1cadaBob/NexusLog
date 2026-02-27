const { test, expect } = require("@playwright/test");

test.describe("NexusLog E2E 模板", () => {
  test("首页可访问", async ({ page }) => {
    const response = await page.goto("/");
    expect(response).not.toBeNull();
    expect(response.status()).toBeLessThan(500);
  });

  test("登录页可访问", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response).not.toBeNull();
    expect(response.status()).toBeLessThan(500);
  });
});
