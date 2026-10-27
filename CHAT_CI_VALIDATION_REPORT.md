# CI-дополнение и чистая установка зависимостей

27.10.2026, ветка `codex/chat-release`. База этой задачи — release-коммит `2991ae0` поверх main `ac56c4c`.

**PASS: согласованное CI-дополнение применено локально; чистые installs и релизные тесты прошли.** Из исполняемого кода/конфигурации изменён только `.github/workflows/deploy.yml`: шесть дополнительных шагов после установки Chromium и до публикации Pages artifact. Push/deploy/workflow dispatch не выполнялись.

## Применённый CI gate

```yaml
      - run: npx --yes pnpm@11.25.0 --dir backend/chat install --frozen-lockfile --ignore-scripts
      - run: npm run test:chat
      - run: npm run test:chat:regression
      - run: npm run test:chat:integration
      - run: npm run test:chat:browser
      - run: node tests/chat0304-browser.mjs
```

Существующие release/validate/build/browser steps, triggers, permissions, environment, concurrency `ib19-publish`, Pages destination и deployment action сохранены. Падение дополнительного шага блокирует последующие обычные upload/deploy steps. Других workflow изменений нет.

При проверке согласованной команды без `--ignore-scripts` pnpm 11 вернул **ERR_PNPM_IGNORED_BUILDS** для workerd; [воспроизведение](docs/diagnostics/chat-ci/install-before.log). Уточнение ограничено одним CLI-флагом в deploy.yml. Никаких глобальных approve-builds, backend workspace policy, package/lockfile изменений или разрешения всех lifecycle scripts не добавлялось.

После установки с отключёнными lifecycle scripts штатные нативные workerd tests действительно запустились и прошли. Для закреплённых зависимостей этого достаточно локально: это не только проверка успешного exit code установщика. Семантика build policy pnpm: [официальная документация](https://pnpm.io/blog/releases/11.0).

## Чистая среда

| Компонент | Проверено |
|---|---|
| Node | **22.23.4**, официальный darwin-arm64 архив nodejs.org, SHA-256 проверен до распаковки |
| npm | **10.9.9**, из того же Node bundle |
| pnpm | **11.25.0**, фактическая установка через npx с тем же pin, что в CI |
| ОС | **macOS arm64**; системный Node/PATH и общие настройки не изменялись |
| Frontend | Старый node_modules убран в ignored backup, выполнен настоящий `npm ci --no-audit --no-fund` с отдельным пустым npm cache |
| Backend | Старый node_modules убран в ignored backup, выполнен pinned pnpm frozen install с `--ignore-scripts` и отдельным пустым store; downloaded=30, reused=0 |
| Browser | `npm exec -- playwright install chromium` PASS; использован соответствующий Playwright 1.56.1 browser cache |
| Lockfiles | Корневой package-lock.json и backend pnpm-lock.yaml побайтно сохранены |

Подготовка/команды не копировали зависимости из другого worktree вместо install. Прежние рабочие зависимости сохранены только для восстановления в `.chat-integration-artifacts/ci-backup/`; активными оставлены новые установленные каталоги. Toolchain находится в `/private/tmp/tuz19-chat-ci-clean/`, в Git не входит.

Доказательства: [root-install.log](docs/diagnostics/chat-ci/root-install.log), [backend-install.log](docs/diagnostics/chat-ci/backend-install.log), [install.json](docs/diagnostics/chat-ci/install.json).

## Повторные тесты под Node 22

| Команда / набор | Итог |
|---|---|
| `npm run test:release` | **29/29 PASS** |
| `npm run validate` | PASS: R1 archive byte-identical, текущий R2 submissions snapshot валиден |
| `npm run build` | PASS, public boundary 348 файлов / 8 JSON / forbidden fields=0 |
| `npm run test:chat` | **16/16 PASS**, реальный workerd и SQL/heartbeat |
| `npm run test:chat:regression` | **11/11 PASS**, все шесть P1, включая 6500-message backlog |
| `npm run test:chat:integration` | **14 Node PASS + 10 browser-групп PASS**, build/on/off, launcher, MAINT binding, expiry/logout, SQL denial cache, operator и реальный возврат прежнего gateway-кода |
| `npm run test:chat:browser` | **12/12 сценариев PASS**, включая реальное истечение lease |
| `node tests/chat0304-browser.mjs` | **13/13 сценариев PASS**, 92 GIF, public/error states и responsive nav |
| `npm run test:release:browser` | PASS: шесть R1 секций, актуальные R2 redirects, mobile/desktop, без page/resource errors |
| `npm run test:public:artifact` | **5/5 PASS**, публичная граница, versioned graph и legacy aliases |
| Дополнительно `node --test tests/maintenance.test.mjs` | **9/9 PASS**, прежние MAINT guards |

Всего **84 Node-проверки + 35 chat browser-сценариев + штатный release-browser suite**. Сводка exit codes/времени: [results.json](docs/diagnostics/chat-ci/results.json); отдельные [release](docs/diagnostics/chat-ci/release.log), [regression](docs/diagnostics/chat-ci/regression.log), [integration](docs/diagnostics/chat-ci/integration.log), [maintenance](docs/diagnostics/chat-ci/maintenance.log).

Полная историческая регрессия аналитики R1 не запускалась. Существующие publication CLI tests использовали временные каталоги и локальный mock API; реальной collection/update или публикации данных не было.

## Границы и оставшаяся проверка

**Ubuntu 24.04 x64 runner в этой сессии не запускался.** Локально подтверждены Node 22, свежие зависимости, native workerd, Chromium и тот же порядок release/chat команд. Linux optional binaries, apt dependencies из `playwright install --with-deps` и запуск внутри GitHub Actions окончательно подтвердятся только в соответствующем runner. Нельзя считать локальный macOS PASS доказательством Linux PASS; Actions не dispatch-ились ради проверки, чтобы не запустить публикацию.

Сохранены **204 защищённых файла**, кроме разрешённого deploy.yml: R1/R2, сборщик/source config, аналитические модули, CSS и два остальных workflow. Не изменены package manifests и lockfiles. Backend source/config, MAINT runtime и production/preview ресурсы не менялись. [invariants.json](docs/diagnostics/chat-ci/invariants.json).

Source nav остаётся false; Cloudflare production activation и секреты не входят в эту задачу. Полный локальный release patch обновлён после CI-коммита; старый release report описывает состояние до согласованного CI-дополнения.
