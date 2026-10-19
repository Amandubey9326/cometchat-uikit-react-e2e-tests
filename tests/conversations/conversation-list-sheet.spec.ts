import { shortId, uniqueSentences, uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { t } from '@i18n/t';
import { ConfirmDialog } from '@pages/components/Dialogs';

/**
 * Conversation list — cases from the "Conversation List" tab of CometChat_Features_All_Test_Cases.xlsx
 * (CL_xxx) that the core suite did not cover yet. Pin / unpin (CL_025–033) is not in UIKit 7.0.3.
 */
const DAY = 24 * 60 * 60 * 1000;
const timeOf = (item: import('@playwright/test').Locator) => item.locator('time').first();

test.describe('Conversation list (sheet cases)', { tag: ['@conversations', '@regression'] }, () => {
  test('CL-003 a group conversation shows its name, initials avatar and last message', async ({ alice, bob, data, api }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user], name: `Hiking Echo ${shortId()}` });
    const text = uniqueText('group news');

    await api.messages.sendText(bob.user.uid, { guid: group.guid }, text);

    const item = alice.app.conversations.item(group.name);
    await expect(item.getByRole('img', { name: group.name })).toContainText('HE');
    await expect(item).toContainText(text);
  });

  test('CL-012 deleting a conversation without network keeps it', { tag: '@network' }, async ({ data, api, loginAs }) => {
    const me = await data.user('cleaner');
    const peer = await data.user('peer');
    await api.messages.sendText(peer.uid, { uid: me.uid }, uniqueText('keep this chat'));
    await api.users.waitForConversation(me.uid, peer.uid);
    const { app, page, context, net } = await loginAs(me);
    net.allow(/.*/);

    await context.setOffline(true);
    await app.conversations.item(peer.name).hover();
    await app.conversations.deleteButton(peer.name).click();
    await new ConfirmDialog(page, t('conversation_delete_title')).button(t('conversation_delete_confirm_yes')).click();
    await context.setOffline(false);
    await app.reload();

    await expect(app.conversations.item(peer.name)).toBeVisible();
  });

  test('CL-013 a conversation from today shows the time', async ({ alice, data, api }) => {
    const peer = await data.user('today');

    await api.messages.sendText(peer.uid, { uid: alice.user.uid }, uniqueText('morning'));

    await expect(timeOf(alice.app.conversations.item(peer.name))).toHaveText(/^\d{1,2}:\d{2}\s?(AM|PM)$/i);
  });

  test('CL-014 a conversation from yesterday shows "Yesterday"', async ({ alice, data, api }) => {
    const peer = await data.user('yesterday');
    await api.messages.sendText(peer.uid, { uid: alice.user.uid }, uniqueText('last night'));
    await alice.page.clock.install({ time: Date.now() + DAY }); // view the list one day later

    await alice.app.reload();

    await expect(timeOf(alice.app.conversations.item(peer.name))).toHaveText(t('date_yesterday'));
  });

  test('CL-015 an older conversation shows a date', async ({ alice, data, api }) => {
    const peer = await data.user('older');
    await api.messages.sendText(peer.uid, { uid: alice.user.uid }, uniqueText('a while ago'));
    await alice.page.clock.install({ time: Date.now() + 10 * DAY });

    await alice.app.reload();

    await expect(timeOf(alice.app.conversations.item(peer.name))).toHaveText(/\d/);
    await expect(timeOf(alice.app.conversations.item(peer.name))).not.toHaveText(/:\d{2}\s?(AM|PM)$/i);
  });

  test('CL-016 the time label changes to "Yesterday" after midnight', async ({ alice, data, api }) => {
    const peer = await data.user('midnight');
    await api.messages.sendText(peer.uid, { uid: alice.user.uid }, uniqueText('late message'));
    await alice.page.clock.install({ time: Date.now() });
    await alice.app.reload();
    const time = timeOf(alice.app.conversations.item(peer.name));
    await expect(time).toHaveText(/:\d{2}/);

    await alice.page.clock.fastForward(DAY);

    await expect(time).toHaveText(t('date_yesterday'), { timeout: 70_000 });
  });

  test('CL-018 my own last message is prefixed with "You:"', async ({ alice, data, api }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const text = uniqueText('from me');
    await alice.app.sendAndConfirm(text);
    await api.users.waitForConversation(alice.user.uid, peer.uid);

    await alice.app.home.openTab('chats');

    await expect(alice.app.conversations.item(peer.name)).toContainText(`${t('conversation_subtitle_you_message')}:`);
  });

  test('CL-020 a long last message is cut with an ellipsis', async ({ alice, data, api }) => {
    const peer = await data.user('talker');
    const { texts } = uniqueSentences(6, 'long');

    await api.messages.sendText(peer.uid, { uid: alice.user.uid }, texts.join(' '));

    const item = alice.app.conversations.item(peer.name);
    await expect(item).toBeVisible();
    const truncated = await item.evaluate(el =>
      Array.from(el.querySelectorAll<HTMLElement>('*')).some(n => n.scrollWidth > n.clientWidth && getComputedStyle(n).textOverflow === 'ellipsis')
    );
    expect(truncated).toBe(true);
  });

  test('CL-023 opening a chat without sending creates no conversation item', async ({ alice, data }) => {
    const peer = await data.user('silent');

    await alice.app.openChatWith(peer);
    await alice.app.home.openTab('chats');

    await expect(alice.app.conversations.item(peer.name)).toHaveCount(0);
  });
});
