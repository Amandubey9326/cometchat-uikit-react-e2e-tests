import { expect, test } from '@fixtures/test.fixture';
import { CredentialsPage } from '@pages/auth/CredentialsPage';
import { CreateGroupDialog } from '@pages/groups/GroupDialogs';
import { ASSETS } from '@pages/messages/MessageComposer';

/**
 * Visual regression of screens that hold no per-run data (test users get random names, so chat
 * screens are compared element by element, never with names in view).
 * Baselines are per platform: create them with `npx playwright test --grep @visual --update-snapshots`
 * (and once more inside the CI image for Linux).
 */
const opts = { maxDiffPixelRatio: 0.01 };

test.describe('Visual', { tag: ['@visual', '@regression'] }, () => {
  test('VIS-01 credentials screen', async ({ page }) => {
    await page.goto('/');
    await new CredentialsPage(page).expectVisible();

    await expect(page).toHaveScreenshot('credentials.png', opts);
  });

  test('VIS-02 empty Chats for a new user', async ({ data, loginAs }) => {
    const { app, page } = await loginAs(await data.user('fresh'));
    await expect(app.conversations.emptyState).toBeVisible();

    await expect(page).toHaveScreenshot('home-empty-light.png', opts);
  });

  test('VIS-03 New Group dialog', async ({ alice }) => {
    await alice.app.home.openTab('groups');
    await alice.app.groups.createGroupButton.click();
    const dialog = new CreateGroupDialog(alice.page).dialog;
    await expect(dialog).toBeVisible();

    await expect(dialog).toHaveScreenshot('new-group-dialog.png', opts);
  });

  test('VIS-04/05/06 composer, emoji keyboard and attachment sheet', async ({ alice, data }) => {
    await alice.app.openChatWith(await data.user('peer'));
    const composer = alice.page.locator('.cometchat-composer-wrapper');

    await expect(composer).toHaveScreenshot('composer.png', opts);
    await alice.app.composer.emojiButton.click();
    await expect(alice.app.emojiKeyboard.dialog).toHaveScreenshot('emoji-keyboard.png', opts);
    await alice.app.composer.emojiButton.click();
    await alice.app.composer.attachmentsButton.click();
    await expect(alice.app.composer.attachmentSheet).toHaveScreenshot('attachment-sheet.png', opts);
  });

  test.describe('dark', () => {
    test.use({ colorScheme: 'dark' });

    test('VIS-07 empty Chats, dark theme', async ({ data, loginAs }) => {
      const { app, page } = await loginAs(await data.user('fresh'));
      await expect(app.conversations.emptyState).toBeVisible();

      await expect(page).toHaveScreenshot('home-empty-dark.png', opts);
    });

    test('VIS-09 composer, emoji keyboard and attachment sheet, dark theme', async ({ alice, data }) => {
      await alice.app.openChatWith(await data.user('peer'));
      const composer = alice.page.locator('.cometchat-composer-wrapper');

      await expect(composer).toHaveScreenshot('composer-dark.png', opts);
      await alice.app.composer.emojiButton.click();
      await expect(alice.app.emojiKeyboard.dialog).toHaveScreenshot('emoji-keyboard-dark.png', opts);
      await alice.app.composer.emojiButton.click();
      await alice.app.composer.attachmentsButton.click();
      await expect(alice.app.composer.attachmentSheet).toHaveScreenshot('attachment-sheet-dark.png', opts);
    });

    test('VIS-10 message list with text, image and file bubbles, dark theme', async ({ alice, data }) => {
      await alice.app.openChatWith(await data.user('peer'));
      await alice.app.sendAndConfirm('A plain text bubble for the visual check, with a second clause for wrapping.');
      await alice.app.composer.attach('image', ASSETS.image);
      await alice.app.messages.bubbleOfType('image').waitUntilSent();
      await alice.app.composer.attach('file', ASSETS.pdf);
      await alice.app.messages.bubbleOfType('file').waitUntilSent();
      const { log } = alice.app.messages;

      await expect(log).toHaveScreenshot('message-bubbles-dark.png', {
        ...opts,
        mask: [log.locator('time'), log.getByRole('separator')],
      });
    });
  });

  test('VIS-08 message list with text, image and file bubbles', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    // Fixed text (not a unique marker) so the picture is the same every run.
    await alice.app.sendAndConfirm('A plain text bubble for the visual check, with a second clause for wrapping.');
    await alice.app.composer.attach('image', ASSETS.image);
    await alice.app.messages.bubbleOfType('image').waitUntilSent();
    await alice.app.composer.attach('file', ASSETS.pdf);
    await alice.app.messages.bubbleOfType('file').waitUntilSent();
    const { log } = alice.app.messages;

    await expect(log).toHaveScreenshot('message-bubbles.png', {
      ...opts,
      mask: [log.locator('time'), log.getByRole('separator')], // clock times and the date chip change per run
    });
  });
});
