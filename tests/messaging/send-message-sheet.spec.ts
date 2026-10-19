import fs from 'node:fs';
import path from 'node:path';
import { uniqueSentences, uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { t } from '@i18n/t';
import { CreatePollDialog } from '@pages/extensions/Polls';
import { ASSETS } from '@pages/messages/MessageComposer';
import { delayResponse } from '@utils/network';

/**
 * Sending messages — cases from the "Send Message" tab of CometChat_Features_All_Test_Cases.xlsx
 * (MSG_xxx) that the core suite did not cover yet. Alignment (MSG_020/024) and group sender
 * info (MSG_026/130) are covered by MSGLIST-002 / MSGLIST-004.
 */
const stickerKeyboard = (page: import('@playwright/test').Page) => page.getByRole('dialog', { name: t('accessibility_sticker_keyboard') });
const linkCard = (domain: RegExp) => ({ name: new RegExp(`^${t('accessibility_link_preview_for').replace('{domain}', '')}${domain.source}$`) });

test.describe('Send message (sheet cases)', { tag: ['@messaging', '@regression'] }, () => {
  test('MSG-021/025 sent and received bubbles have different colours', async ({ alice, bob }) => {
    await alice.app.openChatWith(bob.user);
    await bob.app.openChatWith(alice.user);
    const mine = uniqueText('mine');
    const theirs = uniqueText('theirs');
    await alice.app.sendAndConfirm(mine);
    await bob.app.sendAndConfirm(theirs);

    const bg = (text: string) => alice.app.messages.message(text).body.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(await bg(mine)).not.toBe(await bg(theirs));
  });

  test('MSG-034 the chat scrolls to a new incoming message', async ({ alice, bob }) => {
    await alice.app.openChatWith(bob.user);
    await bob.app.openChatWith(alice.user);
    const text = uniqueText('just arrived');

    await bob.app.sendAndConfirm(text);

    await expect(alice.app.messages.message(text).root).toBeInViewport();
  });

  test(
    'MSG-045 a failed message can be retried',
    { tag: '@network', annotation: { type: 'bug', description: 'BUG-021 — a failed message shows only an error mark; there is no retry' } },
    async ({ alice, data }) => {
      test.fail(true, 'BUG-021');
      const peer = await data.user('peer');
      await alice.app.openChatWith(peer);
      alice.net.allow(/.*/);
      await alice.page.route(/\/v3(\.0)?\/messages$/, route => (route.request().method() === 'POST' ? route.abort('failed') : route.continue()));
      const text = uniqueText('please retry');
      await alice.app.composer.sendWithEnter(text);
      const bubble = alice.app.messages.message(text);
      await expect(bubble.receipt('error')).toBeVisible();
      await alice.page.unroute(/\/v3(\.0)?\/messages$/);

      await bubble.root.getByRole('button', { name: /retry/i }).or(bubble.root.getByText(/retry/i)).first().click({ timeout: 5_000 });

      await expect(bubble.receipt('error')).toHaveCount(0);
    }
  );

  test('MSG-051/162 an image upload shows progress until it is sent', { tag: '@network' }, async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    await delayResponse(alice.page, /\/v3(\.0)?\/messages$/, { method: 'POST', ms: 4_000 });

    await alice.app.composer.attach('image', ASSETS.image);

    // UIKit labels the tile "Uploading image..." until the server answers (hard-coded, L10N-008).
    await expect(alice.app.messages.ofType('image').getByLabel(/uploading/i)).toBeVisible();
    await alice.app.messages.bubbleOfType('image').waitUntilSent();
    await expect(alice.app.messages.ofType('image').getByLabel(/uploading/i)).toHaveCount(0);
  });

  test('MSG-057 the recording timer counts up', { tag: '@calls' }, async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    await alice.app.composer.voiceButton.click();
    const timer = alice.page.getByRole('group', { name: t('media_recorder_aria_label') }).getByRole('timer');
    await expect(timer).toBeVisible();
    const start = await timer.getAttribute('aria-label');

    await expect.poll(() => timer.getAttribute('aria-label'), { timeout: 10_000 }).not.toBe(start);
  });

  test('MSG-060 a received voice note can be played', { tag: '@calls' }, async ({ alice, bob }) => {
    await alice.app.openChatWith(bob.user);
    await bob.app.openChatWith(alice.user);
    const recorder = alice.page.getByRole('group', { name: t('media_recorder_aria_label') });
    await alice.app.composer.voiceButton.click();
    await expect(recorder.getByRole('button', { name: t('media_recorder_pause') })).toBeVisible();
    await recorder.getByRole('button', { name: t('message_composer_send_message_icon_hover') }).click();
    const note = bob.app.messages.ofType('audio');
    await expect(note).toHaveCount(1);

    await note.getByRole('button', { name: t('accessibility_play_audio') }).click();

    await expect(note.getByRole('button', { name: t('accessibility_pause_audio') })).toBeVisible();
  });

  test('MSG-062 a very short recording does not send an empty voice note', { tag: '@calls' }, async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const recorder = alice.page.getByRole('group', { name: t('media_recorder_aria_label') });
    await alice.app.composer.voiceButton.click();

    await recorder.getByRole('button', { name: t('message_composer_send_message_icon_hover') }).click();

    // Either nothing is sent, or a playable note is — never a broken / failed bubble.
    await expect(recorder).toBeHidden();
    await expect(alice.app.messages.ofType('audio').getByRole('img', { name: t('message_bubble_error'), exact: true })).toHaveCount(0);
  });

  test('MSG-065 emoji categories switch the emoji shown', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    await alice.app.composer.emojiButton.click();
    const keyboard = alice.app.emojiKeyboard;

    await keyboard.category(t('emoji_animals_nature')).click();

    await expect(keyboard.category(t('emoji_animals_nature'))).toHaveAttribute('aria-selected', 'true');
    await expect(keyboard.emoji('dog')).toBeInViewport();
  });

  test('MSG-067 several emoji can be added one after another', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    await alice.app.composer.emojiButton.click();
    const keyboard = alice.app.emojiKeyboard;

    await keyboard.emoji('grinning').click();
    await alice.app.composer.emojiButton.click();
    await keyboard.emoji('heart_eyes').click();

    await expect(alice.app.composer.input).toContainText('😀');
    await expect(alice.app.composer.input).toContainText('😍');
  });

  test('MSG-073/076 sticker packs are listed and switching shows that pack', { tag: '@extensions' }, async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    await alice.app.composer.stickerButton.click();
    const keyboard = stickerKeyboard(alice.page);
    const packs = keyboard.getByRole('tab');
    await expect(packs.nth(1)).toBeVisible();
    const firstSticker = () => keyboard.getByRole('gridcell').first().getAttribute('aria-label');
    const before = await firstSticker();

    await packs.nth(1).click();

    await expect(packs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect.poll(firstSticker).not.toBe(before);
  });

  test('MSG-077 with no stickers available, the keyboard says so', { tag: '@extensions' }, async ({ alice, data }) => {
    await alice.page.route(/stickers.*\/v1\/fetch/, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"data":{"defaultStickers":[],"customStickers":[]}}' })
    );
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);

    await alice.app.composer.stickerButton.click();

    await expect(stickerKeyboard(alice.page)).toContainText(t('sticker_empty'));
  });

  test('MSG-078/079/080/082 @all is suggested in a group, inserted, sent and highlighted', async ({ alice, bob, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    await alice.app.openGroup(group.name);
    await bob.app.openGroup(group.name);
    const { composer } = alice.app;
    const text = uniqueText('heads up');

    await composer.type(`${text} @al`);
    const all = composer.mentionSuggestions.getByRole('option', { name: /^@all/ });
    await expect(all).toBeVisible();
    await all.click();
    await expect(composer.input).toContainText('@all');
    await composer.input.press('Enter');

    for (const side of [alice, bob]) {
      await expect(side.app.messages.message(text).text.locator('.cometchat-mentions')).toContainText('all');
    }
  });

  test('MSG-083/093 a direct chat suggests only the other user and no @all', async ({ alice, bob }) => {
    await alice.app.openChatWith(bob.user);
    const { composer } = alice.app;

    await composer.type('@');

    await expect(composer.mentionSuggestions.getByRole('option', { name: /^@all/ })).toHaveCount(0);
    const options = composer.mentionSuggestions.getByRole('option');
    await expect(options.filter({ hasText: bob.user.name })).toBeVisible();
    await expect(options).toHaveCount(1);
  });

  test('MSG-091 mention suggestions show each member\'s avatar', async ({ alice, bob, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    await alice.app.openGroup(group.name);

    await alice.app.composer.type(`@${bob.user.name.split(' ')[0]}`);

    await expect(alice.app.composer.mentionSuggestions.getByRole('option', { name: new RegExp(bob.user.name) }).getByRole('img').first()).toBeVisible();
  });

  test('MSG-092 @ with no matching member offers no suggestion', async ({ alice, bob, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    await alice.app.openGroup(group.name);

    await alice.app.composer.type('@zzqxnomember');

    await expect(alice.app.composer.mentionSuggestions.getByRole('option')).toHaveCount(0);
  });

  test('MSG-094/095 a long message is shortened with "Read more" and expands in place', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const { texts } = uniqueSentences(40, 'long');
    const long = texts.join(' ');
    await alice.app.composer.input.click();
    await alice.page.keyboard.insertText(long);
    await alice.app.composer.sendButton.click();
    const bubble = alice.app.messages.message(texts[0]);
    await bubble.waitUntilSent();

    await bubble.root.getByRole('button', { name: t('text_message_read_more') }).click();

    await expect(bubble.root.getByRole('button', { name: t('text_message_show_less') })).toBeVisible();
    await expect(bubble.text).toContainText(texts[texts.length - 1]);
  });

  test('MSG-105 creating a poll without network shows an error and sends nothing', { tag: ['@extensions', '@network'] }, async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    await alice.app.composer.chooseAttachmentOption(t('message_composer_polls'));
    const dialog = new CreatePollDialog(alice.page);
    await dialog.fill(`Offline ${uniqueText('poll')}?`, ['Yes', 'No']);
    alice.net.allow(/.*/);

    await alice.context.setOffline(true);
    await dialog.createButton.click();

    await expect(dialog.error).toBeVisible();
    await alice.context.setOffline(false);
    await expect(alice.app.messages.ofType('extension_poll')).toHaveCount(0);
  });

  for (const b of [
    { id: '110', name: 'document', sheet: 'messsage_composer_collaborative_document', type: 'extension_document' as const },
    { id: '115', name: 'whiteboard', sheet: 'messsage_composer_collaborative_whiteboard', type: 'extension_whiteboard' as const },
  ]) {
    test(`MSG-${b.id} a collaborative ${b.name} created without network is not sent`, { tag: ['@extensions', '@network'] }, async ({ alice, data }) => {
      const peer = await data.user('peer');
      await alice.app.openChatWith(peer);
      alice.net.allow(/.*/);

      await alice.context.setOffline(true);
      await alice.app.composer.chooseAttachmentOption(t(b.sheet));
      await alice.context.setOffline(false);
      await alice.app.reload();
      await alice.app.openChatWith(peer);

      await expect(alice.app.messages.ofType(b.type)).toHaveCount(0);
    });
  }

  test('MSG-121/122/123/124 an audio file is sent and plays for sender and receiver', async ({ alice, bob }) => {
    await alice.app.openChatWith(bob.user);
    await bob.app.openChatWith(alice.user);

    await alice.app.composer.attach('audio', ASSETS.audio);
    await alice.app.messages.bubbleOfType('audio').waitUntilSent();

    for (const side of [alice, bob]) {
      const audio = side.app.messages.ofType('audio');
      await audio.getByRole('button', { name: t('accessibility_play_audio') }).click();
      await expect(audio.getByRole('button', { name: t('accessibility_pause_audio') })).toBeVisible();
    }
  });

  test('MSG-125 a corrupt audio file is not sent as a playable note', async ({ alice, data }, testInfo) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const corrupt = path.join(testInfo.outputDir, 'corrupt-audio.mp3');
    fs.mkdirSync(testInfo.outputDir, { recursive: true });
    fs.writeFileSync(corrupt, Buffer.from('this is not really audio data'.repeat(20)));
    alice.net.allow(/.*/);

    await alice.app.composer.attach('audio', corrupt);

    // Acceptable: an error mark, or nothing sent. Not acceptable: a normal-looking audio message.
    const audio = alice.app.messages.ofType('audio');
    await expect(audio.getByRole('img', { name: t('message_bubble_error'), exact: true }).or(alice.page.getByRole('alert'))).toBeVisible();
  });

  test('MSG-129 a sticker and a voice note reach the group', { tag: ['@calls', '@extensions'] }, async ({ alice, bob, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    await alice.app.openGroup(group.name);
    await bob.app.openGroup(group.name);

    await alice.app.composer.stickerButton.click();
    await stickerKeyboard(alice.page).getByRole('grid').getByRole('gridcell').first().click();
    const recorder = alice.page.getByRole('group', { name: t('media_recorder_aria_label') });
    await alice.app.composer.voiceButton.click();
    await expect(recorder.getByRole('button', { name: t('media_recorder_pause') })).toBeVisible();
    await recorder.getByRole('button', { name: t('message_composer_send_message_icon_hover') }).click();

    await expect(bob.app.messages.ofType('extension_sticker')).toHaveCount(1);
    await expect(bob.app.messages.ofType('audio')).toHaveCount(1);
  });

  for (const c of [
    { id: '131', name: 'removed', act: 'kick' as const },
    { id: '132', name: 'banned', act: 'ban' as const },
  ]) {
    test(`MSG-${c.id} a ${c.name} member can no longer send in the group`, { tag: '@permissions' }, async ({ alice, bob, data, api }) => {
      const group = await data.group({ owner: alice.user, participants: [bob.user] });
      await bob.app.openGroup(group.name);

      await api.groups[c.act](group.guid, bob.user.uid);

      await expect(bob.app.composer.input).toBeHidden({ timeout: 20_000 });
    });
  }

  test('MSG-164 a sent video plays', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    await alice.app.composer.attach('video', ASSETS.video);
    await alice.app.messages.bubbleOfType('video').waitUntilSent();
    const video = alice.app.messages.ofType('video').locator('video');

    await video.evaluate((v: HTMLVideoElement) => v.play());

    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0)).toBe(true);
  });

  test('MSG-165 a sent document can be opened / downloaded', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    await alice.app.composer.attach('file', ASSETS.pdf);
    await alice.app.messages.bubbleOfType('file').waitUntilSent();
    const file = alice.app.messages.ofType('file');

    const opened = alice.page.waitForEvent('download').then(() => 'download').catch(() => '');
    const popup = alice.page.waitForEvent('popup').then(() => 'popup').catch(() => '');
    await file.getByRole('button', { name: /download/i }).or(file.getByRole('link')).first().click();

    expect(await Promise.race([opened, popup])).not.toBe('');
  });

  test('MSG-176 several links in one message are all clickable', async ({ alice, bob }) => {
    await alice.app.openChatWith(bob.user);
    await bob.app.openChatWith(alice.user);
    const text = `${uniqueText('links')} https://www.wikipedia.org and https://www.cometchat.com`;

    await alice.app.sendAndConfirm(text);

    const bubble = bob.app.messages.message(text);
    await expect(bubble.text.getByRole('link')).toHaveCount(2);
  });

  test('MSG-177 the conversation list shows a link message as text', async ({ alice, data, api }) => {
    const peer = await data.user('linker');
    const text = `${uniqueText('see')} https://www.wikipedia.org`;

    await api.messages.sendText(peer.uid, { uid: alice.user.uid }, text);

    await expect(alice.app.conversations.item(peer.name)).toContainText('wikipedia.org');
  });

  test('MSG-178 a link preview shows for every group member', { tag: '@extensions' }, async ({ alice, bob, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    await alice.app.openGroup(group.name);
    await bob.app.openGroup(group.name);
    const text = `${uniqueText('group link')} https://www.wikipedia.org`;

    await alice.app.sendAndConfirm(text);

    await expect(bob.app.messages.message(text).root.getByRole('article', linkCard(/(www\.)?wikipedia\.org/))).toBeVisible({ timeout: 30_000 });
  });

  test('MSG-179 an unreachable URL is a plain link without a preview', async ({ alice, bob }) => {
    await alice.app.openChatWith(bob.user);
    await bob.app.openChatWith(alice.user);
    const text = `${uniqueText('broken')} https://no-such-host-for-e2e.invalid/page`;

    await alice.app.sendAndConfirm(text);

    const bubble = bob.app.messages.message(text);
    await expect(bubble.text.getByRole('link')).toBeVisible();
    await expect(bubble.root.getByRole('article', linkCard(/.+/))).toHaveCount(0);
  });

  test('MSG-180 a page without an image gets a preview without a thumbnail', { tag: '@extensions' }, async ({ alice, bob }) => {
    await alice.app.openChatWith(bob.user);
    await bob.app.openChatWith(alice.user);
    const text = `${uniqueText('plain page')} https://example.com`;

    await alice.app.sendAndConfirm(text);

    const card = bob.app.messages.message(text).root.getByRole('article', linkCard(/(www\.)?example\.com/));
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card.locator('.cometchat-text-bubble__link-preview-image')).toHaveCount(0);
  });

  test('MSG-181 sending a link without network fails cleanly', { tag: '@network' }, async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    alice.net.allow(/.*/);
    const text = `${uniqueText('offline link')} https://www.wikipedia.org`;

    await alice.context.setOffline(true);
    await alice.app.composer.sendWithEnter(text);

    await expect(alice.app.messages.message(text).root).toBeVisible();
    await expect(alice.app.messages.message(text).text.getByRole('link')).toBeVisible();
    await alice.context.setOffline(false);
  });
});
