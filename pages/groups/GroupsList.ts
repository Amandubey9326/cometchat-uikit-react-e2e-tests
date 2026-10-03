import type { Locator, Page } from '@playwright/test';
import { t } from '@i18n/t';
import { startsWithWord } from '@utils/text';

/** UIKit CometChatGroups inside the sample app's Groups tab. */
export class GroupsList {
  readonly region: Locator;
  readonly list: Locator;
  readonly searchBox: Locator;
  readonly emptyState: Locator;
  /** aria-label "Create group" is hard-coded in the sample app (not localized). */
  readonly createGroupButton: Locator;

  constructor(readonly page: Page) {
    this.region = page.getByRole('region', { name: t('group_title') });
    this.list = this.region.getByRole('listbox', { name: t('accessibility_groups_list') });
    this.searchBox = this.region.getByRole('searchbox');
    this.emptyState = this.region.getByText(t('group_empty_title'));
    this.createGroupButton = this.region.getByRole('button', { name: 'Create group' });
  }

  item(name: string): Locator {
    return this.list.getByRole('option', { name: startsWithWord(name) });
  }

  async search(text: string): Promise<void> {
    await this.searchBox.fill(text);
  }
}
