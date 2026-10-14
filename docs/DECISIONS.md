# Key decisions — source-aware

These are established from repository files and the exported Codex chat, not a claim that all production settings are currently healthy.

1. **Static architecture:** vanilla JS/CSS + JSON on GitHub Pages; avoid introducing React, server or DB without a separate product/technical decision (`README.md`, `package.json`).
2. **Data integrity over convenience:** pinned round ID, exact UUID roster mapping, retained archived members and score/comment revision history (`README.md`, `scripts/source-config.json`, `docs/ROSTER_UPDATE.md`).
3. **Index methodology is deliberate:** preserve existing formulas and regression fixtures; satirical forum index is not evidence of bias (`js/calculations.js`, `docs/V108.html`).
4. **Production publication is gated:** tests/validation before deploy; no force pushes or blind recovery by deleting history (`.github/workflows/*.yml`, README).
5. **Scheduling moved to Cloudflare:** ten-minute clock triggers GitHub workflow; overlapping runs skipped/serialized. This supersedes README's old hourly cron description (`cloudflare/README.md`, `cloudflare/wrangler.jsonc`, update workflow).
6. **Approved visual design is preserved:** historical V95/overview reference plus recent wallpaper changes, mobile states and strict visual regression (`docs/UI_REFERENCE_RESTORE.md`, `css/site-wallpaper.css`, `tests/ui-reference.mjs`, exported chat).
7. **Product/design before implementation:** new working agreement from owner: prototype and acceptance here in ChatGPT, focused Codex task only after approval. This is a process rule, not an existing repo feature.

For a future decision, append date, motivation, alternatives, outcome and relevant code/commit. Do not turn unconfirmed suggestions from old chat into accepted decisions.
