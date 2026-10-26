# REL-01 compatible integration

Base: production main a8789cbc3c5c20f068788b70e6e5f10ac0958915.
Accepted frontend/public source: aeb22dcfba481603c6192da7872e21b6bc470b4a.
Branch: codex/rel01-compatible. No whole-branch merge, collector change or workflow change.

The current main also includes REL-OPEN-01: public R2 is the single coming-soon page, including direct/legacy URLs. This presentation gate is preserved; underlying collection, state and cohort modules remain intact.

The current main already contains the accepted POLISH/GAP/TECH interface. This change carries only the remaining public-identity and PERF-02 differences, plus the immutable r1-public-v1 projection/build allowlist.

The existing production collector, source-config, R1 archive lock and every locked input stay unchanged. The entire six-file R2 state stays unchanged, including its history. This base has 29 confirmed submissions; future collection may increase or revise that count through the existing pipeline. No data from the older 23-entry frontend candidate replaces it.

Ordinary builds verify and copy committed public R1 bytes, never regenerate them from private archives. Existing private archive inputs remain in the source tree because the unchanged production archive lock requires them; they are not newly added by this integration and are never copied into dist. Git history is not rewritten. No claim is made that old repository mappings cease to exist. Previously approved authored-text/comment exceptions remain unmodified.

R2 keeps its current confirmed-track semantics even when submission time is unknown. Its cohort is still the existing approved R1 pass UUID set. The existing reference promise is primed from an already mounted public R1 view where available; direct R2 URLs use the same R1 loader. There is no second loader, persistent browser cache or new calculation formula. R2 score/analytics capabilities remain off.

Existing test:release, test:release:browser, validate and update commands stay unchanged. Existing workflows can run their source checks before build and browser checks after build. Public source tests no longer require dist; artifact assertions are a separate test:public:artifact gate, and every build always runs the whole-dist privacy scanner.

Local checks on official Node22 and pinned Playwright:

- npm ci --ignore-scripts --no-audit --no-fund
- npm test (before build)
- npm run test:release (before build; collector tests use only loopback fixtures)
- npm run validate
- npm run build
- npm run test:public:artifact
- npm run test:release:browser
- npm run test:browser

Browser checks cover root and /ib19/, R1/R2 and all primary routes, profiles25/50 and direct URLs, Back/Forward, filters/sorting, matrix comments/focus, both themes, 390/1440 and failed CSS/JS recovery. A local CSP intentionally blocks external Cloudflare analytics and YouTube; unexpected violations fail the extra smoke. No CSP or production security configuration is changed.

Publication remains unauthorized. Before a future release, verify current main/R2 again and refresh the rollback record. Retain the existing ib19-publish concurrency and MAINT-03. Do not overwrite newer data with this branch snapshot. Roll back frontend/build changes only, preserving any newer R2 state and the existing collector; no whole-main reset. The production backup and reconstruction details remain outside Git in the REL-01 local report.
