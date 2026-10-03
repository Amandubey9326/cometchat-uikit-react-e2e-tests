import { expect, type Locator, type Page } from '@playwright/test';

export type Region = 'us' | 'eu' | 'in';

/** Sample-app "App Credentials" screen. Its strings are hard-coded English (not localized). */
export class CredentialsPage {
  readonly appIdInput: Locator;
  readonly authKeyInput: Locator;
  readonly continueButton: Locator;

  constructor(readonly page: Page) {
    this.appIdInput = page.getByLabel('APP ID');
    this.authKeyInput = page.getByLabel('Auth Keys');
    this.continueButton = page.getByRole('button', { name: 'Continue' });
  }

  /** Region chips are plain divs without a role (A11Y-002). */
  regionChip(region: Region): Locator {
    return this.page.locator('.cometchat-credentials__region').filter({ hasText: new RegExp(`^${region}$`, 'i') });
  }

  selectedRegion(): Locator {
    return this.page.locator('.cometchat-credentials__region-selected');
  }

  async expectVisible(): Promise<void> {
    await expect(this.continueButton).toBeVisible();
  }

  async submit(credentials: { appId: string; region: Region | string; authKey: string }): Promise<void> {
    await this.regionChip(credentials.region as Region).click();
    await this.appIdInput.fill(credentials.appId);
    await this.authKeyInput.fill(credentials.authKey);
    await this.continueButton.click();
  }
}
