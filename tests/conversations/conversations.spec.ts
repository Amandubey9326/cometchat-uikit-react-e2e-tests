import { t } from '@i18n/t';
import { uniqueSentences, uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { ConfirmDialog } from '@pages/components/Dialogs';
import { NewChatView } from '@pages/conversations/NewChatView';
import { nextServerSecond } from '@utils/time';
import { escapeRegExp, startsWithWord } from '@utils/text';

test.describe('Conversations list', { tag: ['@conversations', '@regression'] }, () => {
  test('CONV-01 the list loads existing conversations', { tag: '@smoke' }, async ({ data, api, loginAs }) => {
    const me = await data.user('lister');
    const peer = await data.user('peer');
    await api.messages.sendText(peer.uid, { uid: me.uid }, uniqueText('hello'));

    const { app } = await loginAs(me);

    await expect(app.conversations.item(peer.name)).toBeVisible();
  });

  test('CONV-02 a user without conversations sees the empty state', async ({ data, loginAs }) => {
    const me = await data.user('newbie');

    const { app } = await loginAs(me);

    await expect(app.conversations.emptyState).toBeVisible();
    await expect(app.conversations.items).toHaveCount(0);
  });

  test('CONV-03 an item shows avatar, name, last message, time and receipt', async ({ data, api, loginAs }) => {
    const me = await data.user('sender');
    const peer = await data.user('peer');
    const { app } = await loginAs(me);
    await app.openChatWith(peer);
    const text = uniqueText('latest');
    await app.sendAndConfirm(text);
    await api.users.waitForConversation(me.uid, peer.uid); // CONV-25 covers the first seconds (BUG-012)
    await app.home.openTab('chats');

    const item = app.conversations.item(peer.name);
    await expect(item.getByRole('img', { name: peer.name })).toBeVisible();
    await expect(item).toContainText(text);
    await expect(item.locator('time')).toBeVisible();
    await expect(item).toHaveAccessibleName(/Message (sent|delivered|read)/i);
  });

  test('CONV-04 a group item shows "Sender: text" and the private badge', async ({ alice, bob, data, api }) => {
    const group = await data.group({ owner: alice.user, type: 'private', participants: [bob.user] });
    const text = uniqueText('group news');

    await api.messages.sendText(bob.user.uid, { guid: group.guid }, text);

    const item = alice.app.conversations.item(group.name);
    await expect(item).toContainText(new RegExp(`${escapeRegExp(bob.user.name)}:\\s*${escapeRegExp(text)}`));
    // Badge label is hard-coded English in UIKit (L10N-003, CometChatConversationsItem.tsx:591).
    await expect(item.getByRole('img', { name: 'Private group' })).toBeVisible();
  });

  test('CONV-07 an incoming message moves its conversation to the top', { tag: '@critical' }, async ({ data, api, loginAs }) => {
    const me = await data.user('ranker');
    const first = await data.user('first');
    const second = await data.user('second');
    await api.messages.sendText(first.uid, { uid: me.uid }, uniqueText('early'));
    await nextServerSecond(); // same-second conversations have no defined order (BUG-009)
    await api.messages.sendText(second.uid, { uid: me.uid }, uniqueText('later'));
    const { app } = await loginAs(me);
    await expect(app.conversations.items.first()).toHaveAccessibleName(startsWithWord(second.name));
    await nextServerSecond();

    await api.messages.sendText(first.uid, { uid: me.uid }, uniqueText('newest'));

    await expect(app.conversations.items.first()).toHaveAccessibleName(startsWithWord(first.name));
    await app.reload(); // CONV-15 — the order survives a reload
    await expect(app.conversations.items.first()).toHaveAccessibleName(startsWithWord(first.name));
  });

  test('CONV-08 the unread badge counts incoming messages live and clears when the chat is opened', { tag: '@critical' }, async ({ data, api, loginAs }) => {
    const me = await data.user('reader');
    const peer = await data.user('writer');
    const { app } = await loginAs(me);
    const { texts } = uniqueSentences(3, 'unread');

    await api.messages.sendText(peer.uid, { uid: me.uid }, texts[0]);
    await expect(app.conversations.item(peer.name)).toHaveAccessibleName(app.conversations.unreadLabel(1));
    await api.messages.sendText(peer.uid, { uid: me.uid }, texts[1]);
    await api.messages.sendText(peer.uid, { uid: me.uid }, texts[2]);
    await expect(app.conversations.item(peer.name)).toHaveAccessibleName(app.conversations.unreadLabel(3));

    await app.openConversation(peer.name);

    await expect(app.conversations.item(peer.name)).not.toHaveAccessibleName(app.conversations.unreadSuffix());
  });

  test('CONV-09 a conversation that was read stays read after a reload', { tag: '@critical' }, async ({ data, api, loginAs }) => {
    const me = await data.user('reader');
    const peer = await data.user('writer');
    const text = uniqueText('read me');
    await api.messages.sendText(peer.uid, { uid: me.uid }, text);
    await api.users.waitForConversation(me.uid, peer.uid); // BUG-012: a read inside the window is rejected (403)
    const { app, page } = await loginAs(me);
    await expect(app.conversations.item(peer.name)).toHaveAccessibleName(app.conversations.unreadLabel(1));

    const read = page.waitForResponse(r => /\/conversation\/read$/.test(r.url()) && r.request().method() === 'POST');
    await app.openConversation(peer.name);
    expect((await read).status()).toBe(200);
    await app.reload();

    await expect(app.conversations.item(peer.name)).toBeVisible();
    await expect(app.conversations.item(peer.name)).not.toHaveAccessibleName(app.conversations.unreadSuffix());
  });

  // Only the live list is asserted: the SDK promise never settles (BUG-013), and the server-side
  // unread state after a reload is covered by CONV-09's counterpart below once BUG-013 is fixed.
  test(
    'CONV-10 "Mark as unread" shows the conversation as unread in the list',
    { annotation: { type: 'bug', description: 'BUG-013 — SDK throws on the mark-unread response; the list never updates' } },
    async ({ data, api, loginAs }) => {
      test.fail(true, 'BUG-013');
      const me = await data.user('marker');
      const peer = await data.user('writer');
      const text = uniqueText('mark later');
      await api.messages.sendText(peer.uid, { uid: me.uid }, text);
      await api.users.waitForConversation(me.uid, peer.uid);
      const { app, net } = await loginAs(me);
      net.allow(/reading 'conversationId'/);
      await app.openConversation(peer.name);
      await expect(app.conversations.item(peer.name)).not.toHaveAccessibleName(app.conversations.unreadSuffix());

      await app.messages.message(text).choose(t('message_list_option_mark_as_unread'));

      await expect(app.conversations.item(peer.name)).toHaveAccessibleName(app.conversations.unreadLabel(1));
    }
  );

  test('CONV-11 the list shows when the other user is typing', async ({ data, api, loginAs }) => {
    const me = await data.user('watcher');
    const peer = await data.user('typist');
    await api.messages.sendText(peer.uid, { uid: me.uid }, uniqueText('hi'));
    const mine = await loginAs(me);
    const theirs = await loginAs(peer);
    await theirs.app.openChatWith(me);

    await theirs.app.composer.type('typing a longer thought here');

    await expect(mine.app.conversations.typing(peer.name)).toBeVisible();
  });

  test('CONV-12 the presence dot follows the other user going online and offline', async ({ data, api, loginAs }) => {
    const me = await data.user('observer');
    const peer = await data.user('visitor');
    await api.messages.sendText(peer.uid, { uid: me.uid }, uniqueText('hi'));
    const { app } = await loginAs(me);
    const online = app.conversations.item(peer.name).getByRole('status', { name: t('accessibility_online') });
    await expect(online).toHaveCount(0);

    const visitor = await loginAs(peer);
    await expect(online).toBeVisible();

    await visitor.context.close();
    await expect(online).toHaveCount(0, { timeout: 60_000 });
  });

  test('CONV-13 deleting a conversation removes it, also after reload', { tag: '@critical' }, async ({ data, api, loginAs }) => {
    const me = await data.user('cleaner');
    const peer = await data.user('peer');
    await api.messages.sendText(peer.uid, { uid: me.uid }, uniqueText('delete this chat'));
    const { app, page } = await loginAs(me);
    const item = app.conversations.item(peer.name);

    await item.hover();
    await app.conversations.deleteButton(peer.name).click();
    const confirm = new ConfirmDialog(page, t('conversation_delete_title'));
    await expect(confirm.dialog).toContainText(t('conversation_delete_subtitle'));
    await confirm.button(t('conversation_delete_confirm_yes')).click();

    await expect(item).toHaveCount(0);
    await app.reload();
    await expect(item).toHaveCount(0);
  });

  test('CONV-14 cancelling the delete keeps the conversation', async ({ data, api, loginAs }) => {
    const me = await data.user('keeper');
    const peer = await data.user('peer');
    await api.messages.sendText(peer.uid, { uid: me.uid }, uniqueText('keep this chat'));
    const { app, page } = await loginAs(me);

    await app.conversations.item(peer.name).hover();
    await app.conversations.deleteButton(peer.name).click();
    await new ConfirmDialog(page, t('conversation_delete_title')).button(t('conversation_delete_confirm_no')).click();

    await expect(app.conversations.item(peer.name)).toBeVisible();
  });

  test('CONV-16 scrolling loads more conversations (page size 30)', async ({ data, api, loginAs }) => {
    test.setTimeout(240_000);
    // 31 group conversations: groups instead of users keep the app under its 100-user plan quota.
    const me = await data.user('popular');
    const host = await data.user('host');
    const groups = [];
    for (let i = 0; i < 31; i++) groups.push(await data.group({ owner: host, participants: [me], name: `club ${i}` }));
    for (const g of groups) await api.messages.sendText(host.uid, { guid: g.guid }, uniqueText('club news'));
    const { app } = await loginAs(me);
    const oldest = app.conversations.item(groups[0].name);

    await expect(async () => {
      await app.conversations.items.last().scrollIntoViewIfNeeded();
      await expect(oldest).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 60_000 });

    await expect(app.conversations.items).toHaveCount(31);
  });

  test('CONV-17 Tab moves through the list and Enter opens a conversation', { tag: '@a11y' }, async ({ data, api, loginAs }) => {
    const me = await data.user('keys');
    const a = await data.user('aaa');
    const b = await data.user('bbb');
    await api.messages.sendText(a.uid, { uid: me.uid }, uniqueText('one'));
    await nextServerSecond();
    await api.messages.sendText(b.uid, { uid: me.uid }, uniqueText('two'));
    const { app, page } = await loginAs(me);
    await expect(app.conversations.items.first()).toHaveAccessibleName(startsWithWord(b.name));

    await app.conversations.items.first().focus();
    // Each item also holds a focusable Delete button, so the next item is a few Tab presses away.
    await expect(async () => {
      await page.keyboard.press('Tab');
      await expect(app.conversations.item(a.name)).toBeFocused({ timeout: 500 });
    }).toPass({ timeout: 10_000 });
    await page.keyboard.press('Enter');

    await expect(app.header.titleFor(a.name)).toBeVisible();
  });

  test(
    'CONV-17b arrow keys move through the list (ARIA listbox pattern)',
    { tag: '@a11y', annotation: { type: 'bug', description: 'A11Y-010 — listbox options ignore ArrowUp/ArrowDown' } },
    async ({ data, api, loginAs }) => {
      test.fail(true, 'A11Y-010');
      const me = await data.user('keys');
      const a = await data.user('aaa');
      const b = await data.user('bbb');
      await api.messages.sendText(a.uid, { uid: me.uid }, uniqueText('one'));
      await nextServerSecond();
      await api.messages.sendText(b.uid, { uid: me.uid }, uniqueText('two'));
      const { app, page } = await loginAs(me);
      await expect(app.conversations.items.first()).toHaveAccessibleName(startsWithWord(b.name));

      await app.conversations.items.first().focus();
      await page.keyboard.press('ArrowDown');

      await expect(app.conversations.item(a.name)).toBeFocused({ timeout: 3_000 });
    }
  );

  test('CONV-26 a new chat that starts while another chat is open shows an unread badge', { tag: '@critical' }, async ({ data, api, loginAs }) => {
    const me = await data.user('busy');
    const open = await data.user('open');
    const newcomer = await data.user('newcomer');
    await api.messages.sendText(open.uid, { uid: me.uid }, uniqueText('already here'));
    await api.users.waitForConversation(me.uid, open.uid);
    const { app } = await loginAs(me);
    await app.openConversation(open.name);
    // A hovered row shows its Delete button instead of time + badge; the new row lands under the pointer.
    await app.header.banner.hover();

    await api.messages.sendText(newcomer.uid, { uid: me.uid }, uniqueText('fresh start'));

    await expect(app.conversations.item(newcomer.name)).toHaveAccessibleName(app.conversations.unreadLabel(1));
  });

  test('CONV-19 if conversations fail to load, an error is shown', { tag: '@network' }, async ({ data, loginAs }) => {
    const me = await data.user('unlucky');
    const { app, page, net } = await loginAs(me);
    net.allow(/\/conversations/);
    await page.route(/\/v3(\.0)?\/conversations/, route => route.fulfill({ status: 500, json: { error: { message: 'boom' } } }));

    await page.reload();

    await expect(app.conversations.region.getByText(t('conversation_error_title'))).toBeVisible();
    await expect(app.conversations.region.getByText(t('conversation_error_subtitle'))).toBeVisible();
  });

  test('CONV-20/22 "Create conversation" → search → pick a user opens the chat', async ({ alice, data }) => {
    const peer = await data.user('newfriend');
    await alice.app.home.openMenu();
    await alice.app.home.menuItem(t('create_conversation')).click();
    const view = new NewChatView(alice.page);
    await expect(view.title).toHaveText(t('sample_new_chat'));

    await view.searchBox.fill(peer.name);
    await expect(view.item(peer.name)).toBeVisible();
    await view.item(peer.name).click();

    await expect(alice.app.header.titleFor(peer.name)).toBeVisible();
  });

  test('CONV-21 "Create conversation" → Groups tab → pick a group opens it', async ({ alice, data }) => {
    const group = await data.group({ owner: alice.user });
    await alice.app.home.openMenu();
    await alice.app.home.menuItem(t('create_conversation')).click();
    const view = new NewChatView(alice.page);

    await view.tab('groups').click();
    await view.searchBox.fill(group.name);
    await view.item(group.name).click();

    await expect(alice.app.header.titleFor(group.name)).toBeVisible();
  });

  test('CONV-23 a deleted conversation comes back when a new message arrives', async ({ data, api, loginAs }) => {
    const me = await data.user('returner');
    const peer = await data.user('peer');
    await api.messages.sendText(peer.uid, { uid: me.uid }, uniqueText('first chat'));
    const { app, page } = await loginAs(me);
    await app.conversations.item(peer.name).hover();
    await app.conversations.deleteButton(peer.name).click();
    await new ConfirmDialog(page, t('conversation_delete_title')).button(t('conversation_delete_confirm_yes')).click();
    await expect(app.conversations.item(peer.name)).toHaveCount(0);

    const text = uniqueText('back again');
    await api.messages.sendText(peer.uid, { uid: me.uid }, text);

    await expect(app.conversations.item(peer.name)).toContainText(text);
  });
});
