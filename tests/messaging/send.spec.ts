import { uniqueSentences, uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { escapeRegExp } from '@utils/text';

test.describe('Sending messages', { tag: ['@messaging', '@regression'] }, () => {
  test('MSG-02 Enter sends the message', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const text = uniqueText('enter');

    await alice.app.composer.sendWithEnter(text);

    await expect(alice.app.messages.message(text).root).toBeVisible();
  });

  test('MSG-03 Shift+Enter adds a new line instead of sending', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const first = uniqueText('line-one');
    const { composer, messages } = alice.app;

    await composer.type(first);
    await composer.input.press('Shift+Enter');
    await composer.input.pressSequentially('line two');
    await expect(messages.message(first).root).toHaveCount(0); // not sent yet
    await composer.input.press('Enter');

    const bubble = messages.message(first);
    await expect(bubble.text).toContainText('line two');
    expect(await bubble.text.evaluate(el => (el as HTMLElement).innerText)).toMatch(new RegExp(`${escapeRegExp(first)}\\s*\\n\\s*line two`));
  });

  test('MSG-04 Send is disabled while the composer is empty', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);

    await expect(alice.app.composer.input).toHaveText('');
    await expect(alice.app.composer.sendButton).toBeDisabled();
  });

  test('MSG-05 a whitespace-only message is not sent', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const { composer, messages } = alice.app;

    await composer.type('     ');
    await expect(composer.sendButton).toBeDisabled();
    await composer.input.press('Enter');

    // A real message afterwards proves the list works and that nothing was sent before it.
    const marker = uniqueText('after-blank');
    await composer.clear();
    await composer.sendWithEnter(marker);
    await expect(messages.message(marker).root).toBeVisible();
    await expect(messages.messages).toHaveCount(1);
  });

  test('MSG-06 a 5,000-character message is sent and shown in full', async ({ alice, bob }) => {
    // Varied natural sentences — a repeated filler would be blocked as spam by the app's AI moderation.
    const text = uniqueSentences(60, 'long').texts.join(' ').slice(0, 5000).trimEnd();
    await alice.app.openChatWith(bob.user);

    await alice.app.composer.input.fill(text);
    await alice.app.composer.sendButton.click();

    const sent = alice.app.messages.message(text.slice(0, 40));
    await expect(sent.text).toHaveText(text.trimEnd());
    await bob.app.openConversation(alice.user.name);
    await expect(bob.app.messages.message(text.slice(0, 40)).text).toHaveText(text.trimEnd());
  });

  const emojiTexts = [
    { name: 'plain emoji', text: '😀🎉' },
    { name: 'skin-tone modifier', text: '👍🏽' },
    { name: 'flag', text: '🇮🇳' },
    { name: 'ZWJ family', text: '👨‍👩‍👧‍👦' },
  ];
  for (const e of emojiTexts) {
    test(`MSG-07 emoji render exactly: ${e.name}`, async ({ alice, bob }) => {
      const text = `${uniqueText('emoji')} ${e.text}`;
      await alice.app.openChatWith(bob.user);

      await alice.app.composer.sendWithEnter(text);

      await expect(alice.app.messages.message(text).text).toHaveText(text);
      await bob.app.openConversation(alice.user.name);
      await expect(bob.app.messages.message(text).text).toHaveText(text);
    });
  }

  test('MSG-08 HTML and script payloads are shown as text, never executed', { tag: '@security' }, async ({ alice, bob }) => {
    const id = uniqueText('xss');
    const payloads = [
      `${id} <img src=x onerror="window.__xss=1">`,
      `${id} <script>window.__xss=2</script>`,
      `${id} <b>not bold</b>`,
    ];
    await alice.app.openChatWith(bob.user);
    for (const p of payloads) await alice.app.sendAndConfirm(p);
    await bob.app.openConversation(alice.user.name);

    for (const { app, page } of [alice, bob]) {
      for (const p of payloads) {
        const bubble = app.messages.message(p);
        await expect(bubble.text).toHaveText(p);
        await expect(bubble.text.locator('img, script, b')).toHaveCount(0);
      }
      expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    }
  });

  const languages = [
    { name: 'Hindi', text: 'नमस्ते दुनिया' },
    { name: 'Japanese', text: 'こんにちは世界' },
    { name: 'Chinese', text: '你好，世界' },
    { name: 'Russian', text: 'Привет, мир' },
    { name: 'Arabic (RTL)', text: 'مرحبا بالعالم' },
  ];
  for (const lang of languages) {
    test(`MSG-09 multilingual text renders exactly: ${lang.name}`, async ({ alice, bob }) => {
      const text = `${lang.text} ${uniqueText('lang')}`;
      await alice.app.openChatWith(bob.user);

      await alice.app.composer.sendWithEnter(text);

      await expect(alice.app.messages.message(text).text).toHaveText(text);
      await bob.app.openConversation(alice.user.name);
      await expect(bob.app.messages.message(text).text).toHaveText(text);
    });
  }

  test('MSG-10 a URL becomes a safe, clickable link', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const id = uniqueText('url');
    const url = `https://example.com/pw/${id.replace(/\s/g, '-')}?q=1`;

    await alice.app.composer.sendWithEnter(`${id} visit ${url}`);

    const link = alice.app.messages.message(id).text.getByRole('link', { name: url });
    await expect(link).toHaveAttribute('href', url);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
  });

  test('MSG-21 pasted text is sent', async ({ alice, data, browserName }) => {
    test.skip(browserName !== 'chromium', 'Clipboard permissions are Chromium-only in Playwright');
    const peer = await data.user('peer');
    await alice.context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await alice.app.openChatWith(peer);
    const text = uniqueText('pasted');

    await alice.page.evaluate(value => navigator.clipboard.writeText(value), text);
    await alice.app.composer.input.click();
    await alice.app.composer.input.press('ControlOrMeta+v');
    await expect(alice.app.composer.input).toHaveText(text);
    await alice.app.composer.input.press('Enter');

    await expect(alice.app.messages.message(text).root).toBeVisible();
  });

  test('MSG-01 the Send button sends the message and clears the composer', { tag: ['@smoke', '@critical'] }, async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const text = uniqueText('send button');
    await alice.app.composer.type(text);
    await expect(alice.app.composer.sendButton).toBeEnabled();

    await alice.app.composer.sendButton.click();

    await alice.app.messages.message(text).waitUntilSent();
    await expect(alice.app.composer.input).toHaveText('');
    await expect(alice.app.composer.sendButton).toBeDisabled();
  });
});
