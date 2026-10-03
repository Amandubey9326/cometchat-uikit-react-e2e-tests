import { uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { signIn } from '@flows/sign-in';
import { ChatApp } from '@pages/ChatApp';

test.describe('Conversations with deleted users', { tag: ['@conversations', '@regression'] }, () => {
  test(
    'CONV-24 the app still loads when a user I messaged has been deleted',
    {
      tag: '@critical',
      annotation: {
        type: 'bug',
        description:
          "BUG-008 — server returns the conversation without conversationWith; UIKit crashes to a white screen: \"Cannot use 'in' operator to search for 'getGuid' in undefined\" (CometChatConversationsItem.tsx:494)",
      },
    },
    async ({ page, net, data, api }) => {
      test.fail(true, 'BUG-008');
      // Arrange — I sent the last message to a user whose account is then deleted.
      const me = await data.user('survivor');
      const leaver = await data.user('leaver');
      await api.messages.sendText(me.uid, { uid: leaver.uid }, uniqueText('farewell'));
      const conversationId = `${me.uid}_user_${leaver.uid}`;
      await api.users.delete(leaver.uid);
      // The server now lists the conversation without its `conversationWith`.
      await expect
        .poll(
          async () => {
            const c = (await api.users.conversations(me.uid)).find(x => x.conversationId === conversationId);
            return c ? (c.conversationWith ? 'complete' : 'missing-with') : 'absent';
          },
          { timeout: 45_000 }
        )
        .toBe('missing-with');
      net.allow(/getGuid/);
      const pageErrors: string[] = [];
      page.on('pageerror', e => pageErrors.push(e.message));

      // Act — open the app.
      await signIn(page, me.uid, { realtime: false });

      // Assert — the app stays usable and nothing crashed.
      const app = new ChatApp(page);
      await expect(app.home.chatsRegion).toBeVisible();
      await expect(app.conversations.list.or(app.conversations.emptyState)).toBeVisible();
      expect(pageErrors).toEqual([]);
    }
  );
});
