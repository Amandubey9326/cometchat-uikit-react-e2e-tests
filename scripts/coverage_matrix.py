"""Generates docs/coverage-matrix.md from the scenario list below plus Playwright JSON report(s).

Usage:  python3 scripts/coverage_matrix.py docs/coverage-matrix.md reports/results.json [more.json ...]

Test titles start with the scenario id(s) ("THR-02/03 a thread reply ..."); results, browsers and
bug ids (from `bug` / `issue` annotations) are read from the report, so the matrix never claims
more than the last run proved.
"""
import collections, json, re, sys

OUT = sys.argv[1]
REPORTS = sys.argv[2:]

# (section title, spec file(s), default tags, default browsers, rows)
# row: (id, scenario, kind, pom, extra_tags, status, notes)
S = []
def sec(title, spec, tags, browsers, rows): S.append((title, spec, tags, browsers, rows))
T = 'TODO'

sec('Authentication & credentials', 'tests/auth/{credentials,login,session}.spec.ts', '@auth', 'C', [
 ('AUTH-01','Credentials screen shows region chips US/EU/IN, App ID, Auth Keys, Continue','+','CredentialsPage','@smoke',T,''),
 ('AUTH-02','Valid App ID + region + Auth Key → login screen','+','CredentialsPage','@smoke @critical',T,'Browsers: C F W'),
 ('AUTH-03','Empty App ID / Auth Key blocked by required validation','−','CredentialsPage','',T,''),
 ('AUTH-04','Wrong App ID → clear error, no crash','−','CredentialsPage, LoginPage','',T,'Document actual UX'),
 ('AUTH-05','Wrong Auth Key → login attempt shows error','−','LoginPage','',T,''),
 ('AUTH-06','Wrong region (EU for a US app) → error','−','CredentialsPage','',T,''),
 ('AUTH-07','Credentials persist across reload','R','CredentialsPage','',T,''),
 ('AUTH-08','"Change App Credentials" returns to credentials screen and clears stored values','+','LoginPage','',T,''),
 ('AUTH-09','Login with valid UID → Home, Chats tab active','+','LoginPage, HomePage','@smoke @critical',T,'Browsers: C F W'),
 ('AUTH-10','Login via sample-user card','+','LoginPage','',T,''),
 ('AUTH-11','Non-existent UID → error message, stays on login','−','LoginPage','',T,''),
 ('AUTH-12','Empty UID → cannot submit','−','LoginPage','',T,''),
 ('AUTH-13','UID with surrounding spaces is trimmed','E','LoginPage','',T,''),
 ('AUTH-14','Enter key submits UID form','+','LoginPage','',T,''),
 ('AUTH-15','Session persists after reload','R','HomePage','@critical',T,''),
 ('AUTH-16','Session restored in a new browser context from saved state (browser restart)','R','HomePage','',T,''),
 ('AUTH-17','Logout → login screen; reload stays logged out','+ R','HomePage, LoginPage','@smoke',T,''),
 ('AUTH-18','Logout then login as another user → none of the previous user\'s data visible','E','HomePage, ConversationList','',T,'Data-leak check'),
 ('AUTH-19','Two users logged in concurrently in separate contexts','RT','HomePage','',T,''),
 ('AUTH-20','Revoked / expired session (auth token deleted) → back to the login screen','E','LoginPage','',T,''),
 ('AUTH-21','Sample-users JSON fetch fails → fallback users shown','NET','LoginPage','@network',T,'route.abort sampledata.json'),
 ('AUTH-22','Sample-user cards and "Change App Credentials" reachable by keyboard','A11Y','LoginPage','@a11y',T,'Expected to fail — A11Y-002'),
 ('AUTH-24','A failed login explains why (e.g. unknown UID)','−','LoginPage','',T,''),
 ('AUTH-25','A corrupted saved session does not crash the app','E','LoginPage, HomePage','',T,''),
 ('AUTH-23','Realtime works after login even when the login profile update (2nd PUT /me) is slow','RT NET','flows/sign-in, ConversationList','@critical @network','AUTOMATED','`tests/auth/realtime-after-login.spec.ts` — expected-fail until BUG-003 is fixed'),
])
sec('Home & navigation', 'tests/home/navigation.spec.ts', '@navigation', 'C', [
 ('NAV-01','Tabs switch panes; active tab highlighted','+','HomePage','@smoke',T,'Browsers: C F W'),
 ('NAV-02','Empty right-pane state per tab ("No conversation selected", …)','+','HomePage','',T,''),
 ('NAV-03','Chats "More options" menu: current user, Create conversation, Log Out','+','HomePage.menu','',T,''),
 ('NAV-04','Menu: focus moves in on open, Escape closes it and returns focus, outside click closes it','A11Y','HomePage.menu','@a11y',T,''),
 ('NAV-05','Tabs operable by keyboard','A11Y','HomePage','@a11y',T,'Expected to fail — A11Y-001'),
 ('NAV-06','Each tab keeps its own selection (chat opened from Users returns with Users; other tabs show their empty pane)','E','HomePage','',T,'Documented design, measured live'),
 ('NAV-07','No unexpected console / HTTP errors on load','NET','netWatch','@network',T,''),
])
sec('Conversations', 'tests/conversations/*.spec.ts', '@conversations', 'C', [
 ('CONV-01','List loads (shimmer → items)','+','ConversationList','@smoke',T,''),
 ('CONV-02','Empty state for a user with no conversations','+','ConversationList','',T,'Fresh persona'),
 ('CONV-03','Item shows avatar, name, last message, time, receipt','+','ConversationItem','',T,''),
 ('CONV-04','Group item shows "Sender: text" and private/password badge','+','ConversationItem','',T,''),
 ('CONV-05','Last-message label for media / sticker / poll','+','ConversationItem','',T,''),
 ('CONV-06','Select conversation → chat opens, item selected','+','ConversationList','@smoke',T,''),
 ('CONV-07','Incoming message moves conversation to top','RT','ConversationList','@critical',T,''),
 ('CONV-08','Unread badge increments per incoming message and clears when the chat is opened','RT','ConversationItem','@critical',T,''),
 ('CONV-09','A conversation that was read stays read after reload','R','ConversationItem','@critical',T,''),
 ('CONV-10','Mark as unread (message option) → unread badge in the list','+','MessageOptionsMenu, ConversationItem','',T,''),
 ('CONV-11','Typing indicator in list item','RT','ConversationItem','',T,''),
 ('CONV-12','Presence dot updates on other user online / offline','RT','ConversationItem','',T,''),
 ('CONV-13','Delete conversation → confirm → removed; still removed after reload','+ R','ConversationItem, ConfirmDialog','',T,''),
 ('CONV-14','Delete conversation → cancel → still present','−','ConfirmDialog','',T,''),
 ('CONV-15','Ordering by latest activity survives reload','R','ConversationList','',T,''),
 ('CONV-16','Scroll loads more conversations (pagination)','+','ConversationList','',T,'Seed 40 conversations via REST'),
 ('CONV-17','Tab moves through the list, Enter opens','A11Y','ConversationList','@a11y',T,''),
 ('CONV-17b','Arrow keys move through the list (listbox pattern)','A11Y','ConversationList','@a11y',T,''),
 ('CONV-18','Clicking a conversation while the list is loading shows no error','E','ConversationList','',T,'Old-suite regression'),
 ('CONV-19','Conversations API failure → error state; recovers','NET','ConversationList','@network',T,''),
 ('CONV-20','Create conversation → pick user → chat opens','+','NewChatView','',T,''),
 ('CONV-21','Create conversation → pick group → chat opens','+','NewChatView','',T,''),
 ('CONV-22','New-chat search filters users','+','NewChatView','',T,''),
 ('CONV-23','Deleted conversation reappears when a new message arrives','RT','ConversationList','',T,''),
 ('CONV-24','App still loads when a user I messaged has been deleted','E','ConversationList','@critical',T,'`tests/conversations/deleted-peer.spec.ts` — BUG-008'),
 ('CONV-26','A new chat that starts while another chat is open shows an unread badge','RT','ConversationItem','@critical',T,''),
])
sec('Users', 'tests/users/users.spec.ts', '@users', 'C', [
 ('USR-01','Users list loads with A–Z section headers','+','UsersList','',T,''),
 ('USR-02','Search by exact name finds persona','+','UsersList','',T,''),
 ('USR-03','Partial and case-insensitive search','E','UsersList','',T,'Data-driven'),
 ('USR-04','Special characters / no match → empty state','−','UsersList','',T,''),
 ('USR-05','Clear search restores list','+','UsersList','',T,''),
 ('USR-06','Select user → 1:1 chat opens','+','UsersList','@smoke',T,''),
 ('USR-07','Presence: other user logs in → Online; logs out → Offline / last seen','RT','UsersList, MessageHeader','',T,''),
 ('USR-08','Scroll loads more users','+','UsersList','',T,'Assert behaviour, not totals (shared app)'),
 ('USR-09','Keyboard navigation in list','A11Y','UsersList','@a11y',T,''),
 ('USR-10','Users API failure → error state','NET','UsersList','@network',T,''),
])
sec('User details & blocking', 'tests/users/user-details.spec.ts', '@users', 'C', [
 ('UDET-01','Header click opens User Info: avatar, name, status','+','UserDetails','',T,''),
 ('UDET-02','Close button closes the panel','+','UserDetails','',T,'div + onClick — A11Y-003'),
 ('UDET-03','Block → confirm → composer replaced by blocked notice; persists after reload','+ R','UserDetails, ConfirmDialog, MessageComposer','@critical',T,'tempUser fixture'),
 ('UDET-04','Block → cancel → nothing changes','−','ConfirmDialog','',T,''),
 ('UDET-05','Blocked user\'s messages are not delivered to the blocker','RT P','MessageList','',T,''),
 ('UDET-06','Unblock → composer returns; messaging works again','+','UserDetails','',T,''),
 ('UDET-07','Delete Chat → confirm → conversation removed; persists','+ R','UserDetails, ConversationList','',T,''),
 ('UDET-08','Block / Delete Chat / Close reachable by keyboard','A11Y','UserDetails','@a11y',T,'Expected to fail — A11Y-003'),
])
sec('Messaging — send, receive, list', 'tests/messaging/{send,receive,list}.spec.ts', '@messaging', 'C', [
 ('MSG-01','Send text with Send button → outgoing article','+','MessageComposer, MessageList','@smoke @critical',T,'Browsers: C F W'),
 ('MSG-02','Send with Enter','+','MessageComposer','',T,''),
 ('MSG-03','Shift+Enter inserts newline; multiline renders','E','MessageComposer','',T,''),
 ('MSG-04','Send disabled for empty composer','−','MessageComposer','',T,''),
 ('MSG-05','Whitespace-only message not sent','−','MessageComposer','',T,''),
 ('MSG-06','Long text (5,000 chars) sends and renders fully','E','MessageComposer, MessageBubble','',T,''),
 ('MSG-07','Emoji-only and mixed emoji text','E','MessageBubble','',T,'Data-driven'),
 ('MSG-08','HTML / script payload rendered as text, never executed','E','MessageBubble','@security',T,'dompurify'),
 ('MSG-09','Multilingual text (Hindi, Japanese, Arabic RTL)','E','MessageBubble','',T,'Data-driven'),
 ('MSG-10','URL renders as a safe clickable link','+','MessageBubble','',T,''),
 ('MSG-11','Receiver gets 1:1 message in realtime','RT','MessageList ×2','@smoke @critical',T,'Browsers: C F W'),
 ('MSG-12','Group of 3 receives message in realtime','RT','MessageList ×3','@critical',T,''),
 ('MSG-13','10 rapid messages keep order on both sides','RT E','MessageList','',T,''),
 ('MSG-14','Receipts: "Sent" while the receiver is offline, "Delivered" once online','RT','MessageBubble','@critical',T,''),
 ('MSG-14b','Receipt turns "Read" once the receiver opens the chat','RT','MessageBubble','@critical',T,''),
 ('MSG-14c','Receipt turns "Read" at once when the receiver already has the chat open','RT','MessageBubble','@critical',T,''),
 ('MSG-15','Group: Message Info shows per-member delivered / read','RT','MessageInfo','',T,''),
 ('MSG-16','Timestamps and date separators correct','+','MessageList','',T,''),
 ('MSG-17','Messages persist after reload, order preserved','R','MessageList','@critical',T,''),
 ('MSG-18','Scroll up loads older messages','+','MessageList','',T,'Seed 60 via REST'),
 ('MSG-19','Scroll-to-bottom button appears when scrolled up and works','+','MessageList','',T,''),
 ('MSG-20','New-message indicator when scrolled up and a message arrives','RT','MessageList','','BLOCKED','Async AI moderation on this app makes it timing-dependent (OBS-019); test.fixme'),
 ('MSG-21','Paste text into composer and send','+','MessageComposer','',T,''),
 ('MSG-22','Loading state shown while conversation messages load (no blank gap)','E','MessageList','',T,'OBS-002'),
 ('MSG-24','Draft behaviour when switching conversations (document)','E','MessageComposer','',T,''),
 ('MSG-25','Messages still present after logout / login','R','MessageList','',T,''),
 ('MSG-27','Messages sent within the same second keep their send order','RT E','MessageList','@critical',T,'BUG-009'),
 ('MSG-26','History loads when the realtime connection completes while a conversation is opening','RT NET','MessageList','@critical @network','AUTOMATED','`tests/messaging/history-load.spec.ts` — expected-fail until BUG-002 is fixed'),
])
sec('Message actions', 'tests/messaging/actions.spec.ts', '@messaging', 'C', [
 ('ACT-01','Outgoing options: React, Reply, Reply in thread, Copy, Edit, Delete, Info','P','MessageOptionsMenu','',T,''),
 ('ACT-02','Incoming options (participant): no Edit / Delete','P','MessageOptionsMenu','',T,'Live: Reply in thread, Copy, Translate, Report, Mark Unread'),
 ('ACT-03','Edit own message → "Edited"; receiver sees edit; persists','RT R','MessageComposer, MessageBubble','@critical',T,''),
 ('ACT-04','Cancel edit keeps original','−','MessageComposer','',T,''),
 ('ACT-05','Delete own message → confirm → deleted bubble on both sides; persists','RT R','MessageBubble, ConfirmDialog','@critical',T,''),
 ('ACT-06','Group: only the sender may edit / delete a message, even the owner cannot (v7 design)','P','MessageOptionsMenu','@permissions',T,''),
 ('ACT-07','Reply → quote preview → quoted bubble; receiver sees quote','RT','MessageComposer, MessageBubble','',T,''),
 ('ACT-08','Cancel reply preview','−','MessageComposer','',T,''),
 ('ACT-09','Copy → toast + clipboard contains text','+','MessageOptionsMenu, Toast','',T,'Chromium clipboard permission'),
 ('ACT-10','Message Info panel opens and stays open after load','+','MessageInfo','',T,'Old-suite regression'),
 ('ACT-11','Report → flag dialog, reasons, submit; cancel','+ −','FlagMessageDialog','',T,''),
 ('ACT-12','Translate → translation shown under original','+','MessageBubble','@extensions',T,''),
 ('ACT-13','Message Privately (group incoming) → opens 1:1; absent on outgoing','+ P','MessageOptionsMenu','',T,''),
 ('ACT-14','No actions offered on a deleted message','E','MessageOptionsMenu','',T,''),
 ('ACT-15','Hover toolbar visible when reached by keyboard focus','A11Y','MessageBubble','@a11y',T,''),
 ('ACT-16','Message options menu closes with Escape','A11Y','MessageOptionsMenu','@a11y',T,''),
])
sec('Composer', 'tests/composer/*.spec.ts', '@composer', 'C', [
 ('CMP-01','Composer buttons have human-readable accessible names','A11Y','MessageComposer','@a11y @localization',T,'Expected to fail — BUG-001'),
 ('CMP-02','Bold / italic / underline / strike render for the receiver','+ RT','FormattingToolbar','',T,'Data-driven'),
 ('CMP-03','Keyboard shortcuts (Mod+B / I / U)','+','FormattingToolbar','',T,''),
 ('CMP-04','Link dialog inserts a link','+','FormattingToolbar','',T,''),
 ('CMP-05','Lists, blockquote, inline code, code block','+','FormattingToolbar','',T,'Data-driven'),
 ('CMP-06','Formatting persists after reload','R','MessageBubble','',T,''),
 ('CMP-07','Emoji keyboard: search, insert','+','EmojiKeyboard','',T,''),
 ('CMP-07b','Emoji search finds an emoji by the name it shows','E','EmojiKeyboard','',T,''),
 ('CMP-08','Emoji keyboard closes on Escape / outside click','A11Y','EmojiKeyboard','@a11y',T,''),
 ('CMP-09','Sticker keyboard: categories, send; receiver sees sticker','+ RT','StickerKeyboard','@extensions',T,''),
 ('CMP-10','Voice recording: record → preview → send → audio bubble','+','VoiceRecorder','@calls',T,'calls project (fake mic)'),
 ('CMP-11','Voice recording cancel','−','VoiceRecorder','@calls',T,''),
 ('CMP-12','Microphone permission denied → clear error','E','VoiceRecorder','@calls',T,''),
 ('CMP-13','Typing indicator shown to receiver and cleared after stop','RT','MessageHeader','',T,''),
 ('CMP-14','Composer disabled / replaced for a blocked user','P','MessageComposer','',T,'See UDET-03'),
 ('CMP-15','Attachment menu does not overflow into the conversation list','E','AttachmentSheet','@responsive',T,'Old-suite regression'),
])
sec('Attachments & media', 'tests/attachments/*.spec.ts', '@attachments', 'C', [
 ('ATT-01','Attachment sheet: Image, Video, Audio, File, Polls, Collaborative Document, Whiteboard','+','AttachmentSheet','',T,''),
 ('ATT-02','Send image → thumbnail; receiver sees; persists','+ RT R','AttachmentSheet, MessageBubble','@critical',T,''),
 ('ATT-03','Image opens full-screen viewer; close','+','FullScreenViewer','',T,''),
 ('ATT-04','Send video → video bubble plays','+','MessageBubble','',T,''),
 ('ATT-05','Send audio → audio bubble with play','+','MessageBubble','',T,''),
 ('ATT-06','Send PDF → file bubble with name / size, download','+','MessageBubble','',T,''),
 ('ATT-07','Multiple files in one pick','E','AttachmentSheet','',T,''),
 ('ATT-08','Unsupported / mismatched file type handled','−','AttachmentSheet','',T,''),
 ('ATT-09','Oversized file → clear error','−','AttachmentSheet','',T,''),
 ('ATT-10','Cancel file picker → nothing sent','−','AttachmentSheet','',T,''),
 ('ATT-11','Upload failure (network) → error state and retry','NET','MessageBubble','@network',T,''),
 ('ATT-12','Attachments in group and in thread','+','ThreadPanel','',T,''),
 ('ATT-13','Sent media appears under matching search filter','+','ConversationSearch','@search',T,''),
])
sec('Reactions', 'tests/reactions/reactions.spec.ts', '@reactions', 'C', [
 ('REA-01','Add reaction via React picker → pill with count 1','+','ReactionPicker, MessageBubble','@critical',T,''),
 ('REA-02','Clicking own reaction removes it','+','MessageBubble','',T,''),
 ('REA-03','Several different reactions on one message','E','MessageBubble','',T,''),
 ('REA-04','Two users, same emoji → count 2 on both sides','RT','MessageBubble ×2','',T,''),
 ('REA-05','Reaction list shows who reacted','+','ReactionList','',T,''),
 ('REA-06','Reactions persist after reload','R','MessageBubble','',T,''),
 ('REA-07','Reactions in group and in thread','+','ThreadPanel','',T,''),
 ('REA-08','Reaction picker closes on Escape','A11Y','ReactionPicker','@a11y',T,''),
 ('REA-09','A reaction the server rejects is reported to the user','NET','MessageBubble','@network',T,''),
])
sec('Threads', 'tests/threads/threads.spec.ts', '@threads', 'C', [
 ('THR-01','Reply in thread opens panel with parent preview','+','ThreadPanel','',T,''),
 ('THR-02','Thread reply updates reply count on parent for both users','RT','ThreadPanel, MessageBubble','@critical',T,''),
 ('THR-03','Receiver sees the reply inside the thread','RT','ThreadPanel','',T,''),
 ('THR-04','Thread header shows reply count','+','ThreadPanel','',T,''),
 ('THR-05','Close thread returns to main view','+','ThreadPanel','',T,''),
 ('THR-06','Thread reply preview does not leak into main composer','E','ThreadPanel, MessageComposer','',T,'Old-suite regression'),
 ('THR-07','Attachments in thread','+','ThreadPanel','',T,''),
 ('THR-08','Edit / delete a thread reply','+','ThreadPanel','',T,''),
 ('THR-09','Thread in a group conversation','+','ThreadPanel','',T,''),
 ('THR-10','Thread replies persist after reload','R','ThreadPanel','',T,''),
 ('THR-11','A thread reply that fails to send stays inside the thread','NET','ThreadPanel, MessageList','@network',T,''),
])
sec('Mentions', 'tests/mentions/mentions.spec.ts', '@mentions', 'C', [
 ('MEN-01','Typing @ opens "Mention suggestions"','+','MentionSuggestions','',T,''),
 ('MEN-02','Suggestions filter by typed text','+','MentionSuggestions','',T,''),
 ('MEN-03','Select suggestion (click / Enter) inserts mention','+','MentionSuggestions','',T,''),
 ('MEN-04','Suggestions: arrow keys + Enter pick a user','A11Y','MentionSuggestions','@a11y',T,''),
 ('MEN-04b','Suggestions close with Escape','A11Y','MentionSuggestions','@a11y',T,''),
 ('MEN-05','Multiple mentions in one message','E','MessageComposer','',T,''),
 ('MEN-06','Mention highlighted for sender and receiver','RT','MessageBubble','',T,''),
 ('MEN-07','Group: only members suggested','P','MentionSuggestions','',T,''),
 ('MEN-08','@all in a group','+','MentionSuggestions','','VERIFY','Confirm support in v7'),
 ('MEN-09','Mention inside a thread','+','ThreadPanel','',T,''),
 ('MEN-10','Names with spaces / special characters','E','MentionSuggestions','',T,''),
 ('MEN-11','Mention preserved after edit and after reload','R','MessageBubble','',T,''),
 ('MEN-12','Plain-text composer mentions (enableRichTextEditor=false, ENG-38992)','+','—','','NOT APPLICABLE','Sample app always uses rich text'),
])
sec('Groups', 'tests/groups/{groups,create,join,leave}.spec.ts', '@groups', 'C', [
 ('GRP-01','Groups list: member counts and type badges','+','GroupsList','',T,''),
 ('GRP-02','Search groups: exact / partial / no result / clear','+ −','GroupsList','',T,''),
 ('GRP-03','Create public group → listed; creator is owner','+','CreateGroupDialog','@critical',T,''),
 ('GRP-04','Create private group','+','CreateGroupDialog','',T,''),
 ('GRP-05','Password group requires a password','+ −','CreateGroupDialog','',T,''),
 ('GRP-06','Empty name blocked','−','CreateGroupDialog','',T,''),
 ('GRP-07','Dialog closes with its Close button and with Escape','A11Y','CreateGroupDialog','@a11y',T,''),
 ('GRP-08','Outsider joins public group; members see "joined"','+ RT','GroupsList, MessageList','',T,''),
 ('GRP-09','Password group: wrong password → error; correct → joined','− +','JoinGroupDialog','',T,''),
 ('GRP-10','Private group not visible / joinable for outsider','P','GroupsList','',T,''),
 ('GRP-11','Leave group → confirm → gone; members see "left"','+ RT','GroupDetails','',T,''),
 ('GRP-12','Owner leaving must transfer ownership first','P','TransferOwnership','',T,''),
 ('GRP-13','Delete & Exit (owner) → group gone for all members','P RT','GroupDetails','',T,''),
 ('GRP-14','Groups pagination','+','GroupsList','',T,''),
 ('GRP-15','Groups API failure → error state','NET','GroupsList','@network',T,''),
])
sec('Group details, members & permissions', 'tests/groups/{details,members,permissions}.spec.ts', '@groups', 'C', [
 ('MEM-01','Details: name, avatar, member count, members with scopes','+','GroupDetails, GroupMembers','',T,''),
 ('MEM-02','Search members; empty state','+','GroupMembers','',T,''),
 ('MEM-03','Owner adds members → count updates; new member sees group','+ RT','AddMembers','',T,''),
 ('MEM-04','Kick participant → removed; kicked user loses access','P RT','GroupMembers','',T,''),
 ('MEM-05','Ban → in Banned members; banned user cannot rejoin','P','GroupMembers, BannedMembers','',T,''),
 ('MEM-06','Unban → can rejoin','P','BannedMembers','',T,''),
 ('MEM-07','Promote participant → admin / moderator; others see new scope','P RT','GroupMembers','',T,''),
 ('MEM-08','Demote admin → participant','P','GroupMembers','',T,''),
 ('MEM-09','Transfer ownership → new owner; old owner becomes admin','P','TransferOwnership','',T,''),
 ('MEM-10','Permission matrix: add / kick / ban / scope options per Owner, Admin, Moderator, Participant','P','GroupMembers','@critical',T,'Data-driven, 4 roles'),
 ('MEM-11','Admin cannot kick or ban the owner','P','GroupMembers','',T,''),
 ('MEM-12','Member count persists after reload','R','GroupDetails','',T,''),
 ('MEM-13','Group action bubbles (joined / left / kicked / banned / scope changed)','+','MessageList','',T,''),
])
sec('Search', 'tests/search/*.spec.ts', '@search', 'C', [
 ('SRCH-01','Global search opens with filters Audio, Documents, Groups, Photos, Videos, Links, Unread','+','GlobalSearch','',T,''),
 ('SRCH-02','Search by conversation name','+','GlobalSearch','',T,''),
 ('SRCH-03','Search message text; clicking a result jumps to the message','+','GlobalSearch, MessageList','@critical',T,''),
 ('SRCH-04','Partial, case-insensitive, special characters','E','GlobalSearch','',T,'Data-driven'),
 ('SRCH-05','No result → empty state','−','GlobalSearch','',T,''),
 ('SRCH-06','Each filter narrows results (seeded media)','+','GlobalSearch','',T,''),
 ('SRCH-07','Unread filter shows only unread conversations','+','GlobalSearch','',T,''),
 ('SRCH-08','Back button closes search','+','GlobalSearch','',T,''),
 ('SRCH-09','Escape closes search','A11Y','GlobalSearch','@a11y',T,''),
 ('SRCH-10','In-conversation search: current chat only; filters Audio / Documents / Photos / Videos / Links','+','ConversationSearch','',T,''),
 ('SRCH-11','Scoped search does not inherit global filters','E','ConversationSearch','',T,'Old-suite regression'),
 ('SRCH-12','Keyboard navigation through results','A11Y','GlobalSearch','@a11y',T,''),
])
sec('Calls', 'tests/calls/*.spec.ts', '@calls', 'C (calls project: fake camera + mic)', [
 ('CALL-01','Voice call rings the callee; caller cancels; recorded as "Cancelled Call" / "Missed Call"','+ RT R','CallScreens','@critical',T,'Status checked after reload (BUG-018)'),
 ('CALL-01b','Caller\'s chat shows "Cancelled Call" live','RT','CallScreens, MessageList','',T,''),
 ('CALL-02','Callee declines a video call; caller\'s outgoing screen closes; "Rejected Call"','− RT','CallScreens','',T,''),
 ('CALL-03','Incoming call alert names the caller and the call type','RT','CallScreens','@critical',T,'Covered with CALL-04'),
 ('CALL-04','Accepted call connects both users (2 participants, timer running)','RT','CallScreens','@critical',T,''),
 ('CALL-06','Unanswered call → missed call for the callee','RT','CallScreens','',T,'Server timeout ~45 s; status checked after reload (BUG-018)'),
 ('CALL-07','Busy: callee already on another call','RT E','CallScreens','',T,'Bob is in a call with Carol when Alice calls (BUG-019)'),
 ('CALL-08','Leaving ends the call for both; recorded as "Call Ended"','RT R','CallScreens','@critical',T,'Status checked after reload (BUG-018)'),
 ('CALL-08b','"Call Ended" appears in the chat live','RT','MessageList','',T,''),
 ('CALL-09','Mute / unmute during a call','+','CallScreens','',T,''),
 ('CALL-10','Video call offers camera control','+','CallScreens','',T,''),
 ('CALL-11','Group call posts a meeting bubble a member can join','RT','CallScreens, MessageList','',T,''),
 ('CALL-12','Call logs list the call for both users','+','HomePage.callsPane','',T,''),
 ('CALL-13','Call log details: Participants, Recording, History','+','CallLogDetails','',T,'Details back arrow and tabs are click-only divs'),
 ('CALL-14','Call back from a call log entry','+','CallLogDetails','',T,'From the details panel'),
 ('CALL-15','Call buttons offered in 1:1 and group chats (all browsers)','+','CallScreens','@critical',T,'Runs outside the calls project'),
 ('CALL-16','Call log row has no nested interactive controls','A11Y','CallLogs','@a11y',T,'A11Y-004 (fails as expected)'),
 ('CALL-17','Network interruption during a call','NET','CallScreens','@network','BLOCKED','Playwright `setOffline` does not cut an established WebRTC media path (the callee never drops); needs OS-level network shaping'),
])
sec('Extensions', 'tests/extensions/*.spec.ts', '@extensions', 'C', [
 ('EXT-01','Poll created in a group; both sides see it; persists after reload','+ RT R','CreatePollDialog, PollBubble','@critical',T,''),
 ('EXT-02','Vote counted live for everyone; persists after reload','RT R','PollBubble','@critical',T,''),
 ('EXT-03','Create stays disabled until question + two answers; Close sends nothing','−','CreatePollDialog','',T,''),
 ('EXT-04','A poll accepts at most 12 answers','E','CreatePollDialog','',T,''),
 ('EXT-05','Collaborative document / whiteboard shared with receiver; opens in a new window','+ RT','MessageList','',T,'Data-driven ×2; external board not driven'),
 ('EXT-06','Link preview card for sender and receiver','+ RT','MessageBubble','',T,''),
 ('EXT-08','Votes from three members tallied live, identical for everyone','RT','PollBubble ×3','',T,''),
 ('EXT-09','Changing a vote moves it for everyone; survives reload','RT R','PollBubble','',T,''),
 ('EXT-07','Smart replies / conversation starter / summary','+','MessageComposer','@ai','NOT APPLICABLE','Not in UIKit v7 — the AI plugin only renders agent messages (src/plugins/ai)'),
])
sec('Moderation', 'tests/moderation/*.spec.ts', '@moderation', 'C', [
 ('MOD-01','Phone number / e-mail blocked in 1:1: sender sees notice, receiver never gets it','RT','MessageBubble','@critical',T,'Data-driven ×2 (regex rules)'),
 ('MOD-02','Blocked message in a group reaches no other member','RT','MessageList ×3','',T,''),
 ('MOD-03','Ordinary sentences with small numbers are not blocked','−','MessageList','',T,''),
 ('MOD-04','Blocked notice still shown to the sender after reload','R','MessageBubble','',T,''),
 ('MOD-07','Editing a message to add an e-mail does not leak it to the receiver','RT','MessageComposer, MessageList','',T,''),
 ('MOD-08','Blocked thread reply reaches neither the thread nor the main chat of the receiver','RT','ThreadPanel','',T,''),
 ('MOD-09','Blocked message never shows in the receiver\'s Chats preview or unread count','RT','ConversationItem','',T,''),
 ('MOD-05','Rule disabled → the same content is allowed','RT','MessageList','','BLOCKED','Toggling rules changes the shared app config — not allowed'),
 ('MOD-06','AI rules (spam, toxicity, image / video)','RT','MessageList','','NOT APPLICABLE','Non-deterministic; not asserted'),
])
sec('API — server behaviour the UI depends on', 'tests/api/*.spec.ts', '@api', 'C', [
 ('API-01','Reaction on the first message of a new chat accepted at once','E','ClientSession','',T,''),
 ('API-02','New chat can be marked read at once','E','ClientSession','',T,''),
 ('API-03','First message can be deleted at once','E','ClientSession','',T,''),
 ('API-04','Control: the same actions succeed once the conversation exists','+','ClientSession','',T,''),
 ('API-05','conversation/read sets readAt on the messages','+','ClientSession','',T,''),
])
sec('AI', 'tests/ai/*.spec.ts', '@ai', 'C', [
 ('AI-01','AI Assistant chat: greeting, send, streamed reply, history, new chat','+','AIAssistantChat','',T,'Skips unless AI_AGENT_UID is set'),
 ('AI-01b','AI Assistant: a suggested prompt fills the composer','+','AIAssistantChat','',T,'Skips when the agent has no suggestions'),
 ('AI-02','Agentic group: a solo agent answers every message','RT','MessageList','',T,'Skips unless AI_AGENT_UID is set'),
 ('AI-02b','Agentic group: with two agents, only the mentioned one answers','RT','MessageList','',T,'Skips unless AI_AGENT_UID and AI_AGENT_2_UID are set'),
])
sec('Theme', 'tests/theme/theme.spec.ts', '@theme', 'C', [
 ('THM-01','Light theme by default (data-theme + background luminance); screenshot','+','—','',T,''),
 ('THM-02','Dark system theme at load: lists, chat, composer and emoji keyboard dark; screenshot','+','—','',T,''),
 ('THM-03','Live switch light → dark → light without reload','E','—','',T,''),
 ('THM-04','Text contrast meets WCAG AA (axe) in light and dark','A11Y','—','@a11y',T,'Data-driven ×2'),
 ('THM-05','Builder / custom theme colours reflected in the running app','+','—','','NOT APPLICABLE','Sample app has no Builder config'),
])
sec('Localization', 'tests/localization/*.spec.ts', '@localization', 'C (any PW_LOCALE)', [
 ('L10N-01','Static: every UIKit locale has every en-us key','+','i18n/audit','',T,''),
 ('L10N-02','Static: every sample-app locale has every en-us key','+','i18n/audit','',T,''),
 ('L10N-03','Static: every key the code asks for exists in en-us','+','i18n/audit','',T,''),
 ('L10N-04','UI: main screens show no untranslated keys (run per locale)','+','all POMs via t()','',T,'PW_LOCALE=fr run: only BUG-001 keys'),
 ('L10N-05','UI: home tabs use the locale\'s strings','+','HomePage','',T,''),
 ('L10N-06','Page declares the UI language (<html lang>)','A11Y','—','@a11y',T,'Fails in fr only'),
 ('L10N-07','No English text leaks into a non-English UI','+','—','',T,'Skipped for en-*'),
 ('L10N-08','RTL layout','+','—','','NOT APPLICABLE','No RTL locale shipped'),
])
sec('Responsive', 'tests/responsive/*.spec.ts', '@responsive', 'tablet (1080 px), mobile (412 px)', [
 ('RESP-01','Tablet: list stays beside the open chat; no sideways scroll','+','HomePage, MessageHeader','',T,''),
 ('RESP-02','Mobile: chat replaces the list; Back returns','+','MessageHeader','@critical',T,''),
 ('RESP-03','Mobile: composer usable; no sideways scroll','+','MessageComposer','@critical',T,'With RESP-02'),
 ('RESP-04','Mobile: details open full-screen and close back to the chat','+','UserDetails','',T,''),
 ('RESP-05','Mobile: emoji keyboard and attachment sheet fit on screen','E','EmojiKeyboard, AttachmentSheet','',T,''),
 ('RESP-06','Mobile: every formatting button can be reached','E','FormattingToolbar','',T,''),
 ('RESP-07','Call screens at mobile width','+','CallScreens','@calls',T,'calls project, 412 px window'),
])
sec('Accessibility', 'tests/a11y/*.spec.ts', '@a11y', 'C', [
 ('A11Y-01','axe scan per screen — no serious / critical violations beyond confirmed ones','A11Y','—','',T,'Login, chats, chat, menu, attachments, emoji, group info, new group, search'),
 ('A11Y-01b','Composer popover buttons expose valid ARIA','A11Y','MessageComposer','',T,''),
 ('A11Y-01c','Emoji grid has the rows a grid requires','A11Y','EmojiKeyboard','',T,''),
 ('A11Y-02','Keyboard-only journey: open chat → send','A11Y','—','@critical',T,'Open chat → send (A11Y-02); message menu open / walk / Escape (A11Y-02b)'),
 ('A11Y-02b','Message options menu: open, walk and close with the keyboard','A11Y','MessageBubble','',T,'Focus returns to "More options"'),
 ('A11Y-03','Focus moves into a dialog and stays there while tabbing','A11Y','CreateGroupDialog','',T,'New Group dialog'),
 ('A11Y-04','Escape closes every popover / dialog','A11Y','—','','AUTOMATED','Covered per overlay: CMP-08, REA-08, ACT-16, SRCH-09, GRP-07, MEN-04b, NAV-04'),
 ('A11Y-05','New messages announced (role=log live region)','A11Y','MessageList','',T,''),
])
sec('Visual regression', 'tests/visual/*.spec.ts', '@visual', 'C (baselines per platform)', [
 ('VIS-01','Credentials screen','VIS','CredentialsPage','',T,''),
 ('VIS-02','Empty Chats for a new user (light)','VIS','HomePage','',T,''),
 ('VIS-03','New Group dialog','VIS','CreateGroupDialog','',T,''),
 ('VIS-04','Composer + formatting toolbar','VIS','MessageComposer','',T,''),
 ('VIS-05','Emoji keyboard','VIS','EmojiKeyboard','',T,''),
 ('VIS-06','Attachment sheet','VIS','AttachmentSheet','',T,''),
 ('VIS-07','Empty Chats (dark)','VIS','HomePage','',T,''),
 ('VIS-08','Message list with each bubble type; details panels','VIS','MessageList','',T,'Text, image and file bubbles (times masked); details panels not yet'),
 ('VIS-09','Composer, emoji keyboard, attachment sheet (dark)','VIS','MessageComposer','',T,''),
 ('VIS-10','Message list with text, image and file bubbles (dark)','VIS','MessageList','',T,''),
])
sec('Network & resilience', 'tests/network/*.spec.ts', '@network', 'C', [
 ('NET-01','Offline → online: missed messages appear','NET','MessageList','@critical',T,''),
 ('NET-02','After a short network blip, sending and receiving work','NET','MessageList','',T,''),
 ('NET-03','History fails to load (500) → error with Retry; Retry recovers','NET','MessageList','',T,''),
 ('NET-04','Slow send shows "Sending", never duplicates','NET','MessageComposer','',T,''),
 ('NET-05','Console / HTTP error budget on every test','NET','fixtures/net-watch.ts','',T,'Enforced by NetWatch in every UI test; self-test in `tests/network/net-watch.spec.ts`'),
 ('NET-06','HTTP 408 on POST /groups/{guid}/conversation/read','NET','—','','NEEDS INVESTIGATION','OBS-001 (not seen again)'),
 ('MSG-23','Message sent while offline is shown as failed','NET','MessageBubble','',T,''),
])
sec('Performance signals (report only)', 'tests/perf/*.spec.ts', '@perf', 'C', [
 ('PERF-01','Login → Home ready','+','—','',T,'Reported, not asserted'),
 ('PERF-02','Send → received (median of 5)','RT','—','',T,''),
 ('PERF-03','Open a chat → first message visible','+','—','',T,''),
 ('PERF-04','Image upload → sent','+','—','',T,''),
 ('PERF-05','Open a chat with 40 messages → first page visible','+','—','',T,''),
 ('PERF-06','Scroll up a 40-message history → oldest message visible','+','—','',T,''),
])
sec('Smoke journey', 'tests/smoke/smoke.spec.ts', '@smoke @critical', 'C F W', [
 ('SMK-01','Login → chats → open chat with Bob → send → Bob receives → reload persists → logout','RT R','several','',T,'Runs on all 3 browsers'),
 ('SMK-02','Create group (UI) → add member → message both ways live → reload persists','RT R','CreateGroupDialog, GroupDetails, MessageList','',T,'Runs on all 3 browsers'),
])


