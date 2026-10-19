import { uniqueSentences, uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { t } from '@i18n/t';
import { ConfirmDialog, MessageInfoPanel } from '@pages/components/Dialogs';
import { ASSETS } from '@pages/messages/MessageComposer';
import { SearchPanel } from '@pages/search/SearchPanel';

/**
 * Message list — cases from the "Message List" tab of CometChat_Features_All_Test_Cases.xlsx
 * (MSGLIST_xxx) that the core suite did not cover yet.
 */
const OPT = {
  copy: t('message_list_option_copy'),
  edit: t('message_list_option_edit'),
  delete: t('message_list_option_delete'),
  translate: t('message_list_translate'),
  info: t('message_list_option_info'),
  reply: t('message_list_option_reply_to_message'),
  unread: t('message_list_option_mark_as_unread'),
};

test.describe('Message list (sheet cases)', { tag: ['@messaging', '@regression'] }, () => {
  // ---------------------------------------------------------------- display
  test('MSGLIST-002 my messages are on the right, the other user\'s on the left', async ({ alice, bob }) => {
    await alice.app.openChatWith(bob.user);
    await bob.app.openChatWith(alice.user);
    const mine = uniqueText('mine');
    const theirs = uniqueText('theirs');
    await alice.app.sendAndConfirm(mine);
    await bob.app.sendAndConfirm(theirs);

    const wrapper = (text: string) => alice.app.messages.message(text).root.locator('.cometchat-message-bubble__wrapper').first();
    await expect(wrapper(mine)).toHaveClass(/--outgoing/);
    await expect(wrapper(theirs)).not.toHaveClass(/--outgoing/);
    const log = (await alice.app.messages.log.boundingBox())!;
    const mineBox = (await alice.app.messages.message(mine).body.boundingBox())!;
    const theirsBox = (await alice.app.messages.message(theirs).body.boundingBox())!;
    expect(mineBox.x + mineBox.width / 2).toBeGreaterThan(log.x + log.width / 2);
    expect(theirsBox.x + theirsBox.width / 2).toBeLessThan(log.x + log.width / 2);
  });

  test('MSGLIST-004 a received group message shows the sender\'s name and avatar', async ({ alice, bob, data, api }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    const text = uniqueText('from bob');
    await api.messages.sendText(bob.user.uid, { guid: group.guid }, text);

    await alice.app.openGroup(group.name);

    const bubble = alice.app.messages.message(text).root;
    await expect(bubble.locator('.cometchat-message-bubble__sender-name')).toHaveText(bob.user.name);
    await expect(bubble.getByRole('img', { name: bob.user.name })).toBeVisible();
  });

  test('MSGLIST-006 messages from different days are split by date separators', async ({ alice, data, api }) => {
    // Today's message via the UI; "earlier" ones arrive with a back-dated clock in the browser.
    const peer = await data.user('peer');
    await api.messages.sendText(peer.uid, { uid: alice.user.uid }, uniqueText('today'));
    await alice.page.clock.install({ time: Date.now() + 2 * 24 * 60 * 60 * 1000 }); // view the chat two days later
    await alice.app.reload();

    await alice.app.openConversation(peer.name);

    await expect(alice.app.messages.dateSeparators.first()).not.toHaveText(t('date_today'));
  });

  test('MSGLIST-011 a chat without messages shows no errors and the composer works', async ({ alice, data }) => {
    const peer = await data.user('peer');

    await alice.app.openChatWith(peer);

    await expect(alice.app.messages.messages).toHaveCount(0);
    await expect(alice.app.messages.errorState).toBeHidden();
    const text = uniqueText('first');
    await alice.app.sendAndConfirm(text);
  });

  // ---------------------------------------------------------------- reactions / menu
  test('MSGLIST-020 reacting while offline does not add a reaction or crash', { tag: '@network' }, async ({ alice, data, api }) => {
    const peer = await data.user('peer');
    const text = uniqueText('react offline');
    await api.messages.sendText(peer.uid, { uid: alice.user.uid }, text);
    await api.users.waitForConversation(alice.user.uid, peer.uid);
    await alice.app.openConversation(peer.name);
    alice.net.allow(/.*/);

    await alice.context.setOffline(true);
    await alice.app.messages.message(text).react('joy');
    await alice.context.setOffline(false);
    await alice.app.reload();
    await alice.app.openConversation(peer.name);

    await expect(alice.app.messages.message(text).reaction('😂')).toHaveCount(0);
  });

  test('MSGLIST-028 an edit with empty text is not saved', async ({ alice, data, api }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const text = uniqueText('keep me');
    await alice.app.sendAndConfirm(text);
    await api.users.waitForConversation(alice.user.uid, peer.uid);

    await alice.app.messages.message(text).choose(OPT.edit);
    await alice.app.composer.clear();

    await expect(alice.app.composer.saveButton).toBeDisabled();
    await alice.app.composer.input.press('Enter');
    await expect(alice.app.messages.message(text).root).toBeVisible();
    await expect(alice.app.messages.message(text).editedLabel).toHaveCount(0);
  });

  test('MSGLIST-029/038 an image message offers neither Copy nor Translate', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    await alice.app.composer.attach('image', ASSETS.image);
    await alice.app.messages.bubbleOfType('image').waitUntilSent();

    const menu = await alice.app.messages.bubbleOfType('image').openOptions();

    await expect(menu.getByRole('menuitem', { name: OPT.copy, exact: true })).toHaveCount(0);
    await expect(menu.getByRole('menuitem', { name: OPT.translate, exact: true })).toHaveCount(0);
  });

  test('MSGLIST-030 cancelling the delete confirmation keeps the message', async ({ alice, data, api }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const text = uniqueText('do not delete');
    await alice.app.sendAndConfirm(text);
    await api.users.waitForConversation(alice.user.uid, peer.uid);

    await alice.app.messages.message(text).choose(OPT.delete);
    const confirm = new ConfirmDialog(alice.page, OPT.delete);
    await confirm.button(t('cancel')).click();

    await expect(confirm.dialog).toBeHidden();
    await expect(alice.app.messages.message(text).root).toBeVisible();
    await expect(alice.app.messages.deleted()).toHaveCount(0);
  });

  // ---------------------------------------------------------------- group action messages
  test('MSGLIST-033 adding a member posts an "added" notice', async ({ alice, bob, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });

    await alice.app.openGroup(group.name);

    await expect(alice.app.messages.log.getByRole('status').filter({ hasText: bob.user.name })).toContainText(t('message_list_action_added'));
  });

  test('MSGLIST-034 banning a member posts a "banned" notice', async ({ alice, erin, data }) => {
    const group = await data.group({ owner: alice.user, participants: [erin.user] });
    await alice.app.openGroup(group.name);
    await alice.app.openDetails();

    const menu = await alice.app.groupDetails.members.openOptions(erin.user.name);
    await menu.getByRole('menuitem', { name: t('members_block'), exact: true }).click();

    await expect(alice.app.messages.log).toContainText(`${t('message_list_action_banned')} ${erin.user.name}`);
  });

  test('MSGLIST-035 changing a member\'s scope posts a notice with the new scope', async ({ alice, erin, data }) => {
    const group = await data.group({ owner: alice.user, participants: [erin.user] });
    await alice.app.openGroup(group.name);
    await alice.app.openDetails();

    const menu = await alice.app.groupDetails.members.openOptions(erin.user.name);
    await menu.getByRole('menuitem', { name: t('members_change_role'), exact: true }).click();
    const dialog = alice.page.getByRole('dialog', { name: t('change_scope_title') });
    // Option labels are the raw scope ids capitalised (L10N-005); the radio itself is 0×0.
    await dialog.locator('.cometchat-change-scope__list-item', { hasText: 'Moderator' }).click();
    await dialog.getByRole('button', { name: t('change_scope_confirm_yes') }).click();

    const notice = alice.app.messages.log.getByRole('status').filter({ hasText: erin.user.name }).last();
    await expect(notice).toContainText(t('message_list_action_made'));
    await expect(notice).toContainText(/moderator/i);
  });

  // ---------------------------------------------------------------- translate
  test('MSGLIST-037 after translating, the original text is still shown', { tag: '@extensions' }, async ({ alice, bob }) => {
    await alice.app.openChatWith(bob.user);
    const text = `Hola, nos vemos mañana en la biblioteca con ${uniqueText('es')}`;
    await alice.app.sendAndConfirm(text);
    await bob.app.openConversation(alice.user.name);

    await bob.app.messages.message(text).choose(OPT.translate);

    const bubble = bob.app.messages.message(text);
    await expect(bubble.translation).toBeVisible();
    await expect(bubble.text).toContainText('biblioteca');
  });

  test('MSGLIST-039 translating without network does not change or break the message', { tag: ['@extensions', '@network'] }, async ({ alice, bob }) => {
    await alice.app.openChatWith(bob.user);
    const text = `Hola, nos vemos mañana en la biblioteca con ${uniqueText('es')}`;
    await alice.app.sendAndConfirm(text);
    await bob.app.openConversation(alice.user.name);
    bob.net.allow(/.*/);

    await bob.context.setOffline(true);
    await bob.app.messages.message(text).choose(OPT.translate);

    const bubble = bob.app.messages.message(text);
    await expect(bubble.translation).toHaveCount(0);
    await expect(bubble.text).toContainText('biblioteca');
    await bob.context.setOffline(false);
  });

  // ---------------------------------------------------------------- replies
  test('MSGLIST-050 replying to an image quotes the image', async ({ alice, bob }) => {
    await alice.app.openChatWith(bob.user);
    await bob.app.openChatWith(alice.user);
    await alice.app.composer.attach('image', ASSETS.image);
    await alice.app.messages.bubbleOfType('image').waitUntilSent();
    const answer = uniqueText('nice photo');

    await bob.app.messages.bubbleOfType('image').reply();
    await expect(bob.app.composer.replyPreview).toBeVisible();
    await bob.app.composer.sendWithEnter(answer);

    for (const side of [alice, bob]) await expect(side.app.messages.message(answer).quote).toBeVisible();
  });

  test('MSGLIST-051 clicking a quoted message jumps to the original', async ({ alice, data, api }) => {
    const peer = await data.user('peer');
    const { texts, marker } = uniqueSentences(30, 'history');
    for (const text of texts) await api.messages.sendText(peer.uid, { uid: alice.user.uid }, text);
    await api.messages.waitForModeration(alice.user.uid, peer.uid, marker);
    await alice.app.openConversation(peer.name);
    const original = alice.app.messages.message(texts[texts.length - 1]);
    const answer = uniqueText('answer');
    await original.reply();
    await alice.app.composer.sendWithEnter(answer);
    await alice.app.messages.message(answer).waitUntilSent();
    const first = alice.app.messages.message(texts[0]);
    await first.root.scrollIntoViewIfNeeded();
    await expect(alice.app.messages.message(answer).root).not.toBeInViewport();

    await alice.app.messages.message(answer).quote.click();

    await expect(original.root).toBeInViewport();
  });

  test('MSGLIST-053 a reply keeps working after its original is deleted', async ({ alice, data, api }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const original = uniqueText('will be deleted');
    await alice.app.sendAndConfirm(original);
    await api.users.waitForConversation(alice.user.uid, peer.uid);
    await alice.app.messages.message(original).reply();
    const answer = uniqueText('reply stays');
    await alice.app.composer.sendWithEnter(answer);
    await alice.app.messages.message(answer).waitUntilSent();

    await alice.app.messages.message(original).choose(OPT.delete);
    await new ConfirmDialog(alice.page, OPT.delete).button(OPT.delete).click();

    await expect(alice.app.messages.message(answer).root).toBeVisible();
    await alice.app.reload();
    await alice.app.openConversation(peer.name);
    await expect(alice.app.messages.message(answer).root).toBeVisible();
  });

  test('MSGLIST-054 a reply in a group shows the quote and sender to every member', async ({ alice, bob, carol, data, api }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user, carol.user] });
    const original = uniqueText('group question');
    await api.messages.sendText(bob.user.uid, { guid: group.guid }, original);
    await alice.app.openGroup(group.name);
    await carol.app.openGroup(group.name);
    const answer = uniqueText('group answer');

    await alice.app.messages.message(original).reply();
    await alice.app.composer.sendWithEnter(answer);

    const quote = carol.app.messages.message(answer).quote;
    await expect(quote).toContainText(original);
    await expect(quote).toContainText(bob.user.name);
  });

  // ---------------------------------------------------------------- receipts
  test('MSGLIST-063 several messages all turn "Read" for the sender', async ({ alice, data, loginAs }) => {
    const peer = await data.user('reader');
    const receiver = await loginAs(peer);
    await alice.app.openChatWith(peer);
    await receiver.app.openChatWith(alice.user); // already in the chat (MSG-14c path)
    const { texts } = uniqueSentences(3, 'batch');

    for (const text of texts) await alice.app.sendAndConfirm(text);

    for (const text of texts) await expect(alice.app.messages.message(text).receipt('read')).toBeVisible();
  });

  test('MSGLIST-065 Message Info shows delivered and read times in a 1:1 chat', async ({ alice, data, loginAs }) => {
    const peer = await data.user('reader');
    const receiver = await loginAs(peer);
    await alice.app.openChatWith(peer);
    await receiver.app.openChatWith(alice.user);
    const text = uniqueText('info times');
    await alice.app.sendAndConfirm(text);
    await expect(alice.app.messages.message(text).receipt('read')).toBeVisible();

    await alice.app.messages.message(text).choose(OPT.info);

    const info = new MessageInfoPanel(alice.page);
    await expect(info.dialog).toContainText(t('message_information_read'));
    await expect(info.dialog).toContainText(t('message_information_delivered'));
    await expect(info.dialog).toContainText(/\d{1,2}:\d{2}/);
  });

  test('MSGLIST-067 a group message is not "Read" until every member has read it', async ({ alice, bob, carol, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user, carol.user] });
    await alice.app.openGroup(group.name);
    await bob.app.openGroup(group.name); // only Bob reads; Carol does not open the group
    const text = uniqueText('partly read');

    await alice.app.sendAndConfirm(text);
    await expect(bob.app.messages.message(text).root).toBeVisible();

    await expect(alice.app.messages.message(text).receipt('delivered')).toBeVisible();
    await expect(alice.app.messages.message(text).receipt('read')).toHaveCount(0);
  });

  test('MSGLIST-068 a message to an offline user goes from Sent to Delivered when they come online', async ({ alice, data, loginAs }) => {
    const peer = await data.user('offline');
    await alice.app.openChatWith(peer);
    const text = uniqueText('while you were away');

    await alice.app.sendAndConfirm(text);
    await expect(alice.app.messages.message(text).receipt('sent')).toBeVisible();
    await loginAs(peer);

    await expect(alice.app.messages.message(text).receipt('delivered')).toBeVisible({ timeout: 30_000 });
  });

  test('MSGLIST-069 received messages show no receipt ticks', async ({ alice, bob }) => {
    await alice.app.openChatWith(bob.user);
    await bob.app.openChatWith(alice.user);
    const text = uniqueText('for bob');
    await alice.app.sendAndConfirm(text);

    const bubble = bob.app.messages.message(text);
    await expect(bubble.root).toBeVisible();
    for (const state of ['sent', 'delivered', 'read'] as const) await expect(bubble.receipt(state)).toHaveCount(0);
  });

  test('MSGLIST-070 an image message gets delivered and read receipts like text', async ({ alice, data, loginAs }) => {
    const peer = await data.user('viewer');
    const receiver = await loginAs(peer);
    await alice.app.openChatWith(peer);
    await alice.app.sendAndConfirm(uniqueText('photo coming'));
    await receiver.app.openChatWith(alice.user);

    await alice.app.composer.attach('image', ASSETS.image);

    await expect(alice.app.messages.bubbleOfType('image').receipt('read')).toBeVisible({ timeout: 30_000 });
  });

  test('MSGLIST-072 messages to someone who blocked me never show Delivered or Read', async ({ alice, bob, api }) => {
    await api.users.block(alice.user.uid, bob.user.uid); // Alice blocks Bob
    await bob.app.reload();
    await bob.app.openChatWith(alice.user);
    const text = uniqueText('are you there');

    await bob.app.sendAndConfirm(text);

    const bubble = bob.app.messages.message(text);
    await expect(bubble.receipt('sent')).toBeVisible();
    await expect(bubble.receipt('delivered')).toHaveCount(0);
    await expect(bubble.receipt('read')).toHaveCount(0);
  });

  // ---------------------------------------------------------------- typing & presence
  test('MSGLIST-077 group members see who is typing', async ({ alice, bob, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    await alice.app.openGroup(group.name);
    await bob.app.openGroup(group.name);

    await bob.app.composer.type('thinking out loud');

    await expect(alice.app.header.status).toContainText(bob.user.name);
    await expect(alice.app.header.status).toContainText(/typing/i);
  });

  test('MSGLIST-078 two members typing at once are both shown', async ({ alice, bob, carol, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user, carol.user] });
    for (const u of [alice, bob, carol]) await u.app.openGroup(group.name);

    await bob.app.composer.type('one moment');
    await carol.app.composer.type('me too');

    await expect(alice.app.header.status).toContainText(/are typing/i);
    await expect(alice.app.header.status).toContainText(bob.user.name);
    await expect(alice.app.header.status).toContainText(carol.user.name);
  });

  test('MSGLIST-079 an online user has a status dot in the Users list', async ({ alice, bob }) => {
    await alice.app.home.openTab('users');
    await alice.app.users.search(bob.user.name);

    await expect(alice.app.users.item(bob.user.name).getByRole('status', { name: /online/i })).toBeVisible();
  });

  test('MSGLIST-082 online members have a status dot in Group Info', async ({ alice, bob, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    await alice.app.openGroup(group.name);

    await alice.app.openDetails();

    await expect(alice.app.groupDetails.members.member(bob.user.name).getByRole('status', { name: /online/i })).toBeVisible();
  });

  test('MSGLIST-085 an offline user\'s header shows "Last seen"', async ({ alice, data, loginAs }) => {
    const peer = await data.user('away');
    const other = await loginAs(peer);
    await other.context.close(); // the peer goes offline
    await alice.app.openChatWith(peer);

    // Presence text is part of the banner's accessible name ("<name>, Last seen …").
    await expect(alice.app.header.banner).toHaveAccessibleName(new RegExp(t('message_header_last_seen')), { timeout: 30_000 });
  });

  test('MSGLIST-086 typing indicators work again after a network drop', { tag: '@network' }, async ({ alice, bob }) => {
    await alice.app.openChatWith(bob.user);
    await bob.app.openChatWith(alice.user);
    alice.net.allow(/.*/);

    await alice.context.setOffline(true);
    await alice.context.setOffline(false);
    await bob.app.composer.type('after the blip');

    await expect(alice.app.header.status).toContainText(/typing/i, { timeout: 30_000 });
  });

  test('MSGLIST-087 a blocked user\'s typing is not shown', async ({ alice, bob, api }) => {
    await api.users.block(alice.user.uid, bob.user.uid);
    await alice.app.reload();
    await alice.app.openChatWith(bob.user, { composer: false });
    await bob.app.openChatWith(alice.user);

    await bob.app.composer.type('can you see this');

    await expect(alice.app.header.status).not.toContainText(/typing/i);
    await bob.app.composer.input.pressSequentially(' still typing');
    await expect(alice.app.header.status).not.toContainText(/typing/i);
  });

  test('MSGLIST-088 "typing" disappears when the typist closes the app', async ({ alice, data, loginAs }) => {
    const peer = await data.user('typist');
    const typist = await loginAs(peer);
    await alice.app.openChatWith(peer);
    await typist.app.openChatWith(alice.user);
    await typist.app.composer.type('half a thought');
    await expect(alice.app.header.status).toContainText(/typing/i);

    await typist.context.close();

    await expect(alice.app.header.status).not.toContainText(/typing/i, { timeout: 20_000 });
  });

  // ---------------------------------------------------------------- mark as unread
  test('MSGLIST-092 the unread badge clears after reading the chat again', async ({ data, api, loginAs }) => {
    const me = await data.user('marker');
    const peer = await data.user('writer');
    const text = uniqueText('mark me');
    await api.messages.sendText(peer.uid, { uid: me.uid }, text);
    await api.users.waitForConversation(me.uid, peer.uid);
    const { app, net } = await loginAs(me);
    net.allow(/reading 'conversationId'/); // BUG-013
    await app.openConversation(peer.name);
    await app.messages.message(text).choose(OPT.unread);
    await app.reload(); // BUG-013: the list only shows it after a reload
    await expect(app.conversations.item(peer.name)).toHaveAccessibleName(app.conversations.unreadSuffix());

    await app.openConversation(peer.name);

    await expect(app.conversations.item(peer.name)).not.toHaveAccessibleName(app.conversations.unreadSuffix());
  });

  test('MSGLIST-093 a conversation marked unread is listed under the Unread filter', async ({ data, api, loginAs }) => {
    const me = await data.user('marker');
    const peer = await data.user('writer');
    const text = uniqueText('mark me');
    await api.messages.sendText(peer.uid, { uid: me.uid }, text);
    await api.users.waitForConversation(me.uid, peer.uid);
    const { app, page, net } = await loginAs(me);
    net.allow(/reading 'conversationId'/);
    await app.openConversation(peer.name);
    await app.messages.message(text).choose(OPT.unread);
    await app.reload();

    await app.conversations.searchBox.click();
    const search = new SearchPanel(page);
    await search.toggle('unread');

    await expect(search.conversations.filter({ hasText: peer.name })).toBeVisible();
  });

  test('MSGLIST-094 marking a group message unread shows the group as unread', async ({ alice, bob, data, api }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    const text = uniqueText('group mark me');
    await api.messages.sendText(bob.user.uid, { guid: group.guid }, text);
    await api.users.waitForConversation(alice.user.uid, group.guid);
    alice.net.allow(/reading 'conversationId'/);
    await alice.app.openGroup(group.name);

    await alice.app.messages.message(text).choose(OPT.unread);
    await alice.app.reload();

    await expect(alice.app.conversations.item(group.name)).toHaveAccessibleName(alice.app.conversations.unreadSuffix());
  });

  test('MSGLIST-095 an unread mark survives logout and login', async ({ data, api, loginAs }) => {
    const me = await data.user('marker');
    const peer = await data.user('writer');
    const text = uniqueText('stay unread');
    await api.messages.sendText(peer.uid, { uid: me.uid }, text);
    await api.users.waitForConversation(me.uid, peer.uid);
    const first = await loginAs(me);
    first.net.allow(/reading 'conversationId'/);
    await first.app.openConversation(peer.name);
    await first.app.messages.message(text).choose(OPT.unread);
    await first.app.home.logout();

    const again = await loginAs(me);

    await expect(again.app.conversations.item(peer.name)).toHaveAccessibleName(again.app.conversations.unreadSuffix());
  });

  test('MSGLIST-096 a chat with many unread messages opens at the first unread one', async ({ data, api, loginAs }) => {
    const me = await data.user('reader');
    const peer = await data.user('writer');
    const { texts, marker } = uniqueSentences(25, 'unread');
    for (const text of texts) await api.messages.sendText(peer.uid, { uid: me.uid }, text);
    await api.messages.waitForModeration(me.uid, peer.uid, marker);
    const { app } = await loginAs(me);

    await app.openConversation(peer.name);

    await expect(app.messages.newMessagesDivider).toBeVisible();
    await expect(app.messages.message(texts[0]).root).toBeInViewport();
  });

  test('MSGLIST-097 a fully read chat opens at the latest message', async ({ data, api, loginAs }) => {
    const me = await data.user('reader');
    const peer = await data.user('writer');
    const { texts, marker } = uniqueSentences(25, 'read');
    for (const text of texts) await api.messages.sendText(peer.uid, { uid: me.uid }, text);
    await api.messages.waitForModeration(me.uid, peer.uid, marker);
    const { app } = await loginAs(me);
    await app.openConversation(peer.name); // reads them
    await app.home.openTab('users');
    await app.home.openTab('chats');

    await app.openConversation(peer.name);

    await expect(app.messages.newMessagesDivider).toBeHidden();
    await expect(app.messages.last().root).toBeInViewport();
  });

  test('MSGLIST-098 a chat opens at the message that was marked unread', async ({ data, api, loginAs }) => {
    const me = await data.user('reader');
    const peer = await data.user('writer');
    const { texts, marker } = uniqueSentences(25, 'older');
    for (const text of texts) await api.messages.sendText(peer.uid, { uid: me.uid }, text);
    await api.messages.waitForModeration(me.uid, peer.uid, marker);
    const { app, net } = await loginAs(me);
    net.allow(/reading 'conversationId'/);
    await app.openConversation(peer.name);
    const target = app.messages.message(texts[2]);
    await target.root.scrollIntoViewIfNeeded();
    await target.choose(OPT.unread);
    await app.reload();

    await app.openConversation(peer.name);

    await expect(app.messages.message(texts[2]).root).toBeInViewport();
  });

  test('MSGLIST-099 my own messages do not offer "Mark Unread"', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const text = uniqueText('mine');
    await alice.app.sendAndConfirm(text);

    const menu = await alice.app.messages.message(text).openOptions();

    await expect(menu.getByRole('menuitem', { name: OPT.unread, exact: true })).toHaveCount(0);
  });

  test('MSGLIST-100 marking unread while offline does not crash the app', { tag: '@network' }, async ({ alice, data, api }) => {
    const peer = await data.user('writer');
    const text = uniqueText('offline mark');
    await api.messages.sendText(peer.uid, { uid: alice.user.uid }, text);
    await api.users.waitForConversation(alice.user.uid, peer.uid);
    await alice.app.openConversation(peer.name);
    alice.net.allow(/.*/);

    await alice.context.setOffline(true);
    await alice.app.messages.message(text).choose(OPT.unread);
    await alice.context.setOffline(false);

    await expect(alice.app.messages.message(text).root).toBeVisible();
    await expect(alice.app.composer.input).toBeVisible();
  });
});

