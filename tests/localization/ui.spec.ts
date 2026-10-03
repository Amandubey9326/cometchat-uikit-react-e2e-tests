import { env } from '@config/env';
import { SAMPLE_SRC, sampleDict, UIKIT_SRC, uikitDict, usedKeys } from '@i18n/audit';
import { t } from '@i18n/t';
import { uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import type { TestData } from '@fixtures/test-data';
import type { ChatUser } from '@fixtures/test.fixture';
import { SearchPanel } from '@pages/search/SearchPanel';

/**
 * UI localization: walks the main screens and collects every string in the accessibility tree,
 * then flags tokens that are translation *keys* (the app shows a key when its translation is
 * missing). Runs in whatever locale the build uses — `PW_LOCALE=fr npx playwright test --grep @localization`.
 */
const KNOWN_RAW = new Set(['ATTACHMENTS', 'EMOJI', 'SEND', 'SAVE', 'VOICE_RECORDING', 'CANCEL_EDIT', 'message_composer_close_preview']); // BUG-001

const keyNames = new Set([
  ...Object.keys(uikitDict('en-us')),
  ...Object.keys(sampleDict('en-us')),
  ...usedKeys(UIKIT_SRC).keys(),
  ...usedKeys(SAMPLE_SRC).keys(),
]);
// Only tokens that cannot be ordinary words: snake_case or ALL-CAPS identifiers.
const looksLikeKey = (token: string) => keyNames.has(token) && (token.includes('_') || /^[A-Z]{3,}$/.test(token));

/** Walks the main screens and returns their accessibility trees (one text blob). */
async function captureScreens(alice: ChatUser, data: TestData): Promise<string> {
  const texts: string[] = [];
  const capture = async (screen: string) => {
    const tree = await alice.page.locator('body').ariaSnapshot();
    texts.push(`### ${screen}\n${tree}`);
  };
  const peer = await data.user('peer');
  const group = await data.group({ owner: alice.user, participants: [peer] });

  await capture('home');
  await alice.app.openChatWith(peer);
  await alice.app.sendAndConfirm(uniqueText('hello'));
  await capture('chat');
  await alice.app.composer.attachmentsButton.click();
  await capture('attachment sheet');
  await alice.app.composer.attachmentsButton.click();
  await alice.app.composer.emojiButton.click();
  await capture('emoji keyboard');
  await alice.page.keyboard.press('Escape');
  await alice.app.home.openTab('users');
  await capture('users');
  await alice.app.openGroup(group.name);
  await alice.app.openDetails();
  await capture('group info');
  await alice.app.home.openTab('chats');
  await alice.app.conversations.searchBox.click();
  await expect(new SearchPanel(alice.page).root).toBeVisible();
  await capture('search');
  return texts.join('\n');
}

test.describe('Localization — UI', { tag: ['@localization', '@regression'] }, () => {
  test(`L10N-04 main screens show no untranslated keys (${env.locale})`, { annotation: { type: 'issue', description: 'BUG-001 keys are known and excluded' } }, async ({ alice, data }, testInfo) => {
    test.setTimeout(150_000);

    const all = await captureScreens(alice, data);
    const found = [...new Set(all.match(/[A-Za-z][A-Za-z0-9_]+/g) ?? [])].filter(looksLikeKey);
    await testInfo.attach(`screens-${env.locale}.yml`, { body: all, contentType: 'text/yaml' });
    await testInfo.attach(`raw-keys-${env.locale}.txt`, { body: found.join('\n') || '(none)', contentType: 'text/plain' });

    expect(found.filter(k => !KNOWN_RAW.has(k)), 'raw keys beyond BUG-001').toEqual([]);
  });

  test(`L10N-05 the home tabs use the ${env.locale} strings`, async ({ alice }) => {
    for (const tab of ['chats', 'calls', 'users', 'groups'] as const) {
      await expect(alice.app.home.tab(tab)).toHaveText(t(tab));
    }
  });

  test(
    `L10N-07 no English text leaks into the ${env.locale} UI`,
    { annotation: { type: 'bug', description: 'L10N-002…008 — hard-coded English strings' } },
    async ({ alice, data }, testInfo) => {
      test.skip(env.locale.startsWith('en'), 'Only meaningful for a non-English UI');
      test.fail(true, 'L10N-002…008');
      test.setTimeout(150_000);
      const english = { ...uikitDict('en-us'), ...sampleDict('en-us') };
      const local = { ...uikitDict(env.locale), ...sampleDict(env.locale) };
      // English phrases whose translation differs — seeing one means the UI did not translate it.
      const phrases = Object.entries(english)
        .filter(([k, v]) => local[k] && local[k] !== v && /\s/.test(v.trim()) && !/[{}]/.test(v))
        .map(([, v]) => v.trim());

      const all = await captureScreens(alice, data);
      const leaked = [...new Set(phrases.filter(p => all.includes(p)))];
      await testInfo.attach(`english-in-${env.locale}.txt`, { body: leaked.join('\n') || '(none)', contentType: 'text/plain' });

      expect(leaked).toEqual([]);
    }
  );

  test(`L10N-06 the page declares the UI language (${env.locale})`, { tag: '@a11y', annotation: { type: 'bug', description: 'L10N-007 — index.html hard-codes lang="en"' } }, async ({ alice }) => {
    test.fail(!env.locale.startsWith('en'), 'L10N-007');
    const language = env.locale.split('-')[0];

    // Screen readers pick their voice from <html lang>; index.html hard-codes "en".
    await expect(alice.page.locator('html')).toHaveAttribute('lang', new RegExp(`^${language}`, 'i'));
  });
});
