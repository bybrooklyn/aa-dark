# Theme polish and validation — 2026-09-25

## Changes

- Preserve the alpha of `bg-white/95`, `/90`, `/85`, `/80`, and `/50`, including the existing translucent white hover variant. Solid child surfaces remain solid.
- Provide a visible keyboard focus outline, including controls where the site removes the default outline.
- Put table hover highlighting on the row so colored cells retain their backgrounds.
- Preserve chart tooltip series colors while keeping tooltip headings neutral.
- Let the browser and site control forced-color rendering by excluding both extension stylesheets from that mode. Print remains light.
- Fix featured navigation links whose neutral-700 backgrounds became too light under white text.
- Raise inactive section navigation labels from 50% to 70% opacity. This fixes the tiny New/Updated badges on the homepage and agent pages while keeping the full-opacity hover state.

The extension remains CSS-only, always on, and limited to the original exact host. Its manifest and version are unchanged.

## Validation approach

The baseline used the actual built extension in Chromium on the official public site. Desktop captures included the homepage, model leaderboard, DeepSeek provider page, image arena, and API docs, with matching unthemed pages and narrow-layout captures. Baseline automated checks found insufficient contrast in a homepage Updated badge; opening the desktop menu revealed the pale featured-link backgrounds.

Local browser fixtures intercept a document at the permitted origin, so Chromium injects the real extension. They exercise opacity and nested surfaces, hover and selected states, keyboard focus, disabled controls, semantic table cells, chart/media colors, print, forced colors, dimmed navigation labels, and contrast thresholds. Palette unit checks read the actual CSS values.

The official-site suite checks surfaces and contrast independently on 23 representative routes. It also opens desktop navigation, global and documentation search, leaderboard filters, chart tooltips and model selectors, and the arena prompt dialog. A browser without the extension supplies the reference for chart fill/stroke and media-filter comparisons. Narrow-layout checks use a 390 × 844 viewport; store captures use 1280 × 800.

Readiness checks wait for rendered content, fonts, and finite entrance transitions. Hover sampling ignores controls physically covered by other elements. Normal text uses a 4.5:1 contrast floor; large text uses 3:1.

## Results

- All 7 unit tests passed.
- All 64 browser checks passed with retries disabled (about 1.7 minutes), including all 23 representative public routes.
- A focused rerun also passed after strengthening the unthemed comparison to use actual article images; the provider page contains no non-logo media.
- Reviewed all five refreshed store screenshots, open navigation/search/filter/chart/dialog captures, and four narrow-layout pages plus the navigation drawer.
- The ZIP passed `unzip -t`; its manifest and both CSS files exactly match the current source. It contains only the expected nine package entries.
- `git diff --check` passed.

Package: `releases/artificial-analysis-dark-0.1.3.zip` (unpublished local build).

SHA-256: `f9ba57297d4abfd850f2b4e1b3c9f3a7b6cc08bf3eafcc70ac657e524ab3cdba`.

## Commands and artifacts

- `bun run test`: manifest, theme, version, and palette contracts.
- `bun run test:components`: local browser fixtures, without live-site dependencies.
- `bun run test:e2e`: complete browser coverage and screenshot refresh.
- `bun run package`: local ZIP in `releases/`.
- `git diff --check`: whitespace validation.

Store screenshots are under `store-assets/screenshots/`. Interaction and narrow-layout screenshots are under the ignored `test-results/` directory; Playwright's HTML report is under `playwright-report/`.

## Limits

This covers anonymous public pages in bundled Chromium, including emulated print and forced colors. It does not establish behavior in every Chromium version, on physical Windows high-contrast installations, or on signed-in pages. The pre-existing `.saw` animated-flowchart contrast exclusion remains; no new contrast exclusions were added. Official-site content and markup can change after this run.

The image arena sometimes retains its loading blur in automation. A separate browser **without the extension** reproduced the persistent blur and reported `net::ERR_ADDRESS_UNREACHABLE` for `brunhild.challenges.cloudflare.com`. Consequently, the narrow arena capture covers the page shell, and loaded arena images were not fully validated. The browser test annotates this condition rather than treating the screenshot as a loaded-media review. Arena controls and the prompt dialog, plus separate article-media preservation, were checked successfully.

No store upload or publication was performed.
