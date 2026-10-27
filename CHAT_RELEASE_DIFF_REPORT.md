# Минимальный chat release-diff поверх актуального main

Позднее согласованное CI-дополнение применено и проверено после чистой установки под Node 22: [актуальный CI-отчёт](CHAT_CI_VALIDATION_REPORT.md). Ниже сохранены результаты первоначальной подготовки release-diff.

Дата: 27.10.2026. Ветка: `codex/chat-release`.
Worktree: `/Users/gleb/.codex/worktrees/chat-release/tuz19-v2-dev`.
База: `origin/main` **ac56c4c6349f067457adedbce29ebc1564a0df9f**; GitHub HEAD проверен до переноса и повторно после тестов, совпал.

**GO для ревью release-diff.** Локальные проверки прошли. Production-публикация, создание production namespace/secrets, включение ссылки и изменения CI не выполнялись. Это двухфазная интеграция с безопасным исходным OFF, не автоматическое включение чата.

## Что вошло

Из текущего main изменены только **шесть существующих файлов**:

| Файл | Минимальное изменение |
|---|---|
| `index.html` | Feature meta=false, stylesheet навигации, versioned chat-nav entry |
| `scripts/build.mjs` | Второй HTML entry `/chat/`, общий JS graph, копирование 92 GIF по проверенному каталогу и явный `--chat-nav` opt-in |
| `scripts/check-public-data.mjs` | Второй entry и точный chat asset allowlist с SHA-256 GIF |
| `scripts/release-assets.mjs` | Поддержка `../js/` у chat entry; существующие legacy checksums сохранены |
| `package.json` | Только дополнительные chat dev/test scripts; все команды актуального main сохранены |
| `.gitignore` | Только chat credentials/runtime/artifact directories |

Новые компоненты: `chat/` (страница, CSS, 92 оригинальных GIF, compatibility wrappers), пять `js/chat-*` модулей, API-only `backend/chat/worker.mjs`, оператор и локальные fixtures, `.disabled` templates, MAINT gateway/pages, целевые серверные/браузерные регрессии и документация релиза. Полный старый worktree, preview package builders/secrets, старые отчёты и диагностические снимки не переносились. Standalone build-preview/preview-worker сохранены только как test helpers для прежнего P1-05; production entrypoint их не использует.

Проверенная реализация чата перенесена без рефакторинга и без изменения протокола. [Source provenance](docs/diagnostics/chat-release/source-provenance.json) фиксирует исходные хеши; у local runbook адаптированы путь worktree и ссылка на release runbook, runtime-код не менялся.

Frontend main сохраняет последние мобильные изменения. Итоговый dist: **348 файлов**, **93 runtime-модуля**, **8 разрешённых JSON ресурсов**; backend, fixtures, секреты и конфиги в public не входят. Стандартная сборка оставлена nav=false. Для локальной opt-in проверки используется `--chat-nav`; direct `/chat/` в будущей публикации защищает MAINT.

## Что сохранено побайтно

Проверены **205 защищённых файлов** актуального main:

- **43 файла данных**, включая R1, утверждённый снимок/контракт, публичные данные и R2 submissions.
- **100 существующих JS-модулей**, включая расчёты, аналитику и мобильные оптимизации.
- Collector/source config и остальные scripts вне трёх необходимых build/validator/versioning файлов.
- CSS, существующий Cloudflare clock и корневой package-lock.
- Все три workflow: `deploy.yml`, `update-data-scheduled.yml`, `schedule-clock-utc.yml`.

Результат: [invariants.json](docs/diagnostics/chat-release/invariants.json), [protected-files.json](docs/diagnostics/chat-release/protected-files.json). Базовый локальный checkpoint e64a054, его workflow-удаления и старые данные в историю release-ветки не включены. Никакие source/data файлы из прежнего локального baseline поверх нового main не копировались.

## MAINT-03 и откат

MAINT gateway сохраняет прежний eight-hour signed-cookie gate, same-origin POST login/logout, fail-closed, no-store, canonical/HTTPS и LOGIN_LIMITER. Chat API проходит только exact path allowlist и приватный Service Binding; owner cookie не попадает backend. Принятые WS ограничены сроком MAINT, logout отзывает chat grants. Оператор требует отдельный ADMIN_TOKEN и действующую независимую MAINT-сессию.

`.disabled` references не являются текущими Cloudflare settings. Исходное состояние: frontend nav=false, gateway CHAT_API_ENABLED=false, backend CHAT_ENABLED=false/REQUIRE_GATEWAY_ACCESS=true и без публичных routes/workers.dev/version URLs. Production keys/namespace не созданы и preview значения не перенесены.

Локально проверен реальный возврат прежнего gateway-кода: API исчезает, MAINT и страницы владельца сохраняются; возврат нового кода не снимает persistent backend OFF. Правильный порядок: **backend OFF с ACK/закрытием клиентов → source nav=false → gateway chat flag=false → при необходимости прежний gateway**. Снимать MAINT routes или восстанавливать старый dist/data для отката нельзя.

