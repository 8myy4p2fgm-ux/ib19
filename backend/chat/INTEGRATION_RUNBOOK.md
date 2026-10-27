# CHAT integration — локальный запуск и откат

Production больше не зависит от MAINT-03. Ниже историческая MAINT-схема; актуальный публичный запуск и откат — в docs/release/CHAT_PUBLIC_PRODUCTION.md.

Это локальная проверка release changeset; порядок будущей публикации и отката описан в docs/release/CHAT_RELEASE_RUNBOOK.md. Production-конфигурации остаются `.disabled`; облачные команды, push и dispatch не входят в запуск.

## Запуск

В корне `/Users/gleb/.codex/worktrees/chat-release/tuz19-v2-dev`:

```sh
npm run dev:chat
```

Если npm/Node отсутствуют в PATH, доступный в этой среде эквивалент:

```sh
/Users/gleb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node backend/chat/integration-dev.mjs
```

Launcher собирает opt-in артефакт, запускает локальные gateway / backend / Pages Workers на `http://127.0.0.1:8932` и создаёт только случайные fixture credentials. Пароль локальной формы находится в `.chat-ws-local/integration-owner.json`; откройте `/admin-login` и введите его локально. Файл не отправлять в чат или отчёт. Production-пароль и SESSION_KEY не нужны.

`CHAT_LOCAL_PORT` позволяет выбрать другой loopback-порт. Внешний origin только моделируется внутри workerd; реальные Cloudflare, tuz19.ru и GitHub не вызываются. Локальный Node fetch ограничен loopback. TLS эта локальная цепочка не испытывает.

Для оператора автоматически создаётся отдельная fixture MAINT-сессия в `.chat-ws-local/integration-operator.json` (0600), вне public/Git. Это не сессия пользователя в открытом браузере.

```sh
CHAT_OPERATOR_CREDENTIALS_FILE="$PWD/.chat-ws-local/integration-operator.json" node backend/chat/operator.mjs status
CHAT_OPERATOR_CREDENTIALS_FILE="$PWD/.chat-ws-local/integration-operator.json" node backend/chat/operator.mjs off
CHAT_OPERATOR_CREDENTIALS_FILE="$PWD/.chat-ws-local/integration-operator.json" node backend/chat/operator.mjs on
```

OFF закрывает активные WS и сохраняет enabled=false в SQLite. Повторная публикация кода не равнозначна ON. Для ON требуется операторская команда. Страница/MAINT остаются доступными по прежней политике.

Ctrl+C/SIGTERM завершает локальную проверку и удаляет созданные credential-файлы. После SIGKILL автоматическая очистка невозможна: закрытые fixture-файлы могут остаться; перед следующим запуском удалить только эти локальные fixture-файлы. Никаких реальных production credentials в них быть не должно.

## Флаги

- `config/chat-ui.json: enabled=false` — исходное состояние nav и публичного polling на основных страницах. Обычная сборка оставляет их выключенными.
- `node scripts/build.mjs --chat-nav` — явный локальный opt-in; исходный config не переписывается. Launcher использует этот режим для review. `node scripts/build.mjs` возвращает итоговый артефакт к исходному флагу.
- Прямой `/chat/` содержит клиент чата для владельческой проверки, но доступен только за MAINT; backend дополнительно защищён gateway-контекстом. Скрытие ссылки не является отключением API.
- `CHAT_API_ENABLED=false` у gateway закрывает новые API/WS-запросы. Уже открытые соединения сначала закрывать backend OFF. Поэтому порядок быстрого отката: **OFF → выключить nav/polling → при необходимости вернуть gateway**.
- `CHAT_ENABLED=false` в backend template — начальная конфигурация будущего production-пакета. При будущей разрешённой активации runtime-переменную сначала переводят в true; admin ON не может обойти жёсткий CHAT_ENABLED=false. Для аварийного закрытия уже работающей комнаты использовать проверенный admin OFF, а не только менять переменную.

## Доступ MAINT

Анонимные посетители не получают страницу/статус/сокет чата. После проверки cookie gateway передаёт в приватный backend только срок доступа и session nonce, без Cookie и без SESSION_KEY. Клиентские X-Chat-* удаляются. Backend не имеет публичных маршрутов в production template.

Срок доступа сохраняется в attachment и приватной `gateway_access`, связанной с существующим members.token. Это авторизационная привязка, не новый счётчик онлайна. Вход/переподключение создаёт grant; heartbeat grant не пишет. При expiry онлайн исключается, alarm закрывает соединение не позднее следующей проверки (обычно до 15 секунд). Обычные кадры после expiry также отклоняются.

POST logout через gateway отзывает chat-доступ этой MAINT-сессии: закрывает связанные сокеты и убирает также недавно оборванные сессии. Revocation переживает restart и хранится до исходного expiry. Приватный путь имеет собственный persistent budget 30/min на network и denial cache; при отказе logout возвращает явный 503, не заявляя успешный отзыв. Скопированная старая MAINT-cookie после logout не получает chat API; новая авторизованная сессия может работать. Политику существующего шлюза для остальных разделов это не переписывает.

Для будущего production operator-файла нужны отдельная действующая MAINT-cookie, точный production origin и независимый ADMIN_TOKEN. Значения должны поступать только в закрытый локальный файл; CLI не принимает их аргументами и не выводит. Файл с правами группы/остальных или symlink отвергается, неожиданный origin запрещён. Истёкшую или отозванную операторскую сессию надо обновить нормальным входом MAINT, без обхода шлюза.

## Репетиция возврата

Автоматические тесты выполняют локально:

1. Admin OFF и проверка закрытых WS.
2. Перезапуск backend на той же SQLite: история и enabled=false сохранены.
3. Возврат фактического прежнего кода gateway из fixture базового checkpoint: основные страницы работают для владельца, а чат API отсутствует; анонимный доступ остаётся закрытым.
4. Возврат интегрированного gateway: backend остаётся OFF до явного ON.
5. Возврат артефакта со снятым nav-флагом: нет ссылки и фоновых запросов.

Namespace/SQLite не удаляются, данные R1/R2 не восстанавливаются из старого dist. Для будущего release возвращать только chat changeset поверх свежего main; сохранить текущий R2 snapshot и существующую публикационную блокировку. В Cloudflare rollback кода не откатывает базу и может быть ограничен lifecycle migrations; в первом пакете не делать переименований/удалений классов.

## Проверки

```sh
npm run test:chat
npm run test:chat:regression
npm run test:chat:integration
node tests/chat-ws-browser.mjs
node tests/chat0304-browser.mjs
```

Последовательная интеграционная команда сначала готовит on/off артефакты, затем проверяет launcher, gateway/operator и браузер. Не запускать сборки поверх одновременно проверяемого артефакта. Полную историческую регрессию R1 и data update для этой задачи не требуется запускать.

## Перед будущей публикацией

Требуется отдельное разрешение владельца, актуальный read-only preflight main/MAINT-03/routes, новый production namespace и новые секреты, проверенный авторизованный путь оператора и реальный интеграционный HTTPS/WSS smoke. Не активировать `.disabled` из этого локального worktree. Не переносить базовый локальный checkpoint с отключёнными workflows в main.

В текущей реализации production templates выключены, новых routes и второго Pages publisher нет. Preview не перенастраивался.
