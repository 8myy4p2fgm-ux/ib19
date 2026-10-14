# ТУЗ19: Cloudflare clock

Worker только запускает `update-data-scheduled.yml` с `mode=incremental`. Оценки, история, формулы и публикация остаются в GitHub Actions. Сайт не включает этот каталог в `dist`.

## Доступы

GitHub App ID 5313552, Installation ID 171308771. Установка только в `8myy4p2fgm-ux/ib19`; Repository permissions: Actions read/write, Contents read-only. Webhook, OAuth пользователя и Device Flow не нужны. Worker получает installation token автоматически, ограничивая его репозиторием ib19 и указанными правами. Приватный PEM хранится только в секрете `GH_PRIVATE_KEY` Cloudflare. Поддерживаются исходный PKCS#1 GitHub и PKCS#8; преобразование выполняется в памяти.

Cloudflare: авторизация владельца аккаунта для Workers и SQLite-backed Durable Objects. Права на DNS, настройки tuz19.ru и платный тариф не нужны. При необходимости платного тарифа сначала согласовать стоимость; автоматически его не включать.

## Рабочая конфигурация

`wrangler.jsonc`: crons=["1-59/10 * * * *"], ENABLED=true, DRY_RUN=false, workers_dev=false и preview_urls=false. Только Cloudflare запускает автоматический сбор; GitHub workflow оставлен с workflow_dispatch. Публичного HTTP-интерфейса Worker нет. Для безопасного первоначального развёртывания выставить ENABLED=false, DRY_RUN=true и пустой список crons; для проверки настоящего таймера — ENABLED=true, DRY_RUN=true.

Сборка без публикации: `wrangler deploy --dry-run --config cloudflare/wrangler.jsonc`. Локальная проверка таймера: `wrangler dev --test-scheduled --config cloudflare/wrangler.jsonc`, затем GET `http://localhost:8787/cdn-cgi/local/scheduled`. Начальная конфигурация не использует ключ и не обращается к GitHub. Для preflight с секретом создать игнорируемый `.dev.vars` локально, выставить ENABLED=true и оставить DRY_RUN=true. Это только чтение GitHub; ready=false ожидается, пока main содержит native cron или не получил source/clock_slot.

## Порядок переключения

1. Все тесты, валидация данных, build и Wrangler dry-run должны пройти. Проверить App permissions и installation по настоящему ключу запросами чтения, не делать dispatch для проверки авторизации.
2. Авторизоваться в Cloudflare через Wrangler. Развернуть начальную выключенную конфигурацию. Загрузить PEM через `wrangler secret put GH_PRIVATE_KEY --config cloudflare/wrangler.jsonc` со stdin из локального файла; не вставлять содержимое в командную строку и не включать shell tracing. Не сохранять ключ в Git.
3. Перед переключением проверить свежий main и отсутствие незавершённых collector/deploy. Удалить schedule-блок из update-data-scheduled.yml, сохранив workflow_dispatch и новые поля source/clock_slot. Отправить обычным git push после проверки актуальности main; не force-push. Дождаться успешного Deploy Pages и завершения всех прежних заданий.
4. Выполнить preflight: ready=true, workflow active; без dispatch. Для проверки настоящего Cloudflare Cron разрешён ENABLED=true, DRY_RUN=true, triggers.crons=["1-59/10 * * * *"] ещё до удаления GitHub cron: этот режим только читает GitHub, не запускает второй сборщик. При оставшемся native cron Worker блокирует отправку.
5. Включить ENABLED=true, DRY_RUN=false, triggers.crons=["1-59/10 * * * *"] и развернуть Worker. Это 01,11,21,31,41,51 минута каждого часа по UTC и МСК. Распространение настроек Cron Cloudflare может занять до 15 минут.
6. Получить минимум три настоящих Cron invocation и связанные workflow_dispatch (run-name `Cloudflare <slot>`). Для каждого сверить mode, запросы, lastCheckedAt, статусы публикации и сохранность истории. При unchanged build/commit/deploy должны быть skipped; успешный Actions artifact должен сохраниться. Если все три нашли изменения, реальный no-op ещё не проверен — дождаться подходящего запуска, не объявлять тестовую фикстуру production-доказательством.

## Защита и журнал

Один Durable Object с постоянным именем ib19-clock сериализует обращения. До POST сохраняется dispatching для десятиминутного слота. При повторе или перезапуске объекта тот же слот не отправляется ещё раз. Сетевой таймаут POST становится uncertain: слепого повтора нет, последующий tick ищет run с соответствующим именем. Проверка активных collector/deploy пропускает занятый интервал; GitHub concurrency ib19-publish, cancel-in-progress:false остаётся второй защитой. Защита свежего состояния в update-gate применяется и к source=cloudflare, обычный ручной запуск не блокируется.

GitHub API не предоставляет idempotency-key для dispatch. Здесь не обещается exactly-once при любых сетевых сбоях: для неоднозначного ответа выбран безопасный отказ от повторного POST; следующий свободный интервал восстановит обновление.

Логи содержат slot, scheduledAt, observedAt, статус, runId, HTTP status и безопасный GitHub request ID. Токены, PEM и upstream body не записываются. Статус dispatched означает принятие запроса, не успех сбора; следующий tick сверяет conclusion. Журнал слотов сохраняется семь дней в DO, Workers Logs на Free сейчас три дня. Проверка: Cloudflare Workers → tuz19-clock → Logs/Triggers плюс run URL GitHub. Runtime errors возвращаются как failed Cron promise.

## Стоимость и ограничения

144 tick/сутки. Один объект, короткие API-запросы и небольшой журнал рассчитаны на Free Workers/SQLite DO. Проверить CPU и общие лимиты аккаунта на реальных invocation. RSA и координация выполняются внутри DO; внешний Cron handler только обращается к нему. Длительное ожидание завершения сборщика в объекте не используется — проверка результата происходит на следующем tick. Рабочая очередь GitHub всё ещё может задерживать runner; timer не даёт гарантии публикации ровно в назначенную минуту.

## Откат

Сначала выключить Worker ENABLED=false, дождаться распространения и завершения/сверки отправленных runs. Только затем вернуть GitHub cron и разрешить событие schedule в условии update-job. Не оставлять оба таймера включёнными. Историю, данные и секреты для отката не удалять; исправный сайт продолжает работать.
