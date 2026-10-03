# Coverage Matrix — CometChat React UIKit v7 (sample app)

_Updated after Phase 2 · 2026-09-27 · environment: **production app, region us** · last run: Chromium + WebKit (Firefox blocked locally — ENV-001)_

`FAILED` rows marked "(expected)" are regression tests for confirmed product bugs; they are written with `test.fail()` and flip to an unexpected pass when the bug is fixed.

**Statuses:** `TODO` (planned, not automated) · `AUTOMATED` · `PASSED` · `FAILED` · `BLOCKED` · `NOT APPLICABLE` · `NEEDS INVESTIGATION` · `VERIFY` (availability to confirm first)

**Kinds:** `+` positive · `−` negative · `E` edge · `P` permission · `RT` realtime (2+ users) · `R` refresh / persistence · `NET` network · `A11Y` accessibility · `VIS` visual

**Browsers:** C = Chromium, F = Firefox, W = WebKit. Rows tagged `@smoke` / `@critical` run on C F W; the rest on C unless a note says otherwise.

## Summary

| Total scenarios | 276 |
|---|---|
| PASSED | 31 |
| FAILED | 7 |
| AUTOMATED | 0 |
| TODO | 226 |
| VERIFY | 3 |
| BLOCKED | 6 |
| NEEDS INVESTIGATION | 1 |
| NOT APPLICABLE | 2 |

| Kind | + | − | E | P | RT | R | NET | A11Y | VIS |
|---|---|---|---|---|---|---|---|---|---|
| Count | 120 | 25 | 28 | 18 | 48 | 22 | 16 | 21 | 8 |

| Section | Scenarios | Spec |
|---|---|---|
| Authentication & credentials | 25 | `tests/auth/{credentials,login,session}.spec.ts` |
| Home & navigation | 7 | `tests/home/navigation.spec.ts` |
| Conversations | 23 | `tests/conversations/*.spec.ts` |
| Users | 10 | `tests/users/users.spec.ts` |
| User details & blocking | 8 | `tests/users/user-details.spec.ts` |
| Messaging — send, receive, list | 26 | `tests/messaging/{send,receive,list}.spec.ts` |
| Message actions | 15 | `tests/messaging/actions.spec.ts` |
| Composer | 15 | `tests/composer/*.spec.ts` |
| Attachments & media | 13 | `tests/attachments/*.spec.ts` |
| Reactions | 8 | `tests/reactions/reactions.spec.ts` |
| Threads | 10 | `tests/threads/threads.spec.ts` |
| Mentions | 12 | `tests/mentions/mentions.spec.ts` |
| Groups | 15 | `tests/groups/{groups,create,join,leave}.spec.ts` |
| Group details, members & permissions | 13 | `tests/groups/{details,members,permissions}.spec.ts` |
| Search | 12 | `tests/search/*.spec.ts` |
| Calls | 16 | `tests/calls/*.spec.ts` |
| Extensions | 6 | `tests/extensions/*.spec.ts` |
| Moderation | 3 | `tests/moderation/*.spec.ts` |
| AI | 2 | `tests/ai/*.spec.ts` |
| Theme | 4 | `tests/theme/theme.spec.ts` |
| Localization | 5 | `tests/localization/*.spec.ts` |
| Responsive | 6 | `tests/responsive/*.spec.ts` |
| Accessibility | 5 | `tests/a11y/*.spec.ts` |
| Visual regression | 6 | `tests/visual/*.spec.ts` |
| Network & resilience | 6 | `tests/network/*.spec.ts` |
| Performance signals (report only) | 4 | `tests/perf/*.spec.ts` |
| Smoke journey | 1 | `tests/smoke/smoke.spec.ts` |

## Authentication & credentials

Spec: `tests/auth/{credentials,login,session}.spec.ts` · tags: `@auth` · browsers: C

