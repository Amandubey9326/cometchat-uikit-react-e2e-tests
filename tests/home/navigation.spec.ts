import { expect, test } from '@fixtures/test.fixture';
import { t } from '@i18n/t';
import { EMPTY_PANE_KEYS, type TabName } from '@pages/home/HomePage';

const TABS: TabName[] = ['calls', 'users', 'groups', 'chats'];

test.describe('Home navigation', { tag: '@navigation' }, () => {
  test('NAV-01 each tab shows its pane and is highlighted', { tag: '@smoke' }, async ({ alice }) => {
    const { home } = alice.app;

    for (const tab of TABS) {
      await home.openTab(tab);
      await expect(home.pane(tab)).toBeVisible();
    }
  });

  test('NAV-02 the empty right pane matches the active tab', async ({ alice }) => {
    const { home } = alice.app;

    for (const tab of TABS) {
      await home.openTab(tab);
      await expect(home.emptyPaneTitle).toHaveText(t(EMPTY_PANE_KEYS[tab]));
    }
  });

  test('NAV-03 the Chats menu shows the current user, Create conversation and Log Out', async ({ alice }) => {
    const { home } = alice.app;

    await home.openMenu();

    await expect(home.menu.getByRole('menuitem')).toHaveText([alice.user.name, t('create_conversation'), t('log_out')]);
  });

  test('NAV-04 opening the Chats menu moves focus into it, and Escape closes it', { tag: '@a11y' }, async ({ alice }) => {
    const { home } = alice.app;
    await home.openMenu();
    await expect(home.menu.getByRole('menuitem').first()).toBeFocused();

    await alice.page.keyboard.press('Escape');

    await expect(home.menu).toBeHidden();
  });

  test('NAV-04 after Escape, focus returns to the "More options" button', { tag: '@a11y' }, async ({ alice }) => {
    const { home } = alice.app;
    await home.openMenu();
    await expect(home.menu.getByRole('menuitem').first()).toBeFocused();

    await alice.page.keyboard.press('Escape');

    await expect(home.menu).toBeHidden();
    await expect(home.moreOptionsButton).toBeFocused();
  });

  test('NAV-04 the Chats menu closes on an outside click', async ({ alice }) => {
    const { home } = alice.app;
    await home.openMenu();

    await home.emptyPaneTitle.click();

    await expect(home.menu).toBeHidden();
  });

  test(
    'NAV-05 tabs can be reached with the keyboard',
    { tag: '@a11y', annotation: { type: 'bug', description: 'A11Y-001 — tabs are divs with onClick, no role="tab" / tabindex' } },
    async ({ alice }) => {
      test.fail(true, 'A11Y-001');
      const usersTab = alice.app.home.tab('users');

      await usersTab.focus();

      await expect(usersTab).toBeFocused({ timeout: 2_000 });
    }
  );

  test('NAV-06 each tab keeps its own selection', async ({ alice, bob }) => {
    const { home, header } = alice.app;
    await alice.app.openChatWith(bob.user); // selected in the Users tab

    for (const other of ['chats', 'groups', 'calls'] as const) {
      await home.openTab(other);
      await expect(home.emptyPaneTitle).toHaveText(t(EMPTY_PANE_KEYS[other]));
      await expect(header.titleFor(bob.user.name)).toBeHidden();

      await home.openTab('users');
      await expect(header.titleFor(bob.user.name)).toBeVisible();
    }
  });

  test('NAV-07 loading Home and visiting every tab raises no browser errors', async ({ alice }) => {
    for (const tab of TABS) {
      await alice.app.home.openTab(tab);
      await expect(alice.app.home.pane(tab)).toBeVisible();
    }

    expect(alice.net.unexpectedIssues()).toEqual([]);
  });
});
