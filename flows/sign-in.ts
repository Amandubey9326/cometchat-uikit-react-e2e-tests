import { expect, type Page } from '@playwright/test';
import { env } from '@config/env';
import { CredentialsPage } from '@pages/auth/CredentialsPage';
import { LoginPage } from '@pages/auth/LoginPage';
import { HomePage } from '@pages/home/HomePage';
import { RealtimeNotConnectedError, withRealtimeConnected } from '@utils/realtime';

export interface SignInResult {
  /** True when realtime did not connect after login (BUG-003) and a reload restored it. */
  recoveredFromBug003: boolean;
}

/** Fresh context → credentials screen → submit valid credentials → login screen. */
export async function openLoginScreen(page: Page): Promise<LoginPage> {
  const credentials = new CredentialsPage(page);
  const login = new LoginPage(page);
  await page.goto('/');
  await credentials.expectVisible();
  await credentials.submit({ appId: env.appId, region: env.region, authKey: env.authKey });
  await login.expectVisible();
  return login;
}

/** How long a healthy login takes to authenticate the realtime socket (normally < 2 s). */
const REALTIME_AFTER_LOGIN_MS = 15_000;

/**
 * Real UI sign-in on a fresh context: credentials screen (if shown) → UID
 * login → Home.
 *
 * With `realtime: true` it also waits for the realtime socket. If the socket
 * opened before login finished it never authenticates (BUG-003); the page is
 * then reloaded once — what a user would do — and the caller is told, so the
 * occurrence is reported rather than hidden.
 */
export async function signIn(page: Page, uid: string, { realtime = true } = {}): Promise<SignInResult> {
  const credentials = new CredentialsPage(page);
  const login = new LoginPage(page);
  const home = new HomePage(page);

  await page.goto('/');
  await expect(credentials.continueButton.or(login.uidInput).or(home.chatsRegion)).toBeVisible({ timeout: 60_000 });
  if (await home.chatsRegion.isVisible()) {
    throw new Error(`signIn(${uid}) expects a fresh context, but a session is already active.`);
  }
  if (await credentials.continueButton.isVisible()) {
    await credentials.submit({ appId: env.appId, region: env.region, authKey: env.authKey });
    await login.expectVisible();
  }

  if (!realtime) {
    await login.loginWithUid(uid);
    await home.waitForReady();
    return { recoveredFromBug003: false };
  }

  try {
    await withRealtimeConnected(page, () => login.loginWithUid(uid), REALTIME_AFTER_LOGIN_MS);
    await home.waitForReady();
    return { recoveredFromBug003: false };
  } catch (error) {
    if (!(error instanceof RealtimeNotConnectedError)) throw error;
    await withRealtimeConnected(page, () => page.reload());
    await home.waitForReady();
    return { recoveredFromBug003: true };
  }
}