| ID | Scenario | Kind | POM | Extra tags | Status | Result | Bug | Notes |
|---|---|---|---|---|---|---|---|---|
| AUTH-01 | Credentials screen shows region chips US/EU/IN, App ID, Auth Keys, Continue | + | CredentialsPage | @smoke | PASSED | C ✅ W ✅ |  | `tests/auth/credentials.spec.ts` |
| AUTH-02 | Valid App ID + region + Auth Key → login screen | + | CredentialsPage | @smoke @critical | PASSED | C ✅ W ✅ |  | `tests/auth/credentials.spec.ts` |
| AUTH-03 | Empty App ID / Auth Key blocked by required validation | − | CredentialsPage |  | PASSED | C ✅ |  | Data-driven: empty App ID, empty Auth Key, whitespace App ID |
| AUTH-04 | Wrong App ID → clear error, no crash | − | CredentialsPage, LoginPage |  | PASSED | C ✅ | BUG-004 | Error shown, but only the generic "Login failed"; a wrong App ID is not caught on the credentials screen |
| AUTH-05 | Wrong Auth Key → login attempt shows error | − | LoginPage |  | PASSED | C ✅ | BUG-004 | Generic "Login failed" |
| AUTH-06 | Wrong region (EU for a US app) → error | − | CredentialsPage |  | PASSED | C ✅ | BUG-004 | 401 from the other region; generic "Login failed" |
| AUTH-07 | Credentials persist across reload | R | CredentialsPage |  | PASSED | C ✅ |  |  |
| AUTH-08 | "Change App Credentials" returns to credentials screen and clears stored values | + | LoginPage |  | PASSED | C ✅ |  |  |
| AUTH-09 | Login with valid UID → Home, Chats tab active | + | LoginPage, HomePage | @smoke @critical | PASSED | C ✅ W ✅ |  | `tests/auth/login.spec.ts` |
| AUTH-10 | Login via sample-user card | + | LoginPage |  | PASSED | C ✅ |  | Sample-user list mocked with a framework user (shared sample users untouched) |
| AUTH-11 | Non-existent UID → error message, stays on login | − | LoginPage |  | PASSED | C ✅ | BUG-004 | Generic "Login failed" |
| AUTH-12 | Empty UID → cannot submit | − | LoginPage |  | PASSED | C ✅ |  | Empty and whitespace-only |
| AUTH-13 | UID with surrounding spaces is trimmed | E | LoginPage |  | PASSED | C ✅ |  |  |
| AUTH-14 | Enter key submits UID form | + | LoginPage |  | PASSED | C ✅ |  |  |
| AUTH-15 | Session persists after reload | R | HomePage | @critical | PASSED | C ✅ W ✅ |  | `tests/auth/session.spec.ts` |
| AUTH-16 | Session restored in a new browser context from saved state (browser restart) | R | HomePage |  | PASSED | C ✅ |  |  |
| AUTH-17 | Logout → login screen; reload stays logged out | + R | HomePage, LoginPage | @smoke | PASSED | C ✅ W ✅ |  | SDK session removed, app credentials kept |
| AUTH-18 | Logout then login as another user → none of the previous user's data visible | E | HomePage, ConversationList |  | PASSED | C ✅ |  | Data-leak check |
| AUTH-19 | Two users logged in concurrently in separate contexts | RT | HomePage |  | PASSED | C ✅ W ✅ |  | Every multi-user test (SMK-01) |
| AUTH-20 | Revoked / expired session (auth token deleted) → back to the login screen | E | LoginPage |  | FAILED | C ❌ (expected) | BUG-005 | Stays on a broken Home: "OOPS! Looks like something went wrong" |
| AUTH-21 | Sample-users JSON fetch fails → fallback users shown | NET | LoginPage | @network | PASSED | C ✅ |  | Fetch aborted → superhero1–4 fallback |
| AUTH-22 | Sample-user cards and "Change App Credentials" reachable by keyboard | A11Y | LoginPage | @a11y | FAILED | C ❌ (expected) | A11Y-002 | Expected to fail — A11Y-002 |
| AUTH-24 | A failed login explains why (e.g. unknown UID) | − | LoginPage |  | FAILED | C ❌ (expected) | BUG-004 | Shows "Login failed" |
| AUTH-25 | A corrupted saved session does not crash the app | E | LoginPage, HomePage |  | FAILED | C ❌ (expected) | BUG-006 | White screen + uncaught SyntaxError |
| AUTH-23 | Realtime works after login even when the login profile update (2nd PUT /me) is slow | RT NET | flows/sign-in, ConversationList | @critical @network | FAILED | C ❌ W ❌ (expected) | BUG-003 | `tests/auth/realtime-after-login.spec.ts` — expected-fail until BUG-003 is fixed |

## Home & navigation

Spec: `tests/home/navigation.spec.ts` · tags: `@navigation` · browsers: C

| ID | Scenario | Kind | POM | Extra tags | Status | Result | Bug | Notes |
|---|---|---|---|---|---|---|---|---|
| NAV-01 | Tabs switch panes; active tab highlighted | + | HomePage | @smoke | PASSED | C ✅ W ✅ |  | `tests/home/navigation.spec.ts` |
| NAV-02 | Empty right-pane state per tab ("No conversation selected", …) | + | HomePage |  | PASSED | C ✅ |  |  |
| NAV-03 | Chats "More options" menu: current user, Create conversation, Log Out | + | HomePage.menu |  | PASSED | C ✅ |  |  |
| NAV-04 | Menu: focus moves in on open, Escape closes it and returns focus, outside click closes it | A11Y | HomePage.menu | @a11y | PASSED | C ✅ |  | 3 tests: focus-in + Escape, focus returns to button, outside click |
| NAV-05 | Tabs operable by keyboard | A11Y | HomePage | @a11y | FAILED | C ❌ (expected) | A11Y-001 | Expected to fail — A11Y-001 |
| NAV-06 | Each tab keeps its own selection (chat opened from Users returns with Users; other tabs show their empty pane) | E | HomePage |  | PASSED | C ✅ |  | Per-tab selection — documented design |
| NAV-07 | No unexpected console / HTTP errors on load | NET | netWatch | @network | PASSED | C ✅ |  | No console / page / HTTP errors |

## Conversations

Spec: `tests/conversations/*.spec.ts` · tags: `@conversations` · browsers: C

| ID | Scenario | Kind | POM | Extra tags | Status | Result | Bug | Notes |
|---|---|---|---|---|---|---|---|---|
| CONV-01 | List loads (shimmer → items) | + | ConversationList | @smoke | TODO |  |  |  |
| CONV-02 | Empty state for a user with no conversations | + | ConversationList |  | TODO |  |  | Fresh persona |
| CONV-03 | Item shows avatar, name, last message, time, receipt | + | ConversationItem |  | TODO |  |  |  |
| CONV-04 | Group item shows "Sender: text" and private/password badge | + | ConversationItem |  | TODO |  |  |  |
| CONV-05 | Last-message label for media / sticker / poll | + | ConversationItem |  | TODO |  |  |  |
| CONV-06 | Select conversation → chat opens, item selected | + | ConversationList | @smoke | TODO |  |  |  |
| CONV-07 | Incoming message moves conversation to top | RT | ConversationList | @critical | PASSED | C ✅ W ✅ |  | Exercised by SMK-01 (new conversation appears live) |
| CONV-08 | Unread badge increments per incoming message | RT | ConversationItem | @critical | TODO |  |  |  |
| CONV-09 | Opening a conversation clears unread; still cleared after reload | R | ConversationItem |  | TODO |  |  |  |
| CONV-10 | Mark Unread (message option) → badge; persists after reload | R | MessageOptionsMenu, ConversationItem |  | TODO |  |  |  |
| CONV-11 | Typing indicator in list item | RT | ConversationItem |  | TODO |  |  |  |
| CONV-12 | Presence dot updates on other user online / offline | RT | ConversationItem |  | TODO |  |  |  |
| CONV-13 | Delete conversation → confirm → removed; still removed after reload | + R | ConversationItem, ConfirmDialog |  | TODO |  |  |  |
| CONV-14 | Delete conversation → cancel → still present | − | ConfirmDialog |  | TODO |  |  |  |
| CONV-15 | Ordering by latest activity survives reload | R | ConversationList |  | TODO |  |  |  |
| CONV-16 | Scroll loads more conversations (pagination) | + | ConversationList |  | TODO |  |  | Seed 40 conversations via REST |
| CONV-17 | Arrow keys move selection, Enter opens | A11Y | ConversationList | @a11y | TODO |  |  |  |
| CONV-18 | Clicking a conversation while the list is loading shows no error | E | ConversationList |  | TODO |  |  | Old-suite regression |
| CONV-19 | Conversations API failure → error state; recovers | NET | ConversationList | @network | TODO |  |  |  |
| CONV-20 | Create conversation → pick user → chat opens | + | NewChatView |  | TODO |  |  |  |
| CONV-21 | Create conversation → pick group → chat opens | + | NewChatView |  | TODO |  |  |  |
| CONV-22 | New-chat search filters users | + | NewChatView |  | TODO |  |  |  |
| CONV-23 | Deleted conversation reappears when a new message arrives | RT | ConversationList |  | TODO |  |  |  |

