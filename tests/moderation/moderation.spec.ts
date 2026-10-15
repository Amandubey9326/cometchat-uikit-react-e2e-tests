import { t } from '@i18n/t';
import { uniqueMarker, uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';

/**
 * The app's moderation rules (ENV-003) block, among others, phone numbers and e-mail addresses
 * (regex rules — deterministic) and AI-detected spam/toxicity (not deterministic; not asserted here).
 *
 * Not automated: "disable the rule → the same text is allowed". Toggling rules changes the shared
 * app's dashboard configuration, which the framework must not do (docs/coverage-matrix.md: BLOCKED).
 */
test.describe('Moderation', { tag: ['@moderation', '@regression'] }, () => {
  const blocked = [
    { rule: 'phone number', text: (m: string) => `Call me about the ${m} plan on 415 555 0199 tonight` },
    { rule: 'e-mail address', text: (m: string) => `Send the ${m} notes to jane.doe.${m.split(' ')[0]}@example.com please` },
  ];
  for (const b of blocked) {
    test(`MOD-01 a message with a ${b.rule} is blocked in a 1:1 chat and never reaches the receiver`, { tag: '@critical' }, async ({ alice, bob }) => {
      await alice.app.openChatWith(bob.user);
      await bob.app.openChatWith(alice.user);
      const text = b.text(uniqueMarker());
      const after = uniqueText('after the blocked one');

      await alice.app.composer.sendWithEnter(text);

      const bubble = alice.app.messages.message(text);
      await expect(bubble.blockedNotice).toBeVisible();
      await expect(bubble.receipt('error')).toBeVisible();
      await alice.app.sendAndConfirm(after);
      await expect(bob.app.messages.message(after).root).toBeVisible(); // sync point: later messages arrive
      await expect(bob.app.messages.message(text).root).toHaveCount(0);
    });
  }

  test('MOD-02 a blocked message in a group reaches no other member', async ({ alice, bob, carol, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user, carol.user] });
    await alice.app.openGroup(group.name);
    await bob.app.openGroup(group.name);
    await carol.app.openGroup(group.name);
    const text = blocked[1].text(uniqueMarker());
    const after = uniqueText('group follow-up');

    await alice.app.composer.sendWithEnter(text);

    await expect(alice.app.messages.message(text).blockedNotice).toBeVisible();
    await alice.app.sendAndConfirm(after);
    for (const member of [bob, carol]) {
      await expect(member.app.messages.message(after).root).toBeVisible();
      await expect(member.app.messages.message(text).root).toHaveCount(0);
    }
  });

  test('MOD-03 ordinary sentences with small numbers are not blocked (no false positives)', async ({ alice, bob }) => {
    await alice.app.openChatWith(bob.user);
    await bob.app.openChatWith(alice.user);
    const text = `See you at 5 near gate 12 for the ${uniqueMarker()} tour`;

    await alice.app.sendAndConfirm(text);

    await expect(alice.app.messages.message(text).blockedNotice).toHaveCount(0);
    await expect(bob.app.messages.message(text).root).toBeVisible();
  });

  test('MOD-04 the blocked notice is still shown to the sender after a reload', async ({ alice, data, api }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const ok = uniqueText('before');
    await alice.app.sendAndConfirm(ok);
    await api.users.waitForConversation(alice.user.uid, peer.uid);
    const text = blocked[0].text(uniqueMarker());
    await alice.app.composer.sendWithEnter(text);
    await expect(alice.app.messages.message(text).blockedNotice).toBeVisible();

    await alice.app.reload();
    await alice.app.openConversation(peer.name);

    await expect(alice.app.messages.message(ok).root).toBeVisible();
    await expect(alice.app.messages.message(text).blockedNotice).toBeVisible();
  });

  test('MOD-07 editing a message to add an e-mail address does not leak it to the receiver', async ({ alice, data, api, loginAs }) => {
    const peer = await data.user('modpeer');
    const receiver = await loginAs(peer);
    await alice.app.openChatWith(peer);
    await receiver.app.openChatWith(alice.user);
    const original = uniqueText('clean before edit');
    await alice.app.sendAndConfirm(original);
    await expect(receiver.app.messages.message(original).root).toBeVisible();
    await api.users.waitForConversation(alice.user.uid, peer.uid); // BUG-012: edits inside the new-chat window fail

    await alice.app.messages.message(original).choose(t('message_list_option_edit'));
    await expect(alice.app.composer.editPreview).toBeVisible();
    await alice.app.composer.clear();
    await alice.app.composer.type(blocked[1].text(uniqueMarker()));
    await alice.app.composer.input.press('Enter');

    const after = uniqueText('after the edit');
    await alice.app.sendAndConfirm(after);
    await expect(receiver.app.messages.message(after).root).toBeVisible(); // sync point: later messages arrive
    await expect(receiver.app.messages.log).not.toContainText('@example.com');
  });

  test('MOD-08 a blocked thread reply reaches neither the thread nor the main chat of the receiver', async ({ alice, data, api, loginAs }) => {
    const peer = await data.user('threadpeer');
    const receiver = await loginAs(peer);
    await alice.app.openChatWith(peer);
    await receiver.app.openChatWith(alice.user);
    const parent = uniqueText('thread parent');
    await alice.app.sendAndConfirm(parent);
    await api.users.waitForConversation(alice.user.uid, peer.uid); // BUG-012: thread replies inside the window fail
    const text = blocked[0].text(uniqueMarker());
    const after = uniqueText('allowed thread reply');

    await alice.app.messages.message(parent).choose(t('message_list_option_reply_in_thread'));
    await alice.app.thread.composer.sendWithEnter(text);
    await expect(alice.app.thread.messages.message(text).blockedNotice).toBeVisible();
    await alice.app.thread.composer.sendWithEnter(after);
    await expect(alice.app.thread.messages.message(after).receipt('sending')).toHaveCount(0);

    await receiver.app.messages.message(parent).threadRepliesButton.click();
    await expect(receiver.app.thread.messages.message(after).root).toBeVisible();
    await expect(receiver.app.thread.messages.message(text).root).toHaveCount(0);
    await expect(receiver.app.messages.message(text).root).toHaveCount(0);
  });

  test('MOD-09 a blocked message never shows in the receiver\'s Chats preview or unread count', async ({ alice, data, loginAs }) => {
    const peer = await data.user('listpeer');
    const receiver = await loginAs(peer);
    await alice.app.openChatWith(peer);
    const first = uniqueText('first allowed');
    await alice.app.sendAndConfirm(first);
    const item = receiver.app.conversations.item(alice.user.name);
    await expect(item).toContainText(first);

    const text = blocked[1].text(uniqueMarker());
    await alice.app.composer.sendWithEnter(text);
    await expect(alice.app.messages.message(text).blockedNotice).toBeVisible();
    const after = uniqueText('second allowed');
    await alice.app.sendAndConfirm(after);

    await expect(item).toContainText(after); // sync point
    await expect(item).not.toContainText('@example.com');
    await expect(item).toHaveAccessibleName(receiver.app.conversations.unreadLabel(2));
  });
});
