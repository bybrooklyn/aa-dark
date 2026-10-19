import { lowContrastText, findBrightNeutralPanels } from "./site.mjs";
import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "./fixtures.mjs";

// The real extension is injected by Chromium at its permitted origin. Only the
// document is synthetic, so these checks need neither the site nor its APIs.
const fixtureUrl = "https://artificialanalysis.ai/__aad_test__/components";
const upstream = `
  :root { --neutral-900: 0 0% 9%; color-scheme: light; }
  body { background: white; color: black; font: 16px sans-serif; }
  a { color: inherit; }
  button, input { padding: 8px; margin: 8px; }
  .bg-white { background: white; }
  .text-black { color: black; }
  .bg-brand-lime { background: #d0ff71; }
  .bg-neutral-900 { background: hsl(var(--neutral-900)); }
  .text-white { color: white; }
  .hover\\:bg-white:hover { background: white; }
  .hover\\:bg-white\\/95:hover { background: rgb(255 255 255 / .95); }
  .hover\\:bg-neutral-100:hover { background: hsl(var(--neutral-100)); }
  .group:hover .group-hover\\:bg-white { background: white; }
  .focus\\:outline-none:focus { outline: none; }
  .focus-visible\\:outline-none:focus-visible { outline: none; }
  button:disabled { opacity: .5; }
  td { padding: 12px; }
`;
async function fixture(page, html) {
  await page.route("**/*", route => route.request().url() === fixtureUrl
    ? route.fulfill({ contentType: "text/html", body: `<!doctype html><html><head><style>${upstream}</style></head><body>${html}</body></html>` })
    : route.abort());
  await page.goto(fixtureUrl);
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
}
// Canvas normalizes rgb(), color(srgb ...), and color-mix() across Chromium versions.
async function rgba(locator, property = "backgroundColor") {
  return locator.evaluate((element, property) => {
    const context = document.createElement("canvas").getContext("2d");
    context.fillStyle = getComputedStyle(element)[property];
    context.fillRect(0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data];
  }, property);
}

test("white opacity variants preserve alpha and do not leak into children", async ({ page }) => {
  await fixture(page, [95, 90, 85, 80, 50].map(alpha => `<div id="a${alpha}" class="bg-white/${alpha}"><span class="bg-white">Solid child</span></div>`).join(""));
  for (const alpha of [95, 90, 85, 80, 50]) {
    const color = await rgba(page.locator(`#a${alpha}`));
    expect(Math.abs(color[3] - 255 * alpha / 100)).toBeLessThanOrEqual(1);
    expect(color.slice(0, 3).every(channel => channel < 30)).toBe(true);
    await expect(page.locator(`#a${alpha} span`)).toHaveCSS("background-color", "rgb(24, 19, 27)");
  }
});

test("hover and selected surfaces stay distinct, including translucent hover", async ({ page }) => {
  await fixture(page, `<button id="hover" class="bg-white/50 hover:bg-white/95 text-black">Hover</button>
    <button id="token" class="bg-white hover:bg-neutral-100 text-black">Token hover</button>
    <div class="group"><button id="group" class="bg-white group-hover:bg-white text-black">Group hover</button></div>
    <button id="selected" class="bg-white data-[state=on]:bg-brand-blue/5" data-state="on">Selected</button>`);
  const hover = page.locator("#hover");
  await hover.hover();
  expect((await rgba(hover))[3]).toBeCloseTo(255 * .95, 0);
  await page.locator("#token").hover();
  await expect(page.locator("#token")).not.toHaveCSS("background-color", "rgb(24, 19, 27)");
  await page.locator("#group").hover();
  await expect(page.locator("#group")).toHaveCSS("background-color", "rgb(52, 41, 58)");
  await expect(page.locator("#selected")).toHaveCSS("background-color", "rgb(45, 36, 64)");
});

