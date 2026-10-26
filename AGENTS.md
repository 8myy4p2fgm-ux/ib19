# TUZ19 — instructions for Codex

Project: https://tuz19.ru/ · repo `8myy4p2fgm-ux/ib19` · 19th independent hip-hop battle judging analytics. Source of truth: current repository code and verified runtime logs, **not** old prototypes or stale README sections.

## Working agreement
- Product ideas, UX decisions, and HTML prototypes are discussed and approved with the owner in ChatGPT **before** implementation. Codex implements an agreed task; for uncertain feasibility, provide a short technical assessment first.
- One focused Codex chat per task or closely related changes. Read this file and only task-relevant docs/files; avoid repository-wide audits unless explicitly requested.
- Keep agreed design, existing calculations, forum humor, responsive behavior, and data integrity. Never quietly replace methodology, historical data, roster membership, or UI references.
- Before changing code: state scope and potential impact briefly. After: report changed files, tests run, remaining risks. No unrelated refactoring.
- Do not deploy, push, alter Cloudflare/GitHub settings, or change credentials without an explicit task. Never expose secrets or copy production keys into docs.

## Architecture
- Static frontend: `index.html`, `css/styles.css`, `css/site-wallpaper.css`, `css/assets/overview-wallpaper.jpg`, vanilla JS modules in `js/`.
- `js/app.js` orchestrates; calculations in `js/calculations.js`, `js/personal.js`, etc.; pages in `js/pace-page.js`, `js/forum-link.js`, `js/judge-*`.
- Data: `data/19ib_all_judges_REPAIRED.json`, `data/forum.csv`, `data/forum_judges_export.json`, `data/history.json`, `data/metadata.json`.
- Collection/build/validation: `scripts/`, Node >=22, `package.json`. Deploy: GitHub Pages, `.github/workflows/deploy.yml`.
- Scheduled updates: Cloudflare Worker `cloudflare/` triggers `.github/workflows/update-data-scheduled.yml` through GitHub App; do not rely on README's older hourly schedule. See `docs/DATA_PIPELINE.md`.

## Essential invariants
- API round ID is pinned in `scripts/source-config.json`; never auto-select a new round.
- Forum/veteran membership is keyed by exact UUID from `data/forum.csv`; never match similar names heuristically.
- Preserve historical score/comment revisions, `scoredAt` vs `observedAt`, and archived members. Never delete history to fix size/validation failures.
- Passing: total >=15; guaranteed failure when maximum possible with remaining scores <15. Confirm current formulas in code before modifying.
- Reference designs and visual tests: `docs/IB19_V95_WHITE_TUZ_HEADING.html`, `docs/TUZ_V95_overview_v6.html`, `docs/V108.html`; newer wallpaper rules in `css/site-wallpaper.css`. Read `docs/DESIGN_RULES.md`.

## Local checks
`npm ci` · `npm test` · `npm run validate` · `npm run build`; for UI changes: `npx playwright install chromium` (if necessary) then `npm run test:browser`. Run only relevant checks while iterating, but do not skip mandatory verification before release. `npm run update` performs external API collection: do not run casually.

See `docs/ARCHITECTURE.md`, `docs/DATA_PIPELINE.md`, `docs/DESIGN_RULES.md`, `docs/DECISIONS.md`, `docs/BACKLOG.md`.

## R1/R2 — утверждённые требования REL-02 (26.10.2026)
- R1 завершён. Единственный источник аналитики — принятый финальный снимок, уже закреплённый приложением в `docs/data-candidates/r1-2026-10-22-194208/` вместе с действующей политикой и фиксированным контрактом. Историческое слово candidate в пути не означает разрешение заменить источник. Новый финальный снимок не создавать и не выбирать источник по более позднему exportedAt.
- Не обновлять и не перезаписывать JSON, историю, оценки, исключения и расчёты R1. Не повторять сверки индексов ТУЗа, оценок, итоговых статусов, старых снимков и полную регрессию аналитики при переносе UI/публикации. Проверять только затронутые компоненты и конкретные ошибки; методология неизменна.
- Исходная когорта R2 — все UUID со статусом «Прошёл» в утверждённом R1: 15 и более по действительным оценкам с утверждёнными исключениями. Использовать существующий итоговый статус, не вводить новый расчёт. Прохождение R1 и сдача трека R2 — разные признаки.
- Активная фаза R2 — только сдача треков: участник, факт и доступные сведения о треке, время источника при наличии, новые сдачи и изменения. Не запрашивать оценки R2, не запускать судейские расчёты и не применять к R2 правила R1. Отсутствие оценок не показывать как ошибку или нулевую активность судей.
- После переноса frontend 2.0 в main существующий конвейер должен обновлять только сдачи R2 и публиковать только 2.0. R1 остаётся неизменным архивом; MAINT-03 остаётся включённой. Не создавать второй сборщик, Cron или параллельную публикацию.
- Любые необходимые изменения production-сборщика/workflows сначала предъявлять минимальным конкретным списком для отдельного подтверждения. Новые аудиты и исследования без конкретного блокера не инициировать.
