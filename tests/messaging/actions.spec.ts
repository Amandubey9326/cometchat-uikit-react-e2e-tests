import { t } from '@i18n/t';
import { uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { ConfirmDialog, MessageInfoPanel, ReportDialog, toast } from '@pages/components/Dialogs';

const OPT = {
  thread: t('message_list_option_reply_in_thread'),
  copy: t('message_list_option_copy'),
  edit: t('message_list_option_edit'),
  delete: t('message_list_option_delete'),
  info: t('message_list_option_info'),
  translate: t('message_list_translate'),
  report: t('message_list_option_flag_message'),
  unread: t('message_list_option_mark_as_unread'),
  privately: t('message_list_option_message_privately'),
};

test.describe('Message actions', { tag: ['@messaging', '@regression'] }, () => {
  test('ACT-01 my own message offers Reply in thread, Copy, Edit, Delete and Info', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const text = uniqueText('mine');
    await alice.app.sendAndConfirm(text);

    const menu = await alice.app.messages.message(text).openOptions();

    for (const name of [OPT.thread, OPT.copy, OPT.edit, OPT.delete, OPT.info]) {
      await expect(menu.getByRole('menuitem', { name, exact: true })).toBeVisible();
    }
  });

  test('ACT-02 an incoming message offers no Edit or Delete to a normal user', async ({ alice, bob }) => {
    await alice.app.openChatWith(bob.user);
    const text = uniqueText('theirs');
    await alice.app.sendAndConfirm(text);
    await bob.app.openConversation(alice.user.name);

    const menu = await bob.app.messages.message(text).openOptions();

    for (const name of [OPT.thread, OPT.copy, OPT.report, OPT.unread]) {
      await expect(menu.getByRole('menuitem', { name, exact: true })).toBeVisible();
    }
    await expect(menu.getByRole('menuitem', { name: OPT.edit, exact: true })).toHaveCount(0);
    await expect(menu.getByRole('menuitem', { name: OPT.delete, exact: true })).toHaveCount(0);
  });

  test('ACT-03 editing a message updates it for both users and survives a reload', { tag: '@critical' }, async ({ alice, data, api, loginAs }) => {
    // Arrange — isolated pair, both in the chat.
    const peer = await data.user('editpeer');
    const receiver = await loginAs(peer);
    await alice.app.openChatWith(peer);
    await receiver.app.openChatWith(alice.user);
    const original = uniqueText('before edit');
    const edited = uniqueText('after edit');
    await alice.app.sendAndConfirm(original);

    // Act
    await alice.app.messages.message(original).choose(OPT.edit);
    await expect(alice.app.composer.editPreview).toBeVisible();
    await expect(alice.app.composer.input).toHaveText(original);
    await alice.app.composer.clear();
    await alice.app.composer.type(edited);
    await alice.app.composer.input.press('Enter');

    // Assert — sender, receiver (live), receiver after reload.
    await expect(alice.app.messages.message(edited).editedLabel).toBeVisible();
    await expect(alice.app.messages.message(original).root).toHaveCount(0);
    await expect(receiver.app.messages.message(edited).editedLabel).toBeVisible();
    await api.users.waitForConversation(peer.uid, alice.user.uid); // BUG-012: a reload inside the new-chat window can lose the conversation from Chats
    await receiver.app.reload();
    await receiver.app.openConversation(alice.user.name);
    await expect(receiver.app.messages.message(edited).editedLabel).toBeVisible();
  });

  test('ACT-04 cancelling an edit leaves the message unchanged', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const text = uniqueText('keep');
    await alice.app.sendAndConfirm(text);

    await alice.app.messages.message(text).choose(OPT.edit);
    await expect(alice.app.composer.editPreview).toBeVisible();
    await alice.app.composer.editPreview.getByRole('button').click();

    await expect(alice.app.composer.editPreview).toBeHidden();
    await expect(alice.app.composer.input).toHaveText('');
    await expect(alice.app.messages.message(text).editedLabel).toHaveCount(0);
  });

  // UIKit v7 fetches history with hideDeletedMessages(true): the "deleted" placeholder is shown live,
  // but after a reload the message is gone altogether (OBS-018). Both are asserted as they are today.
  test('ACT-05 deleting a message shows "deleted" for both users; after a reload it is gone', { tag: '@critical' }, async ({ alice, data, api, loginAs }) => {
    const peer = await data.user('delpeer');
    const receiver = await loginAs(peer);
    await alice.app.openChatWith(peer);
    await receiver.app.openChatWith(alice.user);
    const text = uniqueText('remove me');
    await alice.app.sendAndConfirm(text);
    await expect(receiver.app.messages.message(text).root).toBeVisible();
    await api.users.waitForConversation(peer.uid, alice.user.uid); // BUG-012: deletes inside the new-chat window are rejected

    await alice.app.messages.message(text).choose(OPT.delete);
    const confirm = new ConfirmDialog(alice.page, t('message_list_option_delete'));
    await expect(confirm.dialog).toContainText(t('message_list_delete_confirm'));
    await confirm.button(t('message_list_option_delete')).click();

    for (const side of [alice, receiver]) {
      await expect(side.app.messages.message(text).root).toHaveCount(0);
      await expect(side.app.messages.deleted()).toHaveCount(1);
    }
    await receiver.app.reload();
    const history = receiver.page.waitForResponse(r => /\/users\/[^/]+\/messages\?/.test(r.url()) && r.status() === 200);
    await receiver.app.openConversation(alice.user.name);
    await history;
    await expect(receiver.app.messages.message(text).root).toHaveCount(0);
  });

  // Delete/Edit are sender-only in UIKit v7 (CometChatMessageOptions: senderOnly) and the docs give no
  // group scope the right to remove other members' messages — so nobody else gets them.
  test('ACT-06 in a group only the sender may edit or delete a message, even for the owner', { tag: '@permissions' }, async ({ alice, erin, data }) => {
    const group = await data.group({ owner: alice.user, participants: [erin.user] });
    await alice.app.openGroup(group.name);
    await erin.app.openGroup(group.name);
    const fromErin = uniqueText('erin says');
    const fromAlice = uniqueText('alice says');
    await erin.app.sendAndConfirm(fromErin);
    await alice.app.sendAndConfirm(fromAlice);

    const ownerMenu = await alice.app.messages.message(fromErin).openOptions();
    await expect(ownerMenu.getByRole('menuitem', { name: OPT.thread, exact: true })).toBeVisible();
    await expect(ownerMenu.getByRole('menuitem', { name: OPT.delete, exact: true })).toHaveCount(0);
    await expect(ownerMenu.getByRole('menuitem', { name: OPT.edit, exact: true })).toHaveCount(0);

    const participantMenu = await erin.app.messages.message(fromAlice).openOptions();
    await expect(participantMenu.getByRole('menuitem', { name: OPT.delete, exact: true })).toHaveCount(0);
    await expect(participantMenu.getByRole('menuitem', { name: OPT.edit, exact: true })).toHaveCount(0);
  });

  test('ACT-07 a reply quotes the original for both users', async ({ alice, data, loginAs, api }) => {
    const peer = await data.user('quoter');
    const receiver = await loginAs(peer);
    const original = uniqueText('original');
    await api.messages.sendText(peer.uid, { uid: alice.user.uid }, original);
    await alice.app.openConversation(peer.name);
    await receiver.app.openChatWith(alice.user);
    const answer = uniqueText('answer');

    await alice.app.messages.message(original).reply();
    await expect(alice.app.composer.replyPreview).toContainText(original);
    await alice.app.composer.sendWithEnter(answer);

    await expect(alice.app.messages.message(answer).quote).toContainText(original);
    await expect(receiver.app.messages.message(answer).quote).toContainText(original);
    await expect(alice.app.composer.replyPreview).toBeHidden();
  });

  test('ACT-08 a reply can be cancelled before sending', async ({ alice, data, api }) => {
    const peer = await data.user('peer');
    const original = uniqueText('original');
    await api.messages.sendText(peer.uid, { uid: alice.user.uid }, original);
    await alice.app.openConversation(peer.name);

    await alice.app.messages.message(original).reply();
    await expect(alice.app.composer.replyPreview).toBeVisible();
    await alice.app.composer.replyPreview.getByRole('button').click();

    await expect(alice.app.composer.replyPreview).toBeHidden();
  });

  test('ACT-09 Copy shows a confirmation and puts the text on the clipboard', async ({ alice, data, browserName }) => {
    test.skip(browserName !== 'chromium', 'Clipboard permissions are Chromium-only in Playwright');
    await alice.context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const text = uniqueText('copy me');
    await alice.app.sendAndConfirm(text);

    await alice.app.messages.message(text).choose(OPT.copy);

    await expect(toast(alice.page, t('message_list_message_copied'))).toBeVisible();
    // The toast can appear before the asynchronous clipboard write has landed.
    await expect.poll(() => alice.page.evaluate(() => navigator.clipboard.readText())).toBe(text);
  });

  test('ACT-10 Info opens the Message Information panel', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const text = uniqueText('details');
    await alice.app.sendAndConfirm(text);

    await alice.app.messages.message(text).choose(OPT.info);

    const info = new MessageInfoPanel(alice.page);
    await expect(info.dialog).toBeVisible();
    await expect(info.dialog).toContainText(text);
  });

  test('ACT-11 a message can be reported with a reason', async ({ alice, bob }) => {
    await alice.app.openChatWith(bob.user);
    const text = uniqueText('report');
    await alice.app.sendAndConfirm(text);
    await bob.app.openConversation(alice.user.name);

    await bob.app.messages.message(text).choose(OPT.report);
    const report = new ReportDialog(bob.page);
    await expect(report.dialog).toBeVisible();
    await report.reasons.getByRole('radio').first().click();
    await report.submit.click();

    await expect(report.dialog).toBeHidden();
    await expect(bob.page.getByText(t('flag_message_reported'))).toBeVisible();
  });

  test('ACT-11 the report dialog can be cancelled', async ({ alice, bob }) => {
    await alice.app.openChatWith(bob.user);
    const text = uniqueText('no report');
    await alice.app.sendAndConfirm(text);
    await bob.app.openConversation(alice.user.name);

    await bob.app.messages.message(text).choose(OPT.report);
    const report = new ReportDialog(bob.page);
    await report.cancel.click();

    await expect(report.dialog).toBeHidden();
  });

  test('ACT-12 Translate shows a translation of a foreign-language message', { tag: '@extensions' }, async ({ alice, bob }) => {
    await alice.app.openChatWith(bob.user);
    const text = `Hola, nos vemos mañana en la biblioteca con ${uniqueText('es')}`;
    await alice.app.sendAndConfirm(text);
    await bob.app.openConversation(alice.user.name);

    await bob.app.messages.message(text).choose(OPT.translate);

    const bubble = bob.app.messages.message(text);
    await expect(bubble.translationLabel).toBeVisible();
    await expect(bubble.translation).not.toBeEmpty();
    await expect(bubble.translation).toContainText(/library/i); // "biblioteca" translated to the UI language
  });

  test('ACT-13 "Message Privately" on a group message opens a 1:1 chat with the sender', async ({ alice, erin, data }) => {
    const group = await data.group({ owner: alice.user, participants: [erin.user] });
    await erin.app.openGroup(group.name);
    const fromErin = uniqueText('group note');
    await erin.app.sendAndConfirm(fromErin);
    await alice.app.openGroup(group.name);
    const fromAlice = uniqueText('my group note');
    await alice.app.sendAndConfirm(fromAlice);

    await alice.app.messages.message(fromErin).choose(OPT.privately);

    await expect(alice.app.header.titleFor(erin.user.name)).toBeVisible();
    await alice.app.openGroup(group.name);
    const ownMenu = await alice.app.messages.message(fromAlice).openOptions();
    await expect(ownMenu.getByRole('menuitem', { name: OPT.thread, exact: true })).toBeVisible();
    await expect(ownMenu.getByRole('menuitem', { name: OPT.privately, exact: true })).toHaveCount(0);
  });

  test('ACT-14 a deleted message offers no actions', async ({ alice, data, api }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const text = uniqueText('gone');
    await alice.app.sendAndConfirm(text);
    await api.users.waitForConversation(alice.user.uid, peer.uid); // BUG-012: deletes are rejected (403) before
    await alice.app.messages.message(text).choose(OPT.delete);
    await new ConfirmDialog(alice.page, t('message_list_option_delete')).button(t('message_list_option_delete')).click();

    await expect(alice.app.messages.message(text).root).toHaveCount(0);
    await expect(alice.app.messages.deleted()).toHaveCount(1);
    // The only message left is the deleted one, so the log must hold no message toolbar at all.
    await expect(alice.app.messages.log.getByRole('toolbar')).toHaveCount(0);
  });

  test(
    'ACT-15 the message toolbar becomes visible when reached with the keyboard',
    { tag: '@a11y', annotation: { type: 'bug', description: 'A11Y-007 — toolbar stays at opacity 0 while its buttons have keyboard focus' } },
    async ({ alice, data }) => {
      test.fail(true, 'A11Y-007');
      const peer = await data.user('peer');
      await alice.app.openChatWith(peer);
      const text = uniqueText('keyboard');
      await alice.app.sendAndConfirm(text);
      const bubble = alice.app.messages.message(text);

      await bubble.toolbar.getByRole('button', { name: t('accessibility_more_options') }).focus();

      await expect(bubble.toolbar).toHaveCSS('opacity', '1', { timeout: 3_000 });
    }
  );

  // The menu takes focus one animation frame after it opens and only handles Escape while it has
  // focus; an Escape pressed inside that first frame is lost (OBS-016, formerly A11Y-009). When the
  // menu was opened with the mouse, focus does not return to "More options" (keyboard: A11Y-02b).
  test('ACT-16 the message options menu closes with Escape', { tag: '@a11y' }, async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const text = uniqueText('menu escape');
    await alice.app.sendAndConfirm(text);
    const menu = await alice.app.messages.message(text).openOptions();
    await expect(menu.getByRole('menuitem').first()).toBeFocused();

    await alice.page.keyboard.press('Escape');

    await expect(menu).toBeHidden();
  });
});
