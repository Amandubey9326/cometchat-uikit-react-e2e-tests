import type { Locator, Page } from '@playwright/test';
import { t } from '@i18n/t';
import { startsWithWord } from '@utils/text';

/** Sample-app "New Chat" view (Chats menu → Create conversation). Its tabs are divs without roles. */
export class NewChatView {
  readonly root: Locator;
  readonly title: Locator;
  readonly backButton: Locator;
  readonly searchBox: Locator;

  constructor(readonly page: Page) {
    this.root = page.locator('.cometchat-new-chat-view');
    this.title = this.root.locator('.cometchat-new-chat-view__header-title');
    // aria-label "Back" is hard-coded English in the sample app.
    this.backButton = this.root.getByRole('button', { name: 'Back' });
    this.searchBox = this.root.getByRole('searchbox');
  }

  tab(kind: 'users' | 'groups'): Locator {
    return this.root
      .locator('.cometchat-new-chat-view__tabs-tab')
      .filter({ hasText: t(kind === 'users' ? 'sample_tab_users' : 'sample_tab_groups') });
  }

  item(name: string): Locator {
    return this.root.getByRole('option', { name: startsWithWord(name) });
  }
}