## Users

Spec: `tests/users/users.spec.ts` · tags: `@users` · browsers: C

| ID | Scenario | Kind | POM | Extra tags | Status | Result | Bug | Notes |
|---|---|---|---|---|---|---|---|---|
| USR-01 | Users list loads with A–Z section headers | + | UsersList |  | TODO |  |  |  |
| USR-02 | Search by exact name finds persona | + | UsersList |  | TODO |  |  |  |
| USR-03 | Partial and case-insensitive search | E | UsersList |  | TODO |  |  | Data-driven |
| USR-04 | Special characters / no match → empty state | − | UsersList |  | TODO |  |  |  |
| USR-05 | Clear search restores list | + | UsersList |  | TODO |  |  |  |
| USR-06 | Select user → 1:1 chat opens | + | UsersList | @smoke | TODO |  |  |  |
| USR-07 | Presence: other user logs in → Online; logs out → Offline / last seen | RT | UsersList, MessageHeader |  | TODO |  |  |  |
| USR-08 | Scroll loads more users | + | UsersList |  | TODO |  |  | Assert behaviour, not totals (shared app) |
| USR-09 | Keyboard navigation in list | A11Y | UsersList | @a11y | TODO |  |  |  |
| USR-10 | Users API failure → error state | NET | UsersList | @network | TODO |  |  |  |

## User details & blocking

Spec: `tests/users/user-details.spec.ts` · tags: `@users` · browsers: C

| ID | Scenario | Kind | POM | Extra tags | Status | Result | Bug | Notes |
|---|---|---|---|---|---|---|---|---|
| UDET-01 | Header click opens User Info: avatar, name, status | + | UserDetails |  | TODO |  |  |  |
| UDET-02 | Close button closes the panel | + | UserDetails |  | TODO |  |  | div + onClick — A11Y-003 |
| UDET-03 | Block → confirm → composer replaced by blocked notice; persists after reload | + R | UserDetails, ConfirmDialog, MessageComposer | @critical | TODO |  |  | tempUser fixture |
| UDET-04 | Block → cancel → nothing changes | − | ConfirmDialog |  | TODO |  |  |  |
| UDET-05 | Blocked user's messages are not delivered to the blocker | RT P | MessageList |  | TODO |  |  |  |
| UDET-06 | Unblock → composer returns; messaging works again | + | UserDetails |  | TODO |  |  |  |
| UDET-07 | Delete Chat → confirm → conversation removed; persists | + R | UserDetails, ConversationList |  | TODO |  |  |  |
| UDET-08 | Block / Delete Chat / Close reachable by keyboard | A11Y | UserDetails | @a11y | TODO |  |  | Expected to fail — A11Y-003 |

## Messaging — send, receive, list

Spec: `tests/messaging/{send,receive,list}.spec.ts` · tags: `@messaging` · browsers: C

