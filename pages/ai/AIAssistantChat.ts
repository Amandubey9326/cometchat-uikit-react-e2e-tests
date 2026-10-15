import { expect, type Locator, type Page } from '@playwright/test';
import { t } from '@i18n/t';

/**
 * UIKit CometChatAIAssistantChat — what the sample app shows instead of the normal chat
 * when the selected user's role is `@agentic`.
 */
export class AIAssistantChat {
  readonly root: Locator;
  readonly emptyState: Locator;
  readonly greeting: Locator;
  readonly intro: Locator;
  readonly suggestions: Locator;
  readonly input: Locator;
  /** A role=button div; renamed "Stop generating" while a reply streams. */
  readonly sendButton: Locator;
  readonly stopButton: Locator;
  readonly newChatButton: Locator;
  readonly historyButton: Locator;
  readonly history: Locator;
  readonly historyItems: Locator;
  readonly closeHistoryButton: Locator;
  /** Agent replies: the streaming bubble while generating, the assistant bubble once complete. */
  readonly replies: Locator;
  readonly streamError: Locator;

  constructor(readonly page: Page) {
    this.root = page.locator('.cometchat-ai-assistant-chat__wrapper');
    const chat = this.root.locator('.cometchat-ai-assistant-chat');
    this.emptyState = chat.locator('.cometchat-ai-assistant-chat__empty-state');
    this.greeting = this.emptyState.locator('.cometchat-ai-assistant-chat__empty-state-greeting-message');
    this.intro = this.emptyState.locator('.cometchat-ai-assistant-chat__empty-state-intro-message');
    this.suggestions = this.emptyState.locator('.cometchat-ai-assistant-chat__suggested-message-pill');
    const composer = chat.locator('.cometchat-ai-assistant-chat__message-composer-view');
    this.input = composer.getByRole('textbox');
    this.sendButton = composer.getByRole('button', { name: t('accessibility_send_message'), exact: true });
    this.stopButton = composer.getByRole('button', { name: t('accessibility_stop_generating'), exact: true });
    this.newChatButton = chat.getByRole('banner').getByRole('button', { name: t('ai_assistant_chat_new_chat'), exact: true });
    this.historyButton = chat.getByRole('banner').getByRole('button', { name: t('ai_assistant_chat_history_title'), exact: true });
    const sidebar = this.root.locator('.cometchat-ai-assistant-chat__sidebar');
    this.history = sidebar.getByRole('listbox', { name: t('ai_assistant_chat_history_title') });
    this.historyItems = this.history.getByRole('option');
    this.closeHistoryButton = sidebar.getByRole('button', { name: t('ai_assistant_chat_history_close'), exact: true });
    this.replies = chat.locator('.cometchat-ai-assistant-bubble__content, .cometchat-stream-message-bubble__content');
    this.streamError = chat.locator('.cometchat-stream-message-bubble__error');
  }

  /** The user's own question in the list. */
  question(text: string): Locator {
    return this.root.locator('.cometchat-text-bubble__text', { hasText: text });
  }

  async expectOpen(): Promise<void> {
    await expect(this.root).toBeVisible();
    await expect(this.input).toBeVisible();
  }

  async ask(text: string): Promise<void> {
    await this.input.click();
    await this.input.pressSequentially(text);
    await this.sendButton.click();
  }

  /**
   * Waits for a complete reply: a non-empty answer and the composer back to "Send message".
   * LLM latency varies, so the timeout is generous; the text itself is never asserted.
   */
  async waitForReply(count = 1, timeout = 90_000): Promise<void> {
    await expect(this.replies).toHaveCount(count, { timeout });
    await expect(this.replies.nth(count - 1)).not.toBeEmpty({ timeout });
    await expect(this.sendButton).toBeVisible({ timeout });
    await expect(this.streamError).toHaveCount(0);
  }
}
