import type { Locator, Page } from '@playwright/test';
import { t } from '@i18n/t';

export type SearchFilter = 'audio' | 'documents' | 'groups' | 'photos' | 'videos' | 'links' | 'unread';

/** UIKit CometChatSearch — global (Chats search box) or scoped (message header Search). */
export class SearchPanel {
  readonly root: Locator;
  readonly input: Locator;
  readonly backButton: Locator;
  readonly clearButton: Locator;
  readonly filters: Locator;
  readonly conversations: Locator;
  readonly messages: Locator;
  readonly noResults: Locator;

  constructor(readonly page: Page) {
    this.root = page.getByRole('search', { name: t('search_title') });
    this.input = this.root.getByRole('searchbox');
    this.backButton = this.root.getByRole('button', { name: t('accessibility_back') });
    this.clearButton = this.root.getByRole('button', { name: t('accessibility_clear_search') });
    this.filters = this.root.getByRole('toolbar');
    this.conversations = this.root.getByRole('region', { name: t('search_conversation_header') }).getByRole('listitem');
    this.messages = this.root.getByRole('region', { name: t('search_messages_header') }).getByRole('listitem');
    this.noResults = this.root.getByText(t('search_no_result_title'));
  }

  filter(name: SearchFilter): Locator {
    return this.filters.getByRole('button', { name: t(`search_filter_${name}`), exact: true });
  }
}
