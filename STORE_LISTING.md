# Chrome Web Store listing

## Name

Dark Mode for Artificial Analysis — Unofficial

## Short description

A carefully designed dark theme for Artificial Analysis that preserves charts, media, and brand colors.

## Category

Accessibility

## Language

English

## Single purpose

Apply a site-specific, always-on dark visual theme to Artificial Analysis while preserving the meaning and appearance of charts, media, and categorical colors.

## Detailed description

Artificial Analysis is dense with leaderboards, comparison tables, charts, documentation, articles, and media tools. This extension gives those interfaces a dark theme designed specifically for their component system.

Highlights:

- Charcoal-and-plum surfaces with accessible text contrast
- Purpose-built styling for leaderboards, model pages, provider pages, documentation, menus, forms, dialogs, and responsive navigation
- Chart axes, grids, labels, and tooltips adapted for dark surfaces without changing data-series colors
- Images, videos, arena media, and canvas output left untouched
- Public localized pages covered without text-dependent selectors
- No flash of white during page startup
- Print-friendly light output

The extension is always on for Artificial Analysis and has no settings panel. Disable it in your browser's extension manager to return to the original appearance.

Privacy: no analytics, tracking, storage, remote code, or data transmission. The extension runs only on `artificialanalysis.ai` and changes presentation locally.

This is an independent project and is not affiliated with, endorsed by, or sponsored by Artificial Analysis.

## Permission justification

`https://artificialanalysis.ai/*`: required solely to inject the local theme stylesheet and route-family marker on the website the extension is designed to theme. No page data is collected, persisted, or transmitted.

## Remote code declaration

No remote code is used.

## Data-use declaration

No user data is collected or used.

## Graphic assets

- Store icon: `store-assets/icon-128.png`
- Small promotional tile: `store-assets/promo-tile-440x280.png`
- Screenshots: `store-assets/screenshots/*-1280x800.png`

## Publication prerequisites owned by the publisher

- Host `PRIVACY.md` at a public HTTPS URL.
- Provide a public support URL or support email.
- Confirm current Chrome Web Store policy fields in the publisher dashboard.
- Upload the ZIP from `releases/` only after `npm run validate` passes.
