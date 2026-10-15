import { t } from '@i18n/t';
import { uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { MessageBubble } from '@pages/messages/MessageBubble';
import { ASSETS } from '@pages/messages/MessageComposer';
import { SearchPanel } from '@pages/search/SearchPanel';

test.describe('Attachments', { tag: ['@attachments', '@regression'] }, () => {
  test('ATT-01 the attachment sheet offers image, video, audio, file and the extensions', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);

    await alice.app.composer.attachmentsButton.click();

    const sheet = alice.app.composer.attachmentSheet;
    for (const key of [
      'message_composer_attach_image',
      'message_composer_attach_video',
      'message_composer_attach_audio',
      'message_composer_attach_file',
      'message_composer_polls',
      'messsage_composer_collaborative_document',
      'messsage_composer_collaborative_whiteboard',
    ]) {
      await expect(sheet.getByRole('button', { name: t(key) })).toBeVisible();
    }
  });

  test('ATT-02 an image is sent, received live and kept after reload', { tag: '@critical' }, async ({ alice, data, api, loginAs }) => {
    const peer = await data.user('viewer');
    const receiver = await loginAs(peer);
    await receiver.app.openChatWith(alice.user);
    await alice.app.openChatWith(peer);

    await alice.app.composer.attach('image', ASSETS.image);

    await expect(alice.app.messages.ofType('image')).toHaveCount(1);
    await expect(alice.app.messages.ofType('image').getByRole('img').first()).toBeVisible();
    await expect(receiver.app.messages.ofType('image')).toHaveCount(1);
    await api.users.waitForConversation(peer.uid, alice.user.uid); // BUG-012: a reload inside the new-chat window can lose the conversation from Chats
    await receiver.app.reload();
    await receiver.app.openConversation(alice.user.name);
    await expect(receiver.app.messages.ofType('image')).toHaveCount(1);
  });

  test('ATT-03 clicking an image opens the full-screen viewer, which closes again', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    await alice.app.composer.attach('image', ASSETS.image);
    await alice.app.messages.bubbleOfType('image').waitUntilSent();
    // The tile only reacts once its image has preloaded — it then becomes focusable (tabindex 0).
    const image = alice.app.messages.ofType('image').getByRole('button', { name: /fullscreen/i });
    await expect(image).toHaveAttribute('tabindex', '0');

    await image.click();
    const viewer = alice.page.getByRole('dialog', { name: t('full_screen_viewer_image_viewer') });
    await expect(viewer).toBeVisible();
    await expect(viewer.getByRole('button', { name: t('accessibility_download') })).toBeVisible();
    await alice.page.keyboard.press('Escape');

    await expect(viewer).toBeHidden();
    await image.click();
    await viewer.getByRole('button', { name: t('accessibility_close') }).click();
    await expect(viewer).toBeHidden();
  });

  test('ATT-04 a video is sent as a playable video message', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);

    await alice.app.composer.attach('video', ASSETS.video);

    await expect(alice.app.messages.ofType('video').locator('video')).toHaveCount(1);
  });

  test('ATT-05 an audio file is sent with a play control', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);

    await alice.app.composer.attach('audio', ASSETS.audio);

    const audio = alice.app.messages.ofType('audio');
    await expect(audio).toHaveCount(1);
    await expect(audio.getByRole('button').first()).toBeVisible();
  });

  test('ATT-06 a PDF is sent as a file message with its name and a download action', async ({ alice, data, loginAs }) => {
    const peer = await data.user('reader');
    const receiver = await loginAs(peer);
    await receiver.app.openChatWith(alice.user);
    await alice.app.openChatWith(peer);

    await alice.app.composer.attach('file', ASSETS.pdf);

    for (const side of [alice, receiver]) {
      const file = side.app.messages.ofType('file');
      await expect(file).toHaveCount(1);
      await expect(file).toContainText('test-file.pdf');
      await expect(file.getByRole('button', { name: /download/i }).or(file.getByRole('link'))).toBeVisible();
    }
  });

  test('ATT-10 cancelling the file picker sends nothing', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);

    await alice.app.composer.attach('image', []);

    await expect(alice.app.messages.messages).toHaveCount(0);
  });

  test('ATT-11 a failed upload is shown as an error on the message', { tag: '@network' }, async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    alice.net.allow(/.*/);
    await alice.page.route(/\/v3(\.0)?\/messages$/, route =>
      route.request().method() === 'POST' ? route.abort('failed') : route.continue()
    );

    await alice.app.composer.attach('image', ASSETS.image);

    await expect(alice.app.messages.ofType('image').getByRole('img', { name: t('message_bubble_error'), exact: true })).toBeVisible();
  });

  test('ATT-12 an image can be sent in a group and inside a thread', async ({ alice, bob, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    await alice.app.openGroup(group.name);
    await bob.app.openGroup(group.name);

    await alice.app.composer.attach('image', ASSETS.image);
    await expect(bob.app.messages.ofType('image')).toHaveCount(1);

    await alice.app.messages.bubbleOfType('image').choose(t('message_list_option_reply_in_thread'));
    await expect(alice.app.thread.root).toBeVisible();
    await alice.app.thread.composer.attach('image', ASSETS.image);

    // Counting images in the panel is unreliable: the parent is sometimes listed again as a reply (OBS-010).
    await expect(alice.app.messages.bubbleOfType('image').threadRepliesButton).toHaveAccessibleName(MessageBubble.threadRepliesLabel(1));
    await expect(alice.app.thread.messages.last().root).toHaveAccessibleName(/, image message$/);
    await expect(alice.app.thread.messages.last().receipt('sending')).toHaveCount(0);
  });

  test(
    'ATT-07 several files can be picked and sent at once',
    { annotation: { type: 'bug', description: 'BUG-020 — docs promise multi-select + staging tray; 7.0.3 picker takes one file' } },
    async ({ alice, data }) => {
      test.fail(true, 'BUG-020');
      const peer = await data.user('peer');
      await alice.app.openChatWith(peer);
      await alice.app.composer.attachmentsButton.click();
      const chooser = alice.page.waitForEvent('filechooser');
      await alice.app.composer.attachmentSheet.getByRole('button', { name: t('message_composer_attach_image') }).click();

      // CometChatMessageComposerAttachmentButton creates <input type="file"> without `multiple`.
      expect((await chooser).isMultiple(), 'picker allows several files').toBe(true);
    }
  );

  test('ATT-08 a non-image picked through "Image" is not shown as a broken image', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    alice.net.allow(/.*/); // the server may reject the upload — that is an acceptable outcome

    await alice.app.composer.attach('image', ASSETS.pdf); // the accept="image/*" filter is only a hint

    // Acceptable: sent as a file, or rejected with an error mark. Not acceptable: a broken image.
    const { messages } = alice.app;
    await expect(messages.ofType('file').or(messages.ofType('image').getByRole('img', { name: t('message_bubble_error'), exact: true }))).toBeVisible();
  });

  test('ATT-09 an upload the server refuses as too large is marked as failed', { tag: '@network' }, async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    alice.net.allow(/.*/);
    // UIKit 7.0.3 does not enforce `maxFileSize` itself; the server's answer to an oversized file is simulated.
    await alice.page.route(/\/v3(\.0)?\/messages$/, route =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 413, contentType: 'application/json', body: '{"error":{"code":"ERR_FILE_SIZE_LIMIT","message":"File too large"}}' })
        : route.continue()
    );

    await alice.app.composer.attach('file', ASSETS.pdf);

    await expect(alice.app.messages.ofType('file').getByRole('img', { name: t('message_bubble_error'), exact: true })).toBeVisible();
  });

  test('ATT-13 a sent document is found under the Documents search filter', { tag: '@search' }, async ({ alice, data, api }) => {
    const peer = await data.user('docs');
    await alice.app.openChatWith(peer);
    await alice.app.sendAndConfirm(uniqueText('before the file'));
    await api.users.waitForConversation(alice.user.uid, peer.uid);
    await alice.app.composer.attach('file', ASSETS.pdf);
    await alice.app.messages.bubbleOfType('file').waitUntilSent();
    await alice.app.home.openTab('chats');
    await alice.app.conversations.searchBox.click();
    const search = new SearchPanel(alice.page);

    await search.filter('documents').click();

    await expect(search.messages.filter({ hasText: 'test-file.pdf' }).first()).toBeVisible();
  });
});
