import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "./fixtures.mjs";
import { gotoStable } from "./site.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const screenshotsDir = path.join(projectRoot, "store-assets", "screenshots");

test("captures current store screenshots from the real themed extension", async ({ page }) => {
  await mkdir(screenshotsDir, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });

  for (const [name, route, readySelector] of [
    ["01-home", "/", ".recharts-bar-rectangle path"],
    ["02-model-leaderboard", "/leaderboards/models"],
    ["03-provider-analysis", "/providers/deepseek"],
    ["04-image-leaderboard", "/image/leaderboard/text-to-image"],
    ["05-api-documentation", "/data-api/docs"],
  ]) {
    await gotoStable(page, route);
    if (readySelector) await expect(page.locator(readySelector).first()).toBeAttached({ timeout: 30_000 });
    await page.screenshot({ path: path.join(screenshotsDir, `${name}-1280x800.png`), animations: "disabled" });
  }
});
