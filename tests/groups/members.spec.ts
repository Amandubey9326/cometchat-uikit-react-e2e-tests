import { t } from '@i18n/t';
import { expect, test } from '@fixtures/test.fixture';
import { ConfirmDialog } from '@pages/components/Dialogs';
import type { GroupSpec } from '@fixtures/test-data';
import type { TestUser } from '@data/personas';
import { startsWithWord } from '@utils/text';

const KICK = t('members_remove');
const BAN = t('members_block');
const SCOPE = t('members_change_role');

test.describe('Group members & permissions', { tag: ['@groups', '@regression'] }, () => {
  test('MEM-01 Group Info shows name, member count and each member\'s scope', async ({ alice, data }) => {
    const [carol, dave, erin] = [await data.user('carol'), await data.user('dave'), await data.user('erin')];
    const group = await data.group({ owner: alice.user, admins: [carol], moderators: [dave], participants: [erin] });
    await alice.app.openGroup(group.name);

    await alice.app.openDetails();

    const { groupDetails } = alice.app;
    await groupDetails.expectOpen();
    await expect(groupDetails.title).toHaveText(group.name);
    await expect(groupDetails.description).toContainText(`4 ${t('message_header_members')}`);
    const m = groupDetails.members;
    await expect(m.member(alice.user.name)).toContainText(t('member_scope_owner'));
    await expect(m.member(carol.name)).toContainText(t('group_members_admin'));
    await expect(m.member(dave.name)).toContainText(t('group_members_moderator'));
    await expect(m.member(erin.name)).not.toContainText(new RegExp(`${t('member_scope_owner')}|${t('group_members_admin')}|${t('group_members_moderator')}`));
  });

  test('MEM-02 members can be searched; no match shows the empty state', async ({ alice, data }) => {
    const erin = await data.user('erin');
    const frank = await data.user('frank');
    const group = await data.group({ owner: alice.user, participants: [erin, frank] });
    await alice.app.openGroup(group.name);
    await alice.app.openDetails();
    const { members } = alice.app.groupDetails;

    await members.searchBox.fill(erin.name);
    await expect(members.member(erin.name)).toBeVisible();
    await expect(members.member(frank.name)).toHaveCount(0);
    await members.searchBox.fill('zz-no-such-member');
    await expect(members.emptyState).toBeVisible();
  });

  test('MEM-03 the owner adds a member; the count updates and the new member sees the group', async ({ alice, frank, data }) => {
    const group = await data.group({ owner: alice.user });
    await alice.app.openGroup(group.name);
    await alice.app.openDetails();

    await alice.app.groupDetails.action(t('add_members')).click();
    const sheet = alice.page.locator('.cometchat-add-members');
    await sheet.getByRole('searchbox').fill(frank.user.name);
    await sheet.getByRole('option', { name: startsWithWord(frank.user.name) }).click();
    await sheet.locator('.cometchat-add-members__add-btn').click();

    await expect(alice.app.groupDetails.members.member(frank.user.name)).toBeVisible();
    await expect(alice.app.groupDetails.description).toContainText(`2 ${t('message_header_members')}`);
    await frank.app.home.openTab('chats');
    await expect(frank.app.conversations.item(group.name)).toBeVisible();
  });

  test('MEM-04/13 kicking a participant removes them; they are told, and an action message is shown', async ({ alice, erin, data }) => {
    const group = await data.group({ owner: alice.user, participants: [erin.user] });
    await erin.app.openGroup(group.name);
    await alice.app.openGroup(group.name);
    await alice.app.openDetails();

    const menu = await alice.app.groupDetails.members.openOptions(erin.user.name);
    await menu.getByRole('menuitem', { name: KICK, exact: true }).click();

    await expect(alice.app.groupDetails.members.member(erin.user.name)).toHaveCount(0);
    await expect(erin.page.getByText(t('you_have_been_kicked'))).toBeVisible();
    await expect(alice.app.messages.log).toContainText(t('message_list_action_kicked'));
  });

  test('MEM-05/06 a banned member appears under Banned Members and can be unbanned', async ({ alice, erin, data }) => {
    const group = await data.group({ owner: alice.user, participants: [erin.user] });
    await erin.app.openGroup(group.name);
    await alice.app.openGroup(group.name);
    await alice.app.openDetails();
    const details = alice.app.groupDetails;

    const menu = await details.members.openOptions(erin.user.name);
    await menu.getByRole('menuitem', { name: BAN, exact: true }).click();
    await expect(erin.page.getByText(t('you_have_been_banned'))).toBeVisible();
    await details.tab('banned').click();
    const bannedRow = details.bannedList.getByText(erin.user.name);
    await expect(bannedRow).toBeVisible();

    await details.bannedList.getByRole('button', { name: t('unban') }).first().click();
    await expect(bannedRow).toHaveCount(0);
  });

  test('MEM-07/08 changing scope promotes and demotes; other members see it live', async ({ alice, carol, data }) => {
    const erin = await data.user('erin');
    const group = await data.group({ owner: alice.user, admins: [carol.user], participants: [erin] });
    await carol.app.openGroup(group.name);
    await carol.app.openDetails();
    await alice.app.openGroup(group.name);
    await alice.app.openDetails();

    const changeScope = async (target: TestUser, scopeLabel: string) => {
      const menu = await alice.app.groupDetails.members.openOptions(target.name);
      await menu.getByRole('menuitem', { name: SCOPE, exact: true }).click();
      const dialog = alice.page.getByRole('dialog', { name: t('change_scope_title') });
      // The native radio is 0×0 with pointer-events: none — users click the row's label.
      await dialog.locator('.cometchat-change-scope__list-item', { hasText: scopeLabel }).click();
      await expect(dialog.getByRole('radio', { name: scopeLabel })).toBeChecked();
      await dialog.getByRole('button', { name: t('change_scope_confirm_yes') }).click();
      await expect(dialog).toBeHidden();
    };

    // Option labels are the raw scope ids capitalised ("Admin"), not translations (L10N-005).
    await changeScope(erin, 'Admin');
    await expect(alice.app.groupDetails.members.member(erin.name)).toContainText(t('group_members_admin'));
    await expect(carol.app.groupDetails.members.member(erin.name)).toContainText(t('group_members_admin'));

    await changeScope(erin, 'Participant');
    await expect(alice.app.groupDetails.members.member(erin.name)).not.toContainText(t('group_members_admin'));
  });

  test('MEM-09 the owner transfers ownership before leaving', async ({ alice, carol, data }) => {
    const group = await data.group({ owner: alice.user, participants: [carol.user] });
    await alice.app.openGroup(group.name);
    await alice.app.openDetails();

    await alice.app.groupDetails.action(t('leave')).click();
    await new ConfirmDialog(alice.page, t('ownership_transfer')).button(t('continue')).click();
    const transfer = alice.page.locator('.cometchat-transfer-ownership');
    await transfer.getByRole('option', { name: startsWithWord(carol.user.name) }).locator('.cometchat-radio-button__label').click();
    await expect(transfer.getByRole('radio', { name: `Select ${carol.user.name} as new owner` })).toBeChecked(); // hard-coded English (L10N-005)
    await transfer.getByRole('button', { name: t('transfer') }).click();
    await expect(transfer).toBeHidden();

    await carol.app.openGroup(group.name);
    await carol.app.openDetails();
    await expect(carol.app.groupDetails.members.member(carol.user.name)).toContainText(t('member_scope_owner'));
  });

  // Documented v7 matrix (docs: ui-kit/react/guide-group-chat-setup): actor acting on a PARTICIPANT.
  type Cast = { actor: TestUser; owner: TestUser; target: TestUser };
  // BUG-017: the member list decides the viewer's scope before it knows who is logged in, so admins
  // and moderators get no member actions at all (the owner is detected separately and works).
  const matrix: Array<{ role: string; allowed: string[]; bug?: string; group: (c: Cast) => GroupSpec }> = [
    { role: 'owner', allowed: [KICK, BAN, SCOPE], group: c => ({ owner: c.actor, participants: [c.target] }) },
    { role: 'admin', allowed: [KICK, BAN, SCOPE], bug: 'BUG-017', group: c => ({ owner: c.owner, admins: [c.actor], participants: [c.target] }) },
    { role: 'moderator', allowed: [KICK, BAN, SCOPE], bug: 'BUG-017', group: c => ({ owner: c.owner, moderators: [c.actor], participants: [c.target] }) },
  ];
  for (const row of matrix) {
    test(
      `MEM-10 a ${row.role} acting on a participant sees exactly the permitted actions`,
      { tag: ['@permissions', '@critical'], annotation: row.bug ? [{ type: 'bug', description: `${row.bug} — admins / moderators get no member actions` }] : [] },
      async ({ alice, data }) => {
        test.fail(Boolean(row.bug), row.bug);
        const cast = { actor: alice.user, owner: await data.user('owner'), target: await data.user('target') };
        const group = await data.group(row.group(cast));
        await alice.app.openGroup(group.name);
        await alice.app.openDetails();
        const item = alice.app.groupDetails.members.member(cast.target.name);
        await item.hover();

        const menu = await alice.app.groupDetails.members.openOptions(cast.target.name);

        await expect(menu.getByRole('menuitem')).toHaveText(row.allowed); // exactly these, in this order
      }
    );
  }

  test('MEM-10 a participant acting on a participant has no member actions', { tag: ['@permissions', '@critical'] }, async ({ alice, data }) => {
    const target = await data.user('target');
    const group = await data.group({ owner: await data.user('owner'), participants: [alice.user, target] });
    await alice.app.openGroup(group.name);
    await alice.app.openDetails();
    const item = alice.app.groupDetails.members.member(target.name);

    await item.hover();

    await expect(item.getByRole('button', { name: t('accessibility_more_options') })).toHaveCount(0);
  });

  // Note: while BUG-017 is open this passes trivially (a moderator has no member actions at all).
  test('MEM-11 nobody below the owner can act on the owner; a moderator cannot act on an admin', { tag: '@permissions' }, async ({ alice, data }) => {
    const owner = await data.user('owner');
    const admin = await data.user('admin');
    const group = await data.group({ owner, admins: [admin], moderators: [alice.user] });
    await alice.app.openGroup(group.name);
    await alice.app.openDetails();
    const { members } = alice.app.groupDetails;

    for (const target of [owner, admin]) {
      await members.member(target.name).hover();
      await expect(members.member(target.name).getByRole('button', { name: t('accessibility_more_options') })).toHaveCount(0);
    }
  });

  test('MEM-12 the member count survives a reload', async ({ alice, data }) => {
    const group = await data.group({ owner: alice.user, participants: [await data.user('p1'), await data.user('p2')] });
    await alice.app.openGroup(group.name);

    await alice.app.reload();
    await alice.app.openGroup(group.name);
    await alice.app.openDetails();

    await expect(alice.app.groupDetails.description).toContainText(`3 ${t('message_header_members')}`);
  });
});