| ID | Scenario | Kind | POM | Extra tags | Status | Result | Bug | Notes |
|---|---|---|---|---|---|---|---|---|
| MSG-01 | Send text with Send button → outgoing article | + | MessageComposer, MessageList | @smoke @critical | PASSED | C ✅ W ✅ |  | Exercised by SMK-01 |
| MSG-02 | Send with Enter | + | MessageComposer |  | TODO |  |  |  |
| MSG-03 | Shift+Enter inserts newline; multiline renders | E | MessageComposer |  | TODO |  |  |  |
| MSG-04 | Send disabled for empty composer | − | MessageComposer |  | TODO |  |  |  |
| MSG-05 | Whitespace-only message not sent | − | MessageComposer |  | TODO |  |  |  |
| MSG-06 | Long text (5,000 chars) sends and renders fully | E | MessageComposer, MessageBubble |  | TODO |  |  |  |
| MSG-07 | Emoji-only and mixed emoji text | E | MessageBubble |  | TODO |  |  | Data-driven |
| MSG-08 | HTML / script payload rendered as text, never executed | E | MessageBubble | @security | TODO |  |  | dompurify |
| MSG-09 | Multilingual text (Hindi, Japanese, Arabic RTL) | E | MessageBubble |  | TODO |  |  | Data-driven |
| MSG-10 | URL renders as a safe clickable link | + | MessageBubble |  | TODO |  |  |  |
| MSG-11 | Receiver gets 1:1 message in realtime | RT | MessageList ×2 | @smoke @critical | PASSED | C ✅ W ✅ |  | Exercised by SMK-01 |
| MSG-12 | Group of 3 receives message in realtime | RT | MessageList ×3 | @critical | TODO |  |  |  |
| MSG-13 | 10 rapid messages keep order on both sides | RT E | MessageList |  | TODO |  |  |  |
| MSG-14 | Receipt goes sent → delivered → read as receiver opens chat | RT | MessageBubble | @critical | TODO |  |  |  |
| MSG-15 | Group: Message Info shows per-member delivered / read | RT | MessageInfo |  | TODO |  |  |  |
| MSG-16 | Timestamps and date separators correct | + | MessageList |  | TODO |  |  |  |
| MSG-17 | Messages persist after reload, order preserved | R | MessageList | @critical | PASSED | C ✅ W ✅ | BUG-002 | SMK-01 — passes once realtime is connected; the race itself is MSG-26 |
| MSG-18 | Scroll up loads older messages | + | MessageList |  | TODO |  |  | Seed 60 via REST |
| MSG-19 | Scroll-to-bottom button appears when scrolled up and works | + | MessageList |  | TODO |  |  |  |
| MSG-20 | New-message indicator when scrolled up and a message arrives | RT | MessageList |  | TODO |  |  |  |
| MSG-21 | Paste text into composer and send | + | MessageComposer |  | TODO |  |  |  |
| MSG-22 | Loading state shown while conversation messages load (no blank gap) | E | MessageList |  | TODO |  |  | OBS-002 |
| MSG-23 | Send while offline → pending / failed state; reconnect → delivered or retry | NET | MessageList | @network | TODO |  |  |  |
| MSG-24 | Draft behaviour when switching conversations (document) | E | MessageComposer |  | TODO |  |  |  |
| MSG-25 | Messages still present after logout / login | R | MessageList |  | TODO |  |  |  |
| MSG-26 | History loads when the realtime connection completes while a conversation is opening | RT NET | MessageList | @critical @network | FAILED | C ❌ W ❌ (expected) | BUG-002 | `tests/messaging/history-load.spec.ts` — expected-fail until BUG-002 is fixed |

## Message actions

Spec: `tests/messaging/actions.spec.ts` · tags: `@messaging` · browsers: C

| ID | Scenario | Kind | POM | Extra tags | Status | Result | Bug | Notes |
|---|---|---|---|---|---|---|---|---|
| ACT-01 | Outgoing options: React, Reply, Reply in thread, Copy, Edit, Delete, Info | P | MessageOptionsMenu |  | TODO |  |  |  |
| ACT-02 | Incoming options (participant): no Edit / Delete | P | MessageOptionsMenu |  | TODO |  |  | Live: Reply in thread, Copy, Translate, Report, Mark Unread |
| ACT-03 | Edit own message → "Edited"; receiver sees edit; persists | RT R | MessageComposer, MessageBubble | @critical | TODO |  |  |  |
| ACT-04 | Cancel edit keeps original | − | MessageComposer |  | TODO |  |  |  |
| ACT-05 | Delete own message → confirm → deleted bubble on both sides; persists | RT R | MessageBubble, ConfirmDialog | @critical | TODO |  |  |  |
| ACT-06 | Group admin can delete others' messages; participant cannot | P | MessageOptionsMenu |  | TODO |  |  |  |
| ACT-07 | Reply → quote preview → quoted bubble; receiver sees quote | RT | MessageComposer, MessageBubble |  | TODO |  |  |  |
| ACT-08 | Cancel reply preview | − | MessageComposer |  | TODO |  |  |  |
| ACT-09 | Copy → toast + clipboard contains text | + | MessageOptionsMenu, Toast |  | TODO |  |  | Chromium clipboard permission |
| ACT-10 | Message Info panel opens and stays open after load | + | MessageInfo |  | TODO |  |  | Old-suite regression |
| ACT-11 | Report → flag dialog, reasons, submit; cancel | + − | FlagMessageDialog |  | TODO |  |  |  |
| ACT-12 | Translate → translation shown under original | + | MessageBubble | @extensions | TODO |  |  |  |
| ACT-13 | Message Privately (group incoming) → opens 1:1; absent on outgoing | + P | MessageOptionsMenu |  | TODO |  |  |  |
| ACT-14 | No actions offered on a deleted message | E | MessageOptionsMenu |  | TODO |  |  |  |
| ACT-15 | Hover toolbar reachable by keyboard focus | A11Y | MessageBubble | @a11y | TODO |  |  | Toolbar is opacity:0 but in a11y tree — OBS-005 |

## Composer

Spec: `tests/composer/*.spec.ts` · tags: `@composer` · browsers: C

| ID | Scenario | Kind | POM | Extra tags | Status | Result | Bug | Notes |
|---|---|---|---|---|---|---|---|---|
| CMP-01 | Composer buttons have human-readable accessible names | A11Y | MessageComposer | @a11y @localization | TODO |  | BUG-001 | Expected to fail — BUG-001 |
| CMP-02 | Bold / italic / underline / strike render for the receiver | + RT | FormattingToolbar |  | TODO |  |  | Data-driven |
| CMP-03 | Keyboard shortcuts (Mod+B / I / U) | + | FormattingToolbar |  | TODO |  |  |  |
| CMP-04 | Link dialog inserts a link | + | FormattingToolbar |  | TODO |  |  |  |
| CMP-05 | Lists, blockquote, inline code, code block | + | FormattingToolbar |  | TODO |  |  | Data-driven |
| CMP-06 | Formatting persists after reload | R | MessageBubble |  | TODO |  |  |  |
| CMP-07 | Emoji keyboard: categories, search, insert | + | EmojiKeyboard |  | TODO |  |  |  |
| CMP-08 | Emoji keyboard closes on Escape / outside click | A11Y | EmojiKeyboard | @a11y | TODO |  |  |  |
| CMP-09 | Sticker keyboard: categories, send; receiver sees sticker | + RT | StickerKeyboard | @extensions | TODO |  |  |  |
| CMP-10 | Voice recording: record → preview → send → audio bubble | + | VoiceRecorder | @calls | TODO |  |  | calls project (fake mic) |
| CMP-11 | Voice recording cancel | − | VoiceRecorder | @calls | TODO |  |  |  |
| CMP-12 | Microphone permission denied → clear error | E | VoiceRecorder | @calls | TODO |  |  |  |
| CMP-13 | Typing indicator shown to receiver and cleared after stop | RT | MessageHeader |  | TODO |  |  |  |
| CMP-14 | Composer disabled / replaced for a blocked user | P | MessageComposer |  | TODO |  |  | See UDET-03 |
| CMP-15 | Attachment menu does not overflow into the conversation list | E | AttachmentSheet | @responsive | TODO |  |  | Old-suite regression |

