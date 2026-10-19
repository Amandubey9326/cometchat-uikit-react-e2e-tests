import { uniqueMarker, uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { t } from '@i18n/t';
import { ConfirmDialog } from '@pages/components/Dialogs';
import { SearchPanel } from '@pages/search/SearchPanel';
import { MEDIA, sendMedia } from './media-filters';

/**
 * Advanced (in-conversation) search — opened from the chat header's Search button.
 * IDs map 1:1 to the "Advanced Search" tab of CometChat_Features_All_Test_Cases.xlsx (ADVSEARCH_xxx).
 * Media filters list items of this chat only; selecting one hides the other chips until it is
 * clicked again (UIKit behaviour).
 */
test.describe('Advanced search (in a chat)', { tag: ['@search', '@regression'] }, () => {
  const ids: Record<string, [string, string]> = {
    Audio: ['001/002', '003'],
    Documents: ['004/005', '006'],
    Photos: ['007/008', '009'],
    Videos: ['010/011', '012'],
    Links: ['013/014', '015'],
  };

  for (const kind of MEDIA) {
    const [found, empty] = ids[kind.label];

    test(`ADVSEARCH-${found} the ${kind.label} filter lists only this chat's items and opens the source message`, async ({ alice, data, api }) => {
      // Arrange — the item in this chat, and one in another chat that must not be listed (ADVSEARCH_033).
      const other = await data.user('other');
      await alice.app.openChatWith(other);
      await alice.app.sendAndConfirm(uniqueText('hello other'));
      await sendMedia(alice, kind);
      const peer = await data.user('peer');
      await alice.app.openChatWith(peer);
      await alice.app.sendAndConfirm(uniqueText('plain text'));
      await sendMedia(alice, kind);
      await api.users.waitForConversation(alice.user.uid, peer.uid);
      await alice.app.header.searchButton.click();
      const search = new SearchPanel(alice.page);

      // Act
      await search.toggle(kind.filter);

      // Assert — exactly this chat's one item; it opens at the message.
      await expect(search.messages).toHaveCount(1);
      await search.messages.first().click();
      await expect(alice.app.header.titleFor(peer.name)).toBeVisible();
      await expect(alice.app.messages.ofType(kind.bubble).last()).toBeInViewport();
    });

    test(`ADVSEARCH-${empty} the ${kind.label} filter in a chat without such items shows "No Results"`, async ({ alice, data }) => {
      const peer = await data.user('peer');
      await alice.app.openChatWith(peer);
      await alice.app.sendAndConfirm(uniqueText('only text here'));
      await alice.app.header.searchButton.click();
      const search = new SearchPanel(alice.page);

      await search.toggle(kind.filter);

      await expect(search.noResults.first()).toBeVisible();
      await expect(search.messages).toHaveCount(0);
    });
  }

  test('ADVSEARCH-020 clearing the search returns it to its default state', async ({ alice, data, api }) => {
    const peer = await data.user('peer');
    const marker = uniqueMarker();
    await api.messages.sendText(peer.uid, { uid: alice.user.uid }, `Notes on the ${marker} plan`);
    await alice.app.openConversation(peer.name);
    await alice.app.header.searchButton.click();
    const search = new SearchPanel(alice.page);
    await search.input.fill(marker);
    await expect(search.messages.filter({ hasText: marker })).toBeVisible();

    await search.clearButton.click();

    await expect(search.input).toHaveValue('');
    await expect(search.messages.filter({ hasText: marker })).toHaveCount(0);
  });

  const odd = [
    { id: '022', name: 'special characters', text: '@#$%^&*()' },
    { id: '023', name: 'only spaces', text: '     ' },
    { id: '024', name: 'a 500-character text', text: 'searchable '.repeat(46).slice(0, 500) },
  ];
  for (const o of odd) {
    test(`ADVSEARCH-${o.id} searching ${o.name} does not break the search`, async ({ alice, data, api }) => {
      const peer = await data.user('peer');
      await api.messages.sendText(peer.uid, { uid: alice.user.uid }, uniqueText('something to search'));
      await alice.app.openConversation(peer.name);
      await alice.app.header.searchButton.click();
      const search = new SearchPanel(alice.page);

      await search.input.fill(o.text);

      // NetWatch fails the test on any page error; the panel must stay usable and in bounds.
      await expect(search.input).toHaveValue(o.text);
      await expect(search.messages).toHaveCount(0);
      const panel = (await search.root.boundingBox())!;
      const input = (await search.input.boundingBox())!;
      expect(input.x + input.width).toBeLessThanOrEqual(panel.x + panel.width + 1);
    });
  }

  test('ADVSEARCH-025 switching filters shows the right items each time', async ({ alice, data, api }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    await alice.app.sendAndConfirm(uniqueText('start'));
    const photos = MEDIA.find(m => m.filter === 'photos')!;
    const videos = MEDIA.find(m => m.filter === 'videos')!;
    const links = MEDIA.find(m => m.filter === 'links')!;
    for (const kind of [photos, videos, links]) await sendMedia(alice, kind);
    await api.users.waitForConversation(alice.user.uid, peer.uid);
    await alice.app.header.searchButton.click();
    const search = new SearchPanel(alice.page);

    for (const kind of [photos, videos, links]) {
      await search.toggle(kind.filter); // select
      await expect(search.messages).toHaveCount(1);
      await search.toggle(kind.filter); // deselect so the other chips come back
    }
  });

  test('ADVSEARCH-027 a deleted message is not found', async ({ alice, data, api }) => {
    const peer = await data.user('peer');
    const marker = uniqueMarker();
    const text = `Remember the ${marker} detail`;
    await alice.app.openChatWith(peer);
    await alice.app.sendAndConfirm(text);
    await api.users.waitForConversation(alice.user.uid, peer.uid); // BUG-012
    await alice.app.messages.message(text).choose(t('message_list_option_delete'));
    await new ConfirmDialog(alice.page, t('message_list_option_delete')).button(t('message_list_option_delete')).click();
    await expect(alice.app.messages.message(text).root).toHaveCount(0);
    await alice.app.header.searchButton.click();
    const search = new SearchPanel(alice.page);

    await search.input.fill(marker);

    await expect(search.noResults.first()).toBeVisible();
    await expect(search.messages.filter({ hasText: marker })).toHaveCount(0);
  });

  test('ADVSEARCH-029 searching while offline does not crash and shows no stale results', { tag: '@network' }, async ({ alice, data, api }) => {
    const peer = await data.user('peer');
    await api.messages.sendText(peer.uid, { uid: alice.user.uid }, uniqueText('online message'));
    await alice.app.openConversation(peer.name);
    await alice.app.header.searchButton.click();
    const search = new SearchPanel(alice.page);
    alice.net.allow(/.*/); // requests fail while offline

    await alice.context.setOffline(true);
    await search.input.fill(uniqueMarker());

    await expect(search.root).toBeVisible();
    await expect(search.messages).toHaveCount(0);
    await alice.context.setOffline(false);
  });

  test('ADVSEARCH-030 every media filter works in a group chat', async ({ alice, bob, data, api }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    await alice.app.openGroup(group.name);
    await alice.app.sendAndConfirm(uniqueText('group start'));
    for (const kind of MEDIA) await sendMedia(alice, kind);
    await api.users.waitForConversation(alice.user.uid, group.guid);
    await alice.app.header.searchButton.click();
    const search = new SearchPanel(alice.page);

    for (const kind of MEDIA) {
      await search.toggle(kind.filter);
      await expect(search.messages, `${kind.label} in the group`).toHaveCount(1);
      await search.toggle(kind.filter);
    }
  });

  test('ADVSEARCH-031/032 group text search shows the sender and opens the message', async ({ alice, bob, data, api }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    const marker = uniqueMarker();
    const text = `Bob's idea about the ${marker} trip`;
    await api.messages.sendText(bob.user.uid, { guid: group.guid }, text);
    await alice.app.openGroup(group.name);
    await alice.app.header.searchButton.click();
    const search = new SearchPanel(alice.page);

    await search.input.fill(marker);

    const hit = search.messages.filter({ hasText: marker });
    await expect(hit).toBeVisible();
    await expect(hit).toContainText(bob.user.name);
    await hit.click();
    await expect(alice.app.messages.message(text).root).toBeInViewport();
  });
});
