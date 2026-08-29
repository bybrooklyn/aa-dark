import { classifyPath } from "../src/route-classifier.mjs";

const origin = "https://artificialanalysis.ai";
const sitemapUrls = [
  `${origin}/sitemap.xml`,
  ...["de", "es", "ja", "ko", "pt", "zh"].map((locale) => `${origin}/sitemap-${locale}.xml`),
];
const counts = new Map();
const unknown = [];
let total = 0;

for (const sitemapUrl of sitemapUrls) {
  const response = await fetch(sitemapUrl, { headers: { "user-agent": "AA-Dark-Route-Audit/0.1" } });
  if (!response.ok) throw new Error(`${sitemapUrl} returned HTTP ${response.status}`);
  const xml = await response.text();
  const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  if (locations.length === 0) throw new Error(`${sitemapUrl} contained no <loc> entries.`);

  for (const location of locations) {
    const url = new URL(location);
    if (url.origin !== origin) throw new Error(`Unexpected sitemap origin: ${location}`);
    const family = classifyPath(url.pathname);
    total += 1;
    counts.set(family, (counts.get(family) ?? 0) + 1);
    if (family === "unknown") unknown.push(url.pathname);
  }
}

if (unknown.length > 0) {
  console.error(`Unknown public route families (${unknown.length}):`);
  console.error([...new Set(unknown)].slice(0, 100).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Classified ${total} public sitemap entries across ${sitemapUrls.length} sitemaps.`);
  for (const [family, count] of [...counts].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`${family.padEnd(12)} ${count}`);
  }
}
