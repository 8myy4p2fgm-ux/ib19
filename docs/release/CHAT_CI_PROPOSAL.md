# Минимальное предложение CI — НЕ применено

Три текущих workflow сохранены побайтно. Существующий frontend build не требует установки backend tooling; он уже включает chat/public boundary validation. Однако текущий publication job сам не запускает новые server/MAINT регрессии. До production release нужно отдельно согласовать этот минимальный дополнительный gate.

Предлагаемый единственный файл: `.github/workflows/deploy.yml`.

После существующего `npx playwright install --with-deps chromium`, до публикации артефакта, добавить:

```yaml
      - run: npx --yes pnpm@11.25.0 --dir backend/chat install --frozen-lockfile
      - run: npm run test:chat
      - run: npm run test:chat:regression
      - run: npm run test:chat:integration
      - run: npm run test:chat:browser
      - run: node tests/chat0304-browser.mjs
```

Версия pnpm 11.25.0 зафиксирована по имеющемуся dependency tree, lockfile v9. Перед применением требуется отдельная проверка чистой установки на Ubuntu 24.04 / Node 22, включая native workerd/esbuild и разрешения pnpm build scripts. Эти CI-команды в данной задаче не запускались на GitHub.

Не менять `update-data-scheduled.yml`, `schedule-clock-utc.yml`, source config, collection commit allowlist, общий ib19-publish concurrency или Pages destination. Не добавлять автоматический deploy backend, новые облачные credentials или второй publisher.

Изменение workflow здесь только предъявлено; без отдельного подтверждения не применено. Локальные результаты тестов находятся в CHAT_RELEASE_DIFF_REPORT.md.
