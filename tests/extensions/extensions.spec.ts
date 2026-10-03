import { t } from '@i18n/t';
import { uniqueMarker, uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { CreatePollDialog, PollBubble } from '@pages/extensions/Polls';
import { escapeRegExp } from '@utils/text';

/**
 * Extensions enabled on the app (found in Phase 0 discovery): Polls, Collaborative Document,
 * Collaborative Whiteboard, Stickers (CMP-09), Message Translation (ACT-12), Link Preview.
 */
test.describe('Extensions', { tag: ['@extensions', '@regression'] }, () => {
  test('EXT-01 a poll is created and both sides see it, also after reload', { tag: '@critical' }, async ({ alice, bob, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    await alice.app.openGroup(group.name);
    await bob.app.openGroup(group.name);
    const question = `Where should we meet for the ${uniqueMarker()} picnic?`;
    const answers = ['Riverside park', 'Old town square'];

    await alice.app.composer.chooseAttachmentOption(t('message_composer_polls'));
    await new CreatePollDialog(alice.page).create(question, answers);

    for (const side of [alice, bob]) {
      const poll = new PollBubble(side.app.messages.log, question);
      await expect(poll.root).toBeVisible();
      for (const answer of answers) await expect(poll.option(answer)).toHaveAccessibleName(PollBubble.votes(answer, 0));
    }
    await bob.app.reload();
    await bob.app.openGroup(group.name);
    await expect(new PollBubble(bob.app.messages.log, question).root).toBeVisible();
  });

  test('EXT-02 a vote is counted live for everyone and survives a reload', { tag: '@critical' }, async ({ alice, bob, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    await alice.app.openGroup(group.name);
    await bob.app.openGroup(group.name);
    const question = `Which day suits the ${uniqueMarker()} workshop?`;
    await alice.app.composer.chooseAttachmentOption(t('message_composer_polls'));
    await new CreatePollDialog(alice.page).create(question, ['Tuesday', 'Thursday']);
    const bobsPoll = new PollBubble(bob.app.messages.log, question);
    await expect(bobsPoll.root).toBeVisible();

    await bobsPoll.option('Thursday').click();

    await expect(bobsPoll.option('Thursday')).toHaveAttribute('aria-checked', 'true');
    const alicesPoll = new PollBubble(alice.app.messages.log, question);
    await expect(alicesPoll.option('Thursday')).toHaveAccessibleName(PollBubble.votes('Thursday', 1));
    await expect(alicesPoll.option('Tuesday')).toHaveAccessibleName(PollBubble.votes('Tuesday', 0));
    await alice.app.reload();
    await alice.app.openGroup(group.name);
    await expect(alicesPoll.option('Thursday')).toHaveAccessibleName(PollBubble.votes('Thursday', 1));
  });

  test('EXT-03 Create stays disabled until the question and two answers are filled', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    await alice.app.composer.chooseAttachmentOption(t('message_composer_polls'));
    const dialog = new CreatePollDialog(alice.page);
    await expect(dialog.dialog).toBeVisible();

    await expect(dialog.createButton).toBeDisabled();
    await dialog.question.fill('Is this ready?');
    await dialog.options.nth(0).fill('Yes');
    await expect(dialog.createButton).toBeDisabled();
    await dialog.options.nth(1).fill('No');
    await expect(dialog.createButton).toBeEnabled();

    await dialog.closeButton.click();
    await expect(dialog.dialog).toBeHidden();
    await expect(alice.app.messages.messages).toHaveCount(0);
  });

  test('EXT-04 a poll accepts at most 12 answers', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    await alice.app.composer.chooseAttachmentOption(t('message_composer_polls'));
    const dialog = new CreatePollDialog(alice.page);

    for (let i = (await dialog.options.count()); i < 12; i++) await dialog.addOptionButton.click();

    await expect(dialog.options).toHaveCount(12);
    await expect(dialog.addOptionButton).toBeDisabled();
  });

  const boards = [
    { name: 'document', sheet: 'messsage_composer_collaborative_document', open: 'message_list_collaborative_document_open', title: 'message_list_collaborative_document_title' },
    { name: 'whiteboard', sheet: 'messsage_composer_collaborative_whiteboard', open: 'message_list_collaborative_whiteboard_open', title: 'message_list_collaborative_whiteboard_title' },
  ];
  for (const b of boards) {
    test(`EXT-05 a collaborative ${b.name} is shared with the receiver and opens in a new window`, async ({ alice, bob }) => {
      await alice.app.openChatWith(bob.user);
      await bob.app.openChatWith(alice.user);

      await alice.app.composer.chooseAttachmentOption(t(b.sheet));

      for (const side of [alice, bob]) {
        await expect(side.app.messages.log.getByText(t(b.title), { exact: true })).toBeVisible();
      }
      const popup = bob.page.waitForEvent('popup');
      await bob.app.messages.log.getByRole('button', { name: t(b.open) }).click();
      const board = await popup;
      expect(new URL(board.url()).protocol).toBe('https:');
      await board.close();
    });
  }

  test('EXT-06 a link gets a preview card for sender and receiver', async ({ alice, bob }) => {
    await alice.app.openChatWith(bob.user);
    await bob.app.openChatWith(alice.user);
    const text = `${uniqueText('link')} https://www.wikipedia.org`;

    await alice.app.sendAndConfirm(text);

    const card = { name: new RegExp(`^${escapeRegExp(t('accessibility_link_preview_for').replace('{domain}', ''))}(www\\.)?wikipedia\\.org$`) };
    await expect(alice.app.messages.message(text).root.getByRole('article', card)).toBeVisible({ timeout: 30_000 });
    await expect(bob.app.messages.message(text).root.getByRole('article', card)).toBeVisible({ timeout: 30_000 });
  });
});
