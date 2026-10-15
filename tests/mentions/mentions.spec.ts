import { t } from '@i18n/t';
import { uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { startsWithWord } from '@utils/text';

test.describe('Mentions', { tag: ['@mentions', '@regression'] }, () => {
  test('MEN-01/02/03 typing @ suggests members, filters, and inserts the mention', async ({ alice, bob, carol, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user, carol.user] });
    await alice.app.openGroup(group.name);
    const { composer } = alice.app;

    await composer.type('@');
    await expect(composer.mentionSuggestions).toBeVisible();
    await composer.input.pressSequentially(bob.user.name.split(' ')[0]);
    await expect(composer.mentionSuggestions.getByRole('option', { name: startsWithWord(bob.user.name) })).toBeVisible();
    await expect(composer.mentionSuggestions.getByRole('option', { name: startsWithWord(carol.user.name) })).toHaveCount(0);
    await composer.mentionSuggestions.getByRole('option', { name: startsWithWord(bob.user.name) }).click();

    await expect(composer.input).toContainText(bob.user.name);
    await expect(composer.mentionSuggestions).toBeHidden();
  });

  test(
    'MEN-04 suggestions work with the keyboard',
    { tag: '@a11y', annotation: { type: 'bug', description: 'BUG-011 — Enter sends "@Bob" as plain text instead of picking the suggestion; no arrow keys' } },
    async ({ alice, bob, data }) => {
      test.fail(true, 'BUG-011');
      const group = await data.group({ owner: alice.user, participants: [bob.user] });
      await alice.app.openGroup(group.name);
      const { composer } = alice.app;

      await composer.type(`@${bob.user.name.split(' ')[0]}`);
      await expect(composer.mentionSuggestions).toBeVisible();
      await composer.input.press('ArrowDown');
      await composer.input.press('Enter');

      await expect(composer.input).toContainText(bob.user.name, { timeout: 3_000 });
    }
  );

  test('MEN-04b suggestions close with Escape', { tag: '@a11y' }, async ({ alice, bob, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    await alice.app.openGroup(group.name);
    const { composer } = alice.app;
    await composer.type(`@${bob.user.name.split(' ')[0]}`);
    await expect(composer.mentionSuggestions).toBeVisible();

    await composer.input.press('Escape');

    await expect(composer.mentionSuggestions).toBeHidden();
  });

  test('MEN-05/06 several mentions are highlighted for the sender and the receivers', async ({ alice, bob, carol, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user, carol.user] });
    for (const u of [alice, bob]) await u.app.openGroup(group.name);
    const { composer } = alice.app;
    const text = uniqueText('mentions');

    await composer.type(`${text} @${bob.user.name.split(' ')[0]}`);
    await composer.mentionSuggestions.getByRole('option', { name: startsWithWord(bob.user.name) }).click();
    await composer.input.pressSequentially(` and @${carol.user.name.split(' ')[0]}`);
    await composer.mentionSuggestions.getByRole('option', { name: startsWithWord(carol.user.name) }).click();
    await composer.input.press('Enter');

    for (const side of [alice, bob]) {
      const bubble = side.app.messages.message(text);
      await expect(bubble.text.locator('.cometchat-mentions').filter({ hasText: bob.user.name })).toBeVisible();
      await expect(bubble.text.locator('.cometchat-mentions').filter({ hasText: carol.user.name })).toBeVisible();
    }
  });

  test('MEN-07 only group members are suggested', { tag: '@permissions' }, async ({ alice, bob, frank, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    await alice.app.openGroup(group.name);

    await alice.app.composer.type(`@${frank.user.name.split(' ')[0]}`);

    await expect(alice.app.composer.mentionSuggestions.getByRole('option', { name: startsWithWord(frank.user.name) })).toHaveCount(0);
  });

  test('MEN-08 "@all" is offered in a group', async ({ alice, bob, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    await alice.app.openGroup(group.name);

    await alice.app.composer.type('@');

    await expect(alice.app.composer.mentionSuggestions.getByRole('option', { name: new RegExp(t('message_composer_mention_all'), 'i') })).toBeVisible();
  });

  test('MEN-09 mentions work inside a thread', async ({ alice, bob, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    await alice.app.openGroup(group.name);
    const parent = uniqueText('thread topic');
    await alice.app.sendAndConfirm(parent);
    await alice.app.messages.message(parent).choose(t('message_list_option_reply_in_thread'));
    const { composer, messages } = alice.app.thread;
    const text = uniqueText('thread mention');

    await composer.type(`${text} @${bob.user.name.split(' ')[0]}`);
    await composer.mentionSuggestions.getByRole('option', { name: startsWithWord(bob.user.name) }).click();
    await composer.input.press('Enter');

    await expect(messages.message(text).text.locator('.cometchat-mentions')).toContainText(bob.user.name);
  });

  test('MEN-11 a mention survives a reload', async ({ alice, bob, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    await alice.app.openGroup(group.name);
    const text = uniqueText('persisted mention');
    await alice.app.composer.type(`${text} @${bob.user.name.split(' ')[0]}`);
    await alice.app.composer.mentionSuggestions.getByRole('option', { name: startsWithWord(bob.user.name) }).click();
    await alice.app.composer.input.press('Enter');
    await alice.app.messages.message(text).waitUntilSent();

    await alice.app.reload();
    await alice.app.openGroup(group.name);

    await expect(alice.app.messages.message(text).text.locator('.cometchat-mentions')).toContainText(bob.user.name);
  });

  test('MEN-10 names with spaces and special characters are suggested and mentioned in full', async ({ alice, data }) => {
    const special = await data.user('special', { name: "Zoë O'Brien-Núñez" }); // only group members are suggested
    const group = await data.group({ owner: alice.user, participants: [special] });
    await alice.app.openGroup(group.name);
    const { composer } = alice.app;
    const text = uniqueText('special mention');

    await composer.type(`${text} @Zoë O'B`);
    const option = composer.mentionSuggestions.getByRole('option', { name: startsWithWord(special.name) });
    await expect(option).toBeVisible();
    await option.click();
    await composer.input.press('Enter');

    await alice.app.messages.message(text).waitUntilSent();
    await expect(alice.app.messages.message(text).text.locator('.cometchat-mentions')).toContainText(special.name);
  });
});
