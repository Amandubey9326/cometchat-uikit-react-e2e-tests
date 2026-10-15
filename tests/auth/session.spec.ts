import { expect, test } from '@fixtures/test.fixture';
import { CredentialsPage } from '@pages/auth/CredentialsPage';
import { LoginPage } from '@pages/auth/LoginPage';
import { ChatApp } from '@pages/ChatApp';
import { HomePage } from '@pages/home/HomePage';
import { CREDENTIAL_KEYS, corruptSdkSession, readSdkSession, readStorage } from '@utils/session';

test.describe('Session', { tag: '@auth' }, () => {
  test('AUTH-15 the session survives a reload', { tag: '@critical' }, async ({ alice }) => {
    await alice.app.reload();

    await alice.app.home.openMenu();
    await expect(alice.app.home.menuItem(alice.user.name)).toBeVisible();
    expect((await readSdkSession(alice.page))?.uid).toBe(alice.user.uid);
  });

  test('AUTH-16 a new browser context with the saved session opens straight into Home', async ({ alice, browser, userContextOptions }) => {
    // Arrange — take Alice's saved session (what survives a browser restart).
    const saved = await alice.context.storageState();

    // Act — a brand-new browser context restored from it.
    const context = await browser.newContext({ ...userContextOptions, storageState: saved });
    try {
      const app = new ChatApp(await context.newPage());
      await app.open();

      // Assert
      await expect(new LoginPage(app.page).uidInput).toBeHidden();
      await expect(new CredentialsPage(app.page).continueButton).toBeHidden();
      await app.home.openMenu();
      await expect(app.home.menuItem(alice.user.name)).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('AUTH-17 logout returns to the login screen and stays logged out after reload', { tag: ['@smoke', '@critical'] }, async ({ data, loginAs }) => {
    // Arrange — a throw-away user, so no shared session is ended.
    const me = await data.user('logout');
    const { page, app } = await loginAs(me);
    const login = new LoginPage(page);

    // Act
    await app.home.logout();

    // Assert — login screen, SDK session gone, app credentials kept.
    await login.expectVisible();
    expect(await readSdkSession(page)).toBeNull();
    const stored = await readStorage(page, CREDENTIAL_KEYS);
    expect(Object.values(stored).every(Boolean)).toBe(true);
    await page.reload();
    await login.expectVisible();
    await expect(app.home.chatsRegion).toBeHidden();
  });

  test('AUTH-18 after logout, the next user sees none of the previous user\'s data', async ({ data, api, loginAs }) => {
    // Arrange — the first user has a conversation; the second has none.
    const first = await data.user('first');
    const second = await data.user('second');
    const peer = await data.user('peer');
    await api.messages.sendText(peer.uid, { uid: first.uid }, 'only for the first user');
    const { page, app } = await loginAs(first);
    await expect(app.conversations.item(peer.name)).toBeVisible();

    // Act — log out and log in as the second user in the same tab.
    await app.home.logout();
    await new LoginPage(page).loginWithUid(second.uid);
    await app.home.waitForReady();

    // Assert
    await expect(app.conversations.emptyState).toBeVisible();
    await expect(app.conversations.item(peer.name)).toHaveCount(0);
    await app.home.openMenu();
    await expect(app.home.menuItem(second.name)).toBeVisible();
    await expect(app.home.menuItem(first.name)).toHaveCount(0);
  });

  test(
    'AUTH-20 a revoked / expired session sends the user back to login',
    { annotation: { type: 'bug', description: 'BUG-005 — stays on a broken Home ("OOPS! Looks like something went wrong")' } },
    async ({ data, api, loginAs }) => {
      test.fail(true, 'BUG-005');
      // Arrange — log in, then revoke that session's auth token on the server.
      const me = await data.user('revoked');
      const { page, net } = await loginAs(me);
      net.allow(/^401 /, /^: Object$/);
      const session = await readSdkSession(page);
      expect(session).not.toBeNull();
      await api.users.revokeAuthToken(me.uid, session!.authToken);

      // Act
      await page.reload();

      // Assert
      await new LoginPage(page).expectVisible();
    }
  );

  test(
    'AUTH-25 a corrupted saved session does not crash the app',
    { annotation: { type: 'bug', description: 'BUG-006 — white screen, uncaught SyntaxError from JSON.parse' } },
    async ({ data, loginAs }) => {
      test.fail(true, 'BUG-006');
      const me = await data.user('corrupt');
      const { page, net } = await loginAs(me);
      net.allow(/SyntaxError/);
      await corruptSdkSession(page);

      await page.reload();

      // Any usable screen (login or Home) is acceptable; a blank page is not.
      await expect(new LoginPage(page).uidInput.or(new HomePage(page).chatsRegion)).toBeVisible();
    }
  );

  test('AUTH-19 two users signed in at the same time keep separate sessions', async ({ alice, bob }) => {
    await expect(alice.app.home.chatsRegion).toBeVisible();
    await expect(bob.app.home.chatsRegion).toBeVisible();

    await alice.app.openChatWith(bob.user);
    await bob.app.openChatWith(alice.user);
    await bob.app.reload(); // one user's reload must not disturb the other's session

    expect((await readSdkSession(alice.page))?.uid).toBe(alice.user.uid);
    expect((await readSdkSession(bob.page))?.uid).toBe(bob.user.uid);
    await expect(alice.app.header.titleFor(bob.user.name)).toBeVisible();
  });
});
