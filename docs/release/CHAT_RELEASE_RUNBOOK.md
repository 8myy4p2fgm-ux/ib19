# CHAT release-diff: применение и откат

Production больше не зависит от MAINT-03. Ниже историческая MAINT-схема; актуальный публичный запуск и откат — в docs/release/CHAT_PUBLIC_PRODUCTION.md.

Этот changeset подготовлен поверх `origin/main` ac56c4c6349f067457adedbce29ebc1564a0df9f. Он не переносит локальный baseline e64a054, его workflow-удаления, старые R1/R2 или preview credentials.

## Состояние в diff

- `config/chat-ui.json: enabled=false`: нет ссылки и фонового polling на основных страницах. Прямой `/chat/` остаётся за существующим MAINT после будущей публикации.
- `cloudflare/maintenance/wrangler.jsonc.disabled`: существующее имя gateway, LOGIN_LIMITER 1902, предлагаемый новый private CHAT_BACKEND и CHAT_API_ENABLED=false. Это reference, не активная конфигурация Cloudflare.
- `backend/chat/wrangler.production.jsonc.disabled`: предлагаемый новый backend `tuz19-chat`, новый SQLite ChatRoom, без routes/workers.dev/version URLs, REQUIRE_GATEWAY_ACCESS=true и CHAT_ENABLED=false.
- Значений секретов, production namespace_id и account_id в changeset нет. Независимые production значения и namespace создаются только при отдельном разрешении.
- Действующие три workflows и scripts коллектора взяты из main побайтно. Новый collector/Cron/Pages publisher отсутствует. Нет автоматического deploy backend из обновлений R2.
- `backend/chat/build-preview.mjs` и `preview-worker.mjs` оставлены только для неизменённых исторических CHAT-06 packing tests; это standalone test helper, не production deployment entrypoint. Production использует только API-only worker.mjs и MAINT.

## Локальная проверка

Из корня checkout, Node >=22:

```sh
npm ci
npm run build
npm run test:chat
npm run test:chat:regression
npm run test:chat:integration
npm run test:chat:browser
node tests/chat0304-browser.mjs
node --test tests/public-build.test.mjs tests/mobile-perf03-artifact.test.mjs
npm run test:release:browser
```

Chat test tooling устанавливается отдельно по `backend/chat/pnpm-lock.yaml`; корневой package-lock и npm зависимости не менялись. В текущей среде использованы собственные копии проверенных зависимостей worktree (без внешних symlink), Node 24.19.0, Playwright 1.56.1. `npm ci` в этой сессии не выполнялся: npm отсутствует в tool PATH; это не заявляется как пройденная проверка. Для новой чистой среды до релиза требуется frozen dependency install. Предложение целевых CI-шагов — в CHAT_CI_PROPOSAL.md; workflow здесь не изменён.

Для локального review `npm run dev:chat` запускает только loopback fixtures и создаёт случайные закрытые fixture credentials. Никогда не использовать их для Cloudflare. Все chat-only Node команды имеют loopback network guard; этот guard не подменяет существующие main scripts update/build/deploy.

## Перед будущей production-публикацией

1. Отдельное разрешение владельца. Снова проверить текущий main: переносить только этот chat changeset, не откатывать более новые данные. Если за время подготовки изменилась только R2 collection, сохранить её результат.
2. Read-only preflight существующего gateway: записать действующую версию и конфигурацию маршрутов/bindings, подтвердить сохранение MAINT-03. Проверить отсутствие конфликта нового backend name. Новых routes, обходящих MAINT, не создавать; существующие MAINT routes не снимать.
3. Подготовить новый production namespace/backend, два независимых backend secrets и operator file 0600 вне Git; не использовать preview namespace или keys. OWNER_PASSWORD/SESSION_KEY существующего MAINT не экспортировать и не ротировать без отдельной задачи.
4. Подготовить закрытые deployment configs из `.disabled` references в отдельном каталоге. Включить backend runtime CHAT_ENABLED=true для работы оператора; gateway CHAT_API_ENABLED сначала оставить false. После разрешённого включения gateway проверить операторский OFF до допуска пользователей. Hard CHAT_ENABLED=false нельзя обойти admin ON.
5. Публиковать frontend и интеграцию gateway только после закрытых smoke-проверок, сохраняя MAINT для всех страниц и API. CI-изменения предварительно согласовать отдельно. Существующий единственный Pages pipeline/concurrency не заменять.
6. Выполнить реальный HTTPS/WSS smoke, проверить private backend и namespace, Origin/CF-IP, MAINT expiry/logout, отсутствие дублирования, OFF/ON и сохранность данных.
7. Включение ссылки — отдельный маленький diff `config/chat-ui.json` false → true. Значение должно быть в source, чтобы следующий обычный data build его сохранял. Не редактировать готовый dist как постоянный переключатель.

Подготовленный release-diff не выполняет ни одного из этих облачных действий. Текущий production gateway и оба preview не трогались.

## Откат

1. Через независимую действующую MAINT-сессию и ADMIN_TOKEN выполнить `backend/chat/operator.mjs off`. Обязательны admin ACK и закрытие существующих WS; один status=503 недостаточен.
2. Вернуть source nav flag=false и обычную сборку, затем CHAT_API_ENABLED=false у gateway. Gateway flag сам не закрывает ранее принятые WS.
3. При необходимости вернуть только предшествующую версию gateway, записанную в preflight; **MAINT routes сохраняются**. Не снимать авторизацию и не открывать origin ради отката чата.
4. Backend/SQLite не удалять и не считать rollback кода откатом базы. При возврате нового gateway проверить сохранение OFF; включать только явным ON. Локальный тест действительно подставляет прежний gateway-код и проверяет это поведение.
5. Для отката frontend вернуть только integration changeset, не checkout всего старого dist/commit с историческими данными. Актуальные R1/R2, collector и workflows должны сохраниться.

## Оставшиеся ограничения

Cloudflare login limiter приблизительный и локален location, поэтому 5/60s не гарантирует отказ ровно на шестой попытке. Обрыв и жёсткий crash не дают абсолютной точности presence; lease=75s, checkpoint=60s, обычный active alarm≈15s. Общие NAT могут упереться в per-network limits. Права на GIF и фактические платёжные квоты не пересматриваются этим diff.
