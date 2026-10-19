import { uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { t } from '@i18n/t';

/**
 * Composer — cases from the "Composer" tab of CometChat_Features_All_Test_Cases.xlsx (COMP_xxx) that
 * the core suite did not cover yet. Voice playback (COMP_012) = MSG-060, @all (COMP_018/019) =
 * MSG-078/083, no matching member (COMP_023) = MSG-092.
 */
test.describe('Composer (sheet cases)', { tag: ['@composer', '@regression'] }, () => {
  test('COMP-038 formatted text shows no raw markup for the receiver', async ({ alice, bob }) => {
    await alice.app.openChatWith(bob.user);
    await bob.app.openChatWith(alice.user);
    const word = uniqueText('bold idea');

    await alice.app.composer.input.click();
    await alice.app.composer.formatButton('Bold').click();
    await alice.app.composer.input.pressSequentially(word);
    await alice.app.composer.sendButton.click();

    const text = bob.app.messages.message(word).text;
    await expect(text.locator('strong, b')).toContainText(word);
    await expect(text).not.toContainText('**');
    await expect(text).not.toContainText('<b>');
  });

  test('COMP-039 formatting with no text cannot be sent', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);

    await alice.app.composer.input.click();
    await alice.app.composer.formatButton('Bold').click();
    await alice.app.composer.formatButton('Italic').click();

    await expect(alice.app.composer.sendButton).toBeDisabled();
    await alice.app.composer.input.press('Enter');
    await expect(alice.app.messages.messages).toHaveCount(0);
  });

  test('COMP-040 an invalid link URL is rejected', async ({ alice, data }) => {
    const peer = await data.user('peer');
    await alice.app.openChatWith(peer);
    await alice.app.composer.input.click();
    await alice.app.composer.formatButton('Link').click();
    const dialog = alice.page.getByRole('dialog', { name: t('link_dialog_add_link') });
    await dialog.getByPlaceholder(t('link_dialog_text_placeholder')).fill('click me');

    await dialog.getByPlaceholder('https://www.cometchat.com/').fill('not a url');
    await dialog.getByRole('button', { name: t('link_dialog_save') }).click();

    // Either the dialog refuses (error shown, stays open) or no link is created.
    await expect(alice.app.composer.input.getByRole('link')).toHaveCount(0);
  });
});
