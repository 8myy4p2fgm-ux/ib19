# CI-дополнение — применено локально после согласования

27.10.2026 владелец согласовал дополнение. Из workflow изменён только deploy.yml; update-data-scheduled.yml и schedule-clock-utc.yml сохранены побайтно. Существующий frontend build не требует установки backend tooling; он уже включает chat/public boundary validation. До дополнения publication job не запускал новые server/MAINT регрессии. После включения описанного gate они выполняются до загрузки и публикации Pages-артефакта.

Предлагаемый единственный файл: `.github/workflows/deploy.yml`.

После существующего `npx playwright install --with-deps chromium`, до публикации артефакта, добавить:

```yaml
      - run: npx --yes pnpm@11.25.0 --dir backend/chat install --frozen-lockfile --ignore-scripts
      - run: npm run test:chat
      - run: npm run test:chat:regression
      - run: npm run test:chat:integration
      - run: npm run test:chat:browser
      - run: node tests/chat0304-browser.mjs
```

Версия pnpm 11.25.0 зафиксирована по имеющемуся dependency tree, lockfile v9. Перед применением требуется отдельная проверка чистой установки на Ubuntu 24.04 / Node 22, включая native workerd/esbuild и разрешения pnpm build scripts. Эти CI-команды в данной задаче не запускались на GitHub.

Не менять `update-data-scheduled.yml`, `schedule-clock-utc.yml`, source config, collection commit allowlist, общий ib19-publish concurrency или Pages destination. Не добавлять автоматический deploy backend, новые облачные credentials или второй publisher.

Дополнение применено локально без push/deploy/dispatch. Для pnpm 11 добавлен --ignore-scripts: чистый install иначе завершается ERR_PNPM_IGNORED_BUILDS на workerd. Работа нативного workerd проверена тестами после чистой установки. Актуальные результаты и ограничение macOS/Ubuntu — в CHAT_CI_VALIDATION_REPORT.md.
