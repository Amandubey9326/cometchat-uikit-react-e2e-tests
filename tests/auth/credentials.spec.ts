import { env } from '@config/env';
import { expect, test } from '@fixtures/test.fixture';
import { openLoginScreen } from '@flows/sign-in';
import { CredentialsPage } from '@pages/auth/CredentialsPage';
import { LoginPage } from '@pages/auth/LoginPage';
import { CREDENTIAL_KEYS, readStorage } from '@utils/session';

const NOTHING_STORED = { appId: null, region: null, authKey: null };

test.describe('Credentials screen', { tag: '@auth' }, () => {
  test('AUTH-01 shows region chips, App ID, Auth Keys and Continue', { tag: '@smoke' }, async ({ page }) => {
    const credentials = new CredentialsPage(page);

    await page.goto('/');

    await credentials.expectVisible();
    for (const region of ['us', 'eu', 'in'] as const) {
      await expect(credentials.regionChip(region)).toBeVisible();
    }
    await expect(credentials.appIdInput).toHaveAttribute('placeholder', 'Enter the app ID');
    await expect(credentials.authKeyInput).toHaveAttribute('placeholder', 'Enter the auth key');
  });

  test('AUTH-02 valid credentials open the login screen and are stored', { tag: ['@smoke', '@critical'] }, async ({ page }) => {
    const credentials = new CredentialsPage(page);
    await page.goto('/');

    await credentials.submit({ appId: env.appId, region: env.region, authKey: env.authKey });

    await new LoginPage(page).expectVisible();
    expect(await readStorage(page, CREDENTIAL_KEYS)).toEqual({
      appId: env.appId,
      region: env.region,
      authKey: env.authKey,
    });
  });

  const incomplete = [
    { name: 'an empty App ID', appId: '', authKey: env.authKey },
    { name: 'an empty Auth Key', appId: env.appId, authKey: '' },
    { name: 'a whitespace-only App ID', appId: '   ', authKey: env.authKey },
  ];
  for (const input of incomplete) {
    test(`AUTH-03 ${input.name} is not accepted`, async ({ page }) => {
      const credentials = new CredentialsPage(page);
      await page.goto('/');

      await credentials.submit({ appId: input.appId, region: env.region, authKey: input.authKey });

      // The submit handler stores synchronously before reloading, so nothing stored = rejected.
      expect(await readStorage(page, CREDENTIAL_KEYS)).toEqual(NOTHING_STORED);
      await expect(credentials.continueButton).toBeVisible();
      await expect(new LoginPage(page).uidInput).toBeHidden();
    });
  }

  test('AUTH-07 stored credentials survive a reload', async ({ page }) => {
    const login = await openLoginScreen(page);

    await page.reload();

    await login.expectVisible();
    await expect(new CredentialsPage(page).continueButton).toBeHidden();
  });

  test('AUTH-08 "Change App Credentials" returns to the credentials screen and clears them', async ({ page }) => {
    const credentials = new CredentialsPage(page);
    const login = await openLoginScreen(page);

    await login.changeCredentialsLink.click();

    await credentials.expectVisible();
    expect(await readStorage(page, CREDENTIAL_KEYS)).toEqual(NOTHING_STORED);
    await page.reload();
    await credentials.expectVisible();
  });
});
