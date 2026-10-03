import type { Locator, Page } from '@playwright/test';
import { t } from '@i18n/t';

export type GroupKind = 'public' | 'private' | 'password';

/**
 * Sample-app "New Group" dialog (Groups tab → Create group). It uses UIKit's `sample_*` keys
 * (not the sample app's own locales file). Name and password are `required` inputs: empty values
 * are stopped by native form validation, the Create button itself is only disabled while saving.
 */
export class CreateGroupDialog {
  readonly dialog: Locator;
  readonly nameInput: Locator;
  readonly passwordInput: Locator;
  readonly createButton: Locator;
  readonly closeButton: Locator;

  constructor(readonly page: Page) {
    this.dialog = page.getByRole('dialog', { name: t('sample_new_group') });
    this.nameInput = this.dialog.getByRole('textbox', { name: t('sample_name') });
    this.passwordInput = this.dialog.getByLabel(t('sample_password'), { exact: true });
    this.createButton = this.dialog.getByRole('button', { name: t('sample_create_group'), exact: true });
    this.closeButton = this.dialog.getByRole('button', { name: 'Close' }); // hard-coded aria-label
  }

  type(kind: GroupKind): Locator {
    return this.dialog.getByRole('radio', { name: t(`sample_${kind}`) });
  }

  /** True when the browser's native validation flags the input as empty. */
  static async isMissing(input: Locator): Promise<boolean> {
    return input.evaluate(el => (el as HTMLInputElement).validity.valueMissing);
  }
}

/** Sample-app password prompt when opening a password-protected group. "Continue" is disabled until a password is typed. */
export class JoinGroupDialog {
  readonly dialog: Locator;
  readonly passwordInput: Locator;
  readonly joinButton: Locator;
  readonly error: Locator;

  constructor(readonly page: Page) {
    this.dialog = page.getByRole('dialog', { name: t('group_password') });
    this.passwordInput = this.dialog.getByPlaceholder(t('enter_your_password'));
    this.joinButton = this.dialog.getByRole('button', { name: t('continue'), exact: true });
    this.error = this.dialog.getByRole('alert');
  }
}
