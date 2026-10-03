# CometChat React UIKit v7 — E2E Automation

Playwright + TypeScript + Page Object Model tests for the UIKit v7 **sample app**. They run against a real CometChat app and verify every feature from a real user's point of view:

```
UI  +  realtime (a second user)  +  network  +  persistence (reload)  +  permissions  +  browser
```

Docs: [summary](docs/automation-summary.md) · [findings / bugs](docs/findings.md) · [coverage matrix](docs/coverage-matrix.md) · [feature inventory](docs/feature-inventory.md) · [plan](docs/automation-plan.md) · [app map](docs/application-map.md) · [test data](docs/test-data-map.md)

## Setup

Requirements: Node 20+, Python 3 (coverage matrix only), and the UIKit repo checked out at `~/uikit-react`, with `npm install` already run in `sample-app/`. The sample app needs the small E2E hooks (env-driven credentials, locale) from `app-patches/sample-app-e2e-hooks.patch` — apply once with `npm run app:patch` (CI applies it automatically).

```bash
npm install
npx playwright install chromium firefox webkit
cp .env.example .env        # fill in App ID, region, Auth Key, REST API key
```

The framework starts the sample app itself on port **3105** in "upstream" mode (credentials screen, production hosts), so it never collides with a manual `npm run dev` on port 3005.

## Run

```bash
npm test                     # everything (setup → all projects → teardown)
npm run test:smoke           # @smoke
npm run test:critical        # @critical on Chromium / Firefox / WebKit
npm run test:chromium        # full functional suite on Chromium
npm run test:cross-browser   # @smoke|@critical on Chromium, Firefox, WebKit
npm run test:calls           # calls (fake camera + mic)
npm run test:responsive      # tablet + mobile layouts
npm run test:localization    # static audit + UI in the current PW_LOCALE
PW_LOCALE=fr npm test -- --project=chromium   # whole suite against a French build
npm run test:visual          # screenshot comparison (baselines per platform)
npm run test:visual:update   # re-create baselines after an intended UI change
npm run coverage:matrix      # regenerate docs/coverage-matrix.md from reports/results.json
npm run test:ui              # Playwright UI mode
npm run report               # open the last HTML report
npm run lint && npm run typecheck
npm run cleanup              # delete ALL framework-owned (pw-*) data — not during a run
npm run discover             # re-crawl the app read-only (docs/discovery)
```

On macOS 27, Firefox cannot launch (ENV-001). Keep `PW_NO_FIREFOX=1` in `.env`; Firefox runs in CI.

## How it works

| Piece | Where | What it does |
|---|---|---|
| Config | `config/env.ts`, `config/run.ts` | `.env` validation, prod/staging hosts, one `PW_RUN_ID` per run |
| REST client | `api/` | Test-data setup/cleanup only. Retries rate limits. **Refuses to modify anything not prefixed `pw-`.** |
| Users | `fixtures/test-data.ts` | **Per test:** every user and group a test needs is created by REST and deleted when the test ends (the app has a 100-user plan, and deleting a user someone chatted with crashes their app — BUG-008) |
| Fixtures | `fixtures/test.fixture.ts` | `alice`…`frank` (fresh users, own context each, signed in through the UI, realtime connected), `loginAs(user)`, `data.user()` / `data.group()`, `api`, `net` |
| Client API | `api/client-session.ts` | Calls the CometChat *client* API as a test user — only for `tests/api`, which pin down server behaviour the UI depends on |
| Page objects | `pages/` | One class per UIKit component; `ChatApp` composes them for a user |
| i18n | `i18n/t.ts` | Accessible names come from the app's own locale files, so page objects work in every locale |
| Evidence | automatic | On failure: trace, a screenshot and a video **per user**, plus that user's network/console log. Every UI test also fails on unexpected page errors or HTTP 5xx (`fixtures/net-watch.ts`) |
| Reports | `playwright-report/`, `reports/` | HTML report; `reports/results.json` + `junit.xml` for CI and the coverage matrix |

Test data belongs to the framework only (`pw-<run>-*`). The production app is shared with other QA work, and nothing else in it is touched. Each run deletes its data at teardown, and anything `pw-*` older than 24 h is swept at start.

## Writing a test

```ts
import { uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';

test('MSG-11 receiver gets a 1:1 message live', { tag: ['@messaging', '@critical'] }, async ({ alice, bob }) => {
  const text = uniqueText();                          // Arrange
  await alice.app.openChatWith(bob.user);
  await alice.app.composer.send(text);                // Act
  await expect(bob.app.conversations.item(alice.user.name)).toContainText(text);   // Assert (realtime)
  await bob.app.openConversation(alice.user.name);
  await expect(bob.app.messages.message(text).root).toBeVisible();
});
```

Rules:
- Use the ID from `docs/coverage-matrix.md` in the title.
- Tag every test.
- Use role- or label-based locators through page objects.
- **Never use `waitForTimeout`** (lint enforces it).
- Tests that change state get their own `data.user()` / `data.group()`.
- Stateful checks re-assert after `app.reload()`.
- A test for a confirmed product bug uses `test.fail(true, 'BUG-xxx')` with a `bug` annotation, and the line is removed when the bug is fixed.
- Timing-dependent server issues are pinned down at the API level or with `page.route` / `routeWebSocket`, never with a flaky UI race. In a brand-new 1:1 chat, call `api.users.waitForConversation()` before reacting, deleting, reloading or reading (BUG-012).

## Useful env switches

`PW_LOCALE=<code>` · `KEEP_TEST_DATA=1` · `PW_WORKERS=n` (keep ≤ 4: user quota) · `NET_STRICT=0` · `BASE_URL=<deployed app>` · `COMETCHAT_ENV=staging` · `APP_MODE=dev`

Run one Playwright process at a time: runs share `test-results/` and the app's user quota.

## CI

`.github/workflows/e2e.yml` — smoke on every push / PR (Chromium, Firefox, WebKit), full regression nightly (all projects, then the coverage matrix), and a manual job that regenerates the Linux visual baselines. Runs are serialized (one shared app). Secrets: `COMETCHAT_APP_ID`, `COMETCHAT_REGION`, `COMETCHAT_AUTH_KEY`, `COMETCHAT_API_KEY`, `UIKIT_REPO_TOKEN`.
