import type { Locator, Page } from '@playwright/test';
import { t } from '@i18n/t';
import { MessageComposer } from '../messages/MessageComposer';
import { MessageList } from '../messages/MessageList';

/** Sample-app CometChatThreadPanel: thread header + its own message list and composer. */
export class ThreadPanel {
  readonly root: Locator;
  readonly header: Locator;
  readonly closeButton: Locator;
  readonly replyCount: Locator;
  readonly messages: MessageList;
  readonly composer: MessageComposer;

  constructor(readonly page: Page) {
    this.root = page.locator('.cometchat-thread-panel');
    this.header = this.root.getByRole('banner');
    this.closeButton = this.header.getByRole('button', { name: t('thread_close_hover') });
    this.replyCount = this.root.locator('.cometchat-thread-header__reply-count');
    this.messages = new MessageList(page, this.root.locator('.cometchat-thread-panel__messages'));
    this.composer = new MessageComposer(page, this.root.locator('.cometchat-thread-panel__composer-wrapper'));
  }
}
