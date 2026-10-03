import { uniqueMarker, uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { ASSETS } from '@pages/messages/MessageComposer';
import { SearchPanel } from '@pages/search/SearchPanel';

test.describe('Search', { tag: ['@search', '@regression'] }, () => {
  test('SRCH-01 global search opens with all filters', async ({ alice }) => {
    await alice.app.conversations.searchBox.click();
    const search = new SearchPanel(alice.page);

    await expect(search.root).toBeVisible();
    for (const f of ['audio', 'documents', 'groups', 'photos', 'videos', 'links', 'unread'] as const) {
      await expect(search.filter(f)).toBeVisible();
    }
  });

  test('SRCH-02 searching a name finds the conversation', async ({ alice, data, api }) => {
    const peer = await data.user('findme');
    await api.messages.sendText(peer.uid, { uid: alice.user.uid }, uniqueText('hello'));
    await expect(alice.app.conversations.item(peer.name)).toBeVisible();
    await alice.app.conversations.searchBox.click();
    const search = new SearchPanel(alice.page);

    await search.input.fill(peer.name);

    await expect(search.conversations.filter({ hasText: peer.name })).toBeVisible();
  });

  test('SRCH-03 searching message text finds it, and opening the result shows the message', { tag: '@critical' }, async ({ alice, data, api }) => {
    const peer = await data.user('talker');
    const marker = uniqueMarker();
    const text = `Did you read the ${marker} report yet?`;
    await api.messages.sendText(peer.uid, { uid: alice.user.uid }, text);
    await expect(alice.app.conversations.item(peer.name)).toBeVisible();
    await alice.app.conversations.searchBox.click();
    const search = new SearchPanel(alice.page);

    await search.input.fill(marker);
    const hit = search.messages.filter({ hasText: marker });
    await expect(hit).toBeVisible();
    await hit.click();

    await expect(alice.app.header.titleFor(peer.name)).toBeVisible();
    await expect(alice.app.messages.message(text).root).toBeInViewport();
  });

  const variants = [
    { name: 'partial word', term: (m: string) => m.split(' ').slice(1, 3).join(' ') },
    { name: 'upper-case', term: (m: string) => m.toUpperCase() },
  ];
  for (const v of variants) {
    test(`SRCH-04 message search matches a ${v.name}`, async ({ alice, data, api }) => {
      const peer = await data.user('talker');
      const marker = uniqueMarker();
      await api.messages.sendText(peer.uid, { uid: alice.user.uid }, `Notes about the ${marker} walk`);
      await expect(alice.app.conversations.item(peer.name)).toBeVisible();
      await alice.app.conversations.searchBox.click();
      const search = new SearchPanel(alice.page);

      await search.input.fill(v.term(marker));

      await expect(search.messages.filter({ hasText: marker })).toBeVisible();
    });
  }

  test(
    'SRCH-05 no match shows "No Results"',
    { annotation: { type: 'bug', description: 'BUG-016 — both searches return [] but Messages keeps its loading shimmer and no "No Results" is shown' } },
    async ({ alice }) => {
      test.fail(true, 'BUG-016');
      await alice.app.conversations.searchBox.click();
      const search = new SearchPanel(alice.page);

      await search.input.fill('qwxzv nothing matches this');

      await expect(search.noResults.first()).toBeVisible();
    }
  );

  test('SRCH-06 the Photos filter shows image messages only', async ({ alice, data }) => {
    const peer = await data.user('photog');
    await alice.app.openChatWith(peer);
    await alice.app.composer.attach('image', ASSETS.image);
    await expect(alice.app.messages.ofType('image')).toHaveCount(1);
    const text = uniqueText('not a photo');
    await alice.app.sendAndConfirm(text);
    await alice.app.home.openTab('chats');
    await alice.app.conversations.searchBox.click();
    const search = new SearchPanel(alice.page);

    // The server's attachment search lags the send by a few seconds; the panel does not refresh by
    // itself, so the filter is re-applied (as a user would) until the photo shows up.
    await expect(async () => {
      if ((await search.filter('photos').getAttribute('aria-pressed')) === 'true') await search.filter('photos').click();
      await search.filter('photos').click();
      await expect(search.messages.first()).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 45_000 });
    await expect(search.messages.filter({ hasText: text })).toHaveCount(0);
  });

  test('SRCH-07 the Unread filter lists only conversations with unread messages', async ({ alice, data, api }) => {
    const unread = await data.user('unread');
    const read = await data.user('read');
    await api.messages.sendText(read.uid, { uid: alice.user.uid }, uniqueText('already seen'));
    await api.users.waitForConversation(alice.user.uid, read.uid); // BUG-012: a read inside the window is rejected
    await alice.app.openConversation(read.name);
    await alice.app.header.banner.hover(); // a hovered row hides its unread badge behind the Delete button
    await api.messages.sendText(unread.uid, { uid: alice.user.uid }, uniqueText('not yet seen'));
    await expect(alice.app.conversations.item(unread.name)).toHaveAccessibleName(alice.app.conversations.unreadSuffix());
    await alice.app.conversations.searchBox.click();
    const search = new SearchPanel(alice.page);

    await search.filter('unread').click();

    await expect(search.conversations.filter({ hasText: unread.name })).toBeVisible();
    await expect(search.conversations.filter({ hasText: read.name })).toHaveCount(0);
  });

  test('SRCH-08 Back closes the search', async ({ alice }) => {
    await alice.app.conversations.searchBox.click();
    const search = new SearchPanel(alice.page);

    await search.backButton.click();

    await expect(search.root).toBeHidden();
    await expect(alice.app.conversations.region).toBeVisible();
  });

  test(
    'SRCH-09 Escape closes the search',
    { tag: '@a11y', annotation: { type: 'bug', description: 'A11Y-006 — Escape does not close the search panel' } },
    async ({ alice }) => {
      test.fail(true, 'A11Y-006');
      await alice.app.conversations.searchBox.click();
      const search = new SearchPanel(alice.page);
      await expect(search.root).toBeVisible();

      await alice.page.keyboard.press('Escape');

      await expect(search.root).toBeHidden({ timeout: 3_000 });
    }
  );

  test('SRCH-10/11 in-conversation search finds only this chat\'s messages', async ({ alice, data, api }) => {
    const here = await data.user('here');
    const elsewhere = await data.user('elsewhere');
    const marker = uniqueMarker();
    await api.messages.sendText(here.uid, { uid: alice.user.uid }, `Plans for the ${marker} trip here`);
    await api.messages.sendText(elsewhere.uid, { uid: alice.user.uid }, `Plans for the ${marker} trip elsewhere`);
    await alice.app.openConversation(here.name);

    await alice.app.header.searchButton.click();
    const search = new SearchPanel(alice.page);
    await search.input.fill(marker);

    await expect(search.messages.filter({ hasText: 'trip here' })).toBeVisible();
    await expect(search.messages.filter({ hasText: 'trip elsewhere' })).toHaveCount(0);
    await expect(search.filter('groups')).toHaveCount(0); // scoped search has no conversation-level filters
  });

  test('SRCH-12 search results can be reached with the keyboard', { tag: '@a11y' }, async ({ alice, data, api }) => {
    const peer = await data.user('keys');
    const marker = uniqueMarker();
    await api.messages.sendText(peer.uid, { uid: alice.user.uid }, `Chat about the ${marker} garden`);
    await expect(alice.app.conversations.item(peer.name)).toBeVisible();
    await alice.app.conversations.searchBox.click();
    const search = new SearchPanel(alice.page);
    await search.input.fill(marker);
    const hit = search.messages.filter({ hasText: marker });
    await expect(hit).toBeVisible();

    await hit.focus();
    await alice.page.keyboard.press('Enter');

    await expect(alice.app.header.titleFor(peer.name)).toBeVisible();
  });
});
