const { defineConfig, devices } = require("@playwright/test");

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";

module.exports = defineConfig({
  globalSetup: require.resolve("./global-setup"),
  testDir: "./tests",
  fullyParallel: true,
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