# Facts a report cannot show (browser not runnable here, etc.)
MANUAL = {
    'SMK-01': ('F ⛔', 'ENV-001'),
    'AUTH-02': ('F ⛔', 'ENV-001'),
    'AUTH-09': ('F ⛔', 'ENV-001'),
}

BROWSER = {'chromium': 'C', 'firefox': 'F', 'webkit': 'W', 'calls': 'C', 'tablet': 'Tab', 'mobile': 'Mob'}
ID_RE = re.compile(r'^([A-Z][A-Z0-9]*-\d+[a-z]?)((?:/\d+[a-z]?)*)')
BUG_RE = re.compile(r'\b(?:BUG|A11Y|L10N|OBS|ENV)-\d{3}\b')
RANK = ['fail', 'xpass', 'flaky', 'xfail', 'pass', 'skip']
MARK = {'pass': '✅', 'fail': '❌', 'xfail': '❌ (expected)', 'xpass': '❗ passed (expected to fail)', 'flaky': '⚠️ flaky', 'skip': '⏭'}


def ids_of(title):
    m = ID_RE.match(title)
    if not m:
        return []
    first = m.group(1)
    prefix = first.rsplit('-', 1)[0]
    return [first] + [f'{prefix}-{x}' for x in m.group(2).split('/') if x]


