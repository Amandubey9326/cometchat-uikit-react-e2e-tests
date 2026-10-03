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

2026-10-03, all projects (Chromium, WebKit smoke/critical, calls, tablet, mobile), 339 tests in 24.7 min:

| Result | Count |
|---|---|
| Passed (includes known-bug tests that fail as expected) | **330** |
| Failed | 3 |
| Skipped (browser-specific / `fixme`) | 7 |

The 3 failures, investigated:
- **MSG-15** (Chromium): a known-bug test (BUG-010, group read receipts) *passed* — group "Read" works intermittently; BUG-010 needs re-checking for groups.
- **CONV-08** (WebKit): the unread badge counted 2 of 3 incoming messages — likely a message still held by async AI moderation (OBS-019); passes on Chromium.
- **MSG-14** (WebKit): test timeout waiting for "Delivered"; passes on Chromium. Needs a WebKit rerun.

Coverage matrix: 305 scenarios — 229 passed, 39 failed (mostly the deliberate known-bug tests), 24 TODO, 5 blocked, 6 other ([coverage-matrix.md](coverage-matrix.md)).

## 3. Product defects found

| ID | Type | Title |
|---|---|---|
| BUG-001 | Product bug (a11y / l10n) | 12 keys used in code are missing from en-us and render raw: composer buttons ("VOICE_RECORDING", "SEND", …), report dialog "LOADING", reply preview of collaborative bubbles, reaction info error, card fallback |
| BUG-002 | **Product bug (messaging)** | Conversation stays blank if the realtime connection completes while its history is loading |
| BUG-003 | **Product bug (realtime)** | After login, realtime never connects if the socket opens before the login profile update (`PUT /me`) finishes |
| BUG-004 | Product bug (UX, sample app) | Every login failure shows the generic "Login failed"; the SDK's reason is discarded |
| BUG-005 | **Product bug (session)** | A revoked / expired session leaves the user on a broken Home instead of the login screen |
| BUG-006 | Product bug (robustness) | A corrupted saved session crashes the app to a white screen |
| BUG-007 | Product bug (UX) | Pressing Enter while the previous message is still "Sending" does nothing; the text stays in the composer |
| BUG-008 | **Product bug (crash)** | White screen for anyone who once messaged a user whose account was later deleted |
| BUG-009 | **Product bug (messaging)** | Messages sent within the same second are displayed out of order |
| BUG-010 | **Product bug (receipts)** | Opening a chat never turns its messages "Read" for the sender — `conversation/read` returns 200 but sets no `readAt` (1:1 and groups) |
| BUG-011 | Product bug (a11y / composer) | Mention suggestions are not keyboard-operable: no arrow keys, and Enter sends "@Bob" as plain text |
| BUG-012 | **Product bug (server consistency)** | For 1–4 s after the first message of a new 1:1 chat, the server rejects reactions, deletes, mark-as-read and thread replies with 403; the UI drops them silently and a new chat can be missing from Chats |
| BUG-013 | **Product bug (SDK)** | "Mark as unread" never updates the conversation list — SDK 4.1.12 crashes on the server's reply (`reading 'conversationId'`) |
| BUG-014 | Product bug (minor) | Emoji search matches keywords only — "joy" does not find 😂, although the emoji is labelled "joy" |
| BUG-015 | Product bug (threads) | A thread reply that fails to send also appears in the main conversation, with the error mark |
| BUG-016 | Product bug (search) | A global search with no matches never finishes: Messages keeps its loading shimmer and "No Results" is never shown |
| BUG-017 | **Product bug (permissions)** | Group admins and moderators get no member actions (Kick / Ban / Change Scope) in Group Info — only the owner does |
| BUG-018 | Product bug (calls) | Call bubbles do not update live: after a cancel or hang-up the chat keeps "Outgoing Call" / "Answered Call" until a reload (only a hidden "1 new message" is announced) |
| BUG-019 | Product bug (calls) | No "busy" handling: calling someone who is already in a call rings on until the ~45 s unanswered timeout, and the callee's app renders an incoming-call alert during their call. The server returns "initiated" at once, so the callee's UIKit must reject with BUSY — `CometChatIncomingCall` has no active-call check |

Plus accessibility (A11Y-001…018), localization (L10N-001…008) and observations (OBS-001…019) — see [findings](findings.md).

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