## Attachments & media

Spec: `tests/attachments/*.spec.ts` · tags: `@attachments` · browsers: C

| ID | Scenario | Kind | POM | Extra tags | Status | Result | Bug | Notes |
|---|---|---|---|---|---|---|---|---|
| ATT-01 | Attachment sheet: Image, Video, Audio, File, Polls, Collaborative Document, Whiteboard | + | AttachmentSheet |  | TODO |  |  |  |
| ATT-02 | Send image → thumbnail; receiver sees; persists | + RT R | AttachmentSheet, MessageBubble | @critical | TODO |  |  |  |
| ATT-03 | Image opens full-screen viewer; close | + | FullScreenViewer |  | TODO |  |  |  |
| ATT-04 | Send video → video bubble plays | + | MessageBubble |  | TODO |  |  |  |
| ATT-05 | Send audio → audio bubble with play | + | MessageBubble |  | TODO |  |  |  |
| ATT-06 | Send PDF → file bubble with name / size, download | + | MessageBubble |  | TODO |  |  |  |
| ATT-07 | Multiple files in one pick | E | AttachmentSheet |  | TODO |  |  |  |
| ATT-08 | Unsupported / mismatched file type handled | − | AttachmentSheet |  | TODO |  |  |  |
| ATT-09 | Oversized file → clear error | − | AttachmentSheet |  | TODO |  |  |  |
| ATT-10 | Cancel file picker → nothing sent | − | AttachmentSheet |  | TODO |  |  |  |
| ATT-11 | Upload failure (network) → error state and retry | NET | MessageBubble | @network | TODO |  |  |  |
| ATT-12 | Attachments in group and in thread | + | ThreadPanel |  | TODO |  |  |  |
| ATT-13 | Sent media appears under matching search filter | + | ConversationSearch | @search | TODO |  |  |  |

## Reactions

Spec: `tests/reactions/reactions.spec.ts` · tags: `@reactions` · browsers: C

| ID | Scenario | Kind | POM | Extra tags | Status | Result | Bug | Notes |
|---|---|---|---|---|---|---|---|---|
| REA-01 | Add reaction via React picker → pill with count 1 | + | ReactionPicker, MessageBubble | @critical | TODO |  |  |  |
| REA-02 | Clicking own reaction removes it | + | MessageBubble |  | TODO |  |  |  |
| REA-03 | Several different reactions on one message | E | MessageBubble |  | TODO |  |  |  |
| REA-04 | Two users, same emoji → count 2 on both sides | RT | MessageBubble ×2 |  | TODO |  |  |  |
| REA-05 | Reaction list shows who reacted | + | ReactionList |  | TODO |  |  |  |
| REA-06 | Reactions persist after reload | R | MessageBubble |  | TODO |  |  |  |
| REA-07 | Reactions in group and in thread | + | ThreadPanel |  | TODO |  |  |  |
| REA-08 | Reaction picker closes on Escape | A11Y | ReactionPicker | @a11y | TODO |  |  | OBS-004 |

## Threads

Spec: `tests/threads/threads.spec.ts` · tags: `@threads` · browsers: C

| ID | Scenario | Kind | POM | Extra tags | Status | Result | Bug | Notes |
|---|---|---|---|---|---|---|---|---|
| THR-01 | Reply in thread opens panel with parent preview | + | ThreadPanel |  | TODO |  |  |  |
| THR-02 | Thread reply updates reply count on parent for both users | RT | ThreadPanel, MessageBubble | @critical | TODO |  |  |  |
| THR-03 | Receiver sees the reply inside the thread | RT | ThreadPanel |  | TODO |  |  |  |
| THR-04 | Thread header shows reply count | + | ThreadPanel |  | TODO |  |  |  |
| THR-05 | Close thread returns to main view | + | ThreadPanel |  | TODO |  |  |  |
| THR-06 | Thread reply preview does not leak into main composer | E | ThreadPanel, MessageComposer |  | TODO |  |  | Old-suite regression |
| THR-07 | Attachments in thread | + | ThreadPanel |  | TODO |  |  |  |
| THR-08 | Edit / delete a thread reply | + | ThreadPanel |  | TODO |  |  |  |
| THR-09 | Thread in a group conversation | + | ThreadPanel |  | TODO |  |  |  |
| THR-10 | Thread replies persist after reload | R | ThreadPanel |  | TODO |  |  |  |

## Mentions

Spec: `tests/mentions/mentions.spec.ts` · tags: `@mentions` · browsers: C

