import type { Locator, Page } from '@playwright/test';
import { t } from '@i18n/t';
import { escapeRegExp } from '@utils/text';

/** UIKit CometChatMessageHeader (role=banner). */
export class MessageHeader {
  readonly banner: Locator;
  readonly detailsButton: Locator;
  readonly voiceCallButton: Locator;
  readonly videoCallButton: Locator;
  readonly searchButton: Locator;
  /**
   * The header's `role=status`: holds the typing text while the other user types; otherwise it is
   * the presence dot (accessible name "Online", no text) and is absent when offline. Presence is
   * best asserted on `banner`'s name ("<name>, Online" / "<name>, Offline").
   */
  readonly status: Locator;

  constructor(readonly page: Page) {
    // Scoped to the chat header wrapper — the thread panel has a banner of its own.
    this.banner = page.locator('.cometchat-header-wrapper').getByRole('banner');
    this.detailsButton = this.banner.getByRole('button', {
      name: new RegExp(`\\. ${escapeRegExp(t('accessibility_click_for_details'))}$`),
    });
    this.voiceCallButton = this.banner.getByRole('button', { name: t('accessibility_voice_call') });
    this.videoCallButton = this.banner.getByRole('button', { name: t('accessibility_video_call') });
    this.searchButton = this.banner.getByRole('button', { name: t('accessibility_search') });
    this.status = this.detailsButton.getByRole('status');
  }

  /** The header's details button is labelled "<name>. Click for details". */
  titleFor(name: string): Locator {
    return this.banner.getByRole('button', { name: `${name}. ${t('accessibility_click_for_details')}` });
  }
}
