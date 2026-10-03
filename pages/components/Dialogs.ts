import type { Locator, Page } from '@playwright/test';
import { t } from '@i18n/t';

/** UIKit CometChatConfirmDialog (role=dialog named by its title). */
export class ConfirmDialog {
  readonly dialog: Locator;

  constructor(
    readonly page: Page,
    title: string
  ) {
    this.dialog = page.getByRole('dialog', { name: title });
  }

  button(name: string): Locator {
    return this.dialog.getByRole('button', { name, exact: true });
  }
}

/** UIKit CometChatMessageInformation. */
export class MessageInfoPanel {
  readonly dialog: Locator;
  readonly receipts: Locator;

  constructor(readonly page: Page) {
    this.dialog = page.getByRole('dialog').filter({ hasText: t('message_information_title') });
    this.receipts = this.dialog.getByRole('listitem');
  }
}

/** UIKit CometChatFlagMessageDialog ("Report a Message"). */
export class ReportDialog {
  readonly dialog: Locator;
  readonly reasons: Locator;
  readonly remark: Locator;
  readonly submit: Locator;
  readonly cancel: Locator;

  constructor(readonly page: Page) {
    this.dialog = page.getByRole('dialog').filter({ hasText: t('flag_message_title') });
    this.reasons = this.dialog.getByRole('radiogroup');
    this.remark = this.dialog.getByRole('textbox');
    this.submit = this.dialog.getByRole('button', { name: t('flag_message_confirm_yes'), exact: true });
    this.cancel = this.dialog.getByRole('button', { name: t('flag_message_confirm_no'), exact: true });
  }
}

/** UIKit CometChatToast. */
export function toast(page: Page, text?: string): Locator {
  const toasts = page.locator('.cometchat-toast');
  return text ? toasts.filter({ hasText: text }) : toasts;
}