| ID | Scenario | Kind | POM | Extra tags | Status | Result | Bug | Notes |
|---|---|---|---|---|---|---|---|---|
| MEN-01 | Typing @ opens "Mention suggestions" | + | MentionSuggestions |  | TODO |  |  |  |
| MEN-02 | Suggestions filter by typed text | + | MentionSuggestions |  | TODO |  |  |  |
| MEN-03 | Select suggestion (click / Enter) inserts mention | + | MentionSuggestions |  | TODO |  |  |  |
| MEN-04 | Arrow / Tab navigation; Escape closes | A11Y | MentionSuggestions | @a11y | TODO |  |  |  |
| MEN-05 | Multiple mentions in one message | E | MessageComposer |  | TODO |  |  |  |
| MEN-06 | Mention highlighted for sender and receiver | RT | MessageBubble |  | TODO |  |  |  |
| MEN-07 | Group: only members suggested | P | MentionSuggestions |  | TODO |  |  |  |
| MEN-08 | @all in a group | + | MentionSuggestions |  | VERIFY |  |  | Confirm support in v7 |
| MEN-09 | Mention inside a thread | + | ThreadPanel |  | TODO |  |  |  |
| MEN-10 | Names with spaces / special characters | E | MentionSuggestions |  | TODO |  |  |  |
| MEN-11 | Mention preserved after edit and after reload | R | MessageBubble |  | TODO |  |  |  |
| MEN-12 | Plain-text composer mentions (enableRichTextEditor=false, ENG-38992) | + | — |  | NOT APPLICABLE |  |  | Sample app always uses rich text |

## Groups

Spec: `tests/groups/{groups,create,join,leave}.spec.ts` · tags: `@groups` · browsers: C

| ID | Scenario | Kind | POM | Extra tags | Status | Result | Bug | Notes |
|---|---|---|---|---|---|---|---|---|
| GRP-01 | Groups list: member counts and type badges | + | GroupsList |  | TODO |  |  |  |
| GRP-02 | Search groups: exact / partial / no result / clear | + − | GroupsList |  | TODO |  |  |  |
| GRP-03 | Create public group → listed; creator is owner | + | CreateGroupDialog | @critical | TODO |  |  |  |
| GRP-04 | Create private group | + | CreateGroupDialog |  | TODO |  |  |  |
| GRP-05 | Password group requires a password | + − | CreateGroupDialog |  | TODO |  |  |  |
| GRP-06 | Empty name blocked | − | CreateGroupDialog |  | TODO |  |  |  |
| GRP-07 | Dialog Close button; Escape closes | A11Y | CreateGroupDialog | @a11y | TODO |  |  | Escape currently does not close — OBS-003 |
| GRP-08 | Outsider joins public group; members see "joined" | + RT | GroupsList, MessageList |  | TODO |  |  |  |
| GRP-09 | Password group: wrong password → error; correct → joined | − + | JoinGroupDialog |  | TODO |  |  |  |
| GRP-10 | Private group not visible / joinable for outsider | P | GroupsList |  | TODO |  |  |  |
| GRP-11 | Leave group → confirm → gone; members see "left" | + RT | GroupDetails |  | TODO |  |  |  |
| GRP-12 | Owner leaving must transfer ownership first | P | TransferOwnership |  | TODO |  |  |  |
| GRP-13 | Delete & Exit (owner) → group gone for all members | P RT | GroupDetails |  | TODO |  |  |  |
| GRP-14 | Groups pagination | + | GroupsList |  | TODO |  |  |  |
| GRP-15 | Groups API failure → error state | NET | GroupsList | @network | TODO |  |  |  |

## Group details, members & permissions

Spec: `tests/groups/{details,members,permissions}.spec.ts` · tags: `@groups` · browsers: C

| ID | Scenario | Kind | POM | Extra tags | Status | Result | Bug | Notes |
|---|---|---|---|---|---|---|---|---|
| MEM-01 | Details: name, avatar, member count, members with scopes | + | GroupDetails, GroupMembers |  | TODO |  |  |  |
| MEM-02 | Search members; empty state | + | GroupMembers |  | TODO |  |  |  |
| MEM-03 | Owner adds members → count updates; new member sees group | + RT | AddMembers |  | TODO |  |  |  |
| MEM-04 | Kick participant → removed; kicked user loses access | P RT | GroupMembers |  | TODO |  |  |  |
| MEM-05 | Ban → in Banned members; banned user cannot rejoin | P | GroupMembers, BannedMembers |  | TODO |  |  |  |
| MEM-06 | Unban → can rejoin | P | BannedMembers |  | TODO |  |  |  |
| MEM-07 | Promote participant → admin / moderator; others see new scope | P RT | GroupMembers |  | TODO |  |  |  |
| MEM-08 | Demote admin → participant | P | GroupMembers |  | TODO |  |  |  |
| MEM-09 | Transfer ownership → new owner; old owner becomes admin | P | TransferOwnership |  | TODO |  |  |  |
| MEM-10 | Permission matrix: add / kick / ban / scope options per Owner, Admin, Moderator, Participant | P | GroupMembers | @critical | TODO |  |  | Data-driven, 4 roles |
| MEM-11 | Admin cannot kick or ban the owner | P | GroupMembers |  | TODO |  |  |  |
| MEM-12 | Member count persists after reload | R | GroupDetails |  | TODO |  |  |  |
| MEM-13 | Group action bubbles (joined / left / kicked / banned / scope changed) | + | MessageList |  | TODO |  |  |  |

## Search

Spec: `tests/search/*.spec.ts` · tags: `@search` · browsers: C

| ID | Scenario | Kind | POM | Extra tags | Status | Result | Bug | Notes |
|---|---|---|---|---|---|---|---|---|
| SRCH-01 | Global search opens with filters Audio, Documents, Groups, Photos, Videos, Links, Unread | + | GlobalSearch |  | TODO |  |  |  |
| SRCH-02 | Search by conversation name | + | GlobalSearch |  | TODO |  |  |  |
| SRCH-03 | Search message text; clicking a result jumps to the message | + | GlobalSearch, MessageList | @critical | TODO |  |  |  |
| SRCH-04 | Partial, case-insensitive, special characters | E | GlobalSearch |  | TODO |  |  | Data-driven |
| SRCH-05 | No result → empty state | − | GlobalSearch |  | TODO |  |  |  |
| SRCH-06 | Each filter narrows results (seeded media) | + | GlobalSearch |  | TODO |  |  |  |
| SRCH-07 | Unread filter shows only unread conversations | + | GlobalSearch |  | TODO |  |  |  |
| SRCH-08 | Back button closes search | + | GlobalSearch |  | TODO |  |  |  |
| SRCH-09 | Escape closes search | A11Y | GlobalSearch | @a11y | TODO |  |  | Currently does not — OBS-003 |
| SRCH-10 | In-conversation search: current chat only; filters Audio / Documents / Photos / Videos / Links | + | ConversationSearch |  | TODO |  |  |  |
| SRCH-11 | Scoped search does not inherit global filters | E | ConversationSearch |  | TODO |  |  | Old-suite regression |
| SRCH-12 | Keyboard navigation through results | A11Y | GlobalSearch | @a11y | TODO |  |  |  |

