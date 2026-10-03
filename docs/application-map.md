# Application Map — CometChat React UIKit v7 Sample App

_Phase 0 discovery · 2026-09-27 · source-verified + live crawl (`npm run discover`, 20/20 steps, 27 screens in [`discovery/`](discovery/))_

## 1. System under test

| Item | Value |
|---|---|
| Repo | `~/uikit-react` (branch `master-v7`, HEAD `4e0dfbae0`) |
| App | `~/uikit-react/sample-app` — Vite 6 + React 19.2 |
| UIKit | `@cometchat/chat-uikit-react` **7.0.3** (installed in sample-app) |
| Chat SDK | `@cometchat/chat-sdk-javascript` 4.1.12 |
| Calls SDK | `@cometchat/calls-sdk-javascript` 5.0.1 (installed → calling enabled, `setCallingEnabled(true)`) |
| Card renderer | `@cometchat/cards-react` ~1.0.0 (agent card bubbles) |
| Environment under test | **Production**, region `us`, App ID in `.env` (never committed) |
| REST (admin) host | `https://<appId>.api-us.cometchat.io/v3` — verified 200 |
| Client host (browser) | `https://<appId>.apiclient-us.cc-cluster-2.io/v3.0` (SDK default for prod — seen in crawl) |
| Framework port | `3105` (own port — never collides with a manual `npm run dev` on 3005) |

### How the framework starts the app

The sample app's `AppConstants.ts` / `App.tsx` were made **env-driven** (Phase 0 change, see §6). The framework starts it with every `VITE_COMETCHAT_*` override set to `''`, which reproduces the **upstream sample app**: credentials screen first, SDK default (production) hosts. Running `npm run dev` manually with no env vars behaves exactly as before (staging app `255339b67d1d56d4`).

## 2. Screen flow

```
/ (single-page app, no router)
│
├─ Credentials screen ─ shown when App ID / Region / Auth Key are not all known
│     region chips US | EU | IN · textbox "APP ID" · textbox "Auth Keys" · button "Continue"
│     → saves to localStorage (appId, region, authKey) → window.location.reload()
│
├─ Login screen ─ SDK initialised, no logged-in user
│     sample-user cards (fetched from assets.cc-cluster-2.io/sampleapp/v2/sampledata.json,
│     fallback: superhero1-4) · textbox "Your UID" · button "Login" · "Change App Credentials"
│     → CometChatUIKit.login(uid)  (auth-key login; SDK session kept in localStorage)
│
└─ Home (CometChatHome) ─ logged in
      ├─ Left pane (CometChatSelector)
      │    ├─ Tabs: Chats | Calls | Users | Groups   (div + onClick, not role=tab)
      │    ├─ Chats  → region "Chats": "More options" menu [<me>, Create conversation, Log Out],
      │    │           searchbox "Search" (opens global CometChatSearch), listbox "Conversations list"
      │    ├─ Calls  → CometChatCallLogs (rows role=button) → Call Details (Participants/Recording/History)
      │    ├─ Users  → region "Users": searchbox, listbox of users (A-Z section headers)
      │    └─ Groups → region "Groups": button "Create group", searchbox, listbox "Groups list"
      │
      ├─ Centre pane (CometChatMessages)
      │    ├─ banner "<name>, <status>": button "<name>. Click for details", Voice call, Video call, Search
      │    ├─ region "Message list" → log "Message list" → separator "Date separator",
      │    │     article "<sender>, <type> message" → hover toolbar [React, Reply, More options]
      │    └─ Composer: toolbar "Text formatting" (10 buttons), textbox "Type a message",
      │          ATTACHMENTS · EMOJI · Sticker · VOICE_RECORDING · SEND   (raw keys → BUG-001)
      │
      └─ Right pane (CometChatSideComponent) — one at a time
           ├─ User details: "User Info", name, status, Block, Delete Chat
           ├─ Group details: name, member count, region "Members" (search, tabs), Add Members,
           │     Banned members, Transfer ownership, Leave / Delete & Exit
           ├─ Thread panel (CometChatThreadPanel)
           ├─ In-conversation search (scoped: Audio, Documents, Photos, Videos, Links)
           └─ Message information (receipts)
```

Overlays/dialogs seen live: header "More options" menu, message "More options" menu, attachment action sheet, emoji keyboard, sticker keyboard, reaction picker, mention suggestions, "New Group" dialog, confirm dialogs (block / delete chat / leave / delete group), join-group (password), incoming / outgoing / ongoing call screens.

## 3. Locator map (verified live unless marked _source_)

Locators follow the priority role → label → placeholder → text → CSS. Accessible names come from UIKit's locale files, so the framework resolves them through a `t(key)` helper (see automation-plan §3) to stay locale-independent.

