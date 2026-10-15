import { t } from '@i18n/t';
import { uniqueSentences, uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { MessageInfoPanel } from '@pages/components/Dialogs';
import { LoginPage } from '@pages/auth/LoginPage';
import { delayResponse } from '@utils/network';

test.describe('Message delivery', { tag: ['@messaging', '@regression'] }, () => {
  test('MSG-11 the receiver gets a 1:1 message live in the open chat', { tag: '@critical' }, async ({ alice, bob }) => {
    await bob.app.openChatWith(alice.user);
    await alice.app.openChatWith(bob.user);
    const text = uniqueText('live');

    await alice.app.composer.sendWithEnter(text);

    await expect(bob.app.messages.message(text).root).toBeVisible();
  });

  test('MSG-12 every group member gets the message live', { tag: '@critical' }, async ({ alice, bob, carol, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user, carol.user] });
    for (const u of [alice, bob, carol]) await u.app.openGroup(group.name);
    const text = uniqueText('group');

    await alice.app.composer.sendWithEnter(text);

    await expect(bob.app.messages.message(text).root).toBeVisible();
    await expect(carol.app.messages.message(text).root).toBeVisible();
  });

  test(
    'MSG-13 ten messages typed in quick succession all arrive, in order, on both sides',
    { annotation: { type: 'bug', description: 'BUG-007 — Enter is ignored while the previous message is still "Sending"; the text stays in the composer' } },
    async ({ alice, data, loginAs }) => {
    test.fail(true, 'BUG-007');
    // Arrange — an isolated conversation, receiver online in the chat.
    const peer = await data.user('rapid');
    const receiver = await loginAs(peer);
    await alice.app.openChatWith(peer);
    await receiver.app.openChatWith(alice.user);
    const { marker, texts } = uniqueSentences(10, 'rapid');

    // Act — type and press Enter for each, as fast as a user can.
    for (const text of texts) await alice.app.composer.sendWithEnter(text);

    // Assert
    for (const side of [alice, receiver]) {
      const ours = side.app.messages.messages.filter({ hasText: marker });
      await expect(ours).toHaveCount(10);
      await expect(ours.locator('.cometchat-text-bubble__body-text')).toHaveText(texts);
    }
    }
  );

  test('MSG-14 receipts: "Sent" while the receiver is offline', async ({ alice, data }) => {
    const peer = await data.user('away');
    await alice.app.openChatWith(peer);
    const text = uniqueText('status check');

    await alice.app.composer.sendWithEnter(text);

    await expect(alice.app.messages.message(text).receipt('sent')).toBeVisible();
  });

  test('MSG-14 receipts: "Delivered" once the receiver is online', { tag: '@critical' }, async ({ alice, data, loginAs }) => {
    const peer = await data.user('present');
    await loginAs(peer); // online, on Home
    await alice.app.openChatWith(peer);
    const text = uniqueText('status check');

    await alice.app.composer.sendWithEnter(text);

    await expect(alice.app.messages.message(text).receipt('delivered')).toBeVisible();
  });

  test(
    'MSG-14b receipts: "Read" once the receiver opens the chat',
    { tag: '@critical', annotation: { type: 'bug', description: 'BUG-010 — opening a chat (conversation/read) never produces a read receipt' } },
    async ({ alice, data, api, loginAs }) => {
      test.fail(true, 'BUG-010');
      const peer = await data.user('present');
      const receiver = await loginAs(peer);
      await alice.app.openChatWith(peer);
      const text = uniqueText('status check');
      await alice.app.composer.sendWithEnter(text);
      const bubble = alice.app.messages.message(text);
      await expect(bubble.receipt('delivered')).toBeVisible();
      await api.users.waitForConversation(peer.uid, alice.user.uid); // BUG-012: reads inside the window are rejected

      await receiver.app.openConversation(alice.user.name);
      await expect(receiver.app.messages.message(text).root).toBeVisible();

      await expect(bubble.receipt('read')).toBeVisible();
    }
  );

  // Intermittent (BUG-010): failed 1 of 2 runs. Kept as a plain regression test — a failure here is a real product failure.
  test(
    'MSG-14c receipts: "Read" at once when the receiver already has the chat open',
    { tag: '@critical', annotation: { type: 'issue', description: 'BUG-010 (intermittent on this path)' } },
    async ({ alice, data, api, loginAs }) => {
      const peer = await data.user('present');
      const receiver = await loginAs(peer);
      await alice.app.openChatWith(peer);
      await alice.app.sendAndConfirm(uniqueText('opening line'));
      await api.users.waitForConversation(peer.uid, alice.user.uid); // BUG-012
      await receiver.app.openConversation(alice.user.name);
      const text = uniqueText('seen live');

      await alice.app.sendAndConfirm(text);
      await expect(receiver.app.messages.message(text).root).toBeVisible();

      await expect(alice.app.messages.message(text).receipt('read')).toBeVisible();
    }
  );

  test(
    'MSG-15 group Message Info lists who read the message',
    { annotation: { type: 'bug', description: 'BUG-010 — opening a group chat never produces a read receipt' } },
    async ({ alice, bob, carol, data, api }) => {
      test.fail(true, 'BUG-010');
      const group = await data.group({ owner: alice.user, participants: [bob.user, carol.user] });
      await alice.app.openGroup(group.name);
      const text = uniqueText('info');
      await alice.app.sendAndConfirm(text);
      await api.users.waitForConversation(bob.user.uid, group.guid); // BUG-012

      await bob.app.openGroup(group.name); // Bob reads it; Carol does not open the group
      await expect(bob.app.messages.message(text).root).toBeVisible();

      await alice.app.messages.message(text).choose(t('message_list_option_info'));
      const info = new MessageInfoPanel(alice.page);
      await expect(info.dialog).toBeVisible();
      const bobRow = info.receipts.filter({ hasText: bob.user.name });
      await expect(bobRow).toContainText(t('message_information_read'));
      const carolRow = info.receipts.filter({ hasText: carol.user.name });
      await expect(carolRow).not.toContainText(t('message_information_read'));
    }
  );

  test('MSG-16 messages show a time and a "Today" date separator', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const text = uniqueText('time');

    await alice.app.sendAndConfirm(text);

    await expect(alice.app.messages.dateSeparators.first()).toHaveText(t('date_today'));
    await expect(alice.app.messages.message(text).root.getByRole('status').locator('time')).toHaveText(/^\d{1,2}:\d{2}\s?(am|pm)$/i);
  });

  test('MSG-17 messages survive a reload in the same order', { tag: '@critical' }, async ({ alice, data, api }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const { texts } = uniqueSentences(3, 'sequence');
    for (const text of texts) await alice.app.sendAndConfirm(text);
    await api.users.waitForConversation(alice.user.uid, peer.uid); // BUG-012: a reload inside the new-chat window can lose the conversation from Chats

    await alice.app.reload();
    await alice.app.openConversation(peer.name);

    await expect(alice.app.messages.messages.locator('.cometchat-text-bubble__body-text')).toHaveText(texts);
  });

  test('MSG-18/19 older messages load on scroll; a scroll-to-bottom button appears', async ({ alice, data, api }) => {
    test.setTimeout(150_000);
    // Arrange — 40 messages of history from a peer.
    const peer = await data.user('history');
    const history = uniqueSentences(40, 'history');
    for (const text of history.texts) await api.messages.sendText(peer.uid, { uid: alice.user.uid }, text);
    await api.users.waitForConversation(alice.user.uid, peer.uid);
    // History stays hidden while AI moderation is "pending" (ENV-003); assert on what the server will show.
    const shown = await api.messages.waitForModeration(alice.user.uid, peer.uid, history.marker);
    await alice.app.openConversation(peer.name);
    const { messages } = alice.app;
    const oldest = messages.message(shown[0]);
    // History sent this fast shares sentAt seconds, so its order is scrambled (BUG-009): wait for the
    // first page to render rather than for a particular "newest" message.
    await expect(messages.messages.filter({ hasText: history.marker }).first()).toBeVisible();

    // MSG-18 — scrolling up loads the oldest message.
    const scroller = messages.region.locator('.cometchat-message-list__scroll-container');
    await expect(async () => {
      await scroller.evaluate(el => el.scrollTo({ top: 0 }));
      await expect(oldest.root).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 45_000 });

    // MSG-19 — away from the bottom, a scroll-to-bottom button appears. Loading the older page can
    // restore the scroll position, so scroll up again until the list has settled.
    await expect(async () => {
      await scroller.evaluate(el => el.scrollTo({ top: 0 }));
      await expect(messages.scrollToBottomButton).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });

    // MSG-20 (new-message badge and jump to newest) is in its own test below: on this app, AI
    // moderation releases held messages late and makes it timing-dependent (OBS-019).

  });

  // OBS-019: AI moderation on this app holds new messages ("pending") and releases them late; they
  // then count as new and one scroll-to-bottom click can stop mid-list. Re-enable on an app without
  // async moderation, or once OBS-019 is understood.
  // eslint-disable-next-line playwright/expect-expect -- placeholder until OBS-019 is resolved
  test.fixme('MSG-20 a new message while scrolled up is announced, and the button jumps to it', async () => {});

  test('MSG-22 a loading indicator is shown while a conversation loads', async ({ alice, data, api }) => {
    const peer = await data.user('slow');
    await api.messages.sendText(peer.uid, { uid: alice.user.uid }, uniqueText('slow'));
    await expect(alice.app.conversations.item(peer.name)).toBeVisible();
    await delayResponse(alice.page, /\/users\/[^/]+\/messages/, { ms: 3_000 });

    await alice.app.openConversation(peer.name);

    await expect(alice.app.messages.loading).toBeVisible({ timeout: 2_500 });
  });

  test('MSG-23 a message sent while offline is delivered after reconnecting', { tag: '@network' }, async ({ alice, data }) => {
    const peer = await data.user('offline');
    await alice.app.openChatWith(peer);
    alice.net.allow(/ERR_INTERNET_DISCONNECTED|net::ERR/);
    const text = uniqueText('offline');

    await alice.context.setOffline(true);
    await alice.app.composer.sendWithEnter(text);
    const bubble = alice.app.messages.message(text);
    await expect(bubble.root).toBeVisible();
    await alice.context.setOffline(false);

    await expect(bubble.receipt('sent').or(bubble.receipt('delivered'))).toBeVisible({ timeout: 45_000 });
  });

  test('MSG-24 switching conversations clears the composer (v7 has no drafts)', async ({ alice, data }) => {
    // Documents current behaviour: UIKit v7's composer has no draft support (OBS-009).
    const first = await data.user('draft-a');
    const second = await data.user('draft-b');
    await alice.app.openChatWith(first);
    await alice.app.composer.type(uniqueText('draft'));

    await alice.app.openChatWith(second);
    await alice.app.openChatWith(first);

    await expect(alice.app.composer.input).toHaveText('');
  });

  test(
    'MSG-27 messages sent within the same second are shown in the order they were sent',
    { tag: '@critical', annotation: { type: 'bug', description: 'BUG-009 — list order is scrambled for messages sharing a sentAt second' } },
    async ({ data, api, loginAs }) => {
      test.fail(true, 'BUG-009');
      const me = await data.user('orderme');
      const peer = await data.user('orderpeer');
      // Bursts of 10 parallel sends make many messages share a `sentAt` second. The server assigns
      // increasing ids in arrival order, so id order is the true send order.
      const { marker, texts } = uniqueSentences(30, 'order');
      const sent: Array<{ id: string; text: string }> = [];
      for (let i = 0; i < texts.length; i += 10) {
        const burst = texts.slice(i, i + 10);
        const results = await Promise.all(burst.map(text => api.messages.sendText(peer.uid, { uid: me.uid }, text)));
        results.forEach((m, j) => sent.push({ id: m.id, text: burst[j] }));
      }
      const expected = [...sent].sort((a, b) => Number(a.id) - Number(b.id)).map(m => m.text);
      const { app } = await loginAs(me);

      await app.openConversation(peer.name);

      await expect(app.messages.messages.filter({ hasText: marker }).locator('.cometchat-text-bubble__text')).toHaveText(expected);
    }
  );

  test('MSG-25 messages are still there after logout and login', async ({ data, api, loginAs }) => {
    const me = await data.user('relogin');
    const peer = await data.user('peer');
    const { app, page } = await loginAs(me);
    await app.openChatWith(peer);
    const text = uniqueText('relogin');
    await app.sendAndConfirm(text);
    await api.users.waitForConversation(me.uid, peer.uid); // BUG-012

    await app.home.logout();
    await new LoginPage(page).loginWithUid(me.uid);
    await app.home.waitForReady();
    await app.openConversation(peer.name);

    await expect(app.messages.message(text).root).toBeVisible();
  });
});
