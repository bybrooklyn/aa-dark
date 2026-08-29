import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(projectRoot, "dist");
const releaseDir = path.join(projectRoot, "releases");
const manifest = JSON.parse(await readFile(path.join(distDir, "manifest.json"), "utf8"));
const files = {};
/* A timezone-safe, deterministic DOS timestamp within ZIP's 1980–2099 range. */
const fixedTime = new Date("2000-01-01T12:00:00.000Z");

async function collect(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await collect(absolute, relative);
    else files[relative] = [new Uint8Array(await readFile(absolute)), { mtime: fixedTime }];
  }
}

await collect(distDir);
if (!files["manifest.json"]) throw new Error("manifest.json must be at the ZIP root.");

await mkdir(releaseDir, { recursive: true });
const output = path.join(releaseDir, `artificial-analysis-dark-${manifest.version}.zip`);
await writeFile(output, zipSync(files, { level: 9 }));

console.log(`Packaged ${Object.keys(files).length} files at ${output}`);
