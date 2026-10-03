import { ClientSession } from '@api/client-session';
import { uniqueSentences } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';

/**
 * BUG-010 at the API level. UIKit marks a chat read when it is opened with
 * CometChat.markConversationAsRead → POST /users/{uid}/conversation/read. The call succeeds,
 * but the messages never get `readAt`, so the sender never sees "Read" (MSG-14b, MSG-15).
 */
test.describe('Read state', { tag: ['@api', '@regression'] }, () => {
  test(
    'API-05 marking a conversation read sets readAt on its messages',
    { annotation: { type: 'bug', description: 'BUG-010 — conversation/read returns 200 but readAt stays empty' } },
    async ({ api, data }) => {
      test.fail(true, 'BUG-010');
      const [me, peer] = [await data.user('reader'), await data.user('writer')];
      const { texts } = uniqueSentences(2, 'unread');
      for (const text of texts) await api.messages.sendText(peer.uid, { uid: me.uid }, text);
      await api.users.waitForConversation(me.uid, peer.uid); // BUG-012
      const reader = await ClientSession.open(api, me.uid);

      expect(await reader.markConversationRead(peer.uid)).toMatchObject({ status: 200 });

      await expect
        .poll(async () => (await reader.messagesWith(peer.uid)).data?.every(m => Boolean(m.readAt)), { timeout: 15_000 })
        .toBe(true);
    }
  );
});
