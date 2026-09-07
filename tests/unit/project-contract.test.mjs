import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifest = JSON.parse(await readFile(new URL("../../src/manifest.json", import.meta.url), "utf8"));
const pkg = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
const preflight = await readFile(new URL("../../src/preflight.css", import.meta.url), "utf8");
const theme = await readFile(new URL("../../src/theme.css", import.meta.url), "utf8");

test("manifest and package versions match", () => {
  assert.equal(manifest.version, pkg.version, "just publish bumps both; keep them in sync by hand otherwise");
});

test("manifest is a minimal, exact-host, always-on, CSS-only MV3 extension", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.content_scripts.length, 1);
  const [script] = manifest.content_scripts;
  assert.deepEqual(script.matches, ["https://artificialanalysis.ai/*"]);
  assert.deepEqual(script.css, ["preflight.css", "theme.css"]);
  assert.equal(script.js, undefined, "the extension ships no JavaScript; PRIVACY.md and the store listing say so");
  assert.equal(script.run_at, "document_start");
  assert.equal(script.all_frames, false);
  for (const forbidden of ["permissions", "optional_permissions", "host_permissions", "background", "action", "options_page"]) {
    assert.equal(manifest[forbidden], undefined, `${forbidden} must remain absent`);
  }
});

test("preflight prevents a white flash without touching unrelated hosts", () => {
  assert.match(preflight, /#100d12/);
  assert.match(preflight, /color-scheme:\s*dark/);
});

test("theme re-points the site's tokens instead of inverting the page", () => {
  assert.doesNotMatch(theme, /filter:\s*(?:invert|brightness\([^)]*\)\s+invert)/i);
  for (const token of ["--background", "--card", "--neutral-50", "--neutral-200", "--neutral-900", "--brand-blue-light"]) {
    assert.match(theme, new RegExp(`^\\s{4}${token}: \\d`, "m"), `${token} is overridden at the root`);
  }
  // The only universal-selector rule replaces Tailwind's preflight border color.
  const css = theme.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\[[^\]]*\]/g, "[]");
  const universal = [...css.matchAll(/([^{}]*)\{([^}]*)\}/g)]
    .filter(([, selector]) => selector.includes("*"))
    .map(([rule]) => rule.replace(/\s+/g, " ").trim());
  assert.deepEqual(universal, ["html *, html ::before, html ::after { border-color: var(--aad-border); }"]);
});

test("theme handles the utilities that bypass the site's tokens", () => {
  for (const literal of [".text-neutral-950", ".text-neutral-800", ".text-neutral-400", ".bg-neutral-300", ".border-neutral-300", ".bg-white", ".text-black", ".border-black"]) {
    assert.match(theme, new RegExp(`html:root [^{]*${literal.replace(".", "\\.")}[\\s,:)]`), `${literal} is a literal Tailwind color and needs an explicit rule`);
  }
  assert.match(theme, /\.bg-neutral-900[^{]*\{\s*background-color: var\(--aad-code\)/, "inverted neutral-900 must stay dark where the site uses it as a fill");
  assert.doesNotMatch(theme, /button:disabled/, "the site dims disabled controls with opacity; recoloring them breaks bright buttons");
});

test("theme themes chart scaffolding and leaves data series and media alone", () => {
  assert.match(theme, /\.recharts-cartesian-grid/);
  assert.match(theme, /\.recharts-default-tooltip/);
  assert.match(theme, /\.recharts-surface text\[fill="black"\]/);
  assert.match(theme, /\.recharts-label-list:not\(\[fill\]\) text:not\(\[fill\]\)/);
  assert.doesNotMatch(theme, /\.recharts-(?:line-curve|area-curve|bar-rectangle|scatter-symbol)[^{]*\{/);
  assert.match(theme, /main video[\s\S]*filter:\s*none/);
  assert.match(theme, /img\[src\*="\/img\/logos\/"\]/);
});

test("declared palette meets the planned contrast floor", () => {
  const colors = {
    canvas: "#100d12",
    surface3: "#2b2230",
    text: "#f5f1f6",
    muted: "#c0b5c4",
    neutral600: "#aca0b1",
    subtle: "#9a8da0",
    purple: "#ae82ff",
    info: "#8ec7ff",
    success: "#8fe3c5",
    warning: "#ffc56e",
    danger: "#ff7c88",
  };
  for (const [name, hex] of Object.entries(colors)) {
    if (name === "canvas" || name === "surface3") continue;
    assert.ok(contrast(hex, colors.surface3) >= 4.5, `${name} on surface-3`);
  }
});

function contrast(left, right) {
  const a = luminance(left);
  const b = luminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function luminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((value) => Number.parseInt(value, 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}
