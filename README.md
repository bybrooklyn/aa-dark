# Dark Mode for Artificial Analysis — Unofficial

A site-specific Chromium extension that gives [Artificial Analysis](https://artificialanalysis.ai/) a carefully designed charcoal-and-plum dark theme.

This is not an inversion filter. It is two CSS files and nothing else: no JavaScript, no permissions. It re-points the site's own color tokens, themes its known components, preserves chart series and media, and treats logos for dark-background legibility.

This project is independent and is not affiliated with, endorsed by, or sponsored by Artificial Analysis.

## Install locally

1. Install dependencies and build:

   ```sh
   bun install
   bun run build
   ```

2. Open `chrome://extensions` in a Chromium-based browser.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select this project's `dist` directory.
5. Visit `https://artificialanalysis.ai/`.

The theme is intentionally always on. Disable the extension from the browser's extension manager to return to the original site.

## Development

```sh
bun run test           # manifest, theme, and contrast contracts
bun run test:components # deterministic browser checks without the live site
bun run test:e2e       # component fixtures, official-site checks, and screenshots
bun run package        # produce the Chrome Web Store upload ZIP
bun run validate       # run the complete release gate
```

Playwright's bundled Chromium must be installed once:

```sh
bunx playwright install chromium
```

The component suite loads the real extension against intercepted fixture documents at its permitted origin; it needs no live-site responses. It covers opacity, focus, selection, row colors, tooltips, print, and forced colors.

The full browser suite also uses the official live site. Each representative route has independent surface and contrast checks, and interaction tests open navigation, search, table filters, chart controls, and arena dialogs. Chart fills and media are compared with a browser without the extension. Page readiness uses rendered content rather than a fixed delay. A failure can mean either an extension regression or deliberate upstream markup changes; investigate rather than updating selectors or allowlists blindly.

Interaction and narrow-layout screenshots are saved under `test-results/`; the five store screenshots are refreshed under `store-assets/screenshots/`. Review them before publishing. See [the polish validation record](docs/polish-validation.md) for the latest run and its coverage limits.

## Chrome Web Store package

With [`just`](https://just.systems/) installed, run:

```sh
just
```

The default recipe builds and verifies `releases/artificial-analysis-dark-<version>.zip`. Upload that ZIP to the Chrome Web Store dashboard. The dashboard does not accept CRX files.

For a signed CRX intended only for local or non-store distribution, keep the signing key outside this repository and run:

```sh
just crx /absolute/path/to/private-key.pem
```

## Publishing

One-time setup:

```sh
just ready
```

It checks prerequisites, walks through creating a Google Cloud OAuth client for the Chrome Web Store API, obtains a refresh token in the browser, writes it to a gitignored `.env`, and verifies it against the live store item.

Per release:

```sh
just publish 0.1.1            # full gate: unit, e2e, package
just publish 0.1.1 fast       # unit + package only
just publish 0.1.1 --force    # release even if the working tree is not clean
```

`publish` refuses a dirty tree (unless `--force`), a branch other than `main`, a `main` that is behind `origin/main`, an existing tag, or a store submission that is still under review. It then bumps `package.json` and `src/manifest.json`; commits `Release X.Y.Z`; tags `vX.Y.Z`; uploads and submits the ZIP to the Chrome Web Store (it publishes automatically after Google's review); pushes; and creates a GitHub Release with the ZIP attached. If the gate fails, the bump is reverted; if a later step fails, it prints the exact commands to resume or undo.

## Design rules

- No page-wide `filter`, inversion, brightness transform, or media recoloring.
- The site's own HSL tokens (`--neutral-*`, `--brand-*`, shadcn `--background`/`--card`/...) are re-pointed first, so every utility and hover/state variant built on them follows; only literal Tailwind colors get explicit rules.
- Neutral surfaces are translated into a dark elevation system; AA's categorical and brand accents remain meaningful.
- Recharts axes, grids, labels, legends, and tooltips are themed; data series remain untouched.
- Article imagery, arena media, video, audio, and canvas content retain their original appearance.
- Print output stays light, and forced-colors mode remains under operating-system control.
- No JavaScript, settings, storage, analytics, remote code, or data transmission.

## License

Released under [CC0 1.0 Universal](LICENSE). The Artificial Analysis website, name, screenshots, and third-party marks remain the property of their respective owners.
