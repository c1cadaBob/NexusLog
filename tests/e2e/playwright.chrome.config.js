const { defineConfig, devices } = require("@playwright/test");

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";

module.exports = defineConfig({
  globalSetup: require.resolve("./global-setup"),
  testDir: "./tests",
  fullyParallel: false,
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // 使用系统 Chrome 渠道运行时关闭视频，避免额外 ffmpeg 依赖下载。
    video: "off",
  },
  workers: 1,
  projects: [
    {
      name: "chrome",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
      },
    },
  ],
});
