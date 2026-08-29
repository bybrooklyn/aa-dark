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

## Design rules

- No page-wide `filter`, inversion, brightness transform, or media recoloring.
- Neutral surfaces are translated into a dark elevation system; AA's categorical and brand accents remain meaningful.
- Recharts axes, grids, labels, legends, and tooltips are themed; data series remain untouched.
- Article imagery, arena media, video, audio, and canvas content retain their original appearance.
- Print output stays light, and forced-colors mode remains under operating-system control.
- No settings, storage, analytics, remote code, or data transmission.

## License

Released under [CC0 1.0 Universal](LICENSE). The Artificial Analysis website, name, screenshots, and third-party marks remain the property of their respective owners.