test("keyboard focus survives upstream outline removal and disabled controls retain their treatment", async ({ page }) => {
  await fixture(page, `<button id="nav" class="focus:outline-none">Navigation</button>
    <input id="input" class="focus-visible:outline-none" placeholder="Search">
    <button id="disabled" class="bg-brand-lime text-black" disabled>Disabled</button>`);
  for (const id of ["nav", "input"]) {
    await page.keyboard.press("Tab");
    const control = page.locator(`#${id}`);
    await expect(control).toBeFocused();
    await expect(control).toHaveCSS("outline-style", "solid");
    await expect(control).toHaveCSS("outline-width", "2px");
    await expect(control).toHaveCSS("outline-color", "rgb(189, 154, 255)");
  }
  await expect(page.locator("#disabled")).toBeDisabled();
  await expect(page.locator("#disabled")).toHaveCSS("opacity", "0.5");
  await expect(page.locator("#disabled")).toHaveCSS("color", "rgb(11, 9, 12)");
});

test("row hover preserves semantic cell backgrounds", async ({ page }) => {
  await fixture(page, `<table><tbody><tr><td id="plain">Model</td><td id="heat" style="background:rgb(35,70,40)">Heatmap</td><td id="selected" class="bg-brand-lime">Selected</td></tr></tbody></table>`);
  const before = await rgba(page.locator("#heat"));
  await page.locator("#plain").hover();
  expect(await rgba(page.locator("#heat"))).toEqual(before);
  await expect(page.locator("#selected")).toHaveCSS("background-color", "rgb(208, 255, 113)");
  expect((await rgba(page.locator("tr")))[3]).toBeGreaterThan(0);
});

test("tooltip series keep readable source colors and chart/media marks are preserved", async ({ page }) => {
  await fixture(page, `<div class="recharts-default-tooltip"><p class="recharts-tooltip-label">Comparison</p>
    <span id="series" class="recharts-tooltip-item" style="color:rgb(143,227,197)">Series</span></div>
    <svg class="recharts-surface"><path id="mark" fill="#123456" stroke="#abcdef" d="M0 0h20v20z"/><path id="black" fill="#000" d="M30 0h20v20z"/></svg>
    <main><img id="media" alt="Fixture" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Cpath fill='red' d='M0 0h20v20H0z'/%3E%3C/svg%3E"></main>`);
  await expect(page.locator("#series")).toHaveCSS("color", "rgb(143, 227, 197)");
  await expect(page.locator(".recharts-tooltip-label")).toHaveCSS("color", "rgb(192, 181, 196)");
  await expect(page.locator("#mark")).toHaveCSS("fill", "rgb(18, 52, 86)");
  await expect(page.locator("#mark")).toHaveCSS("stroke", "rgb(171, 205, 239)");
  await expect(page.locator("#black")).toHaveCSS("fill", "rgb(0, 0, 0)");
  await expect(page.locator("#black")).toHaveCSS("stroke", "rgb(89, 71, 95)");
  await expect(page.locator("#media")).toHaveCSS("filter", "none");
});

for (const mode of ["forced colors", "print"]) {
  test(`${mode} releases theme tokens, controls, and brand fills to the system/site`, async ({ page }) => {
    await fixture(page, `<button class="bg-brand-lime text-black">Brand</button><input placeholder="Search"><pre class="bg-neutral-900 text-white">Code</pre>`);
    if (mode === "forced colors") await page.emulateMedia({ forcedColors: "active" });
    else await page.emulateMedia({ media: "print" });
    await expect(page.locator("html")).toHaveCSS("color-scheme", mode === "forced colors" ? "light dark" : "light");
    expect(await page.locator("html").evaluate(e => getComputedStyle(e).getPropertyValue("--aad-canvas"))).toBe("");
    await expect(page.locator("button")).toHaveCSS("forced-color-adjust", "auto");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    if (mode === "print") {
      await expect(page.locator("pre")).toHaveCSS("background-color", "rgb(23, 23, 23)");
      await expect(page.locator("button")).toHaveCSS("background-color", "rgb(208, 255, 113)");
    }
    await page.emulateMedia({ media: "screen", forcedColors: "none" });
    await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  });
}

