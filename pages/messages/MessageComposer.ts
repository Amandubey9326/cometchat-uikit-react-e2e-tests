import path from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';
import { ROOT_DIR } from '@config/env';
import { t } from '@i18n/t';

export type AttachmentKind = 'image' | 'video' | 'audio' | 'file';

export const ASSETS = {
  image: path.join(ROOT_DIR, 'test-assets', 'test-image.png'),
  video: path.join(ROOT_DIR, 'test-assets', 'test-video.mp4'),
  audio: path.join(ROOT_DIR, 'test-assets', 'test-audio.mp3'),
  pdf: path.join(ROOT_DIR, 'test-assets', 'test-file.pdf'),
} as const;

/**
 * UIKit CometChatMessageComposer, scoped to its container (main chat or thread).
 * Several button names resolve to raw keys ("SEND", "SAVE", "ATTACHMENTS"…)
 * because those keys are missing from every locale — exactly what the app
 * renders (BUG-001). CMP-01 asserts readable names.
 */
export class MessageComposer {
  readonly input: Locator;
  readonly sendButton: Locator;
  readonly saveButton: Locator;
  readonly attachmentsButton: Locator;
  readonly emojiButton: Locator;
  readonly stickerButton: Locator;
  readonly voiceButton: Locator;
  readonly formattingToolbar: Locator;
  readonly replyPreview: Locator;
  readonly editPreview: Locator;
  readonly mentionSuggestions: Locator;
  readonly attachmentSheet: Locator;

  constructor(
    readonly page: Page,
    readonly scope: Locator = page.locator('body')
  ) {
    // The textbox is renamed "Edit message" while a message is being edited. The rich-text editor's
    // label is hard-coded English ('Type a message', CometChatMessageComposerRoot.tsx — L10N-008),
    // so the literal is accepted too; any composer textbox in this scope is the input.
    this.input = scope
      .getByRole('textbox', { name: t('message_composer_type_message') })
      .or(scope.getByRole('textbox', { name: t('message_composer_edit_message') }))
      .or(scope.getByRole('textbox', { name: 'Type a message', exact: true }));
    this.sendButton = scope.getByRole('button', { name: t('SEND'), exact: true });
    this.saveButton = scope.getByRole('button', { name: t('SAVE'), exact: true });
    this.attachmentsButton = scope.getByRole('button', { name: t('ATTACHMENTS'), exact: true });
    this.emojiButton = scope.getByRole('button', { name: t('EMOJI'), exact: true });
    this.stickerButton = scope.getByRole('button', { name: t('message_composer_sticker_hover'), exact: true });
    this.voiceButton = scope.getByRole('button', { name: t('VOICE_RECORDING'), exact: true });
    this.formattingToolbar = scope.getByRole('toolbar', { name: t('accessibility_text_formatting') });
    this.replyPreview = scope.locator('.cometchat-message-composer__reply-preview');
    this.editPreview = scope.locator('.cometchat-message-composer__edit-preview');
    this.mentionSuggestions = page.getByRole('listbox', { name: t('accessibility_mention_suggestions') });
    this.attachmentSheet = page.getByRole('dialog').filter({
      has: page.getByRole('button', { name: t('message_composer_attach_image') }),
    });
  }

  formatButton(name: string): Locator {
    return this.formattingToolbar.getByRole('button', { name, exact: true });
  }

  async type(text: string): Promise<void> {
    await this.input.click();
    await this.input.pressSequentially(text);
  }

  async clear(): Promise<void> {
    await this.input.click();
    await this.input.press('ControlOrMeta+a');
    await this.input.press('Backspace');
    await expect(this.input).toHaveText('');
  }

  /** Types `text` and sends it with the Send button; the composer must clear. */
  async send(text: string): Promise<void> {
    await this.type(text);
    await expect(this.sendButton).toBeEnabled();
    await this.sendButton.click();
    await expect(this.input).toHaveText('');
  }

  async sendWithEnter(text: string): Promise<void> {
    await this.type(text);
    await this.input.press('Enter');
    await expect(this.input).toHaveText('');
  }

  /** Opens the attachment sheet and picks `files` through the chosen action. */
  /** Opens the attachment sheet and picks a non-file entry, e.g. t('message_composer_polls'). */
  async chooseAttachmentOption(name: string): Promise<void> {
    await this.attachmentsButton.click();
    await expect(this.attachmentSheet).toBeVisible();
    await this.attachmentSheet.getByRole('button', { name }).click();
  }

  async attach(kind: AttachmentKind, files: string | string[]): Promise<void> {
    await this.attachmentsButton.click();
    await expect(this.attachmentSheet).toBeVisible();
    const chooser = this.page.waitForEvent('filechooser');
    await this.attachmentSheet.getByRole('button', { name: t(`message_composer_attach_${kind}`) }).click();
    await (await chooser).setFiles(files);
  }
}
