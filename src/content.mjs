import { classifyPath } from "./route-classifier.mjs";

const THEME_ATTRIBUTE = "data-aad-theme";
const PAGE_ATTRIBUTE = "data-aad-page";
let lastPathname = "";
let scheduled = false;

function applyThemeMetadata() {
  const root = document.documentElement;
  if (!root) return;

  const pathname = location.pathname;
  root.setAttribute(THEME_ATTRIBUTE, "dark");
  root.setAttribute(PAGE_ATTRIBUTE, classifyPath(pathname));
  root.style.colorScheme = "dark";
  lastPathname = pathname;
}

function scheduleRouteCheck() {
  if (scheduled) return;
  scheduled = true;

  queueMicrotask(() => {
    scheduled = false;
    if (location.pathname !== lastPathname || !document.documentElement?.hasAttribute(THEME_ATTRIBUTE)) {
      applyThemeMetadata();
    }
  });
}

applyThemeMetadata();

if (!document.documentElement) {
  new MutationObserver((_, observer) => {
    if (!document.documentElement) return;
    applyThemeMetadata();
    observer.disconnect();
  }).observe(document, { childList: true });
}

addEventListener("popstate", scheduleRouteCheck, { passive: true });
addEventListener("hashchange", scheduleRouteCheck, { passive: true });

new MutationObserver(scheduleRouteCheck).observe(document, {
  childList: true,
  subtree: true,
});
