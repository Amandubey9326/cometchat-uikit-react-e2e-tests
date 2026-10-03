import { t } from '@i18n/t';
import { expect, test } from '@fixtures/test.fixture';

test.describe('Users list', { tag: ['@users', '@regression'] }, () => {
  test('USR-01 the list loads with alphabetical section headers', async ({ alice }) => {
    await alice.app.home.openTab('users');

    await expect(alice.app.users.list.getByRole('option').first()).toBeVisible();
    await expect(alice.app.users.region.locator('.cometchat-users__section-header').first()).toHaveText(/^[A-Z#]$/);
  });

  const searches = [
    { name: 'exact name', term: (n: string) => n },
    { name: 'lower-case', term: (n: string) => n.toLowerCase() },
    // User search matches from the start of the name or UID only; a word in the middle is not found (server behaviour).
    { name: 'the beginning of the name', term: (n: string) => n.slice(0, n.indexOf(' ') + 4) },
  ];
  for (const s of searches) {
    test(`USR-02/03 search by ${s.name} finds the user`, async ({ alice, bob }) => {
      await alice.app.home.openTab('users');

      await alice.app.users.search(s.term(bob.user.name));

      await expect(alice.app.users.item(bob.user.name)).toBeVisible();
    });
  }

  test('USR-04 a search with no match shows the empty state', async ({ alice }) => {
    await alice.app.home.openTab('users');

    await alice.app.users.search('zz-no-such-person-%$#');

    await expect(alice.app.users.emptyState).toBeVisible();
  });

  test('USR-05 clearing the search restores the full list', async ({ alice, bob }) => {
    await alice.app.home.openTab('users');
    await alice.app.users.search(bob.user.name);
    await expect(alice.app.users.list.getByRole('option')).toHaveCount(1);

    await alice.app.users.search('');

    await expect.poll(() => alice.app.users.list.getByRole('option').count()).toBeGreaterThan(1);
  });

  test('USR-06 selecting a user opens the 1:1 chat', { tag: '@smoke' }, async ({ alice, bob }) => {
    await alice.app.openChatWith(bob.user);

    await expect(alice.app.header.titleFor(bob.user.name)).toBeVisible();
    await expect(alice.app.composer.input).toBeEditable();
  });

  test('USR-07 presence: the header shows Online, then Offline when the user leaves', async ({ alice, data, loginAs }) => {
    const peer = await data.user('visitor');
    await alice.app.openChatWith(peer);
    // Offline has no status element — the text is part of the banner's name ("<name>, Offline").
    const offline = new RegExp(`, ${t('message_header_offline')}$`);
    await expect(alice.app.header.banner).toHaveAccessibleName(offline);

    const visitor = await loginAs(peer);
    await expect(alice.app.header.banner).toHaveAccessibleName(new RegExp(`, ${t('message_header_online')}$`));

    await visitor.context.close();
    await expect(alice.app.header.banner).toHaveAccessibleName(offline, { timeout: 60_000 });
  });

  test('USR-08 scrolling loads more users', async ({ alice }) => {
    await alice.app.home.openTab('users');
    const options = alice.app.users.list.getByRole('option');
    await expect(options.first()).toBeVisible();
    const initial = await options.count();

    await expect(async () => {
      await options.last().scrollIntoViewIfNeeded();
      expect(await options.count()).toBeGreaterThan(initial);
    }).toPass({ timeout: 30_000 });
  });

  test(
    'USR-09 arrow keys move through the users and Enter opens a chat',
    { tag: '@a11y', annotation: { type: 'bug', description: 'A11Y-010 — listbox options ignore ArrowUp/ArrowDown (Users list too)' } },
    async ({ alice }) => {
      test.fail(true, 'A11Y-010');
      await alice.app.home.openTab('users');
      const options = alice.app.users.list.getByRole('option');
      await options.first().focus();

      await alice.page.keyboard.press('ArrowDown');
      await expect(options.nth(1)).toBeFocused();
      await alice.page.keyboard.press('Enter');

      await expect(alice.app.header.detailsButton).toBeVisible();
  }
  );

  test('USR-10 if users fail to load, an error is shown', { tag: '@network' }, async ({ alice }) => {
    alice.net.allow(/\/users/);
    await alice.page.route(/\/v3(\.0)?\/users\?/, route => route.fulfill({ status: 500, json: { error: { message: 'boom' } } }));

    await alice.app.home.openTab('users');

    await expect(alice.app.users.region.getByText(t('user_error_subtitle'))).toBeVisible();
  });
});
