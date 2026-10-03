import { expect, type Locator, type Page } from '@playwright/test';

/** Sample-app login screen. Its strings are hard-coded English (not localized). */
export class LoginPage {
  readonly uidInput: Locator;
  readonly loginButton: Locator;
  readonly error: Locator;
  /** "Change App Credentials" is a span with onClick, no role (A11Y-002). */
  readonly changeCredentialsLink: Locator;
  readonly sampleUsers: Locator;

  constructor(readonly page: Page) {
    this.uidInput = page.getByRole('textbox', { name: 'Your UID' });
    this.loginButton = page.getByRole('button', { name: 'Login' });
    this.error = page.locator('.cometchat-login__error');
    this.changeCredentialsLink = page.getByText('App Credentials', { exact: true });
    this.sampleUsers = page.locator('.cometchat-login__user');
  }

  /** Sample-user card (div + onClick, no role — A11Y-002). */
  sampleUser(uid: string): Locator {
    return this.page.locator('.cometchat-login__user').filter({ hasText: uid });
  }

  async expectVisible(): Promise<void> {
    await expect(this.uidInput).toBeVisible();
  }

  async loginWithUid(uid: string): Promise<void> {
    await this.uidInput.fill(uid);
    await this.loginButton.click();
  }
}
