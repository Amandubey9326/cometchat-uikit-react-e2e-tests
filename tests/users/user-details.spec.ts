import { t } from '@i18n/t';
import { uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { ConfirmDialog } from '@pages/components/Dialogs';

test.describe('User details & blocking', { tag: ['@users', '@regression'] }, () => {
  test('UDET-01/02 the header opens User Info with name and status, and it closes', async ({ alice, bob }) => {
    await alice.app.openChatWith(bob.user);
    const details = alice.app.userDetails;

    await alice.app.header.detailsButton.click();

    await details.expectOpen();
    await expect(details.title).toHaveText(bob.user.name);
    await expect(details.description).toHaveText(new RegExp(`^(${t('call_logs_user_status_online')}|${t('call_logs_user_status_offline')})$`));
    await details.closeIcon.click();
    await expect(details.headerText).toBeHidden();
  });

  test('UDET-03/06 block replaces the composer (also after reload); unblock restores it', { tag: '@critical' }, async ({ data, loginAs }) => {
    const me = await data.user('blocker');
    const peer = await data.user('blocked');
    const { app, page } = await loginAs(me);
    await app.openChatWith(peer);
    const banner = page.locator('.cometchat-messages__blocked-banner');

    await app.header.detailsButton.click();
    await app.userDetails.action(t('user_details_block')).click();
    const confirm = new ConfirmDialog(page, t('block_contact'));
    await expect(confirm.dialog).toContainText(t('confirm_block_contact'));
    await confirm.button(t('user_details_block')).click();

    await expect(banner).toContainText(t('cannot_send_to_blocked_user'));
    await expect(app.composer.input).toBeHidden();
    await app.reload();
    await app.openChatWith(peer, { composer: false });
    await expect(banner).toBeVisible();

    await banner.getByText(t('click_to_unblock')).click();
    await expect(banner).toBeHidden();
    await expect(app.composer.input).toBeVisible();
  });

  test('UDET-04 cancelling the block changes nothing', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    await alice.app.header.detailsButton.click();

    await alice.app.userDetails.action(t('user_details_block')).click();
    await new ConfirmDialog(alice.page, t('block_contact')).button(t('cancel')).click();

    await expect(alice.app.userDetails.action(t('user_details_block'))).toBeVisible();
    await expect(alice.app.composer.input).toBeVisible();
  });

  test('UDET-05 messages from a blocked user are not delivered', { tag: '@permissions' }, async ({ data, api, loginAs }) => {
    const me = await data.user('blocker');
    const peer = await data.user('blocked');
    await api.messages.sendText(peer.uid, { uid: me.uid }, uniqueText('before block'));
    const { app, page } = await loginAs(me);
    await app.openConversation(peer.name);
    await app.header.detailsButton.click();
    await app.userDetails.action(t('user_details_block')).click();
    await new ConfirmDialog(page, t('block_contact')).button(t('user_details_block')).click();
    await expect(page.locator('.cometchat-messages__blocked-banner')).toBeVisible();

    const after = uniqueText('after block');
    await api.messages.sendText(peer.uid, { uid: me.uid }, after).catch(() => undefined);

    await expect(app.conversations.item(peer.name)).not.toContainText(after, { timeout: 10_000 });
    await expect(app.messages.message(after).root).toHaveCount(0);
  });

  test('UDET-07 "Delete Chat" removes the conversation, also after reload', async ({ data, api, loginAs }) => {
    const me = await data.user('tidy');
    const peer = await data.user('peer');
    await api.messages.sendText(peer.uid, { uid: me.uid }, uniqueText('old chat'));
    const { app, page } = await loginAs(me);
    await app.openConversation(peer.name);
    await app.header.detailsButton.click();

    await app.userDetails.action(t('delete_chat')).click();
    await new ConfirmDialog(page, t('delete_chat')).button(t('delete_chat')).click();

    await expect(app.conversations.item(peer.name)).toHaveCount(0);
    await app.reload();
    await expect(app.conversations.item(peer.name)).toHaveCount(0);
  });

  test(
    'UDET-08 Block, Delete Chat and Close can be reached with the keyboard',
    { tag: '@a11y', annotation: { type: 'bug', description: 'A11Y-003 — divs with onClick, not focusable' } },
    async ({ alice, bob }) => {
      test.fail(true, 'A11Y-003');
      await alice.app.openChatWith(bob.user);
      await alice.app.header.detailsButton.click();
      const block = alice.app.userDetails.action(t('user_details_block'));

      await block.focus();

      await expect(block).toBeFocused({ timeout: 2_000 });
    }
  );
});
