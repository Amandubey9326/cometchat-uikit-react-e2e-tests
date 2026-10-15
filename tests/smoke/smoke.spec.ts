import { t } from '@i18n/t';
import { RUN_PREFIX } from '@config/run';
import { uniqueMarker, uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { LoginPage } from '@pages/auth/LoginPage';
import { CreateGroupDialog } from '@pages/groups/GroupDialogs';
import { startsWithWord } from '@utils/text';

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

  test(
    'SMK-02 create a group, add a member, chat both ways live, persist on reload',
    { tag: ['@smoke', '@critical'] },
    async ({ alice, bob, data }) => {
      // Arrange — Alice creates a public group through the UI.
      const name = data.uiGroup(`${RUN_PREFIX}ui ${uniqueMarker()}`);
      await alice.app.home.openTab('groups');
      await alice.app.groups.createGroupButton.click();
      const dialog = new CreateGroupDialog(alice.page);
      await dialog.type('public').check();
      await dialog.nameInput.fill(name);
      await dialog.createButton.click();
      await expect(dialog.dialog).toBeHidden();
      await alice.app.openGroup(name);

      // Act — she adds Bob from Group Info.
      await alice.app.openDetails();
      await alice.app.groupDetails.action(t('add_members')).click();
      const sheet = alice.page.locator('.cometchat-add-members');
      await sheet.getByRole('searchbox').fill(bob.user.name);
      await sheet.getByRole('option', { name: startsWithWord(bob.user.name) }).click();
      await sheet.locator('.cometchat-add-members__add-btn').click();
      await expect(alice.app.groupDetails.members.member(bob.user.name)).toBeVisible();
      await alice.app.groupDetails.closeIcon.click();

      // Assert — Alice's message reaches Bob live; Bob's reply reaches Alice live.
      const hello = uniqueText('group hello');
      await alice.app.sendAndConfirm(hello);
      await expect(bob.app.conversations.item(name)).toContainText(hello);
      await bob.app.openConversation(name);
      await expect(bob.app.messages.message(hello).root).toBeVisible();
      const reply = uniqueText('group reply');
      await bob.app.sendAndConfirm(reply);
      await expect(alice.app.messages.message(reply).root).toBeVisible();

      // Assert — both messages survive a reload.
      await bob.app.reload();
      await bob.app.openConversation(name);
      await expect(bob.app.messages.message(hello).root).toBeVisible();
      await expect(bob.app.messages.message(reply).root).toBeVisible();
    }
  );
});
