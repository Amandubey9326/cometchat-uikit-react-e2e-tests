import type { Page } from '@playwright/test';
import { t } from '@i18n/t';
import { uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';

/**
 * Runs in the `tablet` (iPad landscape, 1080 px) and `mobile` (Pixel 7, 412 px) projects.
 * Tablet keeps list + chat side by side; below 768 px the chat replaces the list and the
 * header gets a Back button.
 */
const hasHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);

test.describe('Responsive', { tag: ['@responsive', '@regression'] }, () => {
  test('RESP-01 tablet: the list stays beside the open chat', async ({ alice, data, viewport }) => {
    test.skip((viewport?.width ?? 0) < 768, 'two-pane layout only');
    const peer = await data.user('peer');

    await alice.app.openChatWith(peer);

    await expect(alice.app.users.item(peer.name)).toBeInViewport();
    await expect(alice.app.header.titleFor(peer.name)).toBeInViewport();
    expect(await hasHorizontalScroll(alice.page)).toBe(false);
  });

  test.describe('mobile', () => {
    test.beforeEach(({ viewport }) => {
      test.skip((viewport?.width ?? 0) >= 768, 'single-pane layout only');
    });

    test('RESP-02/03 the chat replaces the list; Back returns; the composer works; no sideways scroll', { tag: '@critical' }, async ({ alice, data }) => {
      const peer = await data.user('peer');

      await alice.app.openChatWith(peer);
      await expect(alice.app.users.region).not.toBeInViewport();
      const text = uniqueText('small screen');
      await alice.app.sendAndConfirm(text);
      await expect(alice.app.messages.message(text).root).toBeInViewport();
      expect(await hasHorizontalScroll(alice.page)).toBe(false);

      await alice.app.header.banner.getByRole('button', { name: t('accessibility_back') }).click();

      await expect(alice.app.users.region).toBeInViewport();
      await expect(alice.app.header.banner).not.toBeInViewport();
    });

    test('RESP-04 details open full-screen and close back to the chat', async ({ alice, data, viewport }) => {
      const peer = await data.user('peer');
      await alice.app.openChatWith(peer);

      await alice.app.header.detailsButton.click();
      await expect(alice.app.userDetails.headerText).toBeInViewport();
      // The panel is an overlay (toBeInViewport ignores stacking), so check that it spans the screen.
      const panel = alice.page.locator('.side-component-header').locator('..');
      expect((await panel.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual((viewport?.width ?? 0) - 2);
      await alice.app.userDetails.closeIcon.click();

      await expect(alice.app.composer.input).toBeInViewport();
    });

    test('RESP-05 emoji keyboard and attachment sheet fit on screen', async ({ alice, data, viewport }) => {
      await alice.app.openChatWith(await data.user('peer'));

      await alice.app.composer.emojiButton.click();
      await expect(alice.app.emojiKeyboard.dialog).toBeInViewport({ ratio: 1 });
      await alice.app.composer.emojiButton.click();
      await alice.app.composer.attachmentsButton.click();
      const box = await alice.app.composer.attachmentSheet.boundingBox();

      expect(box && box.x >= 0 && box.x + box.width <= (viewport?.width ?? 0) + 1).toBe(true);
    });

    test('RESP-06 every formatting button can be reached', async ({ alice, data }) => {
      await alice.app.openChatWith(await data.user('peer'));
      const last = alice.app.composer.formattingToolbar.getByRole('button').last();

      await last.scrollIntoViewIfNeeded();

      await expect(last).toBeInViewport({ ratio: 1 });
    });
  });
});
