import { t } from '@i18n/t';
import { uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';

test.describe('Composer', { tag: ['@composer', '@regression'] }, () => {
  test(
    'CMP-01 composer buttons have human-readable accessible names',
    { tag: ['@a11y', '@localization'], annotation: { type: 'bug', description: 'BUG-001 — raw keys: ATTACHMENTS, EMOJI, VOICE_RECORDING, SEND' } },
    async ({ alice, data }) => {
      test.fail(true, 'BUG-001');
      const peer = await data.user('peer');
      await alice.app.openChatWith(peer);

      // A raw translation key looks like "VOICE_RECORDING": all caps / underscores.
      await expect(alice.app.composer.scope.getByRole('button', { name: /^[A-Z][A-Z_]{2,}$/ })).toHaveCount(0, { timeout: 3_000 });
    }
  );

  const formats = [
    { button: 'Bold', shortcut: 'ControlOrMeta+b', selector: 'strong, b' },
    { button: 'Italic', shortcut: 'ControlOrMeta+i', selector: 'em, i' },
    { button: 'Underline', shortcut: 'ControlOrMeta+u', selector: 'u' },
    { button: 'Strikethrough', shortcut: null, selector: 's, del, strike' },
    { button: 'Code', shortcut: null, selector: 'code' },
  ];
  for (const f of formats) {
    test(`CMP-02 ${f.button} text is formatted for the receiver`, async ({ alice, bob }) => {
      await alice.app.openChatWith(bob.user);
      const text = uniqueText(f.button.toLowerCase());

      await alice.app.composer.input.click();
      await alice.app.composer.formatButton(f.button).click();
      await alice.app.composer.input.pressSequentially(text);
      await alice.app.composer.input.press('Enter');

      await expect(alice.app.messages.message(text).text.locator(f.selector)).toHaveText(text);
      await bob.app.openConversation(alice.user.name);
      await expect(bob.app.messages.message(text).text.locator(f.selector)).toHaveText(text);
    });

    if (f.shortcut) {
      test(`CMP-03 ${f.button} via keyboard shortcut`, async ({ alice, data }) => {
        const peer = await data.user('peer');
        await alice.app.openChatWith(peer);
        const text = uniqueText(`${f.button.toLowerCase()} key`);

        await alice.app.composer.input.click();
        await alice.app.composer.input.press(f.shortcut!);
        await alice.app.composer.input.pressSequentially(text);
        await alice.app.composer.input.press('Enter');

        await expect(alice.app.messages.message(text).text.locator(f.selector)).toHaveText(text);
      });
    }
  }

  const blocks = [
    { button: 'Bulleted List', selector: 'ul li' },
    { button: 'Numbered List', selector: 'ol li' },
    { button: 'Blockquote', selector: 'blockquote' },
    { button: 'Code Block', selector: 'pre' },
  ];
  for (const b of blocks) {
    test(`CMP-05/06 ${b.button} renders as a block, also after reload`, async ({ alice, data, api }) => {
      const peer = await data.user('peer');
      await alice.app.openChatWith(peer);
      const text = uniqueText(b.button.toLowerCase());

      await alice.app.composer.input.click();
      await alice.app.composer.formatButton(b.button).click();
      await alice.app.composer.input.pressSequentially(text);
      await alice.app.composer.sendButton.click();

      await expect(alice.app.messages.message(text).text.locator(b.selector)).toContainText(text);
      await api.users.waitForConversation(alice.user.uid, peer.uid); // BUG-012: reload only once the chat exists
      await alice.app.reload(); // CMP-06
      await alice.app.openConversation(peer.name);
      await expect(alice.app.messages.message(text).text.locator(b.selector)).toContainText(text);
    });
  }

  test('CMP-07 the emoji keyboard searches and inserts an emoji', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const keyboard = alice.app.emojiKeyboard;

    await alice.app.composer.emojiButton.click();
    await expect(keyboard.dialog).toBeVisible();
    await keyboard.search.fill('tears');
    await keyboard.emoji('joy').click();

    await expect(alice.app.composer.input).toContainText('😂');
  });

  test(
    'CMP-07b searching an emoji by the name it shows finds it',
    { annotation: { type: 'bug', description: 'BUG-014 — emoji search matches keywords only; "joy" does not find 😂 (named "joy")' } },
    async ({ alice, data }) => {
      test.fail(true, 'BUG-014');
      const peer = await data.user('peer');
      await alice.app.openChatWith(peer);
      const keyboard = alice.app.emojiKeyboard;
      await alice.app.composer.emojiButton.click();
      await expect(keyboard.dialog).toBeVisible();

      await keyboard.search.fill('joy');

      await expect(keyboard.emoji('joy')).toBeVisible({ timeout: 3_000 });
    }
  );

  test('CMP-08 the emoji keyboard closes with Escape', { tag: '@a11y' }, async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    await alice.app.composer.emojiButton.click();
    await expect(alice.app.emojiKeyboard.dialog).toBeVisible();

    await alice.page.keyboard.press('Escape');

    await expect(alice.app.emojiKeyboard.dialog).toBeHidden();
  });

  test('CMP-09 a sticker is sent and the receiver sees it', { tag: '@extensions' }, async ({ alice, bob }) => {
    await alice.app.openChatWith(bob.user);
    await bob.app.openChatWith(alice.user);
    const stickers = alice.page.getByRole('dialog', { name: t('accessibility_sticker_keyboard') });
    const before = await bob.app.messages.ofType('extension_sticker').count();

    await alice.app.composer.stickerButton.click();
    await expect(stickers).toBeVisible();
    await stickers.getByRole('grid').getByRole('gridcell').first().click();

    await expect(bob.app.messages.ofType('extension_sticker')).toHaveCount(before + 1);
  });

  test('CMP-13 the receiver sees "typing" in the header, and it clears after sending', async ({ alice, data, loginAs }) => {
    const peer = await data.user('watcher');
    const receiver = await loginAs(peer);
    await receiver.app.openChatWith(alice.user);
    await alice.app.openChatWith(peer);

    await alice.app.composer.type('still thinking about it');
    await expect(receiver.app.header.status).toContainText(/typing/i);
    await alice.app.composer.input.press('Enter');

    await expect(receiver.app.header.status).not.toContainText(/typing/i, { timeout: 20_000 });
  });

  test('CMP-04 the Link button inserts a link with its own text', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const label = uniqueText('docs link');
    await alice.app.composer.input.click();

    await alice.app.composer.formatButton('Link').click();
    const dialog = alice.page.getByRole('dialog', { name: t('link_dialog_add_link') });
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder(t('link_dialog_text_placeholder')).fill(label);
    await dialog.getByPlaceholder('https://www.cometchat.com/').fill('https://www.cometchat.com/docs');
    await dialog.getByRole('button', { name: t('link_dialog_save') }).click();
    await expect(dialog).toBeHidden();
    await alice.app.composer.sendButton.click();

    const link = alice.app.messages.message(label).text.getByRole('link', { name: label });
    await expect(link).toHaveAttribute('href', /^https:\/\/www\.cometchat\.com\/docs\/?$/);
  });

  test('CMP-14 a blocked user\'s chat has no composer', { tag: '@permissions' }, async ({ data, api, loginAs }) => {
    const me = await data.user('blocker');
    const peer = await data.user('blocked');
    await api.users.block(me.uid, peer.uid);
    const { app, page } = await loginAs(me);

    await app.openChatWith(peer, { composer: false });

    await expect(page.locator('.cometchat-messages__blocked-banner')).toContainText(t('cannot_send_to_blocked_user'));
    await expect(app.composer.input).toBeHidden();
    await expect(app.composer.sendButton).toBeHidden();
  });

  test('CMP-15 the attachment menu stays inside the chat pane', { tag: '@responsive' }, async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);

    await alice.app.composer.attachmentsButton.click();
    const sheet = alice.app.composer.attachmentSheet;
    await expect(sheet).toBeVisible();

    const box = (await sheet.boundingBox())!;
    const viewport = alice.page.viewportSize()!;
    expect(box.x, 'left edge inside the window').toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, 'right edge inside the window').toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height, 'bottom edge inside the window').toBeLessThanOrEqual(viewport.height);
    const pane = (await alice.page.locator('.cometchat-messages-wrapper').boundingBox())!;
    expect(box.x, 'does not spill over the conversation list').toBeGreaterThanOrEqual(pane.x - 1);
  });
});
