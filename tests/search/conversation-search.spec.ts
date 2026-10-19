import { uniqueMarker, uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { t } from '@i18n/t';
import { ConfirmDialog } from '@pages/components/Dialogs';
import { SearchPanel } from '@pages/search/SearchPanel';
import { MEDIA, sendMedia } from './media-filters';

/**
 * Conversation (global) search — opened from the Chats search box.
 * IDs map 1:1 to the "Conversation Search" tab of CometChat_Features_All_Test_Cases.xlsx (CONVSEARCH_xxx).
 */
test.describe('Conversation search (global)', { tag: ['@search', '@regression'] }, () => {
  const ids: Record<string, [string, string]> = {
    Audio: ['001/002', '003'],
    Documents: ['004/005', '006'],
    Photos: ['007/008', '009'],
    Videos: ['010/011', '012'],
    Links: ['013/014', '015'],
  };

  for (const kind of MEDIA) {
    const [found, empty] = ids[kind.label];

    test(`CONVSEARCH-${found} the ${kind.label} filter finds the item and opens its chat at the message`, async ({ alice, data, api }) => {
      const peer = await data.user('peer');
      await alice.app.openChatWith(peer);
      await alice.app.sendAndConfirm(uniqueText('hello'));
      await sendMedia(alice, kind);
      await api.users.waitForConversation(alice.user.uid, peer.uid);
      await alice.app.home.openTab('chats');
      await alice.app.conversations.searchBox.click();
      const search = new SearchPanel(alice.page);

      await search.toggle(kind.filter);

      const hit = search.messages.first();
      await expect(hit).toBeVisible();
      await hit.click();
      await expect(alice.app.header.titleFor(peer.name)).toBeVisible();
      await expect(alice.app.messages.ofType(kind.bubble).last()).toBeInViewport();
    });

    test(`CONVSEARCH-${empty} the ${kind.label} filter shows "No Results" when no chat has such items`, async ({ data, api, loginAs }) => {
      const me = await data.user('fresh');
      const peer = await data.user('peer');
      await api.messages.sendText(peer.uid, { uid: me.uid }, uniqueText('only text'));
      const { app, page } = await loginAs(me);
      await app.conversations.searchBox.click();
      const search = new SearchPanel(page);

      await search.toggle(kind.filter);

      await expect(search.noResults.first()).toBeVisible();
      await expect(search.messages).toHaveCount(0);
    });
  }

  test('CONVSEARCH-016/017/018 the Groups filter lists only matching groups and opens the group chat', async ({ alice, bob, data, api }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    await api.messages.sendText(bob.user.uid, { guid: group.guid }, uniqueText('group hello'));
    await api.messages.sendText(bob.user.uid, { uid: alice.user.uid }, uniqueText('direct hello'));
    await expect(alice.app.conversations.item(group.name)).toBeVisible();
    await alice.app.conversations.searchBox.click();
    const search = new SearchPanel(alice.page);

    await search.toggle('groups');
    await search.input.fill(group.name.split(' ').slice(-1)[0]); // part of the name

    await expect(search.conversations.filter({ hasText: group.name })).toBeVisible();
    await search.input.fill(bob.user.name); // a 1:1 partner is not a group (CONVSEARCH_018)
    await expect(search.conversations.filter({ hasText: bob.user.name })).toHaveCount(0);
    await search.input.fill(group.name.split(' ').slice(-1)[0]);
    await search.conversations.filter({ hasText: group.name }).click();
    await expect(alice.app.header.titleFor(group.name)).toBeVisible();
  });

  test('CONVSEARCH-019 the Groups filter with an unknown name shows "No Results"', async ({ alice }) => {
    await alice.app.conversations.searchBox.click();
    const search = new SearchPanel(alice.page);

    await search.toggle('groups');
    await search.input.fill(`no such group ${uniqueMarker()}`);

    await expect(search.noResults.first()).toBeVisible();
  });

  test('CONVSEARCH-021 a conversation leaves the Unread list once it is read', async ({ alice, data, api }) => {
    const peer = await data.user('writer');
    await api.messages.sendText(peer.uid, { uid: alice.user.uid }, uniqueText('please read me'));
    await api.users.waitForConversation(alice.user.uid, peer.uid);
    await expect(alice.app.conversations.item(peer.name)).toHaveAccessibleName(alice.app.conversations.unreadSuffix());
    await alice.app.conversations.searchBox.click();
    const search = new SearchPanel(alice.page);
    await search.toggle('unread');
    await search.conversations.filter({ hasText: peer.name }).click();
    await expect(alice.app.header.titleFor(peer.name)).toBeVisible();

    await alice.app.conversations.searchBox.click();
    await search.toggle('unread');

    await expect(search.conversations.filter({ hasText: peer.name })).toHaveCount(0);
  });

  test('CONVSEARCH-022 the Unread filter is empty when everything is read', async ({ data, api, loginAs }) => {
    const me = await data.user('reader');
    const peer = await data.user('peer');
    await api.messages.sendText(peer.uid, { uid: me.uid }, uniqueText('hello'));
    await api.users.waitForConversation(me.uid, peer.uid);
    const { app, page } = await loginAs(me);
    await app.openConversation(peer.name);
    await expect(app.conversations.item(peer.name)).not.toHaveAccessibleName(app.conversations.unreadSuffix());
    await app.conversations.searchBox.click();
    const search = new SearchPanel(page);

    await search.toggle('unread');

    await expect(search.noResults.first()).toBeVisible();
    await expect(search.conversations).toHaveCount(0);
  });

  const odd = [
    { id: '028', name: 'special characters', text: '@#$%^&*()' },
    { id: '029', name: 'only spaces', text: '     ' },
  ];
  for (const o of odd) {
    test(`CONVSEARCH-${o.id} searching ${o.name} does not break the search`, async ({ alice }) => {
      await alice.app.conversations.searchBox.click();
      const search = new SearchPanel(alice.page);

      await search.input.fill(o.text);

      await expect(search.input).toHaveValue(o.text);
      await expect(search.root).toBeVisible();
      await expect(search.messages).toHaveCount(0);
    });
  }

  test('CONVSEARCH-030 switching Photos → Groups → Unread refreshes the results', async ({ alice, bob, data, api }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    await api.messages.sendText(bob.user.uid, { guid: group.guid }, uniqueText('group unread'));
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    await alice.app.sendAndConfirm(uniqueText('hi'));
    await sendMedia(alice, MEDIA.find(m => m.filter === 'photos')!);
    await api.users.waitForConversation(alice.user.uid, peer.uid);
    await alice.app.home.openTab('chats');
    await alice.app.conversations.searchBox.click();
    const search = new SearchPanel(alice.page);

    await search.toggle('photos');
    await expect(search.messages.first()).toBeVisible();
    await search.toggle('photos');
    await search.toggle('groups');
    await expect(search.messages).toHaveCount(0); // a conversation filter shows no message results
    await expect(search.conversations.filter({ hasText: group.name })).toBeVisible();
    await search.toggle('groups');
    await search.toggle('unread');
    await expect(search.conversations.filter({ hasText: group.name })).toBeVisible();
    await expect(search.conversations.filter({ hasText: peer.name })).toHaveCount(0);
  });

  test('CONVSEARCH-031 clearing the search and going back restores the conversation list', async ({ alice, data, api }) => {
    const peer = await data.user('peer');
    const marker = uniqueMarker();
    await api.messages.sendText(peer.uid, { uid: alice.user.uid }, `About the ${marker} event`);
    await expect(alice.app.conversations.item(peer.name)).toBeVisible();
    await alice.app.conversations.searchBox.click();
    const search = new SearchPanel(alice.page);
    await search.input.fill(marker);
    await expect(search.messages.filter({ hasText: marker })).toBeVisible();

    await search.clearButton.click();
    await expect(search.input).toHaveValue('');
    await search.backButton.click();

    await expect(search.root).toBeHidden();
    await expect(alice.app.conversations.item(peer.name)).toBeVisible();
  });

  test('CONVSEARCH-032 a deleted conversation is not found', async ({ data, api, loginAs }) => {
    const me = await data.user('cleaner');
    const peer = await data.user('peer');
    const marker = uniqueMarker();
    await api.messages.sendText(peer.uid, { uid: me.uid }, `Old note on the ${marker} topic`);
    await api.users.waitForConversation(me.uid, peer.uid);
    const { app, page } = await loginAs(me);
    await app.conversations.item(peer.name).hover();
    await app.conversations.deleteButton(peer.name).click();
    await new ConfirmDialog(page, t('conversation_delete_title')).button(t('conversation_delete_confirm_yes')).click();
    await expect(app.conversations.item(peer.name)).toHaveCount(0);
    await app.conversations.searchBox.click();
    const search = new SearchPanel(page);

    await search.input.fill(marker);

    await expect(search.conversations.filter({ hasText: peer.name })).toHaveCount(0);
    await expect(search.messages.filter({ hasText: marker })).toHaveCount(0);
  });

  test('CONVSEARCH-033 searching while offline does not crash', { tag: '@network' }, async ({ alice }) => {
    await alice.app.conversations.searchBox.click();
    const search = new SearchPanel(alice.page);
    alice.net.allow(/.*/);

    await alice.context.setOffline(true);
    await search.input.fill(uniqueMarker());

    await expect(search.root).toBeVisible();
    await expect(search.messages).toHaveCount(0);
    await alice.context.setOffline(false);
  });
});