def outcome(test):
    st, exp = test.get('status'), test.get('expectedStatus')
    if st == 'skipped':
        return 'skip'
    if st == 'flaky':
        return 'flaky'
    if exp == 'failed':
        return 'xfail' if st == 'expected' else 'xpass'
    return 'pass' if st == 'expected' else 'fail'


found = collections.defaultdict(lambda: collections.defaultdict(list))   # id -> browser -> [outcome]
bugs = collections.defaultdict(set)
titles = {}
run_info = []
for path in REPORTS:
    report = json.load(open(path))
    st = report.get('stats', {})
    run_info.append(f"{st.get('startTime', '')[:10]}: {st.get('expected', 0)} expected, {st.get('unexpected', 0)} unexpected, {st.get('flaky', 0)} flaky, {st.get('skipped', 0)} skipped")

    def walk(suite):
        for spec in suite.get('specs', []):
            for test in spec.get('tests', []):
                b = BROWSER.get(test.get('projectName'))
                if not b:
                    continue
                for sid in ids_of(spec['title']) or ['(no id) ' + spec['title']]:
                    found[sid][b].append(outcome(test))
                    titles[sid] = spec['title']
                    for a in test.get('annotations', []):
                        if a.get('type') in ('bug', 'issue'):
                            bugs[sid].update(BUG_RE.findall(a.get('description', '')))
        for child in suite.get('suites', []):
            walk(child)

    for top in report.get('suites', []):
        walk(top)

