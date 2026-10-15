import { t } from '@i18n/t';
import { uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { MessageBubble } from '@pages/messages/MessageBubble';
import { ConfirmDialog } from '@pages/components/Dialogs';
import { ASSETS } from '@pages/messages/MessageComposer';

const THREAD = t('message_list_option_reply_in_thread');

test.describe('Threads', { tag: ['@threads', '@regression'] }, () => {
  test('THR-01/04/05 a thread opens with the parent message, counts replies and closes', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const parent = uniqueText('thread parent');
    await alice.app.sendAndConfirm(parent);
    const { thread } = alice.app;

    await alice.app.messages.message(parent).choose(THREAD);

    await expect(thread.root).toBeVisible();
    await expect(thread.header).toContainText(parent);
    await thread.composer.sendWithEnter(uniqueText('first reply'));
    await expect(thread.replyCount).toContainText(`1 ${t('thread_reply')}`);
    await thread.closeButton.click();
    await expect(thread.root).toBeHidden();
  });

  test('THR-02/03 a thread reply updates the parent for both users and the receiver can open it', { tag: '@critical' }, async ({ alice, data, api, loginAs }) => {
    const peer = await data.user('threader');
    const other = await loginAs(peer);
    await alice.app.openChatWith(peer);
    await other.app.openChatWith(alice.user);
    const parent = uniqueText('discussion');
    await alice.app.sendAndConfirm(parent);
    await api.users.waitForConversation(alice.user.uid, peer.uid); // BUG-012: replies inside the window fail
    const reply = uniqueText('my thread reply');

    await alice.app.messages.message(parent).choose(THREAD);
    await alice.app.thread.composer.sendWithEnter(reply);

    await expect(alice.app.messages.message(parent).threadRepliesButton).toHaveAccessibleName(MessageBubble.threadRepliesLabel(1));
    const theirParent = other.app.messages.message(parent);
    await expect(theirParent.threadRepliesButton).toHaveAccessibleName(MessageBubble.threadRepliesLabel(1));
    await theirParent.threadRepliesButton.click();
    await expect(other.app.thread.messages.message(reply).root).toBeVisible();
  });

  test('THR-06 replying inside a thread does not leak a reply preview into the main composer', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const parent = uniqueText('parent');
    await alice.app.sendAndConfirm(parent);
    await alice.app.messages.message(parent).choose(THREAD);
    const inThread = uniqueText('in thread');
    await alice.app.thread.composer.sendWithEnter(inThread);

    await alice.app.thread.messages.message(inThread).reply();

    await expect(alice.app.thread.composer.replyPreview).toBeVisible();
    await expect(alice.app.composer.replyPreview).toBeHidden();
  });

  test('THR-08 a thread reply can be edited and deleted', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const parent = uniqueText('parent');
    await alice.app.sendAndConfirm(parent);
    await alice.app.messages.message(parent).choose(THREAD);
    const { thread } = alice.app;
    const original = uniqueText('thread draft');
    await thread.composer.sendWithEnter(original);
    await thread.messages.message(original).waitUntilSent();

    await thread.messages.message(original).choose(t('message_list_option_edit'));
    await thread.composer.clear();
    const edited = uniqueText('thread edited');
    await thread.composer.type(edited);
    await thread.composer.input.press('Enter');
    await expect(thread.messages.message(edited).editedLabel).toBeVisible();

    await thread.messages.message(edited).choose(t('message_list_option_delete'));
    await new ConfirmDialog(alice.page, t('message_list_option_delete')).button(t('message_list_option_delete')).click();
    await expect(thread.messages.deleted()).toHaveCount(1);
  });

  test('THR-09 threads work in a group', async ({ alice, bob, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    await alice.app.openGroup(group.name);
    await bob.app.openGroup(group.name);
    const parent = uniqueText('group topic');
    await alice.app.sendAndConfirm(parent);

    await bob.app.messages.message(parent).choose(THREAD);
    const reply = uniqueText('group thread reply');
    await bob.app.thread.composer.sendWithEnter(reply);

    await expect(alice.app.messages.message(parent).threadRepliesButton).toHaveAccessibleName(MessageBubble.threadRepliesLabel(1));
  });

  test('THR-10 thread replies survive a reload', async ({ alice, data, api }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const parent = uniqueText('parent');
    await alice.app.sendAndConfirm(parent);
    await api.users.waitForConversation(alice.user.uid, peer.uid); // BUG-012: replies inside the window fail
    await alice.app.messages.message(parent).choose(THREAD);
    const reply = uniqueText('stays');
    await alice.app.thread.composer.sendWithEnter(reply);
    await alice.app.thread.messages.message(reply).waitUntilSent();

    await alice.app.reload();
    await alice.app.openConversation(peer.name);
    await alice.app.messages.message(parent).threadRepliesButton.click();

    await expect(alice.app.thread.messages.message(reply).root).toBeVisible();
  });

  test(
    'THR-11 a thread reply that fails to send stays inside the thread',
    { tag: '@network', annotation: { type: 'bug', description: 'BUG-015 — a failed thread reply also appears in the main conversation' } },
    async ({ alice, data, api }) => {
      test.fail(true, 'BUG-015');
      const peer = await data.user('peer');
      await alice.app.openChatWith(peer);
      const parent = uniqueText('parent');
      await alice.app.sendAndConfirm(parent);
      await api.users.waitForConversation(alice.user.uid, peer.uid);
      await alice.app.messages.message(parent).choose(THREAD);
      alice.net.allow(/\/thread/);
      await alice.page.route(/\/messages\/\d+\/thread$/, route =>
        route.request().method() === 'POST' ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"code":"ERR_INTERNAL"}}' }) : route.continue()
      );
      const reply = uniqueText('never sent');

      await alice.app.thread.composer.sendWithEnter(reply);

      await expect(alice.app.thread.messages.message(reply).receipt('error')).toBeVisible();
      await expect(alice.app.messages.message(reply).root).toHaveCount(0);
    }
  );

  test('THR-07 a file can be sent inside a 1:1 thread', async ({ alice, data, api }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    const parent = uniqueText('needs the file');
    await alice.app.sendAndConfirm(parent);
    await api.users.waitForConversation(alice.user.uid, peer.uid); // BUG-012
    await alice.app.messages.message(parent).choose(THREAD);

    await alice.app.thread.composer.attach('file', ASSETS.pdf);

    await expect(alice.app.thread.messages.last().root).toHaveAccessibleName(/, file message$/);
    await expect(alice.app.thread.messages.last().root).toContainText('test-file.pdf');
    await expect(alice.app.messages.message(parent).threadRepliesButton).toHaveAccessibleName(MessageBubble.threadRepliesLabel(1));
  });
});
