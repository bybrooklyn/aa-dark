import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "./fixtures.mjs";
import { desktopRoutes, gotoStable, findBrightNeutralPanels, lowContrastText, parseRgb, relativeLuminance, settleTransitions } from "./site.mjs";

for (const route of desktopRoutes) {
  test(`${route} — dark surfaces, chart labels, and media`, async ({ page }) => {
    await gotoStable(page, route);

    const bodyBackground = await page.locator("body").evaluate((body) => getComputedStyle(body).backgroundColor);
    expect(relativeLuminance(parseRgb(bodyBackground)), `${route} body background`).toBeLessThan(0.08);

    const brightPanels = await findBrightNeutralPanels(page);
    expect(brightPanels, `${route} contains unintended light panels`).toEqual([]);

    const blackChartLabels = await page
      .locator(".recharts-surface text")
      .evaluateAll((nodes) => nodes.filter((node) => /^rgba?\(0, 0, 0/.test(getComputedStyle(node).fill)).map((node) => node.textContent));
    expect(blackChartLabels, `${route} contains black chart labels on dark surfaces`).toEqual([]);

    const filteredMedia = await page.locator("main img, main picture, main video, main canvas").evaluateAll((nodes) =>
      nodes.filter((node) => getComputedStyle(node).filter !== "none").slice(0, 10).map((node) => ({
        tag: node.tagName,
        filter: getComputedStyle(node).filter,
        src: node.getAttribute("src"),
      })),
    );
    expect(filteredMedia, `${route} contains filtered media`).toEqual([]);
  });

  test(`${route} — text contrast`, async ({ page }) => {
    await gotoStable(page, route);
    // .saw is the Search Index article's animated flowchart; it dims inactive nodes by design.
    const results = await new AxeBuilder({ page }).withRules(["color-contrast"]).exclude(".saw").analyze();
    const violations = results.violations.flatMap((violation) => violation.nodes.map((node) => ({ html: node.html.slice(0, 160), summary: node.failureSummary?.split("\n")[1] })));
    expect(violations, `${route} color contrast violations`).toEqual([]);
  });
}

test("keeps hovered controls readable", async ({ page }) => {
  for (const route of ["/", "/data-api/docs", "/api-reference", "/hardware-inference-stack"]) {
    await gotoStable(page, route);
    const handles = await page.locator('[class*="hover:text-"], [class*="hover:bg-"], .group:has([class*="group-hover:"])').elementHandles();
    const unreadable = [];
    let sampled = 0;

    for (const handle of handles.slice(0, 40)) {
      const box = await handle.boundingBox();
      if (!box || box.width < 8 || box.height < 8) continue;
      const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const reachable = await handle.evaluate((node, point) => {
        const hit = document.elementFromPoint(point.x, point.y);
        return hit && node.contains(hit);
      }, point);
      if (!reachable) continue; // Hidden/covered controls cannot be hovered by a user.
      await page.mouse.move(point.x, point.y);
      sampled += 1;
      await settleTransitions(page);
      const result = await handle.evaluate(lowContrastText);
      if (result) unreadable.push({ route, ...result });
    }

    expect(sampled, `${route} sampled hover targets`).toBeGreaterThan(0);
    expect(unreadable, `${route} hovered controls`).toEqual([]);
  }
});

test("mobile navigation and representative dense layouts remain dark", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const route of ["/", "/leaderboards/models", "/image/arena", "/data-api/docs"]) {
    await gotoStable(page, route);
    expect(await findBrightNeutralPanels(page), `${route} mobile bright panels`).toEqual([]);
    if (route === "/image/arena" && await page.locator("main .blur").count()) {
      testInfo.annotations.push({
        type: "coverage limitation",
        description: "Image arena retained its upstream loading blur; this capture covers its shell, not loaded arena images.",
      });
    }
    await page.screenshot({ path: testInfo.outputPath(`mobile-${route.replaceAll("/", "_")}.png`), animations: "disabled" });
  }

  await gotoStable(page, "/");
  const menuButton = page.locator("button:has(.lucide-menu)").first();
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await settleTransitions(page);
  expect(await findBrightNeutralPanels(page), "mobile menu bright panels").toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("mobile-menu.png"), animations: "disabled" });
});
