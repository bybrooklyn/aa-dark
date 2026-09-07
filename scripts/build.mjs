import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(projectRoot, "src");
const distDir = path.join(projectRoot, "dist");
const manifest = JSON.parse(await readFile(path.join(srcDir, "manifest.json"), "utf8"));

if (manifest.manifest_version !== 3) throw new Error("Only Manifest V3 is supported.");
if (manifest.permissions || manifest.host_permissions || manifest.background || manifest.action) {
  throw new Error("Manifest gained a permission, background worker, or action UI; review the single-purpose privacy model.");
}
if (manifest.content_scripts.some((script) => script.js)) {
  throw new Error("Manifest gained a content script; the extension is CSS-only. Review the privacy policy and store listing.");
}

await rm(distDir, { recursive: true, force: true });
await mkdir(path.join(distDir, "icons"), { recursive: true });

await import("./generate-assets.mjs");

for (const file of ["manifest.json", "preflight.css", "theme.css"]) {
  await cp(path.join(srcDir, file), path.join(distDir, file));
}

await cp(path.join(projectRoot, "generated-assets", "icons"), path.join(distDir, "icons"), { recursive: true });
await cp(path.join(projectRoot, "LICENSE"), path.join(distDir, "LICENSE"));
await writeFile(path.join(distDir, "BUILD_INFO.txt"), `Artificial Analysis Dark ${manifest.version}\nCC0-1.0\n`, "utf8");

console.log(`Built extension ${manifest.version} in ${distDir}`);
