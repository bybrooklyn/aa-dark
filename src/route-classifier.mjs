export const SUPPORTED_LOCALES = new Set([
  "de",
  "en",
  "es",
  "ja",
  "ko",
  "pt",
  "zh",
]);

export const ROUTE_FAMILIES = new Set([
  "home",
  "models",
  "providers",
  "agents",
  "evaluations",
  "articles",
  "image",
  "video",
  "speech",
  "arenas",
  "docs",
  "marketing",
]);

export function stripLocale(pathname) {
  const normalized = normalizePath(pathname);
  const segments = normalized.split("/").filter(Boolean);

  if (segments.length > 0 && SUPPORTED_LOCALES.has(segments[0])) {
    segments.shift();
  }

  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

export function classifyPath(pathname) {
  const path = stripLocale(pathname);
  const segments = path.split("/").filter(Boolean);
  const first = segments[0] ?? "";

  if (path === "/") return "home";
  if (first === "models" || first === "leaderboards") return "models";
  if (first === "providers" || first === "hardware-inference-stack") return "providers";
  if (first === "agents" || first === "tools") return "agents";
  if (first === "evaluations" || first === "microevals") return "evaluations";
  if (first === "articles" || first === "changelog" || first === "trends") return "articles";
  if (first === "image" || first === "image-lab") return "image";
  if (first === "video" || first === "music") return "video";
  if (["text-to-speech", "speech-to-text", "speech-to-speech"].includes(first)) return "speech";
  if (path.includes("/arena") || path.includes("/playground")) return "arenas";
  if (first === "api-reference" || first === "data-api") return "docs";
  if (["about", "brand-kit", "contact", "faq", "login", "methodology", "services", "optima"].includes(first)) {
    return "marketing";
  }

  return "unknown";
}

function normalizePath(pathname) {
  const value = typeof pathname === "string" && pathname.length > 0 ? pathname : "/";
  const withoutQuery = value.split(/[?#]/, 1)[0] || "/";
  const withLeadingSlash = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  return withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, "") : withLeadingSlash;
}
