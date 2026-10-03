# Automation Summary — CometChat React UIKit v7 (sample app)

_2026-09-29 · production app (us) · `@cometchat/chat-uikit-react` 7.0.3, Chat SDK 4.1.12, Calls SDK 5.0.1_

## 1. What exists

A Playwright + TypeScript + Page Object Model framework that tests the UIKit v7 sample app the way a user uses it — real sign-in, a second (or third) user in its own browser for everything realtime, reloads for persistence, and network interception for failure paths.

| Area | Where | Notes |
|---|---|---|
| Tests | `tests/` — 23 folders | Every title starts with its scenario id from the coverage matrix |
| Page objects | `pages/` | One class per UIKit component; locators by role / label via `t()` so they work in any locale |
| Fixtures | `fixtures/` | Fresh users per test (`alice`…`frank`, `loginAs`, `data.user/group`), NetWatch on every page |
| API | `api/` | REST setup / cleanup (refuses anything not `pw-*`); `ClientSession` for server-behaviour checks |
| Docs | `docs/` | [findings](findings.md), [coverage matrix](coverage-matrix.md), [plan](automation-plan.md), app map, inventory, test-data map |
| CI | `.github/workflows/e2e.yml` | Smoke on push / PR (3 browsers), full regression nightly, Linux visual baselines on demand |

## 2. Last full run

{{RUN}}

## 3. Product defects found

{{BUGS}}

Every defect has a regression test written with `test.fail()`: it fails today, and the report flags it the day the bug is fixed.

## 4. How the hard parts were made reliable

- **Realtime:** "ready" means the realtime socket has received its auth acknowledgement, not just that the page rendered (`utils/realtime.ts`).
- **Shared app, 100-user plan:** every test creates and deletes its own users; nothing outside `pw-*` is ever touched.
- **Server timing (BUG-012):** UI tests wait for the server to know a new conversation (`api.users.waitForConversation`); the bug itself is pinned down at the API level.
- **Races and failures on purpose:** `holdRealtimeSocket`, `delayResponse`, `page.route` and `context.setOffline` make timing and error paths deterministic — no `waitForTimeout` anywhere (lint-enforced).
- **Evidence:** trace, per-user screenshots and videos, and each user's network / console log on every failure; unexpected page errors or HTTP 5xx fail a passing test.

## 5. Not covered yet (and why)

| Item | Status | What it needs |
|---|---|---|
| Moderation: rule disabled → same content allowed | BLOCKED | Toggling rules changes the shared app's config — needs a dedicated app or approval |
| AI assistant / agent features | BLOCKED | Agent UIDs and AI settings on the app |
| Calls: network drop during a call (CALL-17) | BLOCKED | Playwright's `setOffline` does not cut an established WebRTC media path; needs OS-level network shaping |
| Visual baselines for Linux / CI | TODO | Run the workflow's `visual-update` job once and commit the artifact |
| Firefox locally | ENV-001 | Firefox cannot launch on macOS 27; it runs in CI |

## 6. Before CI can run

1. Push this repo; add secrets `COMETCHAT_APP_ID`, `COMETCHAT_REGION`, `COMETCHAT_AUTH_KEY`, `COMETCHAT_API_KEY`, `UIKIT_REPO_TOKEN`.
2. The sample-app hooks (env-driven credentials, locale) are applied from `app-patches/sample-app-e2e-hooks.patch` — or merge them into the UIKit repo and drop the patch step.
3. Run the `visual-update` job once and commit the Linux baselines.
