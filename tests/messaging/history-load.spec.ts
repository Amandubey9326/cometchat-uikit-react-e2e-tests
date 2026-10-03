import { uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { holdRealtimeSocket } from '@utils/realtime';

test.describe('Message history loading', { tag: ['@messaging', '@regression'] }, () => {
  test(
    'MSG-26 history loads when the realtime connection completes while a conversation is opening',
    {
      tag: ['@critical', '@network'],
      annotation: [
        { type: 'bug', description: 'BUG-002 — history response is discarded; list stays blank (docs/findings.md)' },
        { type: 'issue', description: 'Seen naturally on WebKit after a reload (SMK-01, 4/4 runs)' },
      ],
    },
    async ({ data, api, loginAs, bob }) => {
      // Known product bug: remove this line once BUG-002 is fixed (the test then passes).
      test.fail(true, 'BUG-002');

      // Arrange — Bob has an unread message from a new user.
      const me = await data.user('history');
      const sender = await loginAs(me);
      const text = uniqueText('history');
      await sender.app.openChatWith(bob.user);
      await sender.app.composer.send(text);
      await expect(bob.app.conversations.item(me.name)).toContainText(text);
      await api.users.waitForConversation(bob.user.uid, me.uid); // BUG-012: a reload inside the new-chat window can lose the conversation from Chats

      // Arrange — after reload, Bob's realtime socket connects exactly when the conversation starts loading.
      const socket = await holdRealtimeSocket(bob.page);
      bob.page.on('request', req => {
        if (req.method() === 'GET' && req.url().includes(`/users/${me.uid}/conversation`)) socket.release();
      });
      await bob.page.reload();
      await bob.app.home.waitForReady();

      // Act
      await bob.app.openConversation(me.name);

      // Assert — the history is shown.
      await expect(bob.app.messages.message(text).root).toBeVisible();
    }
  );
});
