import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "./fixtures.mjs";

const origin = "https://artificialanalysis.ai";
const desktopRoutes = [
  ["/", "home"],
  ["/leaderboards/models", "models"],
  ["/providers/deepseek", "providers"],
  ["/models/granite-4-2-30b", "models"],
  ["/models/recommend", "models"],
  ["/evaluations/artificial-analysis-intelligence-index", "evaluations"],
  ["/articles/search-api", "articles"],
  ["/image/leaderboard/text-to-image", "image"],
  ["/image/arena", "image"],
  ["/video/arena", "video"],
  ["/text-to-speech/leaderboard/provider-voice", "speech"],
  ["/speech-to-text/non-streaming", "speech"],
  ["/speech-to-speech/arena", "speech"],
  ["/agents/coding", "agents"],
  ["/data-api/docs", "docs"],
  ["/api-reference", "docs"],
  ["/contact", "marketing"],
  ["/de/leaderboards/models", "models"],
  ["/ja/models", "models"],
];

test("themes every representative public template without bright neutral panels", async ({ page }) => {
  for (const [route, family] of desktopRoutes) {
    await gotoStable(page, route);
    await expect(page.locator("html")).toHaveAttribute("data-aad-theme", "dark");
    await expect(page.locator("html")).toHaveAttribute("data-aad-page", family);

    const bodyBackground = await page.locator("body").evaluate((body) => getComputedStyle(body).backgroundColor);
    expect(relativeLuminance(parseRgb(bodyBackground)), `${route} body background`).toBeLessThan(0.08);

    const brightPanels = await findBrightNeutralPanels(page);
    expect(brightPanels, `${route} contains unintended light panels`).toEqual([]);

    const filteredMedia = await page.locator("main img, main picture, main video, main canvas").evaluateAll((nodes) =>
      nodes.filter((node) => getComputedStyle(node).filter !== "none").slice(0, 10).map((node) => ({
        tag: node.tagName,
        filter: getComputedStyle(node).filter,
        src: node.getAttribute("src"),
      })),
    );
    expect(filteredMedia, `${route} contains filtered media`).toEqual([]);
  }
});

test("keeps key pages free of extension-introduced color contrast violations", async ({ page }) => {
  for (const route of ["/", "/providers/deepseek", "/data-api/docs"]) {
    await gotoStable(page, route);
    const results = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
    expect(results.violations, `${route} color contrast violations`).toEqual([]);
  }
});

test("preserves chart series marks while theming chart scaffolding", async ({ page }) => {
  await gotoStable(page, "/providers/deepseek");
  const firstSeriesMark = page.locator(".recharts-bar-rectangle path, .recharts-line-curve, .recharts-area-curve, .recharts-scatter-symbol").first();
  await expect(firstSeriesMark).toBeAttached();
  const chart = page.locator(".recharts-wrapper").filter({ has: firstSeriesMark }).first();
  await expect(chart).toBeAttached();

  const result = await chart.evaluate((root) => {
    const series = [...root.querySelectorAll(".recharts-line-curve, .recharts-area-curve, .recharts-bar-rectangle path, .recharts-scatter-symbol")];
    const grid = root.querySelector(".recharts-cartesian-grid line");
    return {
      seriesCount: series.length,
      seriesColorsUnchanged: series.slice(0, 20).every((node) => {
        const fill = node.getAttribute("fill");
        const stroke = node.getAttribute("stroke");
        const computed = getComputedStyle(node);
        const normalizeHex = (hex) => {
          if (!hex?.startsWith("#") || hex.length !== 7) return null;
          const channels = hex.slice(1).match(/.{2}/g).map((value) => Number.parseInt(value, 16));
          return `rgb(${channels.join(", ")})`;
        };
        return (!fill || fill.startsWith("url(") || computed.fill === normalizeHex(fill))
          && (!stroke || stroke === "none" || computed.stroke === normalizeHex(stroke));
      }),
      gridStroke: grid ? getComputedStyle(grid).stroke : null,
    };
  });

  expect(result.seriesCount).toBeGreaterThan(0);
  expect(result.seriesColorsUnchanged).toBe(true);
  expect(result.gridStroke).toBe("rgb(65, 53, 70)");
});

test("updates route metadata after Next.js client navigation", async ({ page }) => {
  await gotoStable(page, "/");
  const leaderboardLink = page.locator('a[href="/leaderboards/models"]').first();
  await expect(leaderboardLink).toBeVisible();
  await leaderboardLink.click();
  await page.waitForURL(/\/leaderboards\/models/);
  await expect(page.locator("html")).toHaveAttribute("data-aad-page", "models");
});

test("mobile navigation and representative dense layouts remain dark", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const route of ["/", "/leaderboards/models", "/image/arena", "/data-api/docs"]) {
    await gotoStable(page, route);
    expect(await findBrightNeutralPanels(page), `${route} mobile bright panels`).toEqual([]);
  }

  await gotoStable(page, "/");
  const menuButton = page.locator("button:has(.lucide-menu)").first();
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await expect(page.locator("body")).toContainText("Models");
  expect(await findBrightNeutralPanels(page), "mobile menu bright panels").toEqual([]);
});

async function gotoStable(page, route) {
  const response = await page.goto(`${origin}${route}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  expect(response?.status(), `${route} HTTP status`).toBeLessThan(400);
  await page.waitForTimeout(900);
}

async function findBrightNeutralPanels(page) {
  return page.locator("body *").evaluateAll((nodes) => {
    const parse = (value) => {
      const match = value.match(/rgba?\((\d+(?:\.\d+)?)[, ]+(\d+(?:\.\d+)?)[, ]+(\d+(?:\.\d+)?)(?:\s*[/,]\s*(\d+(?:\.\d+)?))?\)/);
      return match ? [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])] : null;
    };
    const lum = ([r, g, b]) => {
      const values = [r, g, b].map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
    };
    const intentional = [
      "bg-brand-lime", "bg-brand-yellow", "bg-brand-orange", "bg-brand-purple",
      "bg-brand-blue", "bg-brand-magenta", "bg-white/", "logo",
    ];

    return nodes.flatMap((node) => {
      if (!(node instanceof HTMLElement)) return [];
      if (["IMG", "PICTURE", "VIDEO", "CANVAS", "SVG"].includes(node.tagName)) return [];
      if (intentional.some((token) => node.className?.toString().includes(token))) return [];
      const rect = node.getBoundingClientRect();
      if (rect.width * rect.height < 2_500 || rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth) return [];
      const style = getComputedStyle(node);
      const rgba = parse(style.backgroundColor);
      if (!rgba || rgba[3] < 0.85 || lum(rgba) < 0.68) return [];
      return [{
        tag: node.tagName,
        className: node.className?.toString().slice(0, 180),
        background: style.backgroundColor,
        area: Math.round(rect.width * rect.height),
      }];
    }).slice(0, 20);
  });
}

function parseRgb(value) {
  const match = value.match(/\d+(?:\.\d+)?/g);
  if (!match || match.length < 3) throw new Error(`Cannot parse color: ${value}`);
  return match.slice(0, 3).map(Number);
}

function relativeLuminance([r, g, b]) {
  const channels = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
