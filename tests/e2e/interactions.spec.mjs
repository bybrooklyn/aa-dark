import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";
import { test, expect } from "./fixtures.mjs";
import { gotoStable, findBrightNeutralPanels, settleTransitions } from "./site.mjs";

async function inspectState(page, testInfo, name, selector) {
  await settleTransitions(page);
  expect(await findBrightNeutralPanels(page), `${name}: bright panels`).toEqual([]);
  const results = await new AxeBuilder({ page }).include(selector).withRules(["color-contrast"]).analyze();
  expect(results.violations.map(v => v.nodes.map(n => ({ html: n.html, summary: n.failureSummary })))).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), animations: "disabled" });
}

test("desktop navigation and search stay readable when opened", async ({ page }, testInfo) => {
  await gotoStable(page, "/");
  await expect(page.getByRole("link", { name: "Log in", exact: true }).filter({ visible: true }).first()).toBeVisible();
  const models = page.getByRole("button", { name: "Models", exact: true });
  // A retry waits for hydration as well as the Radix menu's open state.
  await expect(async () => {
    if (await models.getAttribute("data-state") !== "open") {
      await page.mouse.move(0, 0);
      await models.hover();
    }
    await expect(models).toHaveAttribute("data-state", "open", { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  const menuSearch = page.getByPlaceholder("Search models", { exact: true });
  await expect(menuSearch).toBeVisible();
  await menuSearch.hover();
  await inspectState(page, testInfo, "desktop-menu", "nav");
  await expect(menuSearch).toBeVisible();
  await expect(page).toHaveURL("https://artificialanalysis.ai/");

  await gotoStable(page, "/");
  await page.locator("button:has(.lucide-search):visible").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const search = page.getByPlaceholder("Search for models, providers, leaderboards...");
  await expect(search).toBeFocused();
  await expect(search).toHaveCSS("outline-style", "solid");
  const selected = page.getByRole("dialog").locator("a.bg-muted");
  const firstSelection = await selected.getAttribute("href");
  await page.keyboard.press("ArrowDown");
  await expect(selected).not.toHaveAttribute("href", firstSelection);
  await inspectState(page, testInfo, "search", '[role="dialog"]');
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("leaderboard filtering, row hover, and filter popover remain readable", async ({ page }, testInfo) => {
  await gotoStable(page, "/leaderboards/models");
  const filter = page.getByPlaceholder("Filter, e.g. GPT, Meta");
  await filter.fill("Claude");
  await expect(page.locator("tbody tr").first()).toContainText("Claude");
  await page.locator("tbody tr").first().hover();
  await inspectState(page, testInfo, "leaderboard-hover", "table");
  await filter.clear();
  await page.getByRole("button", { name: "Weights: All", exact: true }).click();
  const popover = page.locator('[data-radix-popper-content-wrapper] > div').filter({ visible: true });
  await expect(popover).toBeVisible();
  await inspectState(page, testInfo, "leaderboard-filter", '[data-radix-popper-content-wrapper]');
});

test("provider chart tooltip and model selector stay readable", async ({ page }, testInfo) => {
  await gotoStable(page, "/providers/deepseek");
  const mark = page.locator(".recharts-bar-rectangle path").first();
  // The bar's centered numeric label intercepts its center; hover near its base.
  await mark.hover({ position: { x: 5, y: 10 } });
  const tooltip = page.locator(".recharts-tooltip-wrapper").filter({ visible: true }).first();
  await expect(tooltip).toBeVisible();
  await inspectState(page, testInfo, "chart-tooltip", ".recharts-tooltip-wrapper");
  await page.getByRole("combobox").first().click();
  await expect(page.getByRole("dialog").or(page.getByRole("listbox")).first()).toBeVisible();
  await inspectState(page, testInfo, "chart-model-selector", '[data-radix-popper-content-wrapper]');
});

test("arena selected controls and prompt dialog remain readable", async ({ page }, testInfo) => {
  await gotoStable(page, "/image/arena");
  const toggle = page.getByRole("button", { name: "Text to Image", exact: true });
  await expect(toggle).toHaveAttribute("data-state", "on");
  await toggle.hover();
  await inspectState(page, testInfo, "arena-controls", "main");
  await page.getByRole("button", { name: "Submit a prompt" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await inspectState(page, testInfo, "arena-prompt", '[role="dialog"]');
});

test("documentation search and keyboard navigation remain readable", async ({ page }, testInfo) => {
  await gotoStable(page, "/data-api/docs");
  // The docs render before their search handler is attached. A bounded retry
  // waits for the interaction to work without toggling an already-open dialog.
  const dialog = page.getByRole("dialog");
  await expect(async () => {
    if (!await dialog.isVisible()) {
      await page.getByRole("button", { name: "Open search", exact: true }).click();
    }
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await page.keyboard.press("ArrowDown");
  await inspectState(page, testInfo, "docs-search", '[role="dialog"]');
});

// Compare actual computed marks against the same live page without the extension,
// including named colors, short hex colors, CSS colors, and media filters.
test("chart fills and media match the official site without the extension", async ({ page }) => {
  const browser = await chromium.launch({ channel: "chromium", headless: true });
  try {
    const original = await browser.newPage({ viewport: { width: 1280, height: 800 }, colorScheme: "light" });
    const sample = page => page.evaluate(() => ({
      marks: [...document.querySelectorAll('.recharts-bar-rectangle path[data-chart-item-id]')].slice(0, 20).map(node => ({
        id: node.getAttribute("data-chart-item-id"), fill: getComputedStyle(node).fill, stroke: getComputedStyle(node).stroke,
      })),
      media: [...document.querySelectorAll('main img:not([src*="/img/logos/"]):not([src*="%2Fimg%2Flogos%2F"]), main video, main canvas')].slice(0, 20).map(node => ({
        tag: node.tagName, src: node.getAttribute("src"), filter: getComputedStyle(node).filter,
      })),
    }));
    await gotoStable(page, "/providers/deepseek");
    await gotoStable(original, "/providers/deepseek", { themed: false });
    await expect(page.locator(".recharts-cartesian-grid line").first()).toHaveCSS("stroke", "rgb(65, 53, 70)");
    const themed = await sample(page);
    const source = await sample(original);
    expect(themed.marks.length).toBeGreaterThan(0);
    expect(themed.marks.map(({ id, fill }) => ({ id, fill }))).toEqual(source.marks.map(({ id, fill }) => ({ id, fill })));
    for (let index = 0; index < themed.marks.length; index++) {
      if (themed.marks[index].fill === "rgb(0, 0, 0)") expect(themed.marks[index].stroke).toBe("rgb(89, 71, 95)");
      else expect(themed.marks[index].stroke).toBe(source.marks[index].stroke);
    }
    // The provider page has no non-logo media. Use an article so this assertion
    // compares real imagery instead of passing on two empty arrays.
    await gotoStable(page, "/articles/search-api");
    await gotoStable(original, "/articles/search-api", { themed: false });
    const themedArticle = await sample(page);
    const sourceArticle = await sample(original);
    expect(themedArticle.media.length).toBeGreaterThan(0);
    expect(themedArticle.media).toEqual(sourceArticle.media);
  } finally {
    await browser.close();
  }
});
