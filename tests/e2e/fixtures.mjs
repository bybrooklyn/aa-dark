import { test as base, chromium, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const extensionPath = path.join(projectRoot, "dist");

export const test = base.extend({
  extensionContext: [async ({}, use, workerInfo) => {
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      headless: true,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
      viewport: { width: 1280, height: 800 },
      colorScheme: "light",
    });
    context.setDefaultTimeout(workerInfo.project.use.actionTimeout);
    context.setDefaultNavigationTimeout(workerInfo.project.use.navigationTimeout);
    await use(context);
    await context.close();
  }, { scope: "worker" }],

  page: async ({ extensionContext }, use) => {
    const page = await extensionContext.newPage();
    await use(page);
    await page.close();
  },
});

export { expect };
