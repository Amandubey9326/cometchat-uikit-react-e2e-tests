# Findings

_Phase 0: source inspection and a read-only crawl · Phases 1–8: automated runs (Chromium, WebKit, calls, tablet, mobile, fr) · updated 2026-09-29_

> **What was tested:** the sample app runs the **published `@cometchat/chat-uikit-react` 7.0.3** (npm), Chat SDK 4.1.12, Calls SDK 5.0.1, against the production app (us). Every bug below was observed in that running app. File references (`CometChat….tsx`) point to the `cometchat-team/uikit-react` `master-v7` source used for root-cause reading; the key ones were cross-checked in the 7.0.3 bundle (`dist/`).

| ID | Type | Title | Status |
|---|---|---|---|
| BUG-012 | **Product bug (server consistency)** | For 1–4 s after the first message of a new 1:1 chat, the server rejects reactions, deletes, mark-as-read and thread replies with 403; the UI drops them silently and a new chat can be missing from Chats | **Confirmed, deterministic at API level** (API-01…03, control API-04); UI feedback gap REA-09 |
| BUG-013 | **Product bug (SDK)** | "Mark as unread" never updates the conversation list — SDK 4.1.12 crashes on the server's reply (`reading 'conversationId'`) | **Confirmed, deterministic** (C). Regression test CONV-10 |
| BUG-015 | Product bug (threads) | A thread reply that fails to send also appears in the main conversation, with the error mark | **Confirmed, deterministic** (C). Regression test THR-11 |
| BUG-011 | Product bug (a11y / composer) | Mention suggestions are not keyboard-operable: no arrow keys, and Enter sends "@Bob" as plain text | **Confirmed** (C + source). Regression test MEN-04 |
| BUG-014 | Product bug (minor) | Emoji search matches keywords only — "joy" does not find 😂, although the emoji is labelled "joy" | **Confirmed** (C + source). Regression test CMP-07b |
| A11Y-005 | Accessibility | Escape does not close the "New Group" dialog | Confirmed (C). GRP test |
| A11Y-006 | Accessibility | Escape does not close the global search panel | Confirmed (C). SRCH-09 |
| A11Y-007 | Accessibility | The message toolbar stays invisible (opacity 0) while its buttons have keyboard focus | Confirmed (C). ACT-15 |
| A11Y-008 | Accessibility | Escape does not close the reaction picker | Confirmed (C). REA-08 |
| OBS-016 | Accessibility (minor, timing) | Message options menu ignores an Escape pressed in the first frame after it opens (it takes focus one frame later; formerly A11Y-009). Opened with the mouse, Escape closes it but focus is not returned to "More options" | Not reproducible once the menu has focus; ACT-16 / A11Y-02b pass |
| A11Y-010 | Accessibility | Conversation list is a `listbox`, but arrow keys do nothing (Tab works, via each row's Delete button) | Confirmed (C + source). CONV-17b |
| A11Y-011 | Accessibility | Create Poll: "Question" / "Options" labels are not associated with their inputs | Confirmed in source; inputs found by placeholder |
| A11Y-012 | Accessibility | Extension messages announce their raw type: "…, extension_sticker message" | Confirmed (C) |
| L10N-004 | Localization | Hard-coded English: thread button ", view thread"; Create Poll button "Creating..." | Confirmed in source |
| OBS-010 | Needs investigation | Thread panel sometimes lists the parent message again as the first reply | Seen 2× (ATT-12 image, THR-02/03 text); server once returned the parent from `/messages/{id}/thread` |
| OBS-011 | UX (minor) | Two "Today" date separators above a single message in a new chat | Seen in screenshots (ATT-03, THR-02/03) |
| BUG-017 | **Product bug (permissions)** | Group admins and moderators get no member actions (Kick / Ban / Change Scope) in Group Info — only the owner does | **Confirmed, deterministic** (C, 4/4 runs). Regression test MEM-10 (admin, moderator) |
| BUG-016 | Product bug (search) | A global search with no matches never finishes: Messages keeps its loading shimmer and "No Results" is never shown | **Confirmed** (C, 3/3 runs). Regression test SRCH-05 |
| L10N-005 | Localization | Hard-coded English in group member management: "Kick", "Ban", "Change Scope", scope options "Admin/Moderator/Participant", the Change Scope description, "Select {name} as new owner", dialog "Close" labels | Confirmed in source |
| OBS-012 | Search (server) | User search matches only the start of a name or UID — a word in the middle of a name is not found | Measured via REST; documented by USR-02/03 |
| OBS-013 | UX / SDK | Members are not told live when the owner deletes a group ("Delete and Exit"); the group disappears from their list only after a reload (the SDK has no group-deleted event) | GRP-13 checks after reload |
| BUG-018 | Product bug (calls) | Call bubbles do not update live: after a cancel or hang-up the chat keeps "Outgoing Call" / "Answered Call" until a reload (only a hidden "1 new message" is announced) | **Confirmed** (calls project, 2/2). Regression tests CALL-01b, CALL-08b |
| BUG-019 | Product bug (calls) | No "busy" handling: calling someone who is already in a call rings on until the ~45 s unanswered timeout, and the callee's app renders an incoming-call alert during their call. The server returns "initiated" at once, so the callee's UIKit must reject with BUSY — `CometChatIncomingCall` has no active-call check | **Confirmed** (calls project, 2/2; API probe; source). Regression test CALL-07 |
| A11Y-013 | Accessibility | Calls: two unnamed buttons in the in-call header; call bubbles are announced as "…, audio message" | Confirmed (a11y snapshot) |
| L10N-006 | Localization | Incoming call subtitle is hard-coded: `Incoming {callType} Call` | Confirmed in source |
| OBS-014 | Needs investigation | A 1:1 chat that holds only call messages is not listed in Chats after a reload | Seen in CALL-01 |
| OBS-015 | Needs investigation | Uncaught `Error: Container dimensions and number of tiles must be positive` (Calls SDK) on the remaining participant's page when the other leaves | Seen 1× (CALL-08) |
| OBS-017 | SDK hygiene (WebKit) | A reload that cancels the SDK's in-flight `POST /user_sessions` leaves an unhandled promise rejection; WebKit reports it ("Unhandled Promise Rejection: [object Object]"), Chromium does not | Seen 2× on WebKit (CONV-07, UDET-03/06); harmless — NetWatch ignores it only right after a cancelled request |
| OBS-018 | UX (by design?) | A deleted message shows "This message was deleted" live, but after a reload it disappears entirely — UIKit fetches history with `hideDeletedMessages(true)` (`CometChatMessageListManager.ts:47`), while the conversation list still says "Message is deleted" | Confirmed (W trace: history `[]` after reload). ACT-05 asserts both; confirm intent with the UIKit team |
| OBS-019 | Needs investigation | With many new messages (incl. history released late by AI moderation), one click on "scroll to bottom" can stop mid-list; a second click reaches the newest message. Also: messages pending moderation are hidden from history until approved (ENV-003) | Seen in MSG-18/19/20 (2/2 runs) |
| L10N-007 | Localization / a11y | `<html lang="en">` is hard-coded, so screen readers read every UI language with English pronunciation | Confirmed (fr run). Test L10N-06 |
| L10N-008 | Localization / a11y | Hard-coded English accessible names: composer "Type a message" (rich-text editor), image tile "Image message. Press Enter to view fullscreen.", "Uploading image...", "{n} more images…" | Confirmed (fr run + source). Test L10N-07 |
| A11Y-015 | **Accessibility (critical)** | Composer attachment / emoji / sticker buttons: `aria-expanded`, `aria-haspopup`, `aria-controls` sit on a role-less wrapper `div`, not on the button — the popup state is never announced | Confirmed (axe + source). Test A11Y-01b |
| A11Y-017 | **Accessibility (critical)** | Emoji keyboard `role="grid"` holds its gridcells directly (no `role="row"`) — grid navigation breaks for screen readers | Confirmed (axe). Test A11Y-01c |
| A11Y-014 | Accessibility (contrast) | Below WCAG AA 4.5:1 — light: avatar initials 2.39:1, composer placeholder 2.58:1; dark: active tab label 3.3:1 | Confirmed (axe). Test THM-04 (light, dark) |
| A11Y-016 | Accessibility | Group members loading state puts `aria-label` on a role-less `div` (prohibited) | Confirmed (axe) |
| A11Y-018 | Accessibility | "New Group" dialog is `aria-modal` but focus never moves into it and is not trapped — keyboard / screen-reader users stay on the page behind it | Confirmed (C + source `CometChatCreateGroup.tsx`). Test A11Y-03 |
| BUG-008 | **Product bug (crash)** | White screen for anyone who once messaged a user whose account was later deleted | **Confirmed, deterministic** (C). Regression test CONV-24 |
| BUG-009 | **Product bug (messaging)** | Messages sent within the same second are displayed out of order | **Confirmed, deterministic** (C). Regression test MSG-27 |
| BUG-010 | **Product bug (receipts)** | Opening a chat never turns its messages "Read" for the sender — `conversation/read` returns 200 but sets no `readAt` (1:1 and groups) | **Confirmed, deterministic** at API level (API-05); UI MSG-14b / MSG-15; live path intermittent (MSG-14c) |
| BUG-007 | Product bug (UX) | Pressing Enter while the previous message is still "Sending" does nothing; the text stays in the composer | **Confirmed, deterministic** (C). Regression test MSG-13 |
| BUG-003 | **Product bug (realtime)** | After login, realtime never connects if the socket opens before the login profile update (`PUT /me`) finishes | **Confirmed, deterministic** (C + W). Regression test AUTH-23 |
| BUG-002 | **Product bug (messaging)** | Conversation stays blank if the realtime connection completes while its history is loading | **Confirmed, deterministic** (C + W). Regression test MSG-26 |
| BUG-005 | **Product bug (session)** | A revoked / expired session leaves the user on a broken Home instead of the login screen | **Confirmed** (C). Regression test AUTH-20 |
| BUG-006 | Product bug (robustness) | A corrupted saved session crashes the app to a white screen | **Confirmed** (C). Regression test AUTH-25 |
| BUG-004 | Product bug (UX, sample app) | Every login failure shows the generic "Login failed"; the SDK's reason is discarded | **Confirmed** (UI + source). Regression test AUTH-24 |
| BUG-001 | Product bug (a11y / l10n) | 12 keys used in code are missing from en-us and render raw: composer buttons ("VOICE_RECORDING", "SEND", …), report dialog "LOADING", reply preview of collaborative bubbles, reaction info error, card fallback | **Confirmed** (UI + static audit L10N-03) |
| ENV-002 | Environment (plan) | App is on plan `free-2023-01`: max **100 users**; 44 belong to others → framework must stay under ~56 | Framework creates + deletes users per test |
| ENV-003 | Environment (moderation) | 9 enabled moderation rules block messages (AI spam/scam/circumvention/toxicity, profanity, phone, e-mail, image, video) | Test text is natural sentences with word markers (data/unique.ts) |
| ENV-001 | Environment | Playwright Firefox (build 1543, FF 155) cannot launch on macOS 27.0 | Blocks local Firefox; CI (Linux) will run it |
| L10N-003 | Localization | Group-type badges are hard-coded English ("Private group", "Password protected group") | Confirmed in source |
| L10N-002 | Localization | Conversations empty state is hard-coded English ("No Conversations"), ignoring `conversation_empty_title` | Confirmed in source |
| A11Y-001 | Accessibility | Home tabs are not keyboard / screen-reader operable | Confirmed in source + a11y tree |
| A11Y-002 | Accessibility | Credentials region chips, login sample-user cards and "Change App Credentials" are click-only | Confirmed in source + a11y tree |
| A11Y-003 | Accessibility | User details Close / Block / Delete Chat are click-only `div`s | Confirmed in source + a11y tree |
| A11Y-004 | Accessibility | Call-log row (`role="button"`) contains a nested call button | Confirmed in source + a11y tree; axe to confirm |
| L10N-001 | Localization | 36–37 UIKit keys missing in most locales (ko 62, hi 10) | Confirmed by static audit L10N-01 |
| OBS-001 | Needs investigation | `POST /groups/cometchat-guid-1/conversation/read` returned HTTP 408 once | Seen 1 time in 4 crawls |
| OBS-002 | Needs investigation | Message list is blank (no loader) for a moment when a conversation opens | Seen in screenshot |
| OBS-003 | → A11Y-005 / A11Y-006 | Escape does not close global search or the "New Group" dialog | Confirmed by tests |
| OBS-004 | → A11Y-008 | Reaction picker stayed open after Escape | Confirmed: not a timing artefact |
| OBS-005 | → A11Y-007 | Message hover toolbar is `opacity:0` but stays in the a11y tree | Confirmed: invisible even with keyboard focus |
| OBS-009 | UX (expected) | Drafts are not kept when switching conversations — v7 composer has no draft support | Documented by MSG-24 |
| OBS-008 | UX | A wrong App ID / region is accepted on the credentials screen; it only fails later as "Login failed" | Observed (AUTH-04/06) |
| OBS-006 | Performance | After a reload `GET /conversations` is called 4 times | Seen in WebKit trace |
| OBS-007 | → BUG-012 | Opening a brand-new 1:1 chat: `GET /users/{uid}/conversation` → 403 | Part of the new-conversation window |
| SEC-001 | Hygiene | Old App ID + Auth Key in a commented block in `sample-app/src/AppConstants.ts` (local, uncommitted) | Don't commit it |

---

## Accessibility scans (Phase 8)

- **axe-core** (WCAG 2.1 A/AA, `tests/a11y/axe.spec.ts`): login, Chats, chat, message menu, attachment sheet, emoji keyboard, Group Info, New Group, search. Clean apart from the confirmed items below, which each scan excludes by rule + element so a new violation still fails.
- **A11Y-015 (critical):** `CometChatPopoverTrigger.tsx` renders a `div` with `aria-expanded` / `aria-haspopup="dialog"` / `aria-controls` around the real button.
- **A11Y-017 (critical):** `CometChatEmojiKeyboardEmojiGrid.tsx` — `role="grid"` with `role="gridcell"` buttons as direct children (axe: aria-required-children / aria-required-parent).
- **A11Y-014 (contrast):** light theme — avatar initials `#fff` on `#aa9ee8` (2.39:1), composer placeholder `#a1a1a1` on `#fff` (2.58:1); dark theme — active tab label `#6852d6` on `#141414` (3.3:1).
- **A11Y-016:** `CometChatGroupMembersLoadingState` — `aria-label` on a generic `div` (use `role="status"`).
- **Theme verified OK:** light by default, dark at load when the system is dark, live switch both ways without a reload (THM-01…03).

## Localization run (Phase 8)

- **How to run a locale:** `PW_LOCALE=fr npx playwright test …` builds the app with `VITE_COMETCHAT_LOCALE=fr` (sample-app hook in `src/index.tsx`) on its own port, and every page object resolves its labels through `t()` in that locale. The French smoke journey (SMK-01) passes.
- **Static audit (L10N-01…03):** UIKit locales miss 36–37 en-us keys each (ko 62, hi 10) — L10N-001; the sample app's 18 locales are complete; **12 keys used in code are missing from en-us** and render raw: `ATTACHMENTS`, `EMOJI`, `SEND`, `SAVE`, `VOICE_RECORDING`, `CANCEL_EDIT`, `message_composer_close_preview` (composer, BUG-001), plus `LOADING` (report dialog), `conversation_subtitle_document` / `conversation_subtitle_whiteboard` (reply preview for collaborative bubbles), `error_text` (reaction info), `card_message_fallback` (card bubble).
- **UI (fr):** no raw keys beyond BUG-001 on the main screens; English leaks found: "Type a message" (L10N-008); `<html lang>` stays "en" (L10N-007). Single-word hard-coded strings (Kick, Ban, Admin…) are listed from source under L10N-003…006.

## BUG-018 — Call bubbles do not update live

- **Steps:** Alice calls Bob from the chat header, then cancels (or: Bob accepts and Alice later clicks "Leave session").
- **Actual:** Alice's chat keeps showing the "Outgoing Call" bubble (or "Answered Call"); the new status message is only announced as "1 new message" and never shown. After a reload the chat correctly shows "Cancelled Call" / "Call Ended", and Bob sees "Missed Call".
- **Expected:** the call's final status appears in the chat as soon as the call ends.
- **Severity:** Medium. **Tests:** CALL-01b, CALL-08b (expected to fail); CALL-01 / CALL-08 check the recorded status after a reload.

## BUG-019 — Calling someone who is already in a call does not return "busy"

- **Steps:** Bob calls Carol; Carol accepts. Alice (not in any call) calls Bob.
- **Actual:** Alice's "Outgoing call" screen keeps ringing (still open after 20 s; it ends only at the ~45 s unanswered timeout). Bob's page renders "Incoming Voice call from Alice" while his call runs (seen in Bob's trace; hidden behind the full-screen call view in the screenshot). No "Busy Call" is recorded.
- **Why:** the server does not decide busy — `POST /calls` to a user who is in a call answers `200 initiated` in ~0.5 s (API probe). The callee's client has to reject with `CALL_STATUS.BUSY`; UIKit 7.0.3 `CometChatIncomingCall` never checks for an active call (only `CometChatCallLogs` / call bubbles know the `busy` status).
- **Expected:** the callee's app rejects the second call as busy without interrupting the running call; the caller sees it end at once and "Busy Call" in the chat.
- **Severity:** Medium. **Test:** CALL-07 (fails as expected; Bob's own call is checked to carry on).

## Calls — other observations (Phase 7)

- **A11Y-013:** in the ongoing-call screen two header buttons have no accessible name; the named controls are "Mute microphone", "Audio device options", "Raise hand", "More options", "Leave session". Call status bubbles are exposed as articles named "<sender>, audio message".
- **L10N-006:** the incoming-call subtitle is the literal `Incoming {callType} Call` (`CometChatIncomingCall.tsx`); the caller-side "busy" status is labelled "Missed Call".
- **OBS-014:** after a reload, a chat whose only messages are calls is not in the Chats list (tests open it from Users). Needs a decision: intended filter or bug.
- **OBS-015:** once, Bob's page threw `Error: Container dimensions and number of tiles must be positive` when Alice left the call (Calls SDK layout teardown). No visible effect; allowed in the call tests and still logged.
- **Verified OK:** ringing (voice and video), decline, accept + connect (2 participants, timer running), mute / unmute, camera control on video calls, leave ends the call for both, call logs for both users, group call via a "Join" meeting bubble.

## BUG-017 — Admins and moderators cannot manage members

- **Steps:** Carol is an **admin** (or moderator) of a group owned by Alice; Erin is a participant. Carol opens Group Info → Members and hovers Erin.
- **Actual:** no "More options" button — Carol cannot kick, ban or change Erin's scope. The owner sees all three (MEM-10 owner passes).
- **Expected (v7 docs, Group Chat Setup):** moderators, admins and the owner can kick / ban participants and change their scope.
- **Cause (source):** `useCometChatGroupMembers.ts` learns the viewer's scope only inside the first member fetch — `if (loggedInUser && loggedInUserScope === null)` — but `loggedInUser` is set by a separate async effect that has not finished yet, so the scope stays `null` → treated as `participant`. The same effect resets the scope to `null` whenever the `group` prop changes, with no refetch. (Also: only the first page of 30 members is searched, so in larger groups the viewer may never be found.) The owner works because it is detected from `group.getOwner()`.
- **Severity:** High (group moderation is impossible for admins and moderators in the UI). **Tests:** MEM-10 admin / moderator (expected to fail); MEM-11 passes only trivially until this is fixed.

## BUG-016 — A search with no matches never finishes

- **Steps:** Chats → Search → type `qwxzv nothing matches this`.
- **Actual:** `GET /messages?searchKey=…` and `GET /conversations?searchKey=…` both return `data: []` within ~0.3 s, but the Messages section keeps its loading shimmer (> 15 s) and the Conversations section is an empty heading; "No Results" never appears. With a filter (e.g. Photos) and no results, "No Results" **is** shown.
- **Expected:** "No Results — We couldn't find any matches…".
- **Cause:** not found yet. `useCometChatSearchMessages` dispatches `FETCH_EMPTY` for an empty result, so the SDK's `fetchPrevious()` promise probably never settles for an empty keyword search (to be confirmed in the SDK).
- **Severity:** Medium. **Test:** SRCH-05.

## OBS-012 / OBS-013 — Search and group-deletion behaviour (documented, not bugs)

- **User search** (`GET /users?searchKey=`) matches from the start of the name or UID only: for "Bob k9x2-bob", `Bob k9` and `bob` match, `k9x2` does not.
- **Group deleted by its owner:** members get no live update (no SDK event); the group leaves their list after a reload.

## BUG-012 — A new 1:1 chat is unusable for its first seconds

- **Environment:** production app (us), SDK 4.1.12, UIKit 7.0.3; reproduced on 2026-09-28/29.
- **Steps (API, deterministic):**
  1. User A sends the first message to user B.
  2. Straight away, A reacts to it, deletes it, or B marks the chat as read.
- **Actual:** `403` for 1–4 s (measured 0.97 s, 3.8 s, 0.99 s):
  - reaction / delete → `ERR_MESSAGE_NO_ACCESS` "does not have access to the message"
  - `POST /users/{uid}/conversation/read` → `ERR_CONVERSATION_NOT_ACCESSIBLE` "…or it does not exist"
  - thread replies sent in the window fail (error mark in the UI)
  - `GET /users/{uid}/conversations` does not list the chat yet
- **What the user sees:** a reaction or delete that silently does nothing (UIKit only passes the error to `onError`; `useMessageListActions.ts` `reactToMessage`), a chat that never turns "Read", a thread reply with a red error mark, and — when they go back to Chats within the window — "No Conversations" until the next message arrives (the sample app remounts the list and refetches).
- **Expected:** a conversation is usable as soon as its first message is acknowledged; failures are shown to the user.
- **Severity:** High (every new chat; silent data loss for the user's action).
- **Tests:** API-01…03 (fail as expected), API-04 (control, passes), REA-09 (no user feedback on a rejected reaction). UI tests that are not about this window call `api.users.waitForConversation()` first.
- **Evidence:** traces of REA-01/02, ACT-14, THR-02/03, CONV-03, MSG-14b (Phase 3 runs); WebKit MSG-17 on the 2026-09-29 full run — three messages sent, reload, **"No Conversations"**; repro scripts in the session notes.

## BUG-013 — "Mark as unread" does nothing in the conversation list

- **Steps:** open a chat with an incoming message → message options → **Mark as unread**.
- **Actual:** the list shows no unread badge. The request `DELETE /users/{uid}/conversation/read {messageId}` succeeds (200), but its body is `{"data":{"success":true,"message":"…"}}`. SDK 4.1.12 `markMessageAsUnread` reads `response.data.conversation.conversationId` → `TypeError: Cannot read properties of undefined (reading 'conversationId')`; the promise never settles, so UIKit never publishes `ui:conversation/updated`.
- **Expected:** "the Conversations component … reflects the updated unread count in real-time" (UIKit docs, Core features → Mark as Unread).
- **Severity:** Medium. **Test:** CONV-10. **Owner:** SDK and/or chat API (response shape mismatch).

## BUG-015 — A failed thread reply leaks into the main conversation

- **Steps:** open a thread; send a reply that fails (reproduced with the BUG-012 window, and deterministically by answering `POST /messages/{id}/thread` with 500).
- **Actual:** the reply shows with the red error mark in the thread **and** in the main conversation, as if it were a normal message.
- **Expected:** it stays in the thread only (with a retry option).
- **Severity:** Medium. **Test:** THR-11.

## BUG-011 — Mention suggestions are not keyboard-operable

- **Steps:** in a group, type `@Bo` → suggestions open → press ArrowDown / Enter.
- **Actual:** arrow keys do nothing (the composer has no key handling for the list); Enter sends the message with the literal text "@Bo…" and the popup stays open.
- **Expected:** ArrowUp/Down move through the suggestions and Enter picks one (ARIA listbox pattern).
- **Severity:** Medium (keyboard and screen-reader users cannot mention anyone). **Test:** MEN-04 (MEN-04b: Escape does close it).

## BUG-014 — Emoji search ignores the emoji's name

- **Actual:** searching "joy" lists 😀 😁 😃 … but not 😂, whose name and tooltip are "joy". The search matches `keywords` only (`useCometChatEmojiKeyboard.ts`), and "joy" is not among 😂's keywords.
- **Expected:** the name is searchable too. **Severity:** Low. **Test:** CMP-07b.

## Accessibility findings from Phase 3 (A11Y-005 … A11Y-012)

| ID | Where | Detail | Test |
|---|---|---|---|
| A11Y-005 | New Group dialog | Escape does not close it | groups spec |
| A11Y-006 | Global search | Escape does not close it (Back button needed) | SRCH-09 |
| A11Y-007 | Message toolbar | Buttons can take keyboard focus while the toolbar stays `opacity: 0` | ACT-15 |
| A11Y-008 | Reaction picker | Escape does not close it (it is fully open before Escape is pressed) | REA-08 |
| ~~A11Y-009~~ → OBS-016 | Message options menu | Escape works once the menu has focus (first item, one animation frame after opening). An Escape pressed inside that frame is lost; ACT-16 passed on the 2026-09-29 full run | ACT-16, A11Y-02b |
| A11Y-010 | Conversation list | `role="listbox"` with `role="option"` rows, but no arrow-key support; Tab reaches the next row via each row's Delete button | CONV-17b (CONV-17 covers Tab) |
| A11Y-011 | Create Poll | `<label>` "Question" / "Options" not tied to their inputs | source |
| A11Y-012 | Message list | Extension messages are announced with their raw type, e.g. "Alice, extension_sticker message" | CMP-09 |

## L10N-005 — Hard-coded English in member management

- Member actions `'Kick'`, `'Ban'`, `'Change Scope'` (`CometChatGroupMembersItem.tsx`), scope options built as `s.charAt(0).toUpperCase() + s.slice(1)` ("Admin"…), the Change Scope description (`CometChatGroupMembersRoot.tsx`), and "Select {name} as new owner" / "Close" in the sample app's dialogs.

## L10N-004 — More hard-coded English

- Thread button label: `"{n} Reply|Replies, view thread"` — the ", view thread" part is not translated.
- Create Poll button while saving: `'Creating...'` (`CometChatCreatePoll.tsx`).
- The vote count reads "1 votes" (`accessibility_vote_count` has no singular form).

## OBS-010 — Thread shows its parent twice

- In two runs the thread panel listed the parent message again as the first reply (below "N Replies"), besides the parent shown at the top. In ATT-12's trace, `GET /messages/8271/thread` returned `[8271]` — the parent itself. A REST repro with text and image parents returned only the real replies, so the trigger is not known yet.

## OBS-011 — Duplicate "Today" separators

- A new chat with one message can show two "Today" separators (screenshots ATT-03, THR-02/03). Cosmetic.

## Not bugs (test assumptions corrected in Phase 3)

- **ACT-06:** a group owner cannot delete or edit other members' messages. Delete/Edit are sender-only in UIKit v7 (`CometChatMessageOptions.ts` `senderOnly: true`) and the docs give no scope that right.
- **REA-01/02 "403":** was BUG-012, not a permission problem.
- **CONV-08/09 badge back after reload:** was BUG-012 (read rejected inside the window). Outside the window the reader's own read state persists (CONV-09 passes) — the sender-side receipt is BUG-010.
- **Emoji "joy" not clickable (CMP-07):** BUG-014; the test now searches "tears".

## BUG-008 — White screen after a contact's account is deleted

- **Steps:**
  1. User A sends a message to user B.
  2. B's account is deleted, as happens with any account deletion.
  3. A opens (or reloads) the app.
- **Actual:** the server's conversation list returns A↔B **without `conversationWith`**. UIKit renders it without a null check: `CometChatConversationsItem.tsx:493–494` runs `'getGuid' in typingConvWith` and throws `TypeError: Cannot use 'in' operator to search for 'getGuid' in undefined`. There is no error boundary, so the **whole app unmounts (white screen) on every load** until the conversation is removed some other way.
- **Expected:** the conversation is skipped or shown as "Deleted user", and the app stays usable.
- **Notes:** if B sent the last message instead, the conversation simply disappears and nothing crashes. Deleting a *group* does not crash either. The conversation takes a few seconds to appear in the server list, so the test waits for that state.
- **Evidence:** REST `GET /users/{A}/conversations` shows `with=MISSING`; the page error is captured in the CONV-24 trace. Found when the framework's per-test cleanup crashed shared test users mid-run.
- **Severity:** **Critical.** A permanent white screen for real users, triggered by a routine account deletion. Related test: CONV-24.

## BUG-009 — Messages in the same second are shown out of order

- **Steps:**
  1. Send 15 messages quickly. A few per second is enough; the test uses REST.
  2. Open the conversation.
- **Actual:** the display order is `1…8, 12, 15, 11, 13, 9, 14, 10`, although message IDs and `sentAt` increase strictly on the server. With 40 messages, 8 are misplaced.
- **Expected:** creation order, broken on ID when timestamps tie.
- **Notes:** `sentAt` has one-second resolution. UIKit does not sort — it renders messages in the order the server returns them (no `sort` in `CometChatMessageList`), so the tie-break is missing on the **server** (`GET /users/{uid}/messages`). The conversation list behaves the same way for chats updated in the same second (CONV-07 needed a one-second gap). Active group chats and fast typers are affected.
- **Test design (Phase 3):** MSG-27 sends 30 messages in bursts of 10 parallel requests and expects id order; it fails on every run.
- **Severity:** High. Related tests: MSG-27 (15 messages, one page) and MSG-18 (40 messages).

## BUG-010 — Opening a chat never turns its messages "Read" for the sender

- **Steps (UI):** Alice sends Bob a message while Bob is elsewhere in the app → Bob opens the chat → Alice watches her bubble.
- **Actual:** Alice's bubble stays **"Delivered"**; in a group, Message Information keeps Bob at "Delivered". Measured after the BUG-012 window: 1:1 0 of 5 runs Read (MSG-14b), group 1 of 5 (MSG-15).
- **Root cause (API, deterministic):** opening a chat calls `CometChat.markConversationAsRead` → `POST /users/{uid}/conversation/read` → **200** "marked as read". The reader's unread count is cleared (CONV-09 passes), but the messages never get `readAt` (checked for 30 s) and no read receipt reaches the sender. Test API-05.
- **Also intermittent on the live path:** when Bob already has the chat open, UIKit calls the per-message `CometChat.markAsRead` (`useMessageListEvents.ts`, only when scrolled to the bottom); Alice saw "Read" in 1 of 2 runs (MSG-14c).
- **Earlier note corrected:** Phase 2 recorded 1:1 receipts as working — that run used the live path.
- **Expected:** once the receiver has seen a message, the sender sees "Read" (1:1 and per member in groups).
- **Severity:** High (read receipts are a core feature). **Tests:** API-05, MSG-14b, MSG-15 (expected to fail), MSG-14c (plain regression, intermittent).

## BUG-007 — Enter is ignored while the previous message is sending

`CometChatMessageComposerSendButton.tsx`: `disabled = !canSend || isSending`, and Enter follows the same rule. A user who sends "ok" and quickly types "thanks" + Enter gets **nothing sent**, and the text stays in the composer with no feedback. Reproduced every time by MSG-13 (the 2nd of 10 quick messages stays in the composer). **Severity:** Medium (UX).

## BUG-003 — No realtime after login when the login profile update is slow

- **Environment:** UIKit 7.0.3 + Chat SDK 4.1.12, sample app, production app (us), Chromium and WebKit
- **Preconditions:** a user who is not logged in
- **Steps:**
  1. Log in with a UID (credentials → UID → Login).
  2. The login flow calls `POST auth_tokens` → `PUT /me` → opens the realtime socket → `PUT /me` again.
  3. Make that second `PUT /me` answer slowly. The test delays it by 2.5 s; in real life this is a slow network or a busy API.
  4. Have another user send this user a message.
- **Expected:** the socket authenticates once it opens, and the message and new conversation arrive live.
- **Actual:** the socket opens (HTTP 101, in-page `open` event) but **the client never sends its auth frame**, receives nothing, and never retries. No live messages, presence, typing or calls for the whole session, until the page is reloaded. The UI gives no sign that anything is wrong.
- **Evidence:**
  - Control run: the socket opens after the 2nd `PUT /me` returns, the auth frame goes out 1 ms after `open`, and the server replies `{"code":"200","status":"OK"}` (4/4 OK).
  - Delayed run: `open` comes before the 2nd `PUT /me` returns, and there is no `send` at all (4/4 broken, Chromium and WebKit).
  - It also happened naturally when 4 users logged in at the same moment (3 of 4 sessions affected, repeatable).
- **Probable area:** Chat SDK socket authentication on `open` depends on login state that the 2nd `PUT /me` sets; there is no retry. Owning team (SDK vs UIKit) to confirm.
- **Frequency:** 100% when the timing is met. Occasional in real life (slow networks and devices).
- **Severity:** **High.** Realtime silently fails for the whole session.
- **Related test:** `tests/auth/realtime-after-login.spec.ts` (AUTH-23, `test.fail` until fixed).
- **Framework handling:** `loginAs` waits for realtime. If it doesn't connect, it reloads once (the user's workaround) and adds a `BUG-003` annotation to that test in the report, so real occurrences are counted, not hidden.

## BUG-002 — Blank conversation when realtime connects while history is loading

- **Environment:** UIKit 7.0.3, sample app, production app (us), Chromium and WebKit
- **Steps:**
  1. User B has a conversation with A that contains messages.
  2. B reloads the page.
  3. B opens that conversation at the moment the realtime socket finishes connecting. Right after a reload, that is simply clicking quickly.
- **Expected:** the history loads and messages appear.
- **Actual:** `GET /users/{uid}/conversation` → the socket connects → the app re-fetches the conversation → `GET /users/{uid}/messages` returns **200 with the messages, but nothing renders**. The list stays blank, with **no loader, no empty state and no retry**. Switching to another chat and back fixes it.
- **Evidence:** reproduced 4/4 on Chromium and 4/4 on WebKit by releasing the realtime socket exactly when the conversation request starts (`holdRealtimeSocket` in `utils/realtime.ts`). WebKit hit it naturally in SMK-01 after a reload (4/4 runs) because its socket connects about 50 ms after the user's click. If the socket is held for the whole time or connects early, history loads fine.
- **Frequency:** 100% when the timing is met; common on WebKit right after a reload.
- **Severity:** **High.** The conversation looks empty (users may think messages are lost).
- **Related test:** `tests/messaging/history-load.spec.ts` (MSG-26, `test.fail` until fixed).
- **Framework handling:** `ChatApp.open()` / `reload()` wait until the realtime socket is authenticated before a test continues, so other tests don't trip over this race by accident.

## BUG-005 — Revoked / expired session is not handled

- **Steps:**
  1. Log in.
  2. Revoke that session's auth token. The test uses REST `DELETE /users/{uid}/auth_tokens/{token}`; in real life this is an admin action, a token expiry or a password change.
  3. Reload the page.
- **Expected:** the login screen appears, ideally with a "session expired" message.
- **Actual:** the app stays on Home. The Chats pane shows **"OOPS! Looks like something went wrong"** (`GET /conversations` → 401), `POST /user_sessions` → 401, there is an uncaught page error (`: Object`, a non-Error rejection), and there is no path back to login except the menu's Log Out.
- **Severity:** Medium. Related test: AUTH-20 (`tests/auth/session.spec.ts`, `test.fail`).

## BUG-006 — Corrupted saved session → white screen

- **Steps:** log in, then change `localStorage["<appId>:common_store/user"]` to invalid JSON and reload.
- **Actual:** a blank page, with an uncaught `SyntaxError: Expected property name or '}' in JSON` from session restore. Nothing renders, so the user must clear site data by hand.
- **Expected:** discard the bad entry and show the login screen.
- **Severity:** Low (rare trigger: tampering, a partial write, a storage format change between SDK versions), but there is no recovery path. Related test: AUTH-25.

## BUG-004 — Login errors never say why

`sample-app/src/components/CometChatLogin/CometChatLogin.tsx:58–61` runs `setError(err instanceof Error ? err.message : 'Login failed')`. CometChat SDK errors are `CometChatException` objects, not `Error` instances, so the UI **always** shows "Login failed", whether the UID is unknown, the Auth Key is wrong, or the region or App ID is wrong. Related test: AUTH-24 (receives "Login failed"). **Severity:** Low (sample-app UX).

## OBS-008 — Credentials are not validated

The credentials screen accepts any App ID / region / Auth Key and goes straight to the login screen. A mistake only shows up when a login fails, and then only as the generic message above.

## Verified OK in Phase 2 (for reference)

- Header menu accessibility: focus moves into the menu on open, Escape closes it, and focus returns to "More options"; an outside click also closes it.
- **Tabs keep separate selections**: a chat opened from Users is restored when you come back to Users, and the other tabs show their own empty pane. This is a design choice, not a bug.
- Logout removes the SDK session, keeps the app credentials, and a second user in the same tab sees none of the first user's data.

## ENV-001 — Firefox cannot launch on this Mac

The Playwright Firefox build 1543 (Firefox 155) exits at start-up on macOS 27.0 with `sandbox_extension_issue_file_to_process … Operation not permitted`, then `Could not find profile folder`. These attempts did not help:
- another TMPDIR
- headed mode
- the older build 1532
- `MOZ_DISABLE_*_SANDBOX`

It is not related to the app. Set `PW_NO_FIREFOX=1` locally (already in `.env`). Firefox runs in Linux CI (Phase 9) or the official Playwright Docker image.

## L10N-002 — Conversations empty state not localized

`src/components/CometChatConversations/CometChatConversationsEmptyState.tsx:33–35` hard-codes "No Conversations" / "There are no conversations available at the moment.", although `conversation_empty_title` / `conversation_empty_subtitle` exist in all locales.

## OBS-006 / OBS-007

- After a reload, `GET /conversations` was requested 4 times within about 1 s (WebKit trace), which looks redundant.
- Opening a chat with a user you have never messaged makes `GET /users/{uid}/conversation` return **403**. The UI handles it and the chat works. This is probably the API's "no conversation yet" response, but 404 would be the usual code; to confirm with the API team.

---

## BUG-001 — Composer buttons announce raw translation keys

- **Environment:** UIKit 7.0.3, sample app, production app (us), Chromium 1440×900, locale en-us
- **Preconditions:** logged in, any conversation open
- **Steps:** open a conversation → inspect the composer buttons with a screen reader or the accessibility tree
- **Expected:** "Attachments", "Emoji", "Voice recording", "Send", and "Cancel edit" on the edit preview
- **Actual:** `ATTACHMENTS`, `EMOJI`, `VOICE_RECORDING`, `SEND`, `CANCEL_EDIT`
- **Root cause:** the keys are not in **any** of the 19 locale files. `getLocalizedString()` returns the key itself when a key is missing (`CometChatLocalize.ts:105`), so the `|| 'Attachments'` fallbacks never run:
  - `src/components/CometChatMessageComposer/CometChatMessageComposerAttachmentButton.tsx:349`
  - `src/components/CometChatMessageComposer/CometChatMessageComposerEmojiButton.tsx:88`
  - `src/components/CometChatMessageComposer/CometChatMessageComposerVoiceButton.tsx:56`
  - `src/components/CometChatMessageComposer/CometChatMessageComposerSendButton.tsx:38`
  - `src/components/CometChatMessageComposer/CometChatMessageComposerEditPreview.tsx:141`
- **Frequency:** always
- **Severity:** Medium. Screen-reader users hear the keys, and they are never translated in other locales.
- **Evidence:** `docs/discovery/14-message-composer.aria.yml`, `docs/discovery/14-message-composer.png`
- **Related tests:** CMP-01, L10N-03

## A11Y-001 — Home tabs not operable by keyboard

`sample-app/src/components/CometChatSelector/CometChatTabs.tsx:63–71`: each tab is a `div` with `onClick`. There is no `role="tab"`, no `tabIndex` and no key handler, and the a11y tree shows only `img` + text. Related test: NAV-05.

## A11Y-002 — Credentials / login controls are click-only

- Region chips: `CometChatCredentials.tsx:52, 61, 70` (`div` + `onClick`).
- Sample-user cards: `CometChatLogin.tsx:76`.
- "Change App Credentials": `CometChatLogin.tsx:145` (`span` + `onClick`).

Related test: AUTH-22.

## A11Y-003 — User details actions are click-only

`CometChatUserDetails.tsx:126` (Close icon `div`) and `:143–150` (Block / Delete Chat `div` items). Related tests: UDET-02, UDET-08.

## A11Y-004 — Nested interactive control in call logs

`src/components/CometChatCallLogs/CometChatCallLogs.tsx:190–197`: the row has `role="button"`, and the trailing call control (`:131–139`) is another `role="button"` inside it. This is axe rule `nested-interactive`. Related test: CALL-16.

## L10N-001 — Locale coverage gaps (static audit of UIKit resources)

Missing keys compared with `en-us` (595 keys): `hi` 10, `es` 36, `ko` 62, and 37 in every other locale. Strings identical to English (possibly untranslated): `ja` 100, `zh` 100, `ru` 100, `nl` 138, and so on. Some are legitimately identical (brand names, "OK"), so this needs a per-key review. The UI cannot switch locale yet because `index.tsx` fixes `en-us`. Related tests: L10N-01…04.

## OBS-001 — HTTP 408 on group conversation read

`POST https://<appId>.apiclient-us.cc-cluster-2.io/v3.0/groups/cometchat-guid-1/conversation/read` → 408, once, while opening "Hiking Group" as `cometchat-uid-1`. It could be transient. NET-06 will try to reproduce it and check whether the unread state is still correct afterwards.

## OBS-002 — Blank message list while loading

In `discovery/10-conversation-open.png` (first crawl) the message area is empty with no shimmer, and messages appear a moment later. MSG-22 will measure it and assert that a loading indicator is shown.

## OBS-003 / OBS-004 — Escape handling

Escape did not close the global search panel (the `Back` button is required) or the "New Group" dialog (the `Close` button is required). The reaction picker stayed open after Escape, but the key may have been pressed before the picker rendered. A11Y-04 checks every overlay deliberately.

## OBS-005 — Invisible hover toolbar in the a11y tree

`CometChatMessageBubble.css:127` sets the options to `opacity: 0; pointer-events: none` until `mouseenter` on the bubble body, but the toolbar buttons stay in the accessibility tree. ACT-15 checks whether keyboard focus reveals them.
