import { uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { LoginPage } from '@pages/auth/LoginPage';

test.describe('Smoke journey', () => {
  test(
    'SMK-01 sign in, send a message, receive it live, persist on reload, sign out',
    { tag: ['@smoke', '@critical'] },
    async ({ data, api, loginAs, bob }) => {
      // Arrange — a fresh user signs in through the real UI; Bob is already on Home.
      const me = await data.user('smoke');
      const text = uniqueText('smoke');
      const sender = await loginAs(me);

      // Act — start a new 1:1 chat with Bob and send.
      await sender.app.openChatWith(bob.user);
      await sender.app.composer.send(text);

      // Assert — the sender sees it; Bob gets the new conversation and message live.
      await expect(sender.app.messages.message(text).root).toBeVisible();
      await expect(bob.app.conversations.item(me.name)).toContainText(text);
      await bob.app.openConversation(me.name);
      await expect(bob.app.messages.message(text).root).toBeVisible();

      // Assert — the message survives a reload.
      await api.users.waitForConversation(bob.user.uid, me.uid); // BUG-012: a reload inside the new-chat window can lose the conversation from Chats
      await bob.app.reload();
      await bob.app.openConversation(me.name);
      await expect(bob.app.messages.message(text).root).toBeVisible();

      // Act + Assert — sign out lands on the login screen and stays there after reload.
      await sender.app.home.logout();
      const login = new LoginPage(sender.page);
      await login.expectVisible();
      await sender.page.reload();
      await login.expectVisible();
    }
  );
});