Подробно: [CHAT_RELEASE_RUNBOOK](docs/release/CHAT_RELEASE_RUNBOOK.md).

## Проверки

Все команды выполнялись локально, Node fetch ограничен loopback; Cloudflare и опубликованные preview в этой задаче не вызывались.

| Набор | Итог |
|---|---|
| Сборка | PASS: общий версионированный граф, public boundary 348/8, forbidden fields=0 — [build.log](docs/diagnostics/chat-release/build.log) |
| Интеграционная сборка | **3/3 PASS**: default/on/off, неизменность source R2 snapshot, poison assets, GIF hashes, disabled configs — [build-tests.log](docs/diagnostics/chat-release/build-tests.log) |
| Сервер/MAINT/шесть P1 | **46/46 PASS**: прежние 16 WS/SQL/GIF + 9 MAINT + 11 CHAT-06 + 9 gateway + 1 operator — [server-regressions.log](docs/diagnostics/chat-release/server-regressions.log) |
| Текущий main public artifact | **5/5 PASS**, public allowlist, exact legacy modules/data aliases, mixed-graph guards — [public-artifact.log](docs/diagnostics/chat-release/public-artifact.log) |
| Launcher | **1/1 PASS**, loopback/0600/cleanup/default build — [launcher.log](docs/diagnostics/chat-release/launcher.log) |
| Browser core | **12/12 сценариев PASS**, включая реальное истечение lease — [chat-browser.log](docs/diagnostics/chat-release/chat-browser.log), [JSON](docs/diagnostics/chat-release/chat-results.json) |
| Public/nav/smiles | **13/13 сценариев PASS**, 92 GIF, поиск, XSS, 320/390/768/1024/1440, error≠zero — [smilies-browser.log](docs/diagnostics/chat-release/smilies-browser.log), [JSON](docs/diagnostics/chat-release/presence-smilies-results.json) |
| Интеграционный Chromium | **10/10 групп PASS**, R1/R2 nav, реальный Service Binding, reconnect, OFF/ON, rollback/no polling, page errors=0 — [integration-browser.log](docs/diagnostics/chat-release/integration-browser.log) |
| Узкий main route smoke | PASS: шесть секций, актуальные redirects R2, возврат R1, mobile/desktop, без resource/page errors — [main-routes-browser.log](docs/diagnostics/chat-release/main-routes-browser.log) |
| Mobile/cached graph compatibility main | PASS: progressive profiles, comments failure, controls, basePath/history, старые cached graphs — [mobile-compat-browser.log](docs/diagnostics/chat-release/mobile-compat-browser.log) |
| Штатный validate | PASS: R1 byte-identical, текущий R2 snapshot валиден — [validate.log](docs/diagnostics/chat-release/validate.log) |

Итого **55 Node-проверок + 35 chat browser-сценариев + два существующих browser suite main**. Повторных специальных проверок Zippy, пересчёта R1, выбора нового snapshot, collection/update и полной исторической регрессии аналитики не было.

Зависимости — независимые собственные каталоги worktree без внешних symlink, версии из существующих lockfiles. `npm ci` и чистый Linux install в этой сессии не выполнялись: npm отсутствует в tool PATH. Полный `npm test`/исторические инфраструктурные наборы не запускались; проверялись затронутые компоненты, сборка/validate и узкие UI/compatibility suites.

Скриншоты локального opt-in artifact: [desktop](docs/diagnostics/chat-release/screenshots/chat-1440.png), [390](docs/diagnostics/chat-release/screenshots/chat-390.png), [320](docs/diagnostics/chat-release/screenshots/chat-320.png).

## Что нужно согласовать перед production

1. Чистая frozen dependency установка и новый server regression gate в существующем publication job. Минимальный конкретный список **предъявлен, не применён**: [CHAT_CI_PROPOSAL](docs/release/CHAT_CI_PROPOSAL.md). AGENTS.md требует отдельного подтверждения workflow-изменений. Collector/Cron workflow не предлагается менять.
2. Отдельное разрешение на production backend/namespace/secrets и точный Service Binding действующего MAINT gateway; preflight фиксирует текущую версию для отката, маршруты MAINT сохраняются.
3. После защищённого cloud smoke и OFF/ON — маленький отдельный activation diff: source nav=true и согласованные runtime flags. Этот changeset оставляет OFF и сам чат пользователям не включает.

Не закрыты этим переносом: приблизительный login limiter Cloudflare, общий NAT, погрешность presence после crash, права на оригинальные GIF и реальные production quotas. Принятая ручная проверка отдельного preview остаётся основанием приёмки, но не заменяет preflight фактической production-топологии.

## Артефакт diff

Бинарный patch полного локального release-коммита относительно указанного main сохраняется в `.chat-integration-artifacts/chat-release.patch` (вне Git, включает 92 GIF). Проверка `git apply --check` выполняется на чистой базе main во временном индексе, не затрагивая основной worktree.

Push, deploy, workflow dispatch, изменения production/preview, credentials, сборщика и R1/R2 **не выполнялись**. Исходные worktrees чата/2.0 не редактировались.