## Calls

Spec: `tests/calls/*.spec.ts` · tags: `@calls` · browsers: C (calls project)

| ID | Scenario | Kind | POM | Extra tags | Status | Result | Bug | Notes |
|---|---|---|---|---|---|---|---|---|
| CALL-01 | Voice call → outgoing screen; cancel → dismissed on both sides | + RT | CallButtons, OutgoingCall |  | TODO |  |  |  |
| CALL-02 | Video call → outgoing screen; cancel | + | OutgoingCall |  | TODO |  |  |  |
| CALL-03 | Receiver gets incoming call with accept / decline | RT | IncomingCall | @critical | TODO |  |  |  |
| CALL-04 | Accept → ongoing call UI for both | RT | OngoingCall |  | TODO |  |  |  |
| CALL-05 | Decline → caller notified; call log reflects it | RT | IncomingCall, CallLogs |  | TODO |  |  |  |
| CALL-06 | Unanswered → missed call in receiver's log | RT | CallLogs |  | TODO |  |  |  |
| CALL-07 | Busy: receiver already on a call | RT E | OutgoingCall |  | TODO |  |  |  |
| CALL-08 | End call → both return; duration in log | RT | OngoingCall, CallLogs |  | TODO |  |  |  |
| CALL-09 | Mute / unmute, camera on / off | + | OngoingCall |  | TODO |  |  |  |
| CALL-10 | Network interruption during call → reconnect or clean end | NET | OngoingCall | @network | TODO |  |  |  |
| CALL-11 | Group call: start, member joins, leave | RT | CallButtons, OngoingCall |  | TODO |  |  |  |
| CALL-12 | Call logs: incoming / outgoing / missed icons and times | + | CallLogs |  | TODO |  |  |  |
| CALL-13 | Call log details: Participants, Recording, History | + | CallLogDetails |  | TODO |  |  |  |
| CALL-14 | Call back from a call log entry | + | CallLogs |  | TODO |  |  |  |
| CALL-15 | Call buttons render on Firefox / WebKit (media not asserted) | + | CallButtons | @critical | TODO |  |  | Browsers: F W |
| CALL-16 | Call log row has no nested interactive controls | A11Y | CallLogs | @a11y | TODO |  |  | Expected to fail — A11Y-004 |

## Extensions

Spec: `tests/extensions/*.spec.ts` · tags: `@extensions` · browsers: C

| ID | Scenario | Kind | POM | Extra tags | Status | Result | Bug | Notes |
|---|---|---|---|---|---|---|---|---|
| EXT-01 | Create poll: question, add / remove options, validation | + − | PollDialog |  | TODO |  |  |  |
| EXT-02 | Vote → receiver sees results live; persists | RT R | PollBubble |  | TODO |  |  |  |
| EXT-03 | Collaborative document: bubble sent and received; link opens new tab | + | MessageBubble |  | TODO |  |  | External site not driven |
| EXT-04 | Collaborative whiteboard: same as EXT-03 | + | MessageBubble |  | TODO |  |  |  |
| EXT-05 | Link preview for a URL | + | MessageBubble |  | VERIFY |  |  | Check whether enabled |
| EXT-06 | Smart replies / conversation starter / summary | + | MessageComposer | @ai | VERIFY |  |  | Depends on dashboard AI settings |

## Moderation

Spec: `tests/moderation/*.spec.ts` · tags: `@moderation` · browsers: C

| ID | Scenario | Kind | POM | Extra tags | Status | Result | Bug | Notes |
|---|---|---|---|---|---|---|---|---|
| MOD-01 | Per rule: blocked content in 1:1 → sender feedback, receiver does not get it (screenshot) | RT | MessageList |  | BLOCKED |  |  | Need enabled rule list |
| MOD-02 | Per rule: blocked content in group | RT | MessageList |  | BLOCKED |  |  | Same |
| MOD-03 | Per rule: allowed content passes after rule disabled | RT | MessageList |  | BLOCKED |  |  | Needs dashboard toggle access or a second app |

## AI

Spec: `tests/ai/*.spec.ts` · tags: `@ai` · browsers: C

| ID | Scenario | Kind | POM | Extra tags | Status | Result | Bug | Notes |
|---|---|---|---|---|---|---|---|---|
| AI-01 | AI Assistant chat: greeting, send, streamed reply, history, new chat | + | AIAssistantChat |  | BLOCKED |  |  | Need @agentic user UID |
| AI-02 | Agentic groups: solo agent replies; squad agent replies only when mentioned | RT | MessageList |  | BLOCKED |  |  | Need 2 agent UIDs |

## Theme

Spec: `tests/theme/theme.spec.ts` · tags: `@theme` · browsers: C

| ID | Scenario | Kind | POM | Extra tags | Status | Result | Bug | Notes |
|---|---|---|---|---|---|---|---|---|
| THM-01 | Light theme screenshots: home, chat, dialogs | VIS | — | @visual | TODO |  |  |  |
| THM-02 | Dark theme via prefers-color-scheme: every pane readable; screenshots | VIS | — | @visual | TODO |  |  |  |
| THM-03 | Live switch light → dark without reload | E | — |  | TODO |  |  |  |
| THM-04 | Colour contrast meets WCAG AA (axe) | A11Y | — | @a11y | TODO |  |  |  |

## Localization

Spec: `tests/localization/*.spec.ts` · tags: `@localization` · browsers: C

