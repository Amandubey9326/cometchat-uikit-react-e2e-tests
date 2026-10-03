import { t } from '@i18n/t';
import { RUN_PREFIX } from '@config/run';
import { uniqueMarker, uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { ConfirmDialog } from '@pages/components/Dialogs';
import { CreateGroupDialog, JoinGroupDialog, type GroupKind } from '@pages/groups/GroupDialogs';

/** UI-created groups get an app-generated guid; the run prefix in the name lets teardown find them. */
const uiGroupName = () => `${RUN_PREFIX}ui ${uniqueMarker()}`;

test.describe('Groups', { tag: ['@groups', '@regression'] }, () => {
  test('GRP-01 the list shows member count and a type badge', async ({ alice, bob, carol, data }) => {
    const group = await data.group({ owner: alice.user, type: 'password', participants: [bob.user, carol.user] });

    await alice.app.home.openTab('groups');
    await alice.app.groups.search(group.name);

    const item = alice.app.groups.item(group.name);
    await expect(item).toContainText(`3 ${t('message_header_members')}`);
    await expect(item.locator('.cometchat-groups__item-type-badge')).toBeVisible();
  });

  test('GRP-02 group search: partial match, no match and clear', async ({ alice, data }) => {
    const group = await data.group({ owner: alice.user });
    await alice.app.home.openTab('groups');
    const { groups } = alice.app;

    await groups.search(group.name.split(' ').slice(-2).join(' '));
    await expect(groups.item(group.name)).toBeVisible();
    await groups.search('zz-no-such-group-%$#');
    await expect(groups.emptyState).toBeVisible();
    await groups.search('');
    await expect.poll(() => groups.list.getByRole('option').count()).toBeGreaterThan(1);
  });

  const kinds: GroupKind[] = ['public', 'private'];
  for (const kind of kinds) {
    test(`GRP-03/04 create a ${kind} group; the creator is its owner`, async ({ alice, data }) => {
      const name = data.uiGroup(uiGroupName());
      await alice.app.home.openTab('groups');
      await alice.app.groups.createGroupButton.click();
      const dialog = new CreateGroupDialog(alice.page);

      await dialog.type(kind).check();
      await dialog.nameInput.fill(name);
      await dialog.createButton.click();

      await expect(dialog.dialog).toBeHidden();
      await alice.app.openGroup(name);
      await alice.app.openDetails();
      await expect(alice.app.groupDetails.members.member(alice.user.name)).toContainText(t('member_scope_owner'));
    });
  }

  test('GRP-05 create a password group', async ({ alice, data }) => {
    const name = data.uiGroup(uiGroupName());
    await alice.app.home.openTab('groups');
    await alice.app.groups.createGroupButton.click();
    const dialog = new CreateGroupDialog(alice.page);

    await dialog.type('password').check();
    await dialog.nameInput.fill(name);
    await dialog.passwordInput.fill('pw-secret-7');
    await dialog.createButton.click();

    await expect(dialog.dialog).toBeHidden();
    await alice.app.home.openTab('groups');
    await alice.app.groups.search(name);
    await expect(alice.app.groups.item(name).locator('.cometchat-groups__item-type-badge')).toBeVisible();
  });

  test('GRP-05 a password group needs a password', async ({ alice }) => {
    await alice.app.home.openTab('groups');
    await alice.app.groups.createGroupButton.click();
    const dialog = new CreateGroupDialog(alice.page);
    await dialog.type('password').check();
    await dialog.nameInput.fill(uiGroupName());
    let created = false;
    alice.page.on('request', r => {
      if (r.method() === 'POST' && /\/groups$/.test(r.url())) created = true;
    });

    await dialog.createButton.click();

    await expect.poll(() => CreateGroupDialog.isMissing(dialog.passwordInput)).toBe(true);
    await expect(dialog.dialog).toBeVisible();
    expect(created, 'no create-group request is sent').toBe(false);
  });

  test('GRP-06 a group needs a name', async ({ alice }) => {
    await alice.app.home.openTab('groups');
    await alice.app.groups.createGroupButton.click();
    const dialog = new CreateGroupDialog(alice.page);

    await dialog.createButton.click();

    await expect.poll(() => CreateGroupDialog.isMissing(dialog.nameInput)).toBe(true);
    await expect(dialog.dialog).toBeVisible();
  });

  test('GRP-07 the New Group dialog closes with its Close button', async ({ alice }) => {
    await alice.app.home.openTab('groups');
    await alice.app.groups.createGroupButton.click();
    const dialog = new CreateGroupDialog(alice.page);

    await dialog.closeButton.click();

    await expect(dialog.dialog).toBeHidden();
  });

  test(
    'GRP-07 the New Group dialog closes with Escape',
    { tag: '@a11y', annotation: { type: 'bug', description: 'A11Y-005 — Escape does not close the New Group dialog' } },
    async ({ alice }) => {
      test.fail(true, 'A11Y-005');
      await alice.app.home.openTab('groups');
      await alice.app.groups.createGroupButton.click();
      const dialog = new CreateGroupDialog(alice.page);
      await expect(dialog.dialog).toBeVisible();

      await alice.page.keyboard.press('Escape');

      await expect(dialog.dialog).toBeHidden({ timeout: 3_000 });
    }
  );

  test('GRP-08 an outsider joins a public group and the members see it live', async ({ alice, frank, data }) => {
    const group = await data.group({ owner: alice.user });
    await alice.app.openGroup(group.name);

    await frank.app.openGroup(group.name);
    const hello = uniqueText('newcomer says hi');
    await frank.app.sendAndConfirm(hello);

    await expect(alice.app.messages.log).toContainText(`${frank.user.name} ${t('message_list_action_joined')}`);
    await expect(alice.app.messages.message(hello).root).toBeVisible();
  });

  test('GRP-09 a password group rejects a wrong password and accepts the right one', async ({ alice, frank, data }) => {
    const group = await data.group({ owner: alice.user, type: 'password', password: 'right-pass-1' });
    await frank.app.home.openTab('groups');
    await frank.app.groups.search(group.name);
    await frank.app.groups.item(group.name).click();
    const join = new JoinGroupDialog(frank.page);
    await expect(join.dialog).toBeVisible();

    await expect(join.joinButton).toBeDisabled(); // nothing typed yet
    await join.passwordInput.fill('wrong-pass');
    await join.joinButton.click();
    await expect(join.error).toBeVisible();
    await join.passwordInput.fill('right-pass-1');
    await join.joinButton.click();

    await expect(join.dialog).toBeHidden();
    await expect(frank.app.header.titleFor(group.name)).toBeVisible();
  });

  test('GRP-10 a private group is not visible to an outsider', { tag: '@permissions' }, async ({ alice, frank, data }) => {
    const group = await data.group({ owner: alice.user, type: 'private' });

    await frank.app.home.openTab('groups');
    await frank.app.groups.search(group.name);

    await expect(frank.app.groups.item(group.name)).toHaveCount(0);
  });

  test('GRP-11 a participant leaves; the conversation goes away and members see it', async ({ alice, erin, data }) => {
    const group = await data.group({ owner: alice.user, participants: [erin.user] });
    await alice.app.openGroup(group.name);
    await erin.app.openGroup(group.name);
    await erin.app.sendAndConfirm(uniqueText('see you all'));

    await erin.app.openDetails();
    await erin.app.groupDetails.action(t('leave')).click();
    await new ConfirmDialog(erin.page, t('leave_group')).button(t('leave')).click();

    await erin.app.home.openTab('chats');
    await expect(erin.app.conversations.item(group.name)).toHaveCount(0);
    await expect(alice.app.messages.log).toContainText(`${erin.user.name} ${t('message_list_action_left')}`);
  });

  test('GRP-12 the owner must transfer ownership before leaving', { tag: '@permissions' }, async ({ alice, bob, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    await alice.app.openGroup(group.name);
    await alice.app.openDetails();

    await alice.app.groupDetails.action(t('leave')).click();

    await expect(alice.page.getByText(t('ownership_transfer'))).toBeVisible();
  });

  // The SDK has no "group deleted" event for members, so the member's list is checked after a reload.
  test('GRP-13 "Delete and Exit" by the owner removes the group for its members', async ({ alice, bob, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    await bob.app.openGroup(group.name);
    await alice.app.openGroup(group.name);
    await alice.app.openDetails();

    await alice.app.groupDetails.action(t('delete_and_exit')).click();
    await new ConfirmDialog(alice.page, t('delete_and_exit')).button(t('delete_and_exit')).click();

    await alice.app.home.openTab('groups');
    await alice.app.groups.search(group.name);
    await expect(alice.app.groups.item(group.name)).toHaveCount(0);
    await bob.app.reload();
    await bob.app.home.openTab('groups');
    await bob.app.groups.search(group.name);
    await expect(bob.app.groups.item(group.name)).toHaveCount(0);
  });

  test('GRP-14 scrolling loads more groups', async ({ alice }) => {
    await alice.app.home.openTab('groups');
    const options = alice.app.groups.list.getByRole('option');
    await expect(options.first()).toBeVisible();
    const initial = await options.count();

    await expect(async () => {
      await options.last().scrollIntoViewIfNeeded();
      expect(await options.count()).toBeGreaterThan(initial);
    }).toPass({ timeout: 30_000 });
  });

  test('GRP-15 if groups fail to load, an error is shown', { tag: '@network' }, async ({ alice }) => {
    alice.net.allow(/\/groups/);
    await alice.page.route(/\/v3(\.0)?\/groups\?/, route => route.fulfill({ status: 500, json: { error: { message: 'boom' } } }));

    await alice.app.home.openTab('groups');

    await expect(alice.app.groups.region.getByText(t('group_error_subtitle'))).toBeVisible();
  });
});
