import { uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { signIn } from '@flows/sign-in';
import { ChatApp } from '@pages/ChatApp';
import { delayResponse } from '@utils/network';

test.describe('Realtime after login', { tag: ['@auth', '@regression'] }, () => {
  test(
    'AUTH-23 realtime works after login even when the login profile update is slow',
    {
      tag: ['@critical', '@network'],
      annotation: [
        { type: 'bug', description: 'BUG-003 — socket opens before login finishes and never authenticates (docs/findings.md)' },
      ],
    },
    async ({ page, data, api }) => {
      // Known product bug: remove this line once BUG-003 is fixed (the test then passes).
      test.fail(true, 'BUG-003');

      // Arrange — the second profile update of the login flow (PUT /me) answers 2.5 s late.
      const me = await data.user('slowlogin');
      const friend = await data.user('friend');
      await delayResponse(page, /\/v3\.0\/me$/, { method: 'PUT', nth: 2, ms: 2_500 });

      // Act — sign in (no reload workaround), then a friend sends a message.
      await signIn(page, me.uid, { realtime: false });
      const text = uniqueText('live');
      await api.messages.sendText(friend.uid, { uid: me.uid }, text);

      // Assert — the conversation arrives live, without a reload.
      await expect(new ChatApp(page).conversations.item(friend.name)).toContainText(text);
    }
  );
});
