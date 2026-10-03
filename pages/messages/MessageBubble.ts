import { expect, type Locator, type Page } from '@playwright/test';
import { t } from '@i18n/t';
import { escapeRegExp } from '@utils/text';
import { EmojiKeyboard } from '../components/EmojiKeyboard';

export type ReceiptState = 'sent' | 'delivered' | 'read' | 'sending' | 'error';

const RECEIPT_KEYS: Record<ReceiptState, string> = {
  sent: 'message_bubble_sent',
  delivered: 'message_bubble_delivered',
  read: 'message_bubble_read',
  sending: 'message_bubble_sending',
  error: 'message_bubble_error',
};

/** One message: `article "<sender>, <type> message"` in a message list. */
export class MessageBubble {
  /** The hover toolbar only appears on mouseenter of the bubble body (opacity:0 otherwise — OBS-005). */
  readonly body: Locator;
  readonly toolbar: Locator;
  /** The original text (also present, unchanged, once the message is translated). */
  readonly text: Locator;
  readonly translation: Locator;
  readonly translationLabel: Locator;
  readonly quote: Locator;
  readonly reactions: Locator;
  readonly editedLabel: Locator;
  readonly deletedText: Locator;
  readonly threadRepliesButton: Locator;
  /** Footer under a message the moderation rules blocked (sender side only). */
  readonly blockedNotice: Locator;

  constructor(
    readonly page: Page,
    readonly root: Locator
  ) {
    this.body = root.locator('.cometchat-message-bubble__body').first();
    this.toolbar = root.getByRole('toolbar');
    this.text = root.locator('.cometchat-text-bubble__text');
    this.translation = root.locator('.cometchat-text-bubble__translation-text');
    this.translationLabel = root.getByText(t('message_translation_label'), { exact: true });
    const quotedPrefix = t('accessibility_quoted_message_from', { name: '' }).trim();
    this.quote = root.getByRole('button', { name: new RegExp(`^${escapeRegExp(quotedPrefix)}`) });
    this.reactions = root.getByRole('group', { name: t('accessibility_reactions') });
    this.editedLabel = root.getByText(t('message_list_action_edited'), { exact: true });
    this.deletedText = root.getByText(t('message_deleted'), { exact: true });
    this.blockedNotice = root.getByText(t('moderation_block_message'), { exact: true });
    // Labelled "{n} Reply|Replies, view thread" (", view thread" is hard-coded — L10N-004).
    this.threadRepliesButton = root.getByRole('button', {
      name: new RegExp(`^\\d+ (${escapeRegExp(t('thread_view_reply'))}|${escapeRegExp(t('thread_view_replies'))}), view thread$`),
    });
  }

  /** Accessible name of the thread button for `count` replies. */
  static threadRepliesLabel(count: number): string {
    return `${count} ${t(count === 1 ? 'thread_view_reply' : 'thread_view_replies')}, view thread`;
  }

  receipt(state: ReceiptState): Locator {
    return this.root.getByRole('img', { name: t(RECEIPT_KEYS[state]), exact: true });
  }

  /** Reaction chip, labelled "{emoji} reacted by {count}". */
  reaction(emoji: string): Locator {
    return this.reactions.getByLabel(new RegExp(`^${escapeRegExp(emoji)} `));
  }

  /** The bubble is on screen and the server has acknowledged it (no "Sending" receipt). */
  async waitUntilSent(): Promise<void> {
    await expect(this.root).toBeVisible();
    await expect(this.receipt('sending')).toHaveCount(0);
    await expect(this.receipt('error')).toHaveCount(0);
  }

  /** Options exist only once the message is acknowledged by the server (not while "Sending"). */
  async showToolbar(): Promise<void> {
    await expect(this.receipt('sending')).toHaveCount(0);
    await expect(this.toolbar).toBeAttached();
    await this.body.hover();
    await expect(this.toolbar).toBeVisible();
  }

  async openOptions(): Promise<Locator> {
    await this.showToolbar();
    await this.toolbar.getByRole('button', { name: t('accessibility_more_options') }).click();
    const menu = this.page.getByRole('menu', { name: t('accessibility_context_menu') });
    await expect(menu).toBeVisible();
    return menu;
  }

  /** Opens "More options" and picks `name` (e.g. t('message_list_option_edit')). */
  async choose(name: string): Promise<void> {
    const menu = await this.openOptions();
    await menu.getByRole('menuitem', { name, exact: true }).click();
  }

  async reply(): Promise<void> {
    await this.showToolbar();
    await this.toolbar.getByRole('button', { name: t('message_list_option_reply_to_message') }).click();
  }

  /** React through the emoji keyboard, e.g. react('joy') → 😂. */
  async react(emojiName: string): Promise<void> {
    await this.showToolbar();
    await this.toolbar.getByRole('button', { name: t('message_list_option_react') }).click();
    const keyboard = new EmojiKeyboard(this.page);
    await expect(keyboard.dialog).toBeVisible();
    await keyboard.emoji(emojiName).click();
  }
}
