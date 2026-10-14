# Architecture — TUZ19

**Snapshot basis:** uploaded `ib19-main.zip`, 14 Oct 2026; compare against the current `main` before acting. Node >=22; vanilla JS, CSS, static JSON; GitHub Pages, no app server/database in production.

## Frontend
- `index.html`: shell, overview, dynamics, judges, rappers, methodology sections; scripts loaded from `js/`.
- `css/styles.css`: main UI. `css/site-wallpaper.css` and `css/assets/overview-wallpaper.jpg`: site-wide wallpaper/background treatment.
- `js/app.js`: initialization and data integration; `js/data.js`, `js/loader.js`, `js/routes.js`: loading/navigation; `js/calculations.js`, `js/personal.js`, `js/score-economy.js`, `js/pace-model.js`: analytics; `js/judge-*`, `js/forum-link*`, `js/pace-page.js`, `js/methodology.js`: page-specific presentation; `js/interactions-*.js`: UI interaction behavior.
- Cloudflare Web Analytics script appears in `index.html`.

## Data and tools
- `data/19ib_all_judges_REPAIRED.json`: primary API-derived data; `data/forum.csv`: curated forum/veteran UUID membership; `data/forum_judges_export.json`: merged forum scoring data; `data/history.json`: baseline and observed revisions; `data/metadata.json`: successful collection metadata.
- `scripts/collector.mjs`, `scripts/fetch-data.mjs`, `scripts/update-history.mjs`: collection/reconciliation; `scripts/validate-data.mjs`, `scripts/check.mjs`: integrity; `scripts/build.mjs`: `dist/` output; `scripts/serve.mjs`: local server.
- `tests/*.test.mjs`: Node regression checks; `tests/browser.mjs`, `tests/ui-reference.mjs`, `tests/loader.mjs`: Playwright/UI checks.

## Release
- `.github/workflows/deploy.yml`: push to `main` or manual dispatch -> tests, browser tests, validate, build, Pages deploy.
- `.github/workflows/update-data-scheduled.yml`: workflow_dispatch from Cloudflare/manual -> gated collection -> tests/validation -> commit data when changed -> Pages deploy when needed.
- Shared GitHub Actions concurrency group `ib19-publish`, cancel-in-progress false.
- `cloudflare/worker.mjs`, `clock-core.mjs`, `wrangler.jsonc`: independent clock and deduplication; no site backend.

For details consult `README.md`, `docs/INCREMENTAL_UPDATE.md`, `docs/VALIDATION.md`, and `cloudflare/README.md`. Some README operational claims predate the Cloudflare switch.
