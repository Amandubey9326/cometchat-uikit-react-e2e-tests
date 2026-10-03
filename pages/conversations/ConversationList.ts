import { expect, type Locator, type Page } from '@playwright/test';
import { t } from '@i18n/t';
import { escapeRegExp, startsWithWord } from '@utils/text';

/** UIKit CometChatConversations inside the sample app's Chats pane. */
export class ConversationList {
  readonly region: Locator;
  readonly list: Locator;
  readonly items: Locator;
  readonly searchBox: Locator;
  readonly emptyState: Locator;

  constructor(readonly page: Page) {
    this.region = page.getByRole('region', { name: t('conversation_chat_title') });
    this.list = this.region.getByRole('listbox', { name: t('accessibility_conversations_list') });
    this.items = this.list.getByRole('option');
    this.searchBox = this.region.getByRole('searchbox', { name: t('accessibility_search') });
    // Hard-coded English in UIKit, ignores the conversation_empty_title key (L10N-002).
    this.emptyState = this.region.locator('.cometchat-conversations__empty-state-title');
  }

  /** Option names start with the conversation's display name. */
  item(name: string): Locator {
    return this.list.getByRole('option', { name: startsWithWord(name) });
  }

  /** The item's accessible name ends with "{count} unread messages" when there are unread messages. */
  unreadLabel(count: number): RegExp {
    return new RegExp(`${escapeRegExp(t('accessibility_unread_messages', { count }))}$`);
  }

  unreadSuffix(): RegExp {
    return new RegExp(`${escapeRegExp(t('accessibility_unread_messages', { count: 'X' })).replace('X', '\\d+')}$`);
  }

  deleteButton(name: string): Locator {
    return this.item(name).getByRole('button', { name: t('conversation_delete_icon_hover'), exact: true });
  }

  typing(name: string): Locator {
    return this.item(name).getByText(t('conversation_subtitle_typing'));
  }

  /**
   * Hover first: a row re-renders on hover (time + badge → Delete button), and WebKit drops a click
   * that lands in the same frame as the pointer entering (OBS-017). Real mouse and touch users are
   * unaffected — they hover before clicking, and a tap works first time.
   */
  async open(name: string): Promise<void> {
    await this.item(name).hover();
    await expect(this.deleteButton(name)).toBeVisible();
    await this.item(name).click();
    await expect(this.item(name)).toHaveAttribute('aria-selected', 'true');
  }
}
