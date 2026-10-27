# Публичный production чат

MAINT-03 отменена владельцем. Production чат, presence и навигация не требуют owner-cookie. Исторические MAINT fixtures/configs оставлены для прежних regression tests и не являются текущей production-топологией.

## Текущая схема

GitHub Pages обслуживает основной сайт и `/chat/`; существующий Cloudflare Worker `tuz19-playlists` и его маршрут `tuz19.ru/api/playlists*` сохранены.

Новый `tuz19-chat` обслуживает **только** `tuz19.ru/api/chat/*`. API-only entry — `backend/chat/worker.mjs`, reference config — `backend/chat/wrangler.public.jsonc.disabled`. REQUIRE_GATEWAY_ACCESS=false, точный ALLOWED_ORIGIN=https://tuz19.ru, workers.dev/version preview URLs отключены. Namespace SQLite независим от preview/clock. Новых collector/Cron/Pages publisher нет.

Исходное `config/chat-ui.json: enabled=true` включает компактную ссылку/онлайн в главной шапке. Пункт плейлистов в main сохранён из 361360f; та же ссылка добавлена в шапку страницы чата. Общий provider получает public status без spectator WebSocket; после join используются room events.

## Модерация и аварийный OFF

Публичность чата не открывает модерацию: `/api/chat/admin` требует точный Origin и независимый ADMIN_TOKEN. Cookie, MAINT пароль и SESSION_KEY для production чата не используются. Ники не подтверждают личность, история хранится 24 часа.

Закрытые production secrets находятся только в ignored `.chat-ws-local/production/`, каталог 0700 / файлы 0600. В Git/Pages/dist их нет. Не использовать preview tokens или фиксированные тестовые ключи.

Операторский файл имеет поля `origin`, `access: "public"`, `adminToken`; cookie отсутствует. Из корня checkout:

```sh
CHAT_OPERATOR_CREDENTIALS_FILE="$PWD/.chat-ws-local/production/operator.json" node backend/chat/operator.mjs off
CHAT_OPERATOR_CREDENTIALS_FILE="$PWD/.chat-ws-local/production/operator.json" node backend/chat/operator.mjs status
CHAT_OPERATOR_CREDENTIALS_FILE="$PWD/.chat-ws-local/production/operator.json" node backend/chat/operator.mjs on
```

OFF должен дать admin ACK и закрыть активные WS кодом 4000. API status/presence возвращают 503, сайт и плейлисты продолжают работать. Один status=503 без ACK может означать технический отказ, поэтому не является единственным подтверждением выключения.

## Откат

1. Выполнить защищённый operator OFF и подтвердить закрытие клиентов.
2. Для снятия ссылки изменить только source `config/chat-ui.json` на false и опубликовать обычный frontend через существующий pipeline. Не подменять старым dist текущие данные R1/R2.
3. Worker/namespace и SQLite сохраняются; при возврате кода persistent OFF остаётся до явного ON. Удаление Worker/namespace не является необходимым откатом.
4. Не возвращать MAINT, не снимать/менять маршрут playlists и не откатывать 361360f с музыкальным плеером. Если нужен прежний frontend, откатывать только chat changeset поверх актуального main с сохранением более свежих данных.

## Проверки

Согласованный Pages CI gate дополнен двумя публичными сценариями: `tests/chat-public-release.test.mjs` и `tests/chat-public-browser.mjs`. Они проверяют вход без cookie, Origin/admin, публичный OFF/ON, и совместную навигацию playlist/chat на 1440/390/320.

Fixtures используют `os.tmpdir()`, а не macOS-only `/private/tmp`. Статический release-smoke моделирует read-only presence; реальный API/WSS покрывается отдельным Miniflare/browser smoke. Данные/коллектор и остальные workflows не меняются.

Для текущего production route zone-scoped CLI прав недостаточно; маршрут добавляется/проверяется в авторизованной Cloudflare панели точным шаблоном, без изменения DNS, существующих routes или auth scopes.
