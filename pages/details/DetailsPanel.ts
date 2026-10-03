import { expect, type Locator, type Page } from '@playwright/test';
import { t } from '@i18n/t';
import { startsWithWord } from '@utils/text';

/**
 * Sample-app side panel ("User Info" / "Group Info"). Its close icon and
 * actions are divs with onClick and no role (A11Y-003), so they are located by
 * their class + visible text.
 */
export class DetailsPanel {
  readonly headerText: Locator;
  readonly closeIcon: Locator;
  readonly title: Locator;
  readonly description: Locator;
  readonly actions: Locator;

  constructor(readonly page: Page) {
    this.headerText = page.locator('.side-component-header__text');
    this.closeIcon = page.locator('.side-component-header__icon');
    this.title = page.locator('.side-component-content__title');
    this.description = page.locator('.side-component-content__description');
    this.actions = page.locator('.side-component-content__action-item');
  }

  action(name: string): Locator {
    return this.actions.filter({ hasText: new RegExp(`^${name}$`) });
  }
}

export class UserDetails extends DetailsPanel {
  async expectOpen(): Promise<void> {
    await expect(this.headerText).toHaveText(t('user_info'));
  }
}

/** UIKit CometChatGroupMembers inside the Group Info panel. */
export class GroupMembers {
  readonly region: Locator;
  readonly list: Locator;
  readonly searchBox: Locator;
  readonly emptyState: Locator;

  constructor(readonly page: Page) {
    this.region = page.getByRole('region', { name: t('group_members_header') });
    this.list = this.region.getByRole('listbox', { name: t('accessibility_group_members_list') });
    this.searchBox = this.region.getByRole('searchbox');
    this.emptyState = this.region.getByText(t('member_empty_title'));
  }

  member(name: string): Locator {
    return this.list.getByRole('option', { name: startsWithWord(name) });
  }

  /** Opens a member's options (Kick / Ban / Change Scope). */
  async openOptions(name: string): Promise<Locator> {
    const item = this.member(name);
    await item.hover();
    await item.getByRole('button', { name: t('accessibility_more_options') }).click();
    const menu = this.page.getByRole('menu', { name: t('accessibility_context_menu') });
    await expect(menu).toBeVisible();
    return menu;
  }
}

export class GroupDetails extends DetailsPanel {
  readonly tabs: Locator;
  readonly members: GroupMembers;
  readonly bannedList: Locator;

  constructor(page: Page) {
    super(page);
    this.tabs = page.locator('.side-component-group-tabs > *');
    this.members = new GroupMembers(page);
    this.bannedList = page.locator('.side-component-group-members-with-tabs');
  }

  tab(kind: 'members' | 'banned'): Locator {
    return this.tabs.filter({ hasText: t(kind === 'members' ? 'view_members' : 'banned_members') });
  }

  async expectOpen(): Promise<void> {
    await expect(this.headerText).toHaveText(t('group_info'));
  }
}
