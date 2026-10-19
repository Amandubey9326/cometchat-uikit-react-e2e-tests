import { shortId, uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { t } from '@i18n/t';
import { ConfirmDialog } from '@pages/components/Dialogs';

/**
 * Group Info actions — cases from the "Group Actions" tab of CometChat_Features_All_Test_Cases.xlsx
 * (GA_xxx) that the core suite did not cover yet. Online dots (GA_028) = MSGLIST-082,
 * "added" notice (GA_066) = MSGLIST-033, Delete & Exit for members (GA_021) = GRP-13.
 */
test.describe('Group actions (sheet cases)', { tag: ['@groups', '@regression'] }, () => {
  test('GA-002/025 Group Info shows the group initials and each member\'s avatar', async ({ alice, bob, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user], name: `Rapid Alpha ${shortId()}` });
    await alice.app.openGroup(group.name);

    await alice.app.openDetails();

    await expect(alice.page.getByRole('img', { name: group.name }).last()).toContainText('RA');
    await expect(alice.app.groupDetails.members.member(bob.user.name).getByRole('img', { name: bob.user.name })).toBeVisible();
  });

  test('GA-009 Add Members shows an empty state when nobody can be added', { tag: '@network' }, async ({ alice, data }) => {
    const group = await data.group({ owner: alice.user });
    await alice.app.openGroup(group.name);
    await alice.app.openDetails();
    // On the shared app there are always users to add, so the users list is answered empty.
    await alice.page.route(/\/v3(\.0)?\/users\?/, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"data":[],"meta":{}}' }));

    await alice.app.groupDetails.action(t('add_members')).click();

    await expect(alice.page.locator('.cometchat-add-members').getByText(t('user_empty_title'))).toBeVisible();
  });

  test('GA-011/012/013 Delete Chat asks to confirm and clears the group chat, keeping the group', async ({ alice, bob, data, api }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    const text = uniqueText('old group message');
    await api.messages.sendText(bob.user.uid, { guid: group.guid }, text);
    await alice.app.openGroup(group.name);
    await expect(alice.app.messages.message(text).root).toBeVisible();
    await alice.app.openDetails();

    await alice.app.groupDetails.action(t('delete_chat')).click();
    const confirm = new ConfirmDialog(alice.page, t('delete_chat'));
    await expect(confirm.dialog).toContainText(t('confirm_delete_chat'));
    await confirm.button(t('delete_chat')).click();

    await alice.app.home.openTab('chats');
    await expect(alice.app.conversations.item(group.name)).toHaveCount(0);
    await alice.app.home.openTab('groups');
    await alice.app.groups.search(group.name);
    await expect(alice.app.groups.item(group.name)).toBeVisible();
  });

  test('GA-014 Delete Chat is disabled for a group without messages', async ({ alice, data }) => {
    const group = await data.group({ owner: alice.user });
    await alice.app.openGroup(group.name);

    await alice.app.openDetails();

    await expect(alice.app.groupDetails.action(t('delete_chat'))).toHaveClass(/--disabled/);
  });

  test('GA-019/020/065 the owner sees Delete & Exit, which warns before deleting', async ({ alice, bob, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    await alice.app.openGroup(group.name);
    await alice.app.openDetails();

    const action = alice.app.groupDetails.action(t('delete_and_exit'));
    await expect(action).toBeVisible();
    await action.click();

    const confirm = new ConfirmDialog(alice.page, t('delete_and_exit'));
    await expect(confirm.dialog).toBeVisible();
    await expect(confirm.dialog).toContainText(/delete/i);
    await confirm.button(t('cancel')).click();
    await expect(confirm.dialog).toBeHidden();
  });

  test('GA-022 a participant does not get Delete & Exit', { tag: '@permissions' }, async ({ alice, erin, data }) => {
    const group = await data.group({ owner: alice.user, participants: [erin.user] });
    await erin.app.openGroup(group.name);

    await erin.app.openDetails();

    await expect(erin.app.groupDetails.action(t('leave'))).toBeVisible();
    await expect(erin.app.groupDetails.action(t('delete_and_exit'))).toHaveCount(0);
  });

  test('GA-032 Banned Members is empty when nobody is banned', async ({ alice, bob, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    await alice.app.openGroup(group.name);
    await alice.app.openDetails();

    await alice.app.groupDetails.tab('banned').click();

    await expect(alice.app.groupDetails.bannedList).toContainText(t('sample_no_banned_members'));
  });

  test('GA-062 cancelling Ownership Transfer keeps the owner', { tag: '@permissions' }, async ({ alice, bob, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    await alice.app.openGroup(group.name);
    await alice.app.openDetails();
    await alice.app.groupDetails.action(t('leave')).click();
    const transfer = alice.page.getByRole('dialog').filter({ hasText: t('ownership_transfer') });
    await expect(transfer).toBeVisible();

    await transfer.getByRole('button', { name: t('cancel') }).click();

    await expect(transfer).toBeHidden();
    await expect(alice.app.groupDetails.members.member(alice.user.name)).toContainText(t('member_scope_owner'));
  });

  test('GA-064 an owner who is the only member is offered Delete & Exit instead of Leave', async ({ alice, data }) => {
    const group = await data.group({ owner: alice.user });
    await alice.app.openGroup(group.name);

    await alice.app.openDetails();

    await expect(alice.app.groupDetails.action(t('leave'))).toHaveCount(0);
    await expect(alice.app.groupDetails.action(t('delete_and_exit'))).toBeVisible();
  });

  test('GA-068/070 ban and unban notices name the member and appear in order', async ({ alice, erin, data }) => {
    const group = await data.group({ owner: alice.user, participants: [erin.user] });
    await alice.app.openGroup(group.name);
    await alice.app.openDetails();
    const details = alice.app.groupDetails;

    const menu = await details.members.openOptions(erin.user.name);
    await menu.getByRole('menuitem', { name: t('members_block'), exact: true }).click();
    await details.tab('banned').click();
    await details.bannedList.getByRole('button', { name: t('unban') }).first().click();

    const notices = alice.app.messages.log.getByRole('status').filter({ hasText: erin.user.name });
    await expect(notices.filter({ hasText: t('message_list_action_unbanned') })).toBeVisible();
    const texts = await notices.allInnerTexts();
    const banned = texts.findIndex(x => new RegExp(`\\b${t('message_list_action_banned')}\\b`).test(x));
    const unbanned = texts.findIndex(x => x.includes(t('message_list_action_unbanned')));
    expect(banned, 'a "banned" notice').toBeGreaterThanOrEqual(0);
    expect(unbanned, '"unbanned" comes after "banned"').toBeGreaterThan(banned);
  });
});
