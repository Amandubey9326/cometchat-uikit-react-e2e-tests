import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { t } from '@i18n/t';
import { uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { openLoginScreen } from '@flows/sign-in';
import { CreateGroupDialog } from '@pages/groups/GroupDialogs';
import { SearchPanel } from '@pages/search/SearchPanel';

/**
 * axe-core scans of each main screen against WCAG 2.1 A/AA (colour contrast is THM-04).
 * Serious / critical violations fail the scan; everything found is attached as JSON.
 */
/** Confirmed violations, excluded so a scan shows what is new (each has its own expected-to-fail test / finding). */
const KNOWN = [
  { rule: 'aria-allowed-attr', target: '.cometchat-popover__trigger', finding: 'A11Y-015' },
  { rule: 'aria-allowed-attr', target: 'div[aria-controls="cometchat-popover-', finding: 'A11Y-015' }, // same element while open
  { rule: 'aria-required-children', target: '.cometchat-emoji-keyboard__emoji-grid', finding: 'A11Y-017' },
  { rule: 'aria-prohibited-attr', target: '.cometchat-group-members__loading-state', finding: 'A11Y-016' },
  // The emoji buttons have no class for axe to report, so this one is limited to the emoji screen.
  { rule: 'aria-required-parent', target: 'button[aria-label=', finding: 'A11Y-017', screen: 'emoji' },
];
const isKnown = (rule: string, target: string, screen: string) =>
  KNOWN.some(k => k.rule === rule && target.includes(k.target) && (!('screen' in k) || k.screen === screen));

async function scan(page: Page, screen: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).disableRules(['color-contrast']).analyze();
  const violations = results.violations.map(v => ({
    rule: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map(n => n.target.join(' ')).slice(0, 10),
  }));
  await test.info().attach(`axe-${screen}.json`, { body: JSON.stringify(violations, null, 2), contentType: 'application/json' });
  return violations
    .filter(v => v.impact === 'serious' || v.impact === 'critical')
    .map(v => ({ ...v, nodes: v.nodes.filter(n => !isKnown(v.rule, n, screen)) }))
    .filter(v => v.nodes.length)
    .map(v => `${v.rule} (${v.impact}): ${v.nodes.join(', ')}`);
}

test.describe('Accessibility — axe', { tag: ['@a11y', '@regression'] }, () => {
  test('A11Y-01 login screens', async ({ page }) => {
    await openLoginScreen(page);

    expect(await scan(page, 'login')).toEqual([]);
  });

  test('A11Y-01 chats, chat, message menu, attachments, emoji', async ({ alice, data }) => {
    expect.soft(await scan(alice.page, 'chats'), 'chats').toEqual([]);
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const text = uniqueText('axe');
    await alice.app.sendAndConfirm(text);
    expect.soft(await scan(alice.page, 'chat'), 'chat').toEqual([]);
    await alice.app.messages.message(text).openOptions();
    expect.soft(await scan(alice.page, 'message-menu'), 'message menu').toEqual([]);
    await alice.page.mouse.click(5, 5); // closes the menu via its backdrop
    await alice.app.composer.attachmentsButton.click();
    expect.soft(await scan(alice.page, 'attachment-sheet'), 'attachment sheet').toEqual([]);
    await alice.app.composer.attachmentsButton.click();
    await alice.app.composer.emojiButton.click();
    expect(await scan(alice.page, 'emoji'), 'emoji keyboard').toEqual([]);
  });

  test('A11Y-01 groups, group info, new group dialog, search', async ({ alice, data }) => {
    const group = await data.group({ owner: alice.user, participants: [await data.user('member')] });
    await alice.app.openGroup(group.name);
    await alice.app.openDetails();
    expect.soft(await scan(alice.page, 'group-info'), 'group info').toEqual([]);
    await alice.app.home.openTab('groups');
    await alice.app.groups.createGroupButton.click();
    await expect(new CreateGroupDialog(alice.page).dialog).toBeVisible();
    expect.soft(await scan(alice.page, 'new-group'), 'new group dialog').toEqual([]);
    await new CreateGroupDialog(alice.page).closeButton.click();
    await alice.app.home.openTab('chats');
    await alice.app.conversations.searchBox.click();
    await new SearchPanel(alice.page).input.fill(t('search_title').slice(0, 2));
    expect(await scan(alice.page, 'search'), 'search').toEqual([]);
  });

  test(
    'A11Y-01b composer popover buttons expose valid ARIA (expanded / has-popup on the button itself)',
    { annotation: { type: 'bug', description: 'A11Y-015 — aria-expanded / aria-haspopup / aria-controls sit on a role-less wrapper div' } },
    async ({ alice, data }) => {
      test.fail(true, 'A11Y-015');
      await alice.app.openChatWith(await data.user('peer'));

      const results = await new AxeBuilder({ page: alice.page }).include('.cometchat-composer-wrapper').withRules(['aria-allowed-attr']).analyze();

      expect(results.violations.flatMap(v => v.nodes.map(n => n.target.join(' ')))).toEqual([]);
    }
  );

  test(
    'A11Y-01c the emoji grid has the rows a grid requires',
    { annotation: { type: 'bug', description: 'A11Y-017 — role="grid" holds gridcells directly (no role="row")' } },
    async ({ alice, data }) => {
      test.fail(true, 'A11Y-017');
      await alice.app.openChatWith(await data.user('peer'));
      await alice.app.composer.emojiButton.click();
      await expect(alice.app.emojiKeyboard.dialog).toBeVisible();

      const results = await new AxeBuilder({ page: alice.page }).include('.cometchat-emoji-keyboard__emoji-grid').withRules(['aria-required-children']).analyze();

      expect(results.violations).toEqual([]);
    }
  );
});
