import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifest = JSON.parse(await readFile(new URL("../../src/manifest.json", import.meta.url), "utf8"));
const preflight = await readFile(new URL("../../src/preflight.css", import.meta.url), "utf8");
const theme = await readFile(new URL("../../src/theme.css", import.meta.url), "utf8");

test("manifest is a minimal, exact-host, always-on MV3 content extension", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.content_scripts[0].matches, ["https://artificialanalysis.ai/*"]);
  assert.equal(manifest.content_scripts[0].run_at, "document_start");
  assert.equal(manifest.content_scripts[0].all_frames, false);
  for (const forbidden of ["permissions", "optional_permissions", "host_permissions", "background", "action", "options_page"]) {
    assert.equal(manifest[forbidden], undefined, `${forbidden} must remain absent`);
  }
});

test("preflight prevents a white flash without touching unrelated hosts", () => {
  assert.match(preflight, /#100d12/);
  assert.match(preflight, /color-scheme:\s*dark/);
});

test("theme is component-aware and never applies inversion", () => {
  assert.doesNotMatch(theme, /filter:\s*(?:invert|brightness\([^)]*\)\s+invert)/i);
  assert.doesNotMatch(theme, /html\[data-aad-theme[^}]+\]\s+\*/);
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
    subtle: "#9a8da0",
    purple: "#ae82ff",
  };
  assert.ok(contrast(colors.text, colors.surface3) >= 4.5);
  assert.ok(contrast(colors.muted, colors.surface3) >= 4.5);
  assert.ok(contrast(colors.subtle, colors.surface3) >= 4.5);
  assert.ok(contrast(colors.purple, colors.surface3) >= 4.5);
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
