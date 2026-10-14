# Backlog / verification queue

## Confirmed work to consider
- **Audio track submission feature**: discussed with owner, not identified as an implemented module in this ZIP. Before implementation: define file size/duration, authentication/moderation, hosting/storage, playback and abuse protection. GitHub Pages alone is not an upload backend. Prototype and agree UX first.
- **Improve operating reliability:** exported 14 Oct audit said Cloudflare ticks were punctual but busy slots were skipped; full audit and HTTPS checks needed. Check latest Cloudflare/GitHub logs before deciding on fixes. Do not treat that historical audit as a live incident.
- **HTTPS/domain:** older `README.md` and `docs/UPDATE_DIAGNOSTICS.md` mention certificate/DNS problems; re-check current site, don't assume still broken.
- **Documentation drift:** README describes old hourly scheduling, whereas `cloudflare/wrangler.jsonc` and update workflow show a Cloudflare 10-minute clock. Update README after reviewing current production behavior.

## Possible enhancements — not approved scope
- Subtle forum easter eggs, interactive reactions and playful judge graphics: discussed in ChatGPT; require explicit owner-approved prototype before coding.
- Review data freshness UX for tabs left open (older diagnostics say refresh required). Check actual behavior first.

## Handoff checklist
- Confirm branch and current Git status; reconcile ZIP snapshot with actual main.
- Check whether the last CI/deployment passed and whether any local unpushed changes exist.
- Start a new chat for one bounded task; read `AGENTS.md` and only relevant docs.
- For UI: request approved prototype; for infra: request exact expected behavior and constraints.
