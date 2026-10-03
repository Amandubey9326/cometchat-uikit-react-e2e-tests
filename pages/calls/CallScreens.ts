import { type Locator, type Page } from '@playwright/test';
import { t } from '@i18n/t';
import { escapeRegExp } from '@utils/text';

export type CallType = 'voice' | 'video';

/**
 * UIKit call overlays for one user:
 * - outgoing: `dialog "Outgoing call"` with the callee's name and an "End call" button
 * - incoming: `alertdialog "Incoming {type} call from {name}"` with Decline / Accept
 * - ongoing:  `dialog "Ongoing call"` hosting the Calls SDK session
 */
export class CallScreens {
  readonly outgoing: Locator;
  readonly endOutgoing: Locator;
  readonly incoming: Locator;
  readonly accept: Locator;
  readonly decline: Locator;
  readonly ongoing: Locator;

  constructor(readonly page: Page) {
    this.outgoing = page.getByRole('dialog', { name: t('accessibility_outgoing_call') });
    this.endOutgoing = this.outgoing.getByRole('button', { name: t('outgoing_call_end') });
    const incomingPrefix = t('accessibility_incoming_call_from').split('{type}')[0];
    this.incoming = page.getByRole('alertdialog', { name: new RegExp(`^${escapeRegExp(incomingPrefix)}`) });
    this.decline = this.incoming.getByRole('button', { name: t('incoming_call_confirm_no') });
    this.accept = this.incoming.getByRole('button', { name: t('incoming_call_confirm_yes') });
    this.ongoing = page.getByRole('dialog', { name: t('accessibility_ongoing_call') });
  }

  /** The incoming alert for a call from `callerName`. */
  incomingFrom(callerName: string): Locator {
    return this.page.getByRole('alertdialog', { name: new RegExp(`${escapeRegExp(callerName)}$`) });
  }
}

/** Call buttons in a chat header (voice / video). */
export function callButton(header: Locator, type: CallType): Locator {
  return header.getByRole('button', { name: t(type === 'voice' ? 'accessibility_voice_call' : 'accessibility_video_call'), exact: true });
}
