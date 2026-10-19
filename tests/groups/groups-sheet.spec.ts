import { shortId, uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { t } from '@i18n/t';
import { ConfirmDialog } from '@pages/components/Dialogs';
import { CreateGroupDialog, JoinGroupDialog } from '@pages/groups/GroupDialogs';
import { RUN_PREFIX } from '@config/run';
import { delayResponse } from '@utils/network';

/**
 * Groups module — cases from the "Modules (Users+Groups)" tab of
 * CometChat_Features_All_Test_Cases.xlsx (GROUPS_xxx) that the core suite did not cover yet.
 * UI-created groups are registered with data.uiGroup() so they are cleaned up.
 */
const uiName = (label: string) => `${RUN_PREFIX}ui ${label}`;

test.describe('Groups (sheet cases)', { tag: ['@groups', '@regression'] }, () => {
  test('GROUPS-003/006 a group without an image shows an initials avatar', async ({ alice, data }) => {
    const group = await data.group({ owner: alice.user, name: `Rapid Alpha ${shortId()}` });
    await alice.app.home.openTab('groups');
    await alice.app.groups.search(group.name);

    await expect(alice.app.groups.item(group.name).getByRole('img', { name: group.name })).toContainText('RA');
  });

  test('GROUPS-007 an empty groups list shows the empty state', { tag: '@network' }, async ({ alice }) => {
    // The shared app always has public groups, so the server's answer is replaced by an empty page.
    await alice.page.route(/\/v3(\.0)?\/groups\?/, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"data":[],"meta":{}}' }));

    await alice.app.home.openTab('groups');

    await expect(alice.app.groups.emptyState).toBeVisible();
  });

  test('GROUPS-008 a very long group name is cut with an ellipsis without breaking the row', async ({ alice, data }) => {
    const name = `Long ${'group name '.repeat(12)}${shortId()}`;
    const group = await data.group({ owner: alice.user, name });
    await alice.app.home.openTab('groups');
    await alice.app.groups.search(group.name.slice(0, 20));
    const item = alice.app.groups.item(group.name);
    await expect(item).toBeVisible();

    const list = (await alice.app.groups.list.boundingBox())!;
    const row = (await item.boundingBox())!;
    expect(row.x + row.width).toBeLessThanOrEqual(list.x + list.width + 1);
    const truncated = await item.evaluate(el =>
      Array.from(el.querySelectorAll<HTMLElement>('*')).some(n => n.scrollWidth > n.clientWidth && getComputedStyle(n).textOverflow === 'ellipsis')
    );
    expect(truncated, 'the name is truncated with an ellipsis').toBe(true);
  });

  test('GROUPS-013 group search is case-insensitive', async ({ alice, data }) => {
    const group = await data.group({ owner: alice.user, name: `Hello Team ${shortId()}` });
    await alice.app.home.openTab('groups');

    await alice.app.groups.search(group.name.toLowerCase());

    await expect(alice.app.groups.item(group.name)).toBeVisible();
  });

  test('GROUPS-017 a group search with special characters shows the empty state without errors', async ({ alice }) => {
    await alice.app.home.openTab('groups');

    await alice.app.groups.search('@#$%');

    await expect(alice.app.groups.emptyState).toBeVisible();
  });

  test('GROUPS-019 the selected group is highlighted', async ({ alice, data }) => {
    const group = await data.group({ owner: alice.user });
    await alice.app.home.openTab('groups');
    await alice.app.groups.search(group.name);

    await alice.app.groups.item(group.name).click();

    await expect(alice.app.groups.item(group.name)).toHaveAttribute('aria-selected', 'true');
  });

  test('GROUPS-022 the Create Group button gives hover feedback', async ({ alice }) => {
    await alice.app.home.openTab('groups');
    const button = alice.app.groups.createGroupButton;
    const look = () => button.evaluate(el => {
      const st = getComputedStyle(el);
      return `${st.backgroundColor}|${st.color}|${st.opacity}`;
    });
    const before = await look();

    await button.hover();

    const after = await look();
    const tooltip = (await button.getAttribute('title')) ?? '';
    expect(after !== before || tooltip !== '', 'colour changes on hover, or a tooltip is offered').toBe(true);
    expect(await button.evaluate(el => getComputedStyle(el).cursor)).toBe('pointer');
  });

  test('GROUPS-025 the Groups welcome pane shows its icon', async ({ alice }) => {
    await alice.app.home.openTab('groups');

    await expect(alice.app.home.emptyPaneTitle).toBeVisible();
    await expect(alice.page.locator('.cometchat-empty-state-view').locator('svg, img, [class*="icon"]').first()).toBeVisible();
  });

  test('GROUPS-030 a loading state shows while the groups list is slow', { tag: '@network' }, async ({ alice }) => {
    await delayResponse(alice.page, /\/v3(\.0)?\/groups\?/, { ms: 4_000 });

    await alice.app.home.openTab('groups');

    await expect(alice.page.getByRole('status', { name: t('accessibility_loading_groups') })).toBeVisible({ timeout: 3_000 });
    await expect(alice.app.groups.list.getByRole('option').first()).toBeVisible({ timeout: 15_000 });
  });

  test('GROUPS-040 a group name with special characters and emoji is created and shown correctly', async ({ alice, data }) => {
    const name = data.uiGroup(uiName(`Team 🚀 & Co. #${shortId()}`));
    await alice.app.home.openTab('groups');
    await alice.app.groups.createGroupButton.click();
    const dialog = new CreateGroupDialog(alice.page);

    await dialog.nameInput.fill(name);
    await dialog.createButton.click();

    await expect(dialog.dialog).toBeHidden();
    await alice.app.home.openTab('groups');
    await alice.app.groups.search(name);
    await expect(alice.app.groups.item(name)).toContainText(name);
  });

  test('GROUPS-041 a 100+ character group name is handled without breaking the app', async ({ alice, data }) => {
    const name = data.uiGroup(uiName(`${'very long name '.repeat(8)}${shortId()}`));
    await alice.app.home.openTab('groups');
    await alice.app.groups.createGroupButton.click();
    const dialog = new CreateGroupDialog(alice.page);

    await dialog.nameInput.fill(name);
    await dialog.createButton.click();

    await expect(dialog.dialog).toBeHidden();
    await alice.app.home.openTab('groups');
    await alice.app.groups.search(name.slice(0, 30));
    await expect(alice.app.groups.list.getByRole('option').first()).toBeVisible();
  });

  test('GROUPS-043 a name of only spaces is not accepted', async ({ alice }) => {
    await alice.app.home.openTab('groups');
    await alice.app.groups.createGroupButton.click();
    const dialog = new CreateGroupDialog(alice.page);
    let created = false;
    alice.page.on('request', r => {
      if (r.method() === 'POST' && /\/groups$/.test(r.url())) created = true;
    });

    await dialog.nameInput.fill('     ');
    await dialog.createButton.click();

    await expect(dialog.dialog).toBeVisible();
    expect(created, 'no group is created').toBe(false);
  });

  test('GROUPS-045 a duplicate group name creates a separate group without errors', async ({ alice, data }) => {
    const existing = await data.group({ owner: alice.user, name: uiName(`Twin ${shortId()}`) });
    data.uiGroup(existing.name);
    await alice.app.home.openTab('groups');
    await alice.app.groups.createGroupButton.click();
    const dialog = new CreateGroupDialog(alice.page);

    await dialog.nameInput.fill(existing.name);
    await dialog.createButton.click();

    await expect(dialog.dialog).toBeHidden();
    await alice.app.home.openTab('groups');
    await alice.app.groups.search(existing.name);
    await expect(alice.app.groups.item(existing.name)).toHaveCount(2);
  });

  test('GROUPS-046 creating a group without network shows an error and adds nothing', { tag: '@network' }, async ({ alice }) => {
    const name = uiName(`Offline ${shortId()}`);
    await alice.app.home.openTab('groups');
    await alice.app.groups.createGroupButton.click();
    const dialog = new CreateGroupDialog(alice.page);
    await dialog.nameInput.fill(name);
    alice.net.allow(/.*/);

    await alice.context.setOffline(true);
    await dialog.createButton.click();

    await expect(dialog.dialog.getByRole('alert').or(alice.page.getByRole('alert'))).toBeVisible();
    await alice.context.setOffline(false);
    await alice.app.groups.search(name);
    await expect(alice.app.groups.item(name)).toHaveCount(0);
  });

  test('GROUPS-048 Back / Close closes the form without creating a group', async ({ alice }) => {
    const name = uiName(`Never ${shortId()}`);
    await alice.app.home.openTab('groups');
    await alice.app.groups.createGroupButton.click();
    const dialog = new CreateGroupDialog(alice.page);
    await dialog.nameInput.fill(name);

    await dialog.closeButton.click();

    await expect(dialog.dialog).toBeHidden();
    await expect(alice.app.groups.region).toBeVisible();
    await alice.app.groups.search(name);
    await expect(alice.app.groups.item(name)).toHaveCount(0);
  });

  test('GROUPS-050 a new group has 1 member — the creator', async ({ alice, data }) => {
    const name = data.uiGroup(uiName(`Solo ${shortId()}`));
    await alice.app.home.openTab('groups');
    await alice.app.groups.createGroupButton.click();
    const dialog = new CreateGroupDialog(alice.page);
    await dialog.nameInput.fill(name);
    await dialog.createButton.click();
    await expect(dialog.dialog).toBeHidden();

    await alice.app.home.openTab('groups');
    await alice.app.groups.search(name);

    await expect(alice.app.groups.item(name)).toContainText(/\b1 member\b/i);
  });

  test('GROUPS-058 the group password field hides what is typed', async ({ alice, frank, data }) => {
    const group = await data.group({ owner: alice.user, type: 'password', password: 'secret-pass-1' });
    await frank.app.home.openTab('groups');
    await frank.app.groups.search(group.name);
    await frank.app.groups.item(group.name).click();
    const join = new JoinGroupDialog(frank.page);

    await join.passwordInput.fill('secret-pass-1');

    await expect(join.passwordInput).toHaveAttribute('type', 'password');
  });

  test('GROUPS-060 an empty password cannot be submitted', async ({ alice, frank, data }) => {
    const group = await data.group({ owner: alice.user, type: 'password', password: 'secret-pass-1' });
    await frank.app.home.openTab('groups');
    await frank.app.groups.search(group.name);

    await frank.app.groups.item(group.name).click();

    const join = new JoinGroupDialog(frank.page);
    await expect(join.dialog).toBeVisible();
    await expect(join.joinButton).toBeDisabled();
  });

  test('GROUPS-062 a banned user cannot join the group again', async ({ alice, frank, data, api }) => {
    const group = await data.group({ owner: alice.user, participants: [frank.user] });
    await api.groups.ban(group.guid, frank.user.uid);
    await frank.app.reload();

    await frank.app.home.openTab('groups');
    await frank.app.groups.search(group.name);
    await frank.app.groups.item(group.name).click();

    await expect(frank.app.composer.input).toBeHidden();
    await expect(frank.page.getByText(t('you_have_been_banned')).or(frank.page.getByRole('alert'))).toBeVisible();
  });

  test('GROUPS-063 joining without network does not join', { tag: '@network' }, async ({ alice, frank, data }) => {
    const group = await data.group({ owner: alice.user });
    await frank.app.home.openTab('groups');
    await frank.app.groups.search(group.name);
    frank.net.allow(/.*/);

    await frank.context.setOffline(true);
    await frank.app.groups.item(group.name).click();
    await frank.context.setOffline(false);

    await alice.app.openGroup(group.name);
    await alice.app.openDetails();
    await expect(alice.app.groupDetails.members.member(frank.user.name)).toHaveCount(0);
  });

  test('GROUPS-066 a member can leave a public group and join it again', async ({ alice, erin, data }) => {
    const group = await data.group({ owner: alice.user, participants: [erin.user] });
    await erin.app.openGroup(group.name);
    await erin.app.openDetails();
    await erin.app.groupDetails.action(t('leave')).click();
    await new ConfirmDialog(erin.page, t('leave_group')).button(t('leave')).click();

    await erin.app.openGroup(group.name); // rejoins a public group
    const back = uniqueText('back again');
    await erin.app.sendAndConfirm(back);

    await alice.app.openGroup(group.name);
    await expect(alice.app.messages.message(back).root).toBeVisible();
  });
});
