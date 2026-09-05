# Dark Mode for Artificial Analysis — Unofficial

A site-specific Chromium extension that gives [Artificial Analysis](https://artificialanalysis.ai/) a carefully designed charcoal-and-plum dark theme.

This is not an inversion filter. It themes the site's semantic tokens and known components, preserves chart series and media, treats logos for dark-background legibility, and audits the live public route catalog for drift.

This project is independent and is not affiliated with, endorsed by, or sponsored by Artificial Analysis.

## Install locally

1. Install dependencies and build:

   ```sh
   npm install
   npm run build
   ```

2. Open `chrome://extensions` in a Chromium-based browser.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select this project's `dist` directory.
5. Visit `https://artificialanalysis.ai/`.

The theme is intentionally always on. Disable the extension from the browser's extension manager to return to the original site.

## Development

```sh
npm test               # route, manifest, theme, and contrast contracts
npm run audit:live     # classify every route in all public sitemaps
npm run test:e2e       # load the real extension in bundled Chromium
npm run package        # produce the Chrome Web Store upload ZIP
npm run validate       # run the complete release gate
```

Playwright's bundled Chromium must be installed once:

```sh
npx playwright install chromium
```

The browser suite uses the live site. A failure can mean either a regression in this extension or deliberate upstream markup changes; investigate rather than updating selectors or allowlists blindly.

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
just publish 0.1.1        # full gate: unit, live route audit, e2e, package
just publish 0.1.1 fast   # unit + package only
```

`publish` refuses a dirty tree, a branch other than `main`, an out-of-sync `origin/main`, an existing tag, or a store submission that is still under review. It then bumps `package.json`, `package-lock.json`, and `src/manifest.json`; commits `Release X.Y.Z`; tags `vX.Y.Z`; uploads and submits the ZIP to the Chrome Web Store (it publishes automatically after Google's review); pushes; and creates a GitHub Release with the ZIP attached. If a step fails after the release commit, it prints the exact commands to resume or undo.

## Design rules

- No page-wide `filter`, inversion, brightness transform, or media recoloring.
- Neutral surfaces are translated into a dark elevation system; AA's categorical and brand accents remain meaningful.
- Recharts axes, grids, labels, legends, and tooltips are themed; data series remain untouched.
- Article imagery, arena media, video, audio, and canvas content retain their original appearance.
- Print output stays light, and forced-colors mode remains under operating-system control.
- No settings, storage, analytics, remote code, or data transmission.

## License

Released under [CC0 1.0 Universal](LICENSE). The Artificial Analysis website, name, screenshots, and third-party marks remain the property of their respective owners.
