import { env } from '@config/env';
import { RUN_PREFIX } from '@config/run';
import { expect, test } from '@fixtures/test.fixture';
import { openLoginScreen } from '@flows/sign-in';
import { CredentialsPage } from '@pages/auth/CredentialsPage';
import { LoginPage } from '@pages/auth/LoginPage';
import type { TestUser } from '@data/personas';
import { HomePage } from '@pages/home/HomePage';
import { readSdkSession } from '@utils/session';

const OTHER_REGION = env.region === 'eu' ? 'us' : 'eu';
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

test.describe('Login', { tag: '@auth' }, () => {
  const existing = (u: TestUser) => u.uid;
  const unknown = () => `${RUN_PREFIX}u-does-not-exist`;
  const rejected = [
    { id: 'AUTH-04', name: 'a wrong App ID', credentials: { appId: 'pw0000000000000000' }, uidFor: existing },
    { id: 'AUTH-05', name: 'a wrong Auth Key', credentials: { authKey: 'deadbeef'.repeat(5) }, uidFor: existing },
    { id: 'AUTH-06', name: 'the wrong region', credentials: { region: OTHER_REGION }, uidFor: existing },
    { id: 'AUTH-11', name: 'an unknown UID', credentials: {}, uidFor: unknown },
  ];
  for (const c of rejected) {
    test(`${c.id} login with ${c.name} shows an error and stays on the login screen`, async ({ page, data }) => {
      // Arrange
      const user = await data.user('neg');
      const uid = c.uidFor(user);
      const login = new LoginPage(page);
      await page.goto('/');
      await new CredentialsPage(page).submit({
        appId: env.appId,
        region: env.region,
        authKey: env.authKey,
        ...c.credentials,
      });
      await login.expectVisible();

      // Act
      await login.loginWithUid(uid);

      // Assert
      await expect(login.error).toBeVisible();
      await expect(login.error).not.toBeEmpty();
      await expect(login.uidInput).toBeVisible();
      await expect(new HomePage(page).chatsRegion).toBeHidden();
      expect(await readSdkSession(page)).toBeNull();
    });
  }

  test(
    'AUTH-24 a failed login tells the user why (unknown UID)',
    { annotation: { type: 'bug', description: 'BUG-004 — every failure shows the generic "Login failed"' } },
    async ({ page }) => {
      test.fail(true, 'BUG-004');
      const login = await openLoginScreen(page);

      await login.loginWithUid(`${RUN_PREFIX}u-does-not-exist`);

      await expect(login.error).toBeVisible();
      await expect(login.error).toHaveText(/not exist|not found|invalid uid/i, { timeout: 5_000 });
    }
  );

  test('AUTH-09 a valid UID opens Home as that user with Chats active', { tag: ['@smoke', '@critical'] }, async ({ data, loginAs }) => {
    const me = await data.user('login');

    const { app } = await loginAs(me);

    await expect(app.home.tab('chats').locator('.cometchat-tab-component__tab-text-active')).toBeVisible();
    await app.home.openMenu();
    await expect(app.home.menuItem(me.name)).toBeVisible();
  });

  test('AUTH-10 clicking a sample-user card logs in as that user', async ({ page, data }) => {
    // Arrange — the sample-user list (fetched at runtime) is replaced with our own test user.
    const me = await data.user('card');
    await page.route('**/sampleapp/v2/sampledata.json', route =>
      route.fulfill({ json: { users: [{ uid: me.uid, name: me.name, avatar: TINY_PNG }] } })
    );
    const login = await openLoginScreen(page);
    const home = new HomePage(page);

    // Act
    await login.sampleUser(me.uid).click();

    // Assert
    await home.waitForReady();
    await home.openMenu();
    await expect(home.menuItem(me.name)).toBeVisible();
  });

  const blankUids = [
    { name: 'empty', value: '' },
    { name: 'whitespace-only', value: '   ' },
  ];
  for (const blank of blankUids) {
    test(`AUTH-12 an ${blank.name} UID is not submitted`, async ({ page }) => {
      const login = await openLoginScreen(page);

      await login.loginWithUid(blank.value);

      await expect(login.uidInput).toBeVisible();
      await expect(login.error).toBeHidden();
      expect(await readSdkSession(page)).toBeNull();
    });
  }

  test('AUTH-13 spaces around the UID are ignored', async ({ page, data }) => {
    const me = await data.user('trim');
    const login = await openLoginScreen(page);
    const home = new HomePage(page);

    await login.loginWithUid(`   ${me.uid}   `);

    await home.waitForReady();
    expect((await readSdkSession(page))?.uid).toBe(me.uid);
  });

  test('AUTH-14 pressing Enter in the UID field logs in', async ({ page, data }) => {
    const me = await data.user('enter');
    const login = await openLoginScreen(page);
    const home = new HomePage(page);

    await login.uidInput.fill(me.uid);
    await login.uidInput.press('Enter');

    await home.waitForReady();
    expect((await readSdkSession(page))?.uid).toBe(me.uid);
  });

  test('AUTH-21 if the sample-user list cannot be fetched, the built-in fallback users are shown', async ({ page, net }) => {
    net.allow(/sampledata\.json/);
    await page.route('**/sampleapp/v2/sampledata.json', route => route.abort());

    const login = await openLoginScreen(page);

    await expect(login.sampleUsers).toHaveCount(4);
    for (const uid of ['superhero1', 'superhero2', 'superhero3', 'superhero4']) {
      await expect(login.sampleUser(uid)).toBeVisible();
    }
  });

  test(
    'AUTH-22 sample-user cards can be reached with the keyboard',
    { tag: '@a11y', annotation: { type: 'bug', description: 'A11Y-002 — cards are divs with onClick, no role / tabindex' } },
    async ({ page }) => {
      test.fail(true, 'A11Y-002');
      const login = await openLoginScreen(page);
      const card = login.sampleUsers.first();
      await expect(card).toBeVisible();

      await card.focus();

      await expect(card).toBeFocused({ timeout: 2_000 });
    }
  );
});