known = set()
for (_, _, _, _, rr) in S:
    for i, r in enumerate(rr):
        sid = r[0]
        known.add(sid)
        res, bug, status = '', '', r[5]
        if sid in found:
            per = {b: min(o, key=RANK.index) for b, o in found[sid].items()}
            worst = min(per.values(), key=RANK.index)
            status = {'fail': 'FAILED', 'xfail': 'FAILED', 'xpass': 'NEEDS INVESTIGATION', 'flaky': 'FLAKY', 'pass': 'PASSED', 'skip': 'AUTOMATED'}[worst]
            res = ' '.join(f'{b} {MARK[o]}' for b, o in sorted(per.items()))
            bug = ', '.join(sorted(bugs[sid]))
        if sid in MANUAL:
            res = (res + ' ' + MANUAL[sid][0]).strip()
            bug = ', '.join(sorted(set(filter(None, bug.split(', '))) | {MANUAL[sid][1]}))
        rr[i] = (r[0], r[1], r[2], r[3], r[4], status, r[6], res, bug)

rows = [(t, r) for (t, _, _, _, rr) in S for r in rr]
by_status = collections.Counter(r[5] for _, r in rows)
by_kind = collections.Counter()
for _, r in rows:
    for k in r[2].split():
        by_kind[k] += 1
