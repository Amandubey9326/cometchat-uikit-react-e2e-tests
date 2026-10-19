import { uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { t } from '@i18n/t';
import { ConfirmDialog } from '@pages/components/Dialogs';
import { ASSETS } from '@pages/messages/MessageComposer';

/**
 * Threads — cases from the "Send Threaded Message" tab of CometChat_Features_All_Test_Cases.xlsx
 * (MSG_133–153) that the core suite did not cover yet. Subscribe to thread (MSG_147–153) is not in 7.0.3.
 */
const THREAD = t('message_list_option_reply_in_thread');

test.describe('Threads (sheet cases)', { tag: ['@threads', '@regression'] }, () => {
  test('MSG-140 video and audio can be sent inside a thread', async ({ alice, data, api }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const parent = uniqueText('media thread');
    await alice.app.sendAndConfirm(parent);
    await api.users.waitForConversation(alice.user.uid, peer.uid); // BUG-012
    await alice.app.messages.message(parent).choose(THREAD);
    const { thread } = alice.app;

    await thread.composer.attach('video', ASSETS.video);
    await expect(thread.messages.last().root).toHaveAccessibleName(/, video message$/);
    await thread.composer.attach('audio', ASSETS.audio);

    await expect(thread.messages.last().root).toHaveAccessibleName(/, audio message$/);
  });

  test('MSG-141 a voice note and a sticker can be sent inside a thread', { tag: ['@calls', '@extensions'] }, async ({ alice, data, api }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const parent = uniqueText('voice thread');
    await alice.app.sendAndConfirm(parent);
    await api.users.waitForConversation(alice.user.uid, peer.uid);
    await alice.app.messages.message(parent).choose(THREAD);
    const { thread } = alice.app;

    await thread.composer.stickerButton.click();
    await alice.page.getByRole('dialog', { name: t('accessibility_sticker_keyboard') }).getByRole('grid').getByRole('gridcell').first().click();
    await expect(thread.messages.last().root).toHaveAccessibleName(/, extension_sticker message$/);
    const recorder = alice.page.getByRole('group', { name: t('media_recorder_aria_label') });
    await thread.composer.voiceButton.click();
    await expect(recorder.getByRole('button', { name: t('media_recorder_pause') })).toBeVisible();
    await recorder.getByRole('button', { name: t('message_composer_send_message_icon_hover') }).click();

    await expect(thread.messages.last().root).toHaveAccessibleName(/, audio message$/);
  });

  test('MSG-145 an empty thread reply cannot be sent', async ({ alice, data, api }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const parent = uniqueText('empty reply');
    await alice.app.sendAndConfirm(parent);
    await api.users.waitForConversation(alice.user.uid, peer.uid);
    await alice.app.messages.message(parent).choose(THREAD);
    const { thread } = alice.app;
    const before = await thread.messages.messages.count();

    await expect(thread.composer.sendButton).toBeDisabled();
    await thread.composer.input.click();
    await thread.composer.input.press('Enter');

    await expect(thread.messages.messages).toHaveCount(before);
  });

  test('MSG-146 deleting a parent with replies leaves a deleted placeholder and no crash', async ({ alice, data, api }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const parent = uniqueText('parent to delete');
    await alice.app.sendAndConfirm(parent);
    await api.users.waitForConversation(alice.user.uid, peer.uid);
    await alice.app.messages.message(parent).choose(THREAD);
    const reply = uniqueText('reply under it');
    await alice.app.thread.composer.sendWithEnter(reply);
    await alice.app.thread.messages.message(reply).waitUntilSent();
    await alice.app.thread.closeButton.click();

    await alice.app.messages.message(parent).choose(t('message_list_option_delete'));
    await new ConfirmDialog(alice.page, t('message_list_option_delete')).button(t('message_list_option_delete')).click();

    await expect(alice.app.messages.deleted()).toHaveCount(1);
    await alice.app.reload();
    await alice.app.openConversation(peer.name);
    await expect(alice.app.composer.input).toBeVisible();
  });
});
