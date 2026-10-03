# Feature Inventory — CometChat React UIKit v7 (sample app, prod app `us`)

_Phase 0 · 2026-09-27 · **Needs your review before Phase 1**_

Sources: UIKit `src/components` (36 components + 29 base components), `src/plugins` (ai, polls, stickers, collaborative-document, collaborative-whiteboard, core), sample-app `src/components` (17 screens), live crawl of the prod app.

**Availability legend**
- **LIVE** — seen working in the prod app during the crawl
- **SOURCE** — wired in sample-app/UIKit source; not yet exercised live
- **VERIFY** — depends on dashboard config; will be checked at the start of that phase
- **BLOCKED** — needs something we don't have yet (listed)
- **N/A** — not reachable in the sample app

| # | Feature | UIKit / sample-app components | Availability | Priority | Notes / dependency |
|---|---|---|---|---|---|
| 1 | App credentials screen | `CometChatCredentials` | LIVE | P1 | Region chips, App ID, Auth Key; persisted in localStorage |
| 2 | Login / logout / session | `CometChatLogin`, `CometChatUIKit.login/logout` | LIVE | P0 | UID login + sample-user cards; logout in Chats "More options" |
| 3 | Home navigation (tabs) | `CometChatSelector`, `CometChatTabs` | LIVE | P0 | Chats / Calls / Users / Groups |
| 4 | Conversations list | `CometChatConversations` | LIVE | P0 | listbox; last msg, time, receipts, unread badge, typing, presence, delete on hover |
| 5 | New conversation | `CometChatNewChatView` (Create conversation) | SOURCE | P1 | From Chats menu → Users/Groups picker |
| 6 | Users list | `CometChatUsers` | LIVE | P1 | A-Z headers, search, presence, pagination |
| 7 | User details | `CometChatUserDetails` (sample) | LIVE | P1 | Block / unblock, Delete Chat |
| 8 | Groups list | `CometChatGroups` | LIVE | P1 | public / private / password badges, member count, search |
| 9 | Create group | `CometChatCreateGroup` (sample) | LIVE (dialog) | P1 | Public / Private / Password |
| 10 | Join group (password) | `CometChatJoinGroup` (sample) | SOURCE | P1 | Needs a password group created by the framework |
| 11 | Group details | `CometChatGroupDetails` (sample) | LIVE | P1 | Members, Add Members, Leave, Delete & Exit |
| 12 | Group members & roles | `CometChatGroupMembers`, `CometChatChangeScope` | LIVE (members region) | P1 | Kick, ban, change scope — Owner / Admin / Moderator / Participant |
| 13 | Banned members | `CometChatBannedMembers` (sample) | SOURCE | P2 | Unban |
| 14 | Add members | `CometChatAddMembers` (sample) | SOURCE | P1 | |
| 15 | Transfer ownership | `CometChatTransferOwnership` (sample) | SOURCE | P2 | Owner leaving a group |
| 16 | Message header | `CometChatMessageHeader` | LIVE | P1 | Name, status / last seen, member count, typing, call buttons, search |
| 17 | Message list | `CometChatMessageList` | LIVE | P0 | Date separators, receipts, pagination, scroll-to-bottom, new-message indicator |
| 18 | Text messages | `CometChatTextBubble`, text plugin | LIVE | P0 | Send / receive / render / sanitise (dompurify) |
| 19 | Rich-text composer | `CometChatFormattingToolbar`, `CometChatLinkDialog/Popover` | LIVE | P1 | Bold, Italic, Underline, Strike, Link, Numbered List, Bulleted List, Blockquote, Code, Code Block |
| 20 | Message composer basics | `CometChatMessageComposer` | LIVE | P0 | Enter to send, Shift+Enter, disabled Send when empty, paste |
| 21 | Emoji keyboard | `CometChatEmojiKeyboard` | LIVE | P2 | Categories, search |
| 22 | Mentions | composer mention formatter | LIVE (suggestions) | P1 | Users in 1:1 and groups, `@all` in groups (VERIFY) |
| 23 | Message actions | `CometChatContextMenu`, message options | LIVE (incoming) | P0 | React, Reply, Reply in thread, Copy, Mark Unread, Edit, Delete, Info, Message Privately |
| 24 | Reply (quote) | composer reply preview | LIVE (button) | P1 | |
| 25 | Edit / Delete | `CometChatDeleteBubble`, edit preview | SOURCE | P0 | "Edited" label, deleted bubble on both sides |
| 26 | Message information | `CometChatMessageInformation` | SOURCE | P2 | Delivered / read per recipient |
| 27 | Reactions | `CometChatReactions`, `CometChatReactionList` | LIVE (picker) | P1 | Add / remove / counts / who-reacted list |
| 28 | Threads | `CometChatThreadPanel`, `CometChatThreadHeader`, `CometChatThreadView` | LIVE (menu item) | P1 | |
| 29 | Attachments — image | image plugin, `CometChatImageBubble`, `CometChatFullScreenViewer` | LIVE (menu) | P0 | |
| 30 | Attachments — video | `CometChatVideoBubble` | LIVE (menu) | P1 | |
| 31 | Attachments — audio | `CometChatAudioBubble` | LIVE (menu) | P1 | |
| 32 | Attachments — file | `CometChatFileBubble`, `CometChatDownloadButton` | LIVE (menu) | P1 | |
| 33 | Voice recording | `CometChatMediaRecorder` | LIVE (button) | P2 | Chromium fake microphone |
| 34 | Stickers (extension) | stickers plugin, `CometChatStickersKeyboard`, `CometChatStickerBubble` | LIVE | P2 | |
| 35 | Polls (extension) | polls plugin, `CometChatCreatePoll`, `CometChatPollBubble` | LIVE (menu) | P2 | Create, vote, realtime results |
| 36 | Collaborative Document (extension) | collaborative-document plugin + bubble | LIVE (menu) | P3 | Opens an external domain — verify the bubble and link only |
| 37 | Collaborative Whiteboard (extension) | collaborative-whiteboard plugin + bubble | LIVE (menu) | P3 | Same as above |
| 38 | Message translation (extension) | "Translate" option | LIVE (menu item) | P2 | |
| 39 | Report / flag message | `CometChatFlagMessageDialog` | LIVE (menu item) | P2 | Moderation review happens on the dashboard |
| 40 | Link preview | text bubble | VERIFY | P3 | Send a URL and see whether a preview renders |
| 41 | Moderation (content rules) | `CometChatModerationView` | VERIFY / BLOCKED | P2 | Needs the rule list from the dashboard; `modtoggle-*` users suggest an email-masking rule exists |
| 42 | Smart replies / conversation starter / summary (AI) | `CometChatSmartReplies`, `CometChatConversationStarter`, `CometChatConversationSummary` | VERIFY | P3 | Depends on AI features being enabled on the dashboard |
| 43 | AI Assistant chat | `CometChatAIAssistantChat` (sample `CometChatAIAssistant`) | BLOCKED | P2 | Needs an `@agentic` user UID |
| 44 | Agentic group chat | agentic message category, `@cometchat/cards-react` | BLOCKED | P3 | Needs 2 agent UIDs |
| 45 | Global search | `CometChatSearch` | LIVE | P1 | Filters: Audio, Documents, Groups, Photos, Videos, Links, Unread |
| 46 | In-conversation search | `CometChatSearch` (scoped) | LIVE | P1 | Filters: Audio, Documents, Photos, Videos, Links |
| 47 | Voice / video 1:1 calls | `CometChatCallButtons`, `CometChatOutgoingCall`, `CometChatIncomingCall`, `CometChatOngoingCall` | LIVE (buttons) | P1 | Two-user; Chromium with fake media |
| 48 | Group calls | call buttons in group, `CometChatCallBubble` / meeting | SOURCE | P2 | |
| 49 | Call logs & details | `CometChatCallLogs`, sample `CometChatCallLog*` | LIVE | P2 | Participants / Recording / History |
| 50 | Typing indicator | `CometChatTypingIndicator` | SOURCE | P1 | Realtime, two users |
| 51 | Presence | `subscribePresenceForAllUsers()` | LIVE (Offline / last seen) | P1 | Realtime, two users |
| 52 | Read / delivered receipts | message list + conversations | LIVE (icons) | P0 | Realtime, two users |
| 53 | Unread count / Mark Unread | conversations + message option | LIVE (option) | P1 | |
| 54 | Group action messages | `CometChatGroupActionBubble` | SOURCE | P2 | "X joined / left / was kicked…" |
| 55 | Theme light / dark | `CometChatProvider theme`, follows `prefers-color-scheme` live | SOURCE | P2 | Emulated with `colorScheme` |
| 56 | Localization (19 locales) | `CometChatLocalize` + sample `locales/` | SOURCE — **not switchable in UI** | P2 | index.tsx fixes `en-us`; needs a `VITE_COMETCHAT_LOCALE` hook (proposed). Static key audit possible now. |
| 57 | Responsive layout | CSS media queries | SOURCE | P2 | 1440 / 1024 / 768 / 375 |
| 58 | Accessibility | roles / aria across UIKit | LIVE (partial) | P1 | Several gaps already found — see findings |
| 59 | Toasts / confirm dialogs | `CometChatToast`, `CometChatConfirmDialog` | SOURCE | P2 | |
| 60 | Error / empty / loading states | per-list shimmer, empty and error views | LIVE (shimmer, empty) | P1 | Error states forced through network interception |
| 61 | Notification feed | `CometChatNotificationFeed` | N/A | — | Not used by the sample app |
| 62 | Sound manager | `CometChatSoundManager` | N/A (auto) | P3 | Audio output not asserted; verify no console errors |

## Open questions for review

1. **Moderation** — which rules are enabled on this app (e.g. email masking, profanity)? Needed to write block/allow tests.
2. **AI** — are smart replies, conversation starter or summary enabled? Is there an agent UID for AI Assistant and agentic groups?
3. **Localization** — may I add a `VITE_COMETCHAT_LOCALE` hook to the sample app (same pattern as the App ID change) so all 19 locales can be tested in the UI?
4. **Anything missing?** — features you test manually that aren't listed here.
