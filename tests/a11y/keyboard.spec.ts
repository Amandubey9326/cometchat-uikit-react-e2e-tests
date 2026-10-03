import type { Locator, Page } from '@playwright/test';
import { t } from '@i18n/t';
import { uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { CreateGroupDialog } from '@pages/groups/GroupDialogs';

/**
 * Presses Tab until `target` has focus; returns how many presses it took (a usability signal:
 * every hidden message-toolbar button is a Tab stop). Fails after `maxPresses`.
 */
async function tabTo(page: Page, target: Locator, maxPresses = 80): Promise<number> {
  for (let presses = 1; presses <= maxPresses; presses++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate(el => el === document.activeElement)) return presses;
  }
  throw new Error(`Tab never reached the target in ${maxPresses} presses`);
}

const focusIsInside = (container: Locator) => container.evaluate(el => el.contains(document.activeElement));

test.describe('Accessibility — keyboard only', { tag: ['@a11y', '@regression'] }, () => {
  test('A11Y-02 a keyboard-only user can open a chat and send a message', { tag: '@critical' }, async ({ data, api, loginAs }) => {
    const me = await data.user('keys');
    const peer = await data.user('peer');
    await api.messages.sendText(peer.uid, { uid: me.uid }, uniqueText('ping'));
    await api.users.waitForConversation(me.uid, peer.uid);
    const { app, page } = await loginAs(me);
    const reply = uniqueText('typed only');

    const toChat = await tabTo(page, app.conversations.item(peer.name));
    await page.keyboard.press('Enter');
    await expect(app.header.titleFor(peer.name)).toBeVisible();
    const toComposer = await tabTo(page, app.composer.input);
    test.info().annotations.push({ type: 'tab presses', description: `to the chat: ${toChat}, then to the composer: ${toComposer}` });
    await page.keyboard.type(reply);
    await page.keyboard.press('Enter');

    await expect(app.messages.message(reply).root).toBeVisible();
    await app.messages.message(reply).waitUntilSent();
  });

  test(
    'A11Y-03 the New Group dialog takes focus and keeps it while tabbing',
    { annotation: { type: 'bug', description: 'A11Y-018 — aria-modal dialog never receives focus and does not trap it' } },
    async ({ alice }) => {
      test.fail(true, 'A11Y-018');
      await alice.app.home.openTab('groups');
      await alice.app.groups.createGroupButton.click();
      const { dialog } = new CreateGroupDialog(alice.page);
      await expect(dialog).toBeVisible();

      await expect.poll(() => focusIsInside(dialog), { message: 'focus moves into the dialog' }).toBe(true);
      for (let i = 0; i < 12; i++) {
        await alice.page.keyboard.press('Tab');
        expect(await focusIsInside(dialog), `focus still inside after ${i + 1} Tab presses`).toBe(true);
      }
    }
  );

  test('A11Y-02b the message options menu can be opened and walked with the keyboard', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const text = uniqueText('keyboard menu');
    await alice.app.sendAndConfirm(text);
    const more = alice.app.messages.message(text).toolbar.getByRole('button', { name: t('accessibility_more_options') });

    await more.focus();
    await alice.page.keyboard.press('Enter');

    const menu = alice.page.getByRole('menu', { name: t('accessibility_context_menu') });
    await expect(menu).toBeVisible();
    const items = menu.getByRole('menuitem');
    await expect(items.first()).toBeFocused(); // UIKit focuses the first item once the menu is placed
    await alice.page.keyboard.press('ArrowDown');
    await expect(items.nth(1)).toBeFocused();
    await alice.page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(more).toBeFocused(); // focus returns to "More options"
  });

  test('A11Y-05 an incoming message lands in the live "Message list" log', async ({ alice, bob }) => {
    await alice.app.openChatWith(bob.user);
    await bob.app.openChatWith(alice.user);
    const { log } = bob.app.messages;
    // role="log" is an implicit polite live region; an explicit aria-live="off" would silence it.
    await expect(log).not.toHaveAttribute('aria-live', 'off');
    const text = uniqueText('announce me');

    await alice.app.sendAndConfirm(text);

    await expect(log.getByRole('article').filter({ hasText: text })).toBeVisible();
  });
});
