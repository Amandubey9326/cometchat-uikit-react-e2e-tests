import type { Locator, Page } from '@playwright/test';
import { t } from '@i18n/t';

/** UIKit CometChatEmojiKeyboard — used by the composer and as the reaction picker. */
export class EmojiKeyboard {
  readonly dialog: Locator;
  readonly search: Locator;
  readonly categories: Locator;

  constructor(readonly page: Page) {
    this.dialog = page.getByRole('dialog', { name: t('accessibility_emoji_keyboard') });
    this.search = this.dialog.getByRole('searchbox');
    this.categories = this.dialog.getByRole('tablist', { name: t('accessibility_emoji_categories') });
  }

  /** Emoji cell by its short name, e.g. 'joy' → 😂. */
  emoji(name: string): Locator {
    return this.dialog.getByRole('gridcell', { name, exact: true });
  }

  category(name: string): Locator {
    return this.categories.getByRole('tab', { name });
  }
}
