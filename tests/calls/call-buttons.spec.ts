import { expect, test } from '@fixtures/test.fixture';
import { callButton } from '@pages/calls/CallScreens';

// No media involved, so this runs in the regular browser projects (Chromium, WebKit, Firefox in CI)
// rather than the `@calls` project with fake devices.
test.describe('Call buttons', { tag: ['@regression', '@critical'] }, () => {
  test('CALL-15 voice and video call buttons are offered in 1:1 and group chats', async ({ alice, data }) => {
    const peer = await data.user('peer');
    const group = await data.group({ owner: alice.user, participants: [peer] });

    await alice.app.openChatWith(peer);
    await expect(callButton(alice.app.header.banner, 'voice')).toBeEnabled();
    await expect(callButton(alice.app.header.banner, 'video')).toBeEnabled();

    await alice.app.openGroup(group.name);
    await expect(callButton(alice.app.header.banner, 'voice')).toBeEnabled();
    await expect(callButton(alice.app.header.banner, 'video')).toBeEnabled();
  });
});
