import { t } from '@i18n/t';
import { uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { toast } from '@pages/components/Dialogs';

const JOY = { name: 'joy', char: '😂' };
const HEART_EYES = { name: 'heart_eyes', char: '😍' };

test.describe('Reactions', { tag: ['@reactions', '@regression'] }, () => {
  test('REA-01 reacting adds a reaction with count 1', { tag: '@critical' }, async ({ alice, data, api }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const text = uniqueText('react to me');
    await alice.app.sendAndConfirm(text);
    await api.users.waitForConversation(alice.user.uid, peer.uid); // BUG-012: not before the conversation exists
    const bubble = alice.app.messages.message(text);

    await bubble.react(JOY.name);

    await expect(bubble.reaction(JOY.char)).toHaveAccessibleName(t('accessibility_reacted_by', { emoji: JOY.char, count: 1 }));
  });

  test('REA-02 clicking my own reaction removes it', async ({ alice, data, api }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const text = uniqueText('undo reaction');
    await alice.app.sendAndConfirm(text);
    await api.users.waitForConversation(alice.user.uid, peer.uid); // BUG-012: not before the conversation exists
    const bubble = alice.app.messages.message(text);
    await bubble.react(JOY.name);
    await expect(bubble.reaction(JOY.char)).toBeVisible();

    await bubble.reaction(JOY.char).click();

    await expect(bubble.reaction(JOY.char)).toHaveCount(0);
  });

  test('REA-03 different reactions on one message are shown side by side', async ({ alice, data, api }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const text = uniqueText('many reactions');
    await alice.app.sendAndConfirm(text);
    await api.users.waitForConversation(alice.user.uid, peer.uid); // BUG-012: not before the conversation exists
    const bubble = alice.app.messages.message(text);

    await bubble.react(JOY.name);
    await bubble.react(HEART_EYES.name);

    await expect(bubble.reaction(JOY.char)).toBeVisible();
    await expect(bubble.reaction(HEART_EYES.char)).toBeVisible();
  });

  test('REA-04 the same reaction from two users counts 2 on both sides, live', { tag: '@critical' }, async ({ alice, data, api, loginAs }) => {
    const peer = await data.user('fan');
    const other = await loginAs(peer);
    await alice.app.openChatWith(peer);
    await other.app.openChatWith(alice.user);
    const text = uniqueText('shared reaction');
    await alice.app.sendAndConfirm(text);
    await api.users.waitForConversation(alice.user.uid, peer.uid); // BUG-012

    await alice.app.messages.message(text).react(JOY.name);
    await other.app.messages.message(text).react(JOY.name);

    const two = t('accessibility_reacted_by', { emoji: JOY.char, count: 2 });
    await expect(alice.app.messages.message(text).reaction(JOY.char)).toHaveAccessibleName(two);
    await expect(other.app.messages.message(text).reaction(JOY.char)).toHaveAccessibleName(two);
  });

  test('REA-05 the reaction list shows who reacted', async ({ alice, data, loginAs }) => {
    const peer = await data.user('fan');
    const other = await loginAs(peer);
    await alice.app.openChatWith(peer);
    await other.app.openChatWith(alice.user);
    const text = uniqueText('who reacted');
    await alice.app.sendAndConfirm(text);
    await other.app.messages.message(text).react(JOY.name);
    const chip = alice.app.messages.message(text).reaction(JOY.char);
    await expect(chip).toBeVisible();

    await chip.hover();

    await expect(alice.page.getByRole('tooltip')).toContainText(peer.name);
  });

  test('REA-06 reactions survive a reload', async ({ alice, data, api }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const text = uniqueText('keep reaction');
    await alice.app.sendAndConfirm(text);
    await api.users.waitForConversation(alice.user.uid, peer.uid); // BUG-012: not before the conversation exists
    await alice.app.messages.message(text).react(JOY.name);
    await expect(alice.app.messages.message(text).reaction(JOY.char)).toBeVisible();

    await alice.app.reload();
    await alice.app.openConversation(peer.name);

    await expect(alice.app.messages.message(text).reaction(JOY.char)).toBeVisible();
  });

  test('REA-07 reactions work in a group and inside a thread', async ({ alice, bob, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    await alice.app.openGroup(group.name);
    await bob.app.openGroup(group.name);
    const text = uniqueText('group reaction');
    await alice.app.sendAndConfirm(text);

    await bob.app.messages.message(text).react(JOY.name);
    await expect(alice.app.messages.message(text).reaction(JOY.char)).toBeVisible();

    await alice.app.messages.message(text).choose(t('message_list_option_reply_in_thread'));
    const reply = uniqueText('thread reaction');
    await alice.app.thread.composer.sendWithEnter(reply);
    await alice.app.thread.messages.message(reply).react(HEART_EYES.name);
    await expect(alice.app.thread.messages.message(reply).reaction(HEART_EYES.char)).toBeVisible();
  });

  test(
    'REA-08 the reaction picker closes with Escape',
    { tag: '@a11y', annotation: { type: 'bug', description: 'A11Y-008 — Escape does not close the reaction picker' } },
    async ({ alice, data }) => {
      test.fail(true, 'A11Y-008');
      const peer = await data.user('peer');
      await alice.app.openChatWith(peer);
      const text = uniqueText('escape picker');
      await alice.app.sendAndConfirm(text);
      const bubble = alice.app.messages.message(text);
      await bubble.showToolbar();
      await bubble.toolbar.getByRole('button', { name: t('message_list_option_react') }).click();
      await expect(alice.app.emojiKeyboard.dialog).toBeVisible();

      await alice.page.keyboard.press('Escape');

      await expect(alice.app.emojiKeyboard.dialog).toBeHidden({ timeout: 3_000 });
    }
  );

  test(
    'REA-09 a reaction the server rejects is reported to the user',
    { tag: '@network', annotation: { type: 'bug', description: 'BUG-012 — a rejected reaction silently disappears; the user is not told' } },
    async ({ alice, data, api }) => {
      test.fail(true, 'BUG-012');
      const peer = await data.user('peer');
      await alice.app.openChatWith(peer);
      const text = uniqueText('rejected reaction');
      await alice.app.sendAndConfirm(text);
      await api.users.waitForConversation(alice.user.uid, peer.uid);
      // Reproduce the server's answer inside the new-conversation window (403 ERR_MESSAGE_NO_ACCESS).
      alice.net.allow(/\/reactions\//);
      await alice.page.route(/\/messages\/\d+\/reactions\//, route =>
        route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'ERR_MESSAGE_NO_ACCESS', message: 'The user does not have access to the message.' } }),
        })
      );
      const bubble = alice.app.messages.message(text);

      await bubble.react(JOY.name);

      await expect(bubble.reaction(JOY.char)).toHaveCount(0);
      await expect(alice.page.getByRole('alert').or(toast(alice.page))).toBeVisible({ timeout: 5_000 });
    }
  );
});
