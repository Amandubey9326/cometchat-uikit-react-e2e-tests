# Automation Plan — Playwright + TypeScript + POM

_Phase 0 · 2026-09-27 · target: CometChat React UIKit 7.0.3 sample app, production app (`us`)_

## 1. Goal

Prove that the UIKit works for real users. Every feature in [feature-inventory.md](feature-inventory.md) is verified as follows:

```
UI  +  realtime (2nd user)  +  network  +  persistence (reload)  +  permissions  +  browser
```

A passing API call never counts as a pass on its own; the UI must show the result.

## 2. Architecture

```
tests/<feature>/*.spec.ts        business-readable (Arrange → Act → Assert → Cleanup)
        │ uses
fixtures/test.fixture.ts         alice / bob / … (logged-in pages), group(), tempUser(), api, netWatch
        │ builds
pages/**                         one class per UIKit component; composed into screens
        │ uses
i18n/t.ts                        accessible names from the same locale JSON the app uses
api/**                           CometChat REST client (setup / cleanup only, prefix-guarded)
config/env.ts                    prod / staging host resolution, validated env
```

## 3. Conventions

- **Locators:** role → label → placeholder → text → CSS. Names come from `t('KEY')` rather than literals, so the same page objects work in every locale. A `.cometchat-*` class is used only where the UI has no role; each such spot is commented with the matching A11Y finding.
- **No hard waits.** `waitForTimeout` is banned by lint (`eslint-plugin-playwright`). Only web-first `expect`, `waitForResponse` and event waits are used.
- **Hover toolbars:** hover `.cometchat-message-bubble__body`, then click. This is wrapped once in `MessageBubble.openOptions()`.
- **Stateful checks:** act → assert → `page.reload()` → assert again.
- **Realtime:** always two contexts. The receiver's assertion is the pass condition.
- **Independence:** no test relies on another test's data. `fullyParallel: true`; data is isolated per test (see [test-data-map.md](test-data-map.md)).
- **Evidence:** `trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`. A `netWatch` fixture attaches unexpected 4xx/5xx responses, failed requests and console errors to the report, and fails the test on unexpected errors (with an allow-list).
- **Tags:** `@smoke @critical @regression` plus a feature tag (`@auth @conversations @messaging @composer @attachments @reactions @threads @mentions @users @groups @search @calls @extensions @moderation @ai @theme @localization @responsive @a11y @visual @network`).

## 4. Playwright projects

| Project | Browser / device | Runs |
|---|---|---|
| `setup` | Chromium | Seeds personas, logs each in once, saves `storageState` |
| `chromium` | Desktop Chrome 1440×900 | Everything |
| `firefox` | Desktop Firefox | `@smoke`, `@critical` |
| `webkit` | Desktop Safari | `@smoke`, `@critical` |
| `tablet` | iPad (gen 7) | `@responsive` |
| `mobile` | iPhone 13 / Pixel 7 | `@responsive` |
| `calls` | Chromium + `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`, mic/camera permissions | `@calls`, voice recording |

## 5. Dependencies

`@playwright/test` 1.63, `typescript`, `dotenv`, `@types/node`.

Proposed additions:
- `@axe-core/playwright`, for automated WCAG scans (Phase 8).
- `eslint` + `eslint-plugin-playwright`, for the hard-wait ban and floating-promise checks.

Nothing else.

## 6. Phases

| # | Phase | Output | Exit criteria |
|---|---|---|---|
| **0** | Discovery (**done** 2026-09-27) | This folder: app map, inventory, data map, plan, coverage matrix, findings | You review the inventory |
| **1** | Framework (**done** 2026-09-27) | config/env, API client + prefix guard, personas + `storageState` setup, fixtures, base page objects, `t()`, `netWatch`, lint, reporters | SMK-01 green on Chromium + WebKit; Firefox blocked locally (ENV-001). Found BUG-002 and BUG-003 |
| **2** | Auth + smoke (**done** 2026-09-27) | AUTH-01…25, NAV-01…07, SMK-01 — 40 tests | 54/54 as expected on Chromium + WebKit; found BUG-004, BUG-005, BUG-006 |
| **3** | Messaging (**done** 2026-09-28/29) | CONV, MSG, ACT, CMP, ATT, REA, THR, MEN + `tests/api` | Per-test users; BUG-007…015 found; every failure triaged |
| **4** | Users & groups (**done** 2026-09-29) | USR, UDET, GRP, MEM (role matrix) | BUG-017 (admins/moderators have no member actions) |
| **5** | Search (**done** 2026-09-29) | SRCH | BUG-016 |
| **6** | Extensions, moderation (**done** 2026-09-29) | EXT-01…06, MOD-01…04 | AI and rule toggling BLOCKED with reason |
| **7** | Calls (**done** 2026-09-29) | CALL (calls project, fake media) | BUG-018 |
| **8** | Advanced (**done** 2026-09-29) | THM, L10N (static + per-locale runs), RESP, A11Y (axe), VIS, NET, PERF | A11Y-014…017, L10N-007/008 |
| **9** | CI + report (**done** 2026-09-29) | `.github/workflows/e2e.yml`, `app-patches/`, `scripts/coverage_matrix.py`, `docs/automation-summary.md` | CI not yet run (needs secrets + repo) |

## 6a. Realtime synchronisation (learned in Phase 1)

- "App ready" means the Chats pane is loaded **and** CometChat's realtime socket has received its auth acknowledgement (`utils/realtime.ts`). Opening a conversation during connection hits BUG-002, so ordinary tests wait for readiness, and MSG-26 tests the race on purpose.
- `loginAs` recovers from BUG-003 with one reload and adds a report annotation. AUTH-23 tests the bug on purpose.
- `holdRealtimeSocket()` and `delayResponse()` make timing bugs deterministic. Use them rather than hoping for a race.

## 7. Commands

```bash
npx playwright test --grep @smoke                 # smoke
npx playwright test --grep @regression            # regression
npx playwright test --project=chromium            # full on Chromium
npx playwright test --grep @critical --project=firefox --project=webkit
npm run discover                                   # re-crawl the app (read-only)
```

## 8. Failure triage

When a test fails, the test is not changed first. The cause is checked in this order:

1. Application behaviour
2. Selector
3. Test data
4. Authentication
5. API
6. WebSocket
7. Environment
8. Timing
9. Extension configuration
10. Product defect

Each failure is classified as PRODUCT BUG, AUTOMATION BUG, ENVIRONMENT, TEST DATA, EXPECTED or BLOCKED. Bug reports are written only for confirmed product defects, with trace, video and network evidence.
