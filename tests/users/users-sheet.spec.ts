import { shortId, uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { t } from '@i18n/t';
import { callButton } from '@pages/calls/CallScreens';
import { ConfirmDialog } from '@pages/components/Dialogs';
import { delayResponse } from '@utils/network';

/**
 * Users module — cases from the "Modules (Users+Groups)" tab of
 * CometChat_Features_All_Test_Cases.xlsx (USERS_xxx) that the core suite did not cover yet.
 */
test.describe('Users (sheet cases)', { tag: ['@users', '@regression'] }, () => {
  test('USERS-003/004 each user shows an initials avatar and the full name', async ({ alice, data }) => {
    const peer = await data.user('avatar', { name: `Nora Quill ${shortId()}` });
    await alice.app.home.openTab('users');
    await alice.app.users.search(peer.name);
    const item = alice.app.users.item(peer.name);

    await expect(item.getByRole('img', { name: peer.name })).toContainText('NQ');
    await expect(item).toContainText(peer.name);
  });

  test('USERS-008 the selected user is highlighted', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.home.openTab('users');
    await alice.app.users.search(peer.name);

    await alice.app.users.item(peer.name).click();

    await expect(alice.app.users.item(peer.name)).toHaveAttribute('aria-selected', 'true');
  });

  test(
    'USERS-012 searching part of the last name finds the user',
    { annotation: { type: 'bug', description: 'OBS-012 — the server only matches the start of a name or UID' } },
    async ({ alice, data }) => {
      test.fail(true, 'OBS-012');
      const id = shortId();
      const peer = await data.user('grace', { name: `Nancy Gracewood${id}` });
      await alice.app.home.openTab('users');

      await alice.app.users.search(`Gracewood${id}`);

      await expect(alice.app.users.item(peer.name)).toBeVisible({ timeout: 10_000 });
    }
  );

  test('USERS-013 user search is case-insensitive', async ({ alice, data }) => {
    const peer = await data.user('susan', { name: `Susan Marie ${shortId()}` });
    await alice.app.home.openTab('users');

    await alice.app.users.search(peer.name.toUpperCase());

    await expect(alice.app.users.item(peer.name)).toBeVisible();
  });

  test('USERS-015 a search with special characters shows the empty state without errors', async ({ alice }) => {
    await alice.app.home.openTab('users');

    await alice.app.users.search('@#$%');

    await expect(alice.app.users.emptyState).toBeVisible();
    await expect(alice.app.users.searchBox).toHaveValue('@#$%');
  });

  test('USERS-016 a search of only spaces keeps the full list', async ({ alice }) => {
    await alice.app.home.openTab('users');
    const options = alice.app.users.list.getByRole('option');
    await expect(options.first()).toBeVisible();

    await alice.app.users.search('     ');

    await expect(options.first()).toBeVisible();
    await expect(alice.app.users.emptyState).toBeHidden();
  });

  test('USERS-019 one character filters to users starting with it', async ({ alice, data }) => {
    const peer = await data.user('quill', { name: `Qwyn ${shortId()}` });
    await alice.app.home.openTab('users');

    await alice.app.users.search('Q');

    await expect(alice.app.users.item(peer.name)).toBeVisible();
    const names = await alice.app.users.list.getByRole('option').allInnerTexts();
    for (const name of names) expect(name.trim().toLowerCase(), name).toMatch(/^q|\bq/);
  });

  test('USERS-024 a loading state shows while the users list is slow', { tag: '@network' }, async ({ alice }) => {
    await delayResponse(alice.page, /\/v3(\.0)?\/users\?/, { ms: 4_000 });

    await alice.app.home.openTab('users');

    await expect(alice.page.getByRole('status', { name: t('accessibility_loading_users') })).toBeVisible({ timeout: 3_000 });
    await expect(alice.app.users.list.getByRole('option').first()).toBeVisible({ timeout: 15_000 });
  });

  test('USERS-032 a blocked user has no way to call the user who blocked them', async ({ alice, bob, api }) => {
    await api.users.block(alice.user.uid, bob.user.uid); // Alice blocks Bob
    await bob.app.reload();

    await bob.app.openChatWith(alice.user, { composer: false });

    await expect(callButton(bob.app.header.banner, 'voice')).toHaveCount(0);
    await expect(callButton(bob.app.header.banner, 'video')).toHaveCount(0);
  });

  test('USERS-033 call buttons are hidden while the user is blocked', async ({ data, api, loginAs }) => {
    const me = await data.user('blocker');
    const peer = await data.user('blocked');
    await api.users.block(me.uid, peer.uid);
    const { app } = await loginAs(me);

    await app.openChatWith(peer, { composer: false });

    await expect(callButton(app.header.banner, 'voice')).toHaveCount(0);
    await expect(callButton(app.header.banner, 'video')).toHaveCount(0);
  });

  test('USERS-036 earlier messages stay after blocking and unblocking', async ({ data, api, loginAs }) => {
    const me = await data.user('blocker');
    const peer = await data.user('peer');
    const text = uniqueText('before the block');
    await api.messages.sendText(peer.uid, { uid: me.uid }, text);
    await api.users.waitForConversation(me.uid, peer.uid);
    const { app, page } = await loginAs(me);
    await app.openConversation(peer.name);
    await expect(app.messages.message(text).root).toBeVisible();

    await app.header.detailsButton.click();
    await app.userDetails.action(t('user_details_block')).click();
    await new ConfirmDialog(page, t('block_contact')).button(t('user_details_block')).click();
    const banner = page.locator('.cometchat-messages__blocked-banner');
    await expect(banner).toBeVisible();
    await banner.getByText(t('click_to_unblock')).click();
    await expect(banner).toBeHidden();

    await expect(app.messages.message(text).root).toBeVisible();
  });

  test('USERS-037 a blocked user stays in Users and Chats; opening them shows the unblock view', async ({ data, api, loginAs }) => {
    const me = await data.user('blocker');
    const peer = await data.user('blocked');
    await api.messages.sendText(peer.uid, { uid: me.uid }, uniqueText('hello before'));
    await api.users.waitForConversation(me.uid, peer.uid);
    await api.users.block(me.uid, peer.uid);
    const { app, page } = await loginAs(me);

    await expect(app.conversations.item(peer.name)).toBeVisible();
    await app.home.openTab('users');
    await app.users.search(peer.name);
    await expect(app.users.item(peer.name)).toBeVisible();
    await app.users.item(peer.name).click();

    await expect(page.locator('.cometchat-messages__blocked-banner')).toContainText(t('cannot_send_to_blocked_user'));
  });

  test('USERS-038 blocking without network leaves the user unblocked', { tag: '@network' }, async ({ data, loginAs }) => {
    const me = await data.user('blocker');
    const peer = await data.user('peer');
    const { app, page, context, net } = await loginAs(me);
    await app.openChatWith(peer);
    net.allow(/.*/);
    await app.header.detailsButton.click();

    await context.setOffline(true);
    await app.userDetails.action(t('user_details_block')).click();
    await new ConfirmDialog(page, t('block_contact')).button(t('user_details_block')).click();
    await context.setOffline(false);
    await app.reload();
    await app.openChatWith(peer);

    await expect(page.locator('.cometchat-messages__blocked-banner')).toBeHidden();
    await expect(app.composer.input).toBeVisible();
  });

  test('USERS-039 a group chat offers no Block option', async ({ alice, bob, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    await alice.app.openGroup(group.name);

    await alice.app.openDetails();

    await expect(alice.app.groupDetails.action(t('user_details_block'))).toHaveCount(0);
  });
});
