import { t } from '@i18n/t';
import { expect, test } from '@fixtures/test.fixture';

/**
 * Voice recording. CMP-10/11 run in the `calls` project (fake microphone, permission granted).
 * The recorder replaces the input with `group "Voice recorder"` and starts recording at once.
 */
const recorderOf = (page: import('@playwright/test').Page) => page.getByRole('group', { name: t('media_recorder_aria_label') });

test.describe('Voice recording', { tag: ['@composer', '@regression'] }, () => {
  test('CMP-10 a voice note is recorded and sent as an audio message', { tag: '@calls' }, async ({ alice, bob }) => {
    await alice.app.openChatWith(bob.user);
    await bob.app.openChatWith(alice.user);
    const recorder = recorderOf(alice.page);

    await alice.app.composer.voiceButton.click();
    await expect(recorder).toBeVisible();
    await expect(recorder.getByRole('button', { name: t('media_recorder_pause') })).toBeVisible(); // recording
    await recorder.getByRole('button', { name: t('message_composer_send_message_icon_hover') }).click();

    await expect(recorder).toBeHidden();
    await expect(alice.app.messages.ofType('audio')).toHaveCount(1);
    await expect(bob.app.messages.ofType('audio')).toHaveCount(1);
  });

  test('CMP-11 deleting a recording sends nothing and restores the composer', { tag: '@calls' }, async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const recorder = recorderOf(alice.page);
    await alice.app.composer.voiceButton.click();
    await expect(recorder.getByRole('button', { name: t('media_recorder_pause') })).toBeVisible();

    await recorder.getByRole('button', { name: t('media_recorder_delete') }).click();

    await expect(recorder).toBeHidden();
    await expect(alice.app.composer.input).toBeVisible();
    await expect(alice.app.messages.messages).toHaveCount(0);
  });

  test('CMP-12 a denied microphone shows a clear message', async ({ alice, data }) => {
    // Deterministic denial: the browser's getUserMedia rejects as it does when the user blocks the mic.
    await alice.page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
    });
    await alice.app.reload();
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    alice.net.allow(/NotAllowedError|Permission denied/);

    await alice.app.composer.voiceButton.click();

    const alert = recorderOf(alice.page).getByRole('alert');
    await expect(alert).toContainText(t('media_recorder_error_title'));
    await expect(alert).toContainText(t('media_recorder_error_subtitle'));
    await expect(alice.app.messages.messages).toHaveCount(0);
  });
});