| Area | Element | Locator |
|---|---|---|
| Credentials | region chip | `getByText('US', { exact: true })` (div, no role) |
| | App ID / Auth Key | `getByLabel('APP ID')` / `getByLabel('Auth Keys')` |
| | submit | `getByRole('button', { name: 'Continue' })` |
| Login | UID | `getByRole('textbox', { name: 'Your UID' })` |
| | submit | `getByRole('button', { name: 'Login' })` |
| | sample user card | `getByText('cometchat-uid-1')` (no role) |
| | change credentials | `getByText('App Credentials')` (span + onClick) |
| Home | tabs | `.cometchat-tab-component__tab` filter `hasText` (no role) |
| Chats | pane | `getByRole('region', { name: 'Chats' })` |
| | menu | `getByRole('button', { name: 'More options' })` → `getByRole('menu', { name: 'Context menu options' })` → `menuitem` |
| | list / item | `getByRole('listbox', { name: 'Conversations list' }).getByRole('option', { name: /…/ })` |
| | global search | `getByRole('searchbox', { name: 'Search' })` → `getByRole('search', { name: 'Search' })`, `Back` button, filter `toolbar "Search"` |
| Users / Groups | pane / list | `getByRole('region', { name: 'Users' \| 'Groups' })` → `getByRole('option')` |
| | create group | `getByRole('button', { name: 'Create group' })` → `getByRole('dialog', { name: 'New Group' })` (radiogroup "Group type", textbox "Name", button "Create Group", button "Close") |
| Header | banner | `getByRole('banner')` → `button /Click for details/`, `Voice call`, `Video call`, `Search` |
| Message list | container | `getByRole('log', { name: 'Message list' })` |
| | message | `.getByRole('article', { name: /^<sender>, text message/ })` |
| | hover toolbar | hover `.cometchat-message-bubble__body` first (options are `opacity:0` until `mouseenter` on the body) → `getByRole('button', { name: 'React' \| 'Reply' \| 'More options' })` |
| | options menu | `getByRole('menuitem', { name })` — live on incoming 1:1 text: `Reply in thread`, `Copy`, `Translate`, `Report`, `Mark Unread`. _Source_ (en-us labels exist, not yet seen live): `Edit`, `Delete`, `Info` (outgoing), `Message Privately` (incoming, group) |
| Composer | input | `getByRole('textbox', { name: 'Type a message' })` |
| | buttons | `getByRole('button', { name: t('ATTACHMENTS') })` … (names currently raw keys — BUG-001) |
| | attachment sheet | `getByRole('dialog')` → `Attach Image`, `Attach Video`, `Attach Audio`, `Attach File`, `Polls`, `Collaborative Document`, `Collaborative Whiteboard` |
| | emoji | `getByRole('dialog', { name: 'Emoji keyboard' })` → `searchbox "Search emoji"`, `tablist "Emoji categories"`, `gridcell "<name>"` |
| | stickers | `getByRole('dialog', { name: 'Sticker keyboard' })` |
| | mentions | `getByRole('listbox', { name: 'Mention suggestions' })` |
| User details | actions | _div + onClick_ → text/CSS fallback (`.side-component-header__icon` close) — A11Y-003 |
| Call logs | row | `.cometchat-call-logs__list-item` / `getByRole('button', { name: /<name> .* (Voice\|Video) call/ })` |

## 4. Realtime & network surface

- WebSocket: SDK realtime socket (opened on login; one per logged-in context).
- REST calls from the browser go to the client host `…apiclient-us.cc-cluster-2.io/v3.0`.
- Observed during crawl: `POST /groups/cometchat-guid-1/conversation/read` → **HTTP 408** once (NEEDS INVESTIGATION, see findings).
- Console noise to whitelist: `[JitsiMeetJS.ts] Analytics disabled, disposing.` (warning from Calls SDK init).

## 5. Persistence

| Stored in | Keys | Used by |
|---|---|---|
| `localStorage` | `appId`, `region`, `authKey` | Credentials screen |
| `localStorage` | CometChat SDK session (auth token, user) | Login/session restore |
| — | theme follows `prefers-color-scheme` live | App.tsx media-query listener |
| — | locale fixed to `en-us` (index.tsx passes no `locale`) | CometChatProvider |

→ Playwright `storageState` captures both credentials and SDK session, so per-user saved logins work.

## 6. Change made to the app under test (Phase 0)

Uncommitted, in `~/uikit-react/sample-app` (on top of the user's existing local edits):

- `src/AppConstants.ts` — each constant reads `VITE_COMETCHAT_APP_ID / _REGION / _AUTH_KEY / _CLIENT_HOST / _ADMIN_HOST`, falling back to the previous hard-coded staging values.
- `src/App.tsx` — `setClientHost` / `setAdminHost` are applied only when the value is non-empty.
- `src/vite-env.d.ts` — new, `/// <reference types="vite/client" />` for `import.meta.env` typing.
- `tsc --noEmit` passes.

## 7. Existing automation in the repo (not modified)

`sample-app/e2e/` — ~220 helper-based tests over 30 specs. Used as a **scenario checklist** only. Not reused as code because of: 266 `waitForTimeout`, 699 raw CSS locators vs 4 role locators, shared mutable seed data ("Bob", "Strategy"), Chromium-only, `workers: 1`, no working two-user realtime test, and its seed script targets `api-<region>.cometchat.io` with fixed seed data that does not exist in this app.
