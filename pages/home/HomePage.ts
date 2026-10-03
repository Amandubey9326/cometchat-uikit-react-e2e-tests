import { expect, type Locator, type Page } from '@playwright/test';
import { t } from '@i18n/t';

export type TabName = 'chats' | 'calls' | 'users' | 'groups';

/** Title of the empty right pane per tab (sample-app CometChatEmptyStateView). */
export const EMPTY_PANE_KEYS: Record<TabName, string> = {
  chats: 'sample_no_conversation_selected',
  users: 'sample_select_user_to_chat',
  groups: 'sample_select_group_to_chat',
  calls: 'sample_select_call_log',
};

/** Sample-app shell: bottom tabs, Chats header menu, empty right pane. */
export class HomePage {
  readonly chatsRegion: Locator;
  readonly moreOptionsButton: Locator;
  readonly menu: Locator;
  readonly emptyPaneTitle: Locator;
  /** Call logs have no landmark role (unlike the other panes), hence the class. */
  readonly callsPane: Locator;

  constructor(readonly page: Page) {
    this.chatsRegion = page.getByRole('region', { name: t('conversation_chat_title') });
    this.moreOptionsButton = this.chatsRegion.getByRole('button', { name: t('accessibility_more_options') });
    this.menu = page.getByRole('menu', { name: t('accessibility_context_menu') });
    this.emptyPaneTitle = page.locator('.cometchat-empty-state-view__text-title');
    this.callsPane = page.locator('.cometchat-call-logs');
  }

  /** The pane a tab shows on the left. */
  pane(name: TabName): Locator {
    const regionKey: Record<Exclude<TabName, 'calls'>, string> = {
      chats: 'conversation_chat_title',
      users: 'user_title',
      groups: 'group_title',
    };
    return name === 'calls' ? this.callsPane : this.page.getByRole('region', { name: t(regionKey[name]) });
  }

  /** Tabs are divs + onClick without role="tab" (A11Y-001), hence the class locator. */
  tab(name: TabName): Locator {
    return this.page.locator('.cometchat-tab-component__tab').filter({ hasText: t(name) });
  }

  async openTab(name: TabName): Promise<void> {
    await this.tab(name).click();
    await expect(this.tab(name).locator('.cometchat-tab-component__tab-text-active')).toBeVisible();
  }

  menuItem(name: string): Locator {
    return this.menu.getByRole('menuitem', { name });
  }

  async openMenu(): Promise<void> {
    await this.moreOptionsButton.click();
    await expect(this.menu).toBeVisible();
  }

  /** Home is ready once the Chats pane has finished its first load. */
  async waitForReady(): Promise<void> {
    await expect(this.chatsRegion).toBeVisible({ timeout: 60_000 });
    await expect(this.chatsRegion.getByRole('status', { name: t('accessibility_loading_conversations') })).toBeHidden({
      timeout: 30_000,
    });
  }

  /** The account menu only exists in the Chats pane. */
  async logout(): Promise<void> {
    await this.openTab('chats');
    await this.openMenu();
    await this.menuItem(t('log_out')).click();
  }
}