| ID | Scenario | Kind | POM | Extra tags | Status | Result | Bug | Notes |
|---|---|---|---|---|---|---|---|---|
| L10N-01 | Static: every UIKit en-us key exists in all 18 other locales | + | — |  | TODO |  |  | Currently 10–62 missing per locale — L10N-001 |
| L10N-02 | Static: sample-app locale files complete vs en-us | + | — |  | TODO |  |  |  |
| L10N-03 | Static: every key passed to getLocalizedString() exists in en-us | + | — |  | TODO |  |  | Would catch BUG-001 |
| L10N-04 | UI per locale: no raw keys, no English fallback, no overflow on key screens | + | all POMs via t() |  | BLOCKED |  |  | Needs VITE_COMETCHAT_LOCALE hook (proposed) |
| L10N-05 | RTL layout | + | — |  | NOT APPLICABLE |  |  | No RTL locale shipped |

## Responsive

Spec: `tests/responsive/*.spec.ts` · tags: `@responsive` · browsers: tablet, mobile

| ID | Scenario | Kind | POM | Extra tags | Status | Result | Bug | Notes |
|---|---|---|---|---|---|---|---|---|
| RESP-01 | 1024 px: list + chat layout | + | HomePage |  | TODO |  |  |  |
| RESP-02 | 768 px: pane toggling and back button | + | HomePage, MessageHeader |  | TODO |  |  |  |
| RESP-03 | 375 px: open chat, back to list, composer usable, dialogs fit | + | HomePage, MessageComposer |  | TODO |  |  |  |
| RESP-04 | Side panels (details / thread / search) at small widths | + | GroupDetails, ThreadPanel |  | TODO |  |  |  |
| RESP-05 | Emoji / sticker / attachment popovers stay inside the viewport | E | EmojiKeyboard, AttachmentSheet |  | TODO |  |  |  |
| RESP-06 | Call screens at mobile width | + | OngoingCall | @calls | TODO |  |  |  |

## Accessibility

Spec: `tests/a11y/*.spec.ts` · tags: `@a11y` · browsers: C

| ID | Scenario | Kind | POM | Extra tags | Status | Result | Bug | Notes |
|---|---|---|---|---|---|---|---|---|
| A11Y-01 | axe scan per screen — no critical / serious violations | A11Y | — |  | TODO |  |  | Known failures annotated |
| A11Y-02 | Keyboard-only journey: login → open chat → send → menu → react | A11Y | — |  | TODO |  |  |  |
| A11Y-03 | Focus trapped inside dialogs and restored on close | A11Y | ConfirmDialog, CreateGroupDialog |  | TODO |  |  |  |
| A11Y-04 | Escape closes every popover / dialog | A11Y | — |  | TODO |  |  | Data-driven over overlays |
| A11Y-05 | New messages announced (role=log live region) | A11Y | MessageList |  | TODO |  |  |  |

## Visual regression

Spec: `tests/visual/*.spec.ts` · tags: `@visual` · browsers: C

| ID | Scenario | Kind | POM | Extra tags | Status | Result | Bug | Notes |
|---|---|---|---|---|---|---|---|---|
| VIS-01 | Conversation list | VIS | ConversationList |  | TODO |  |  | Mask times / avatars |
| VIS-02 | Message list with each bubble type | VIS | MessageList |  | TODO |  |  |  |
| VIS-03 | Composer + formatting toolbar | VIS | MessageComposer |  | TODO |  |  |  |
| VIS-04 | Group details / user details | VIS | GroupDetails |  | TODO |  |  |  |
| VIS-05 | Dialogs and popovers | VIS | — |  | TODO |  |  |  |
| VIS-06 | Thread panel | VIS | ThreadPanel |  | TODO |  |  |  |

## Network & resilience

Spec: `tests/network/*.spec.ts` · tags: `@network` · browsers: C

| ID | Scenario | Kind | POM | Extra tags | Status | Result | Bug | Notes |
|---|---|---|---|---|---|---|---|---|
| NET-01 | Offline → online: realtime resumes, missed messages fetched | NET | MessageList |  | TODO |  |  |  |
| NET-02 | Short WebSocket drop → reconnect | NET | MessageList |  | TODO |  |  |  |
| NET-03 | 5xx on message fetch → error state and retry | NET | MessageList |  | TODO |  |  |  |
| NET-04 | Slow network: loaders shown, no duplicate sends | NET | MessageComposer |  | TODO |  |  |  |
| NET-05 | Console / HTTP error budget per suite | NET | netWatch |  | TODO |  |  |  |
| NET-06 | HTTP 408 on POST /groups/{guid}/conversation/read | NET | — |  | NEEDS INVESTIGATION |  |  | OBS-001 |

## Performance signals (report only)

Spec: `tests/perf/*.spec.ts` · tags: `@perf` · browsers: C

| ID | Scenario | Kind | POM | Extra tags | Status | Result | Bug | Notes |
|---|---|---|---|---|---|---|---|---|
| PERF-01 | Time from login to Home | + | — |  | TODO |  |  | No thresholds without requirements |
| PERF-02 | Send → receive latency (median of 10) | RT | — |  | TODO |  |  |  |
| PERF-03 | Conversation open → first message visible | + | — |  | TODO |  |  |  |
| PERF-04 | 1 MB image upload time | + | — |  | TODO |  |  |  |

## Smoke journey

Spec: `tests/smoke/smoke.spec.ts` · tags: `@smoke @critical` · browsers: C F W

| ID | Scenario | Kind | POM | Extra tags | Status | Result | Bug | Notes |
|---|---|---|---|---|---|---|---|---|
| SMK-01 | Login → chats → open chat with Bob → send → Bob receives → reload persists → logout | RT R | several |  | PASSED | C ✅ W ✅ F ⛔ | ENV-001 (F) | Two-user realtime journey; Firefox cannot launch on macOS 27 |
