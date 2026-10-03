import type { Locator, Page } from '@playwright/test';
import { t } from '@i18n/t';
import { startsWithWord } from '@utils/text';

/** UIKit CometChatUsers inside the sample app's Users tab. */
export class UsersList {
  readonly region: Locator;
  readonly list: Locator;
  readonly searchBox: Locator;
  readonly emptyState: Locator;

  constructor(readonly page: Page) {
    this.region = page.getByRole('region', { name: t('user_title') });
    this.list = this.region.getByRole('listbox', { name: t('accessibility_users_list') });
    this.searchBox = this.region.getByRole('searchbox');
    this.emptyState = this.region.getByText(t('user_empty_title'));
  }

  item(name: string): Locator {
    return this.list.getByRole('option', { name: startsWithWord(name) });
  }

  async search(text: string): Promise<void> {
    await this.searchBox.fill(text);
  }
}
