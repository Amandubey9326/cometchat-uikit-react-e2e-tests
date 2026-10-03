import AxeBuilder from '@axe-core/playwright';
import { uniqueText } from '@data/unique';
import { expect, test, type ChatUser } from '@fixtures/test.fixture';
import { backgroundLuminance } from '@utils/color';

/**
 * Theme: UIKit sets `data-theme` on its `.cometchat` wrapper and swaps CSS variables; the sample
 * app reads prefers-color-scheme at start (index.tsx) and follows live changes (App.tsx).
 */
const shoot = async (user: ChatUser, name: string) =>
  test.info().attach(name, { body: await user.page.screenshot(), contentType: 'image/png' });

const wrapper = (user: ChatUser) => user.page.locator('.cometchat[data-theme]').first();

test.describe('Theme', { tag: ['@theme', '@regression'] }, () => {
  test('THM-01 the app starts in the light theme by default', async ({ alice, data }) => {
    await expect(wrapper(alice)).toHaveAttribute('data-theme', 'light');
    expect(await backgroundLuminance(alice.app.conversations.region)).toBeGreaterThan(0.7);
    await alice.app.openChatWith(await data.user('peer'));
    await alice.app.sendAndConfirm(uniqueText('light'));
    await shoot(alice, 'light-chat.png');
  });

  test('THM-03 switching the system theme re-themes the app live, without a reload', async ({ alice }) => {
    await expect(wrapper(alice)).toHaveAttribute('data-theme', 'light');

    await alice.page.emulateMedia({ colorScheme: 'dark' });
    await expect(wrapper(alice)).toHaveAttribute('data-theme', 'dark');
    await expect.poll(() => backgroundLuminance(alice.app.conversations.region)).toBeLessThan(0.2);

    await alice.page.emulateMedia({ colorScheme: 'light' });
    await expect(wrapper(alice)).toHaveAttribute('data-theme', 'light');
  });

  test.describe('dark system theme', () => {
    test.use({ colorScheme: 'dark' });

    test('THM-02 a dark system theme starts the app dark: lists, chat, composer and dialogs', async ({ alice, data }) => {
      await expect(wrapper(alice)).toHaveAttribute('data-theme', 'dark');
      expect(await backgroundLuminance(alice.app.conversations.region)).toBeLessThan(0.2);
      await alice.app.openChatWith(await data.user('peer'));
      await alice.app.sendAndConfirm(uniqueText('dark'));

      expect(await backgroundLuminance(alice.app.messages.region)).toBeLessThan(0.2);
      expect(await backgroundLuminance(alice.app.composer.input)).toBeLessThan(0.2);
      await alice.app.composer.emojiButton.click();
      expect(await backgroundLuminance(alice.app.emojiKeyboard.dialog)).toBeLessThan(0.2);
      await shoot(alice, 'dark-chat-emoji.png');
    });
  });

  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`${scheme} contrast`, () => {
      test.use({ colorScheme: scheme });

      test(
        `THM-04 text contrast meets WCAG AA in the ${scheme} theme (chat screen)`,
        { tag: '@a11y', annotation: { type: 'bug', description: 'A11Y-014 — avatar initials, composer placeholder (light) and active tab label (dark) below 4.5:1' } },
        async ({ alice, data }, testInfo) => {
          test.fail(true, 'A11Y-014');
          await alice.app.openChatWith(await data.user('peer'));
          await alice.app.sendAndConfirm(uniqueText('contrast'));

          const results = await new AxeBuilder({ page: alice.page }).withRules(['color-contrast']).analyze();
          const report = results.violations.flatMap(v => v.nodes.map(n => `${n.target.join(' ')} — ${n.failureSummary?.split('\n').slice(1).join(' ')}`));
          await testInfo.attach(`contrast-${scheme}.txt`, { body: report.join('\n') || '(none)', contentType: 'text/plain' });

          expect(report).toEqual([]);
        }
      );
    });
  }
});