test("inactive section navigation labels remain readable and brighten on hover", async ({ page }) => {
  await fixture(page, `<style>.opacity-50 {opacity:.5}.group:hover .group-hover\\:opacity-100 {opacity:1}</style>
    <aside><nav><a href="#section" class="group"><span class="opacity-50 group-hover:opacity-100">Section <span class="text-brand-purple-dark" style="font-size:10px">Updated</span></span></a></nav></aside>`);
  const label = page.locator(".opacity-50");
  await expect(label).toHaveCSS("opacity", "0.7");
  const result = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
  expect(result.violations).toEqual([]);
  await page.locator("a").hover();
  await expect(label).toHaveCSS("opacity", "1");
});

test("contrast sampling understands color-mix and enforces normal and large text floors", async ({ page }) => {
  await fixture(page, `<div id="panel" style="width:100px;height:100px;background:color-mix(in srgb, white 95%, transparent)">Panel</div>
    <div id="normal" style="color:#777;background:#211a25;font-size:16px">Normal</div>
    <div id="large" style="color:#777;background:#211a25;font-size:24px">Large</div>
    <div id="token" style="color:hsl(var(--neutral-600));background:var(--aad-surface-3)">Muted text</div>`);
  expect(await findBrightNeutralPanels(page)).toHaveLength(1);
  expect(await page.locator("#normal").evaluate(lowContrastText)).not.toBeNull();
  expect(await page.locator("#large").evaluate(lowContrastText)).toBeNull();
  expect(await page.locator("#token").evaluate(lowContrastText)).toBeNull();
});

test("arena Elo bars, heatmap cells, toggles, and chart halos stay legible", async ({ page }) => {
  await fixture(page, `<style>.opacity-60 {opacity:.6}</style>
    <table><tbody><tr class="opacity-60"><td><span class="relative">
      <span id="bar" class="absolute inset-y-0 left-0 rounded-[2px]" style="width:90%;background-color:#000000"></span>
      <span id="whisker" class="absolute top-1/2 h-px" style="left:90%;width:5%;background-color:#171717"></span>
    </span></td><td><span id="interval" class="text-neutral-400" style="font-size:11px">±52</span></td></tr></tbody></table>
    <div style="background-color:rgb(220, 252, 231)"><span id="cell" class="text-neutral-900">37.6 min</span></div>
    <button id="toggle" class="data-[state=on]:bg-neutral-900 text-white" data-state="on">32x</button>
    <span id="code" class="text-brand-blue-light">"slug"</span>
    <svg class="recharts-surface"><text id="label" fill="#003c1d" stroke="#fff" paint-order="stroke">Vera Rubin</text>
      <g class="recharts-line"><path id="line" class="recharts-curve recharts-line-curve" stroke="#000000" fill="none" d="M0 0L20 20"/></g><circle id="dot" r="4" fill="#000000"/></svg>`);
  await expect(page.locator("tr")).toHaveCSS("opacity", "0.75");
  await expect(page.locator("#bar")).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await expect(page.locator("#bar")).not.toHaveCSS("box-shadow", "none");
  await expect(page.locator("#whisker")).toHaveCSS("background-color", "rgb(192, 181, 196)");
  await expect(page.locator("#cell")).toHaveCSS("color", "rgb(23, 23, 23)");
  await expect(page.locator("#toggle")).toHaveCSS("background-color", "rgb(12, 10, 14)");
  await expect(page.locator("#label")).toHaveCSS("fill", "rgb(245, 241, 246)");
  await expect(page.locator("#line")).toHaveCSS("stroke", "rgb(0, 0, 0)");
  await expect(page.locator("#line")).not.toHaveCSS("filter", "none");
  await expect(page.locator("#dot")).toHaveCSS("stroke", "rgb(89, 71, 95)");
  const result = await new AxeBuilder({ page }).withRules(["color-contrast"]).include(["#interval", "#cell", "#toggle", "#code"]).analyze();
  expect(result.violations).toEqual([]);
});
