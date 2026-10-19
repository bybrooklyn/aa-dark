import { expect } from "./fixtures.mjs";

export const origin = "https://artificialanalysis.ai";
export const desktopRoutes = [
  "/",
  "/leaderboards/models",
  "/providers/deepseek",
  "/models/granite-4-2-30b",
  "/models/recommend",
  "/evaluations/artificial-analysis-intelligence-index",
  "/articles/search-api",
  "/hardware-inference-stack/datacenter",
  "/agents",
  "/agents/coding",
  "/microevals",
  "/image/leaderboard/text-to-image",
  "/image/arena",
  "/video/arena",
  "/text-to-speech/leaderboard/provider-voice",
  "/speech-to-text/non-streaming",
  "/speech-to-speech/arena",
  "/music/leaderboard/vocals",
  "/data-api",
  "/data-api/docs",
  "/api-reference",
  "/methodology",
  "/optima",
  "/contact",
  "/de/leaderboards/models",
  "/ja/models",
];

export async function gotoStable(page, route, { themed = true } = {}) {
  const response = await page.goto(`${origin}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  expect(response?.status(), `${route} HTTP status`).toBeLessThan(400);
  if (themed) await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  if (route !== "/api-reference") await expect(page.locator("main").first()).toBeVisible();
  await expect(page.locator("h1, h2").first()).toBeVisible();
  if (route === "/" || route.startsWith("/providers/")) {
    await expect(page.locator(".recharts-bar-rectangle path").first()).toBeAttached();
  } else if (route === "/leaderboards/models") {
    await expect(page.locator("tbody tr").first()).toBeVisible();
  } else if (route === "/data-api/docs") {
    await expect(page.locator("pre").first()).toBeVisible();
  } else if (["/image/arena", "/video/arena"].includes(route)) {
    await expect(page.getByRole("button", { name: "Submit a prompt" })).toBeVisible();
  }
  await page.evaluate(() => document.fonts.ready);
  await settleTransitions(page);
}

export async function findBrightNeutralPanels(page) {
  return page.locator("body *").evaluateAll((nodes) => {
    const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    const parse = (value) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, alpha] = context.getImageData(0, 0, 1, 1).data;
      return [r, g, b, alpha / 255];
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
      "bg-brand-blue", "bg-brand-magenta", "logo",
    ];

    return nodes.flatMap((node) => {
      if (!(node instanceof HTMLElement)) return [];
      if (["IMG", "PICTURE", "VIDEO", "CANVAS", "SVG"].includes(node.tagName)) return [];
      if (intentional.some((token) => node.className?.toString().includes(token))) return [];
      const rect = node.getBoundingClientRect();
      if (rect.width * rect.height < 2_500) return [];
      const style = getComputedStyle(node);
      const rgba = parse(style.backgroundColor);
      if (!rgba || rgba[3] < 0.85 || lum(rgba) < 0.68) return [];
      // Saturated fills are data marks (inline lab colors on Elo bars), not panels.
      if (Math.max(...rgba.slice(0, 3)) - Math.min(...rgba.slice(0, 3)) > 60) return [];
      return [{
        tag: node.tagName,
        className: node.className?.toString().slice(0, 180),
        background: style.backgroundColor,
        area: Math.round(rect.width * rect.height),
      }];
    }).slice(0, 20);
  });
}

/* Runs in the page: returns a description if the element's own text is unreadable
   against its effective background, otherwise null. */
export function lowContrastText(element) {
  const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const parse = (value) => {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b, alpha] = context.getImageData(0, 0, 1, 1).data;
    return [r, g, b, alpha / 255];
  };
  const lum = ([r, g, b]) => {
    const values = [r, g, b].map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
  };
  const blend = (top, under) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1);
  const textNode = [...element.childNodes].find((node) => node.nodeType === 3 && node.textContent.trim().length > 1);
  if (!textNode) return null;
  const chain = [];
  for (let node = element; node && node !== document.documentElement; node = node.parentElement) chain.push(node);
  let background = [16, 13, 18, 1];
  for (const node of chain.reverse()) {
    const color = parse(getComputedStyle(node).backgroundColor);
    if (color && color[3] > 0) background = blend(color, background);
  }
  const style = getComputedStyle(element);
  const color = parse(style.color);
  if (!color || color[3] === 0) return null;
  const foreground = color[3] < 1 ? blend(color, background) : color;
  const light = Math.max(lum(foreground), lum(background));
  const dark = Math.min(lum(foreground), lum(background));
  const ratio = (light + 0.05) / (dark + 0.05);
  const size = Number.parseFloat(style.fontSize);
  const large = size >= 24 || (size >= 18.66 && Number.parseInt(style.fontWeight, 10) >= 700);
  if (ratio >= (large ? 3 : 4.5)) return null;
  return {
    text: textNode.textContent.trim().slice(0, 40),
    className: element.className?.toString().slice(0, 160),
    color: style.color,
    background: `rgb(${background.slice(0, 3).map(Math.round).join(", ")})`,
    ratio: Number(ratio.toFixed(2)),
  };
}

export function parseRgb(value) {
  const match = value.match(/\d+(?:\.\d+)?/g);
  if (!match || match.length < 3) throw new Error(`Cannot parse color: ${value}`);
  return match.slice(0, 3).map(Number);
}

export function relativeLuminance([r, g, b]) {
  const channels = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

// Finish finite entrance/color transitions before sampling pixels or contrast.
// Infinite activity indicators do not block the checks.
export async function settleTransitions(page) {
  await page.evaluate(async () => {
    const finite = document.getAnimations().filter(animation => {
      const timing = animation.effect?.getComputedTiming();
      return animation.playState === "running" && timing && Number.isFinite(timing.endTime)
        && timing.endTime - Number(animation.currentTime ?? 0) <= 5_000;
    });
    await Promise.all(finite.map(animation => animation.finished.catch(() => {})));
  });
}
