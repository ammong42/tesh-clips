import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";
const systemChromium = process.env.CHROMIUM_PATH || "/usr/bin/chromium";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    launchOptions: {
      executablePath: existsSync(systemChromium) ? systemChromium : undefined,
      args: ["--no-sandbox"],
    },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
