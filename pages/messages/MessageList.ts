import type { Locator, Page } from '@playwright/test';
import { t } from '@i18n/t';
import { MessageBubble } from './MessageBubble';

/**
 * The type as it appears in the article's accessible name ("<sender>, <type> message").
 * Extension messages expose their raw SDK type (A11Y-012), e.g. "extension_sticker".
 */
export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'file'
  | 'groupMember'
  | 'meeting'
  | 'extension_sticker'
  | 'extension_poll'
  | 'extension_document'
  | 'extension_whiteboard';

/**
 * UIKit CometChatMessageList: region → log "Message list" → article per message.
 * `scope` separates the main chat from the thread panel, which has its own list.
 */
export class MessageList {
  readonly region: Locator;
  readonly log: Locator;
  readonly messages: Locator;
  readonly dateSeparators: Locator;
  readonly loading: Locator;
  readonly scrollToBottomButton: Locator;
  readonly newMessagesDivider: Locator;
  readonly errorState: Locator;

  constructor(
    readonly page: Page,
    scope: Locator = page.locator('body')
  ) {
    this.region = scope.getByRole('region', { name: t('accessibility_message_list') });
    this.log = this.region.getByRole('log', { name: t('accessibility_message_list') });
    this.messages = this.log.getByRole('article');
    this.dateSeparators = this.log.getByRole('separator', { name: t('accessibility_date_separator') });
    this.loading = this.region.getByRole('status', { name: t('accessibility_loading_messages') });
    this.scrollToBottomButton = this.region.locator('.cometchat-message-list__scroll-to-bottom');
    this.newMessagesDivider = this.region.locator('.cometchat-message-list__new-message-divider');
    this.errorState = this.region.getByRole('alert');
  }

  /** The message whose own text contains `text` (quoted text in a reply does not count). */
  message(text: string): MessageBubble {
    return new MessageBubble(
      this.page,
      this.messages.filter({ has: this.page.locator('.cometchat-text-bubble__text', { hasText: text }) })
    );
  }

  /** Messages of one type, e.g. ofType('image'); articles are named "<sender>, <type> message". */
  ofType(type: MessageType): Locator {
    return this.log.getByRole('article', { name: new RegExp(`, ${type} message$`) });
  }

  /** A message of one type as a bubble (hover toolbar, options…). */
  bubbleOfType(type: MessageType, index = 0): MessageBubble {
    return new MessageBubble(this.page, this.ofType(type).nth(index));
  }

  /** Nth-from-last article as a bubble (0 = last). Only for chats no other test writes to. */
  last(offset = 0): MessageBubble {
    return new MessageBubble(this.page, offset === 0 ? this.messages.last() : this.messages.nth(-1 - offset));
  }

  deleted(): Locator {
    return this.log.getByText(t('message_deleted'), { exact: true });
  }
}
