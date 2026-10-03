import type { Page } from '@playwright/test';
import { env } from '@config/env';

/** localStorage key where the Chat SDK keeps the logged-in user and auth token. */
export const SDK_USER_KEY = `${env.appId}:common_store/user`;

/** Keys the sample app's credentials screen writes. */
export const CREDENTIAL_KEYS = ['appId', 'region', 'authKey'] as const;

export async function readStorage(page: Page, keys: readonly string[]): Promise<Record<string, string | null>> {
  return page.evaluate(ks => Object.fromEntries(ks.map(k => [k, localStorage.getItem(k)])), [...keys]);
}

/** The SDK session of the current page, or null when logged out. */
export async function readSdkSession(page: Page): Promise<{ uid: string; authToken: string } | null> {
  const raw = (await readStorage(page, [SDK_USER_KEY]))[SDK_USER_KEY];
  if (!raw) return null;
  const parsed = JSON.parse(raw) as { uid?: string; authToken?: string };
  return parsed.uid && parsed.authToken ? { uid: parsed.uid, authToken: parsed.authToken } : null;
}

export async function corruptSdkSession(page: Page): Promise<void> {
  await page.evaluate(key => localStorage.setItem(key, '{not json'), SDK_USER_KEY);
}
