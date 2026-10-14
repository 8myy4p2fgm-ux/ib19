# Design rules and prototype handoff

## Workflow
1. Discuss user experience and forum references in ChatGPT; build an HTML prototype using the **current** site as baseline.
2. Owner approves desktop/mobile layout, interaction states, text and acceptance criteria.
3. Codex integrates only the approved change into repository modules; compares result with reference and runs relevant tests.
4. No unapproved redesign or wholesale style replacement.

## Current visual references
- Main reference: `docs/IB19_V95_WHITE_TUZ_HEADING.html`; overview-specific reference: `docs/TUZ_V95_overview_v6.html`; historical calculation regression reference: `docs/V108.html` (not necessarily the latest visual design).
- Production styles: `css/styles.css`, `css/site-wallpaper.css`; wallpaper asset `css/assets/overview-wallpaper.jpg`.
- Recent approved direction in exported chat: wallpaper used across pages, background treatment around 73% dimming, denser surfaces for legibility, fixed wallpaper; inspect current CSS for exact values rather than blindly reproducing percentages.
- Preserve dark, compact analytical presentation; readability and clear table row hover/selection matter. Forum jokes/easter eggs should be subtle, not obstruct charts or content.
- Check desktop and mobile states, especially 1440/1024/768/390/320 px. Keep chart labels, table readability, interactions, keyboard focus, and contrast usable.

## Regression discipline
- Use `npm run test:browser`; reference comparison tests may depend on viewport scroll position and pointer position with fixed wallpaper. Do not loosen screenshot thresholds merely to make tests pass.
- For loader behavior consult `js/loader.js` and `tests/loader.mjs`; documented minimum display about two seconds; test elapsed time from loader start, not DOM ready.
- Keep reference prototypes in `docs/` as historical artifacts; do not copy their embedded old data into the live frontend.