unmapped = sorted(sid for sid in found if sid not in known)

L = []
L.append('# Coverage Matrix — CometChat React UIKit v7 (sample app)\n')
L.append('_Generated by `scripts/coverage_matrix.py` · environment: **production app, region us** · runs: ' + ('; '.join(run_info) or 'none') + '_\n')
L.append('**Result marks:** ✅ passed · ❌ failed · ❌ (expected) = regression test for a confirmed bug, written with `test.fail()` · ❗ an expected failure passed (bug fixed? re-check) · ⚠️ flaky · ⏭ skipped. **Browsers:** C Chromium, F Firefox, W WebKit, Tab tablet, Mob mobile.\n')
L.append('**Statuses:** `PASSED` · `FAILED` (see Result: expected or not) · `FLAKY` · `AUTOMATED` (not run in the report) · `TODO` · `VERIFY` · `BLOCKED` · `NOT APPLICABLE` · `NEEDS INVESTIGATION`\n')
L.append('**Kinds:** `+` positive · `−` negative · `E` edge · `P` permission · `RT` realtime (2+ users) · `R` refresh / persistence · `NET` network · `A11Y` accessibility · `VIS` visual\n')
L.append('## Summary\n')
L.append(f'| Total scenarios | {len(rows)} |')
L.append('|---|---|')
for k in ['PASSED', 'FAILED', 'FLAKY', 'AUTOMATED', 'TODO', 'VERIFY', 'BLOCKED', 'NEEDS INVESTIGATION', 'NOT APPLICABLE']:
    L.append(f'| {k} | {by_status.get(k, 0)} |')
