# Data pipeline and scheduled updates

## Source and collection
- API `https://api.19ib.ru`; pinned round ID in `scripts/source-config.json`. Public endpoints documented in README: `/rounds/{id}/full`, `/rounds/{id}/entries/{userId}/scores`, `/rounds/{id}/live`.
- Main data in `data/19ib_all_judges_REPAIRED.json`; author-curated forum roster in `data/forum.csv` (exact UUIDs); merged `data/forum_judges_export.json`.
- `data/history.json` preserves baseline, revisions and observed index states; distinguish API `scoredAt` from collector `observedAt`. `data/metadata.json` tracks collection/publication state. Archived missing API members are not silently deleted or counted as current.
- Incremental collection and periodic full audit are distinct modes; inspect `docs/INCREMENTAL_UPDATE.md`, `scripts/collection-state.mjs` and workflow inputs before changing logic.

## Current scheduling (code snapshot)
- `cloudflare/wrangler.jsonc`: Worker `tuz19-clock`, cron `1-59/10 * * * *` (minute 1,11,21,31,41,51 each hour), `ENABLED=true`, `DRY_RUN=false` in repository config.
- Cloudflare Worker uses GitHub App dispatch for `.github/workflows/update-data-scheduled.yml`; GitHub workflow itself uses `workflow_dispatch` and has no native schedule in this snapshot.
- `cloudflare/clock-core.mjs` and Durable Object `SCHEDULER` guard against duplicate slots and skip busy collection/deploy windows. Scheduled invocation is **not** proof that new data was published.
- GitHub workflow checks latest state, runs collection/tests/validation, commits updated data and deploys Pages only as permitted by its gates. Shared `ib19-publish` concurrency prevents overlapping writers.
- A busy 10-minute slot can be skipped. Collection can take longer than ten minutes; **do not promise publication every ten minutes**.

## Safety and validation
- `npm test`, `npm run validate`, `npm run build`; browser checks on full audits and normal site deployments. Do not run `npm run update` without intending to query live API and potentially change local data.
- Never expose Cloudflare secret `GH_PRIVATE_KEY`; never enable both Cloudflare and old GitHub native cron simultaneously.
- For incidents: inspect Cloudflare Cron event -> GitHub workflow_dispatch/run -> collection result -> data commit -> Pages deployment -> site `metadata.json`. See `cloudflare/README.md` and `docs/UPDATE_DIAGNOSTICS.md` (the latter describes an older 13 Oct hourly incident).
- Operational HTTPS, runtime health and true update cadence **cannot be verified from the ZIP**; check production logs separately.
