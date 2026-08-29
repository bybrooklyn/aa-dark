import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatedDir = path.join(projectRoot, "generated-assets");
const iconSource = await readFile(path.join(projectRoot, "assets", "icon.svg"));
const promoSource = await readFile(path.join(projectRoot, "assets", "promo-tile.svg"));

await mkdir(path.join(generatedDir, "icons"), { recursive: true });
await mkdir(path.join(projectRoot, "store-assets"), { recursive: true });

for (const size of [16, 32, 48, 128]) {
  await sharp(iconSource, { density: 384 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(path.join(generatedDir, "icons", `icon-${size}.png`));
}

await sharp(promoSource, { density: 192 })
  .resize(440, 280)
  .png({ compressionLevel: 9 })
  .toFile(path.join(projectRoot, "store-assets", "promo-tile-440x280.png"));

console.log("Generated extension icons and store promotional tile.");