xf = sum(1 for _, r in rows if '(expected)' in r[7])
L.append(f'\nOf the FAILED rows, **{xf}** are expected failures that document confirmed bugs.\n')
L.append('| Kind | ' + ' | '.join(['+', '−', 'E', 'P', 'RT', 'R', 'NET', 'A11Y', 'VIS']) + ' |')
L.append('|' + '---|' * 10)
L.append('| Count | ' + ' | '.join(str(by_kind.get(k, 0)) for k in ['+', '−', 'E', 'P', 'RT', 'R', 'NET', 'A11Y', 'VIS']) + ' |')
L.append('')
L.append('| Section | Scenarios | Spec |')
L.append('|---|---|---|')
for (t, spec, tags, br, rr) in S:
    L.append(f'| {t} | {len(rr)} | `{spec}` |')
L.append('')
for (t, spec, tags, br, rr) in S:
    L.append(f'## {t}\n')
    L.append(f'Spec: `{spec}` · tags: `{tags}` · browsers: {br}\n')
    L.append('| ID | Scenario | Kind | POM | Extra tags | Status | Result | Bug | Notes |')
    L.append('|---|---|---|---|---|---|---|---|---|')
    for (i, sc, k, pom, xt, st, nt, res, bug) in rr:
        L.append(f'| {i} | {sc} | {k} | {pom} | {xt} | {st} | {res} | {bug} | {nt} |')
    L.append('')
if unmapped:
    L.append('## Tests without a matrix row\n')
    L.append('Add a row for each (or fix the id in the test title).\n')
    for sid in unmapped:
        L.append(f'- `{sid}` — {titles[sid]}')
    L.append('')
open(OUT, 'w').write('\n'.join(L))
print(len(rows), dict(by_status), 'unmapped:', unmapped)
