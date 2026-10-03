import { t } from '@i18n/t';
import { expect, test, type ChatUser } from '@fixtures/test.fixture';
import { CallScreens, callButton } from '@pages/calls/CallScreens';

/**
 * Calls run in the `calls` project: Chromium with a fake camera and microphone, both granted.
 * The in-call screen is rendered by Calls SDK 5 inside `dialog "Ongoing call"`.
 */
test.describe('Calls — 1:1', { tag: ['@calls', '@regression'] }, () => {
  test.describe.configure({ timeout: 150_000 });

  const users = new Map<CallScreens, ChatUser>();
  const netOf = (screens: CallScreens) => users.get(screens)!.net;

  const ring = async (caller: ChatUser, callee: ChatUser, type: 'voice' | 'video') => {
    await caller.app.openChatWith(callee.user);
    await callButton(caller.app.header.banner, type).click();
    const mine = new CallScreens(caller.page);
    const theirs = new CallScreens(callee.page);
    users.set(mine, caller).set(theirs, callee);
    await expect(mine.outgoing).toContainText(callee.user.name);
    await expect(mine.outgoing).toContainText(t('calls_outgoing_call'));
    await expect(theirs.incomingFrom(caller.user.name)).toBeVisible({ timeout: 30_000 });
    return { mine, theirs };
  };

  const connect = async (a: CallScreens, b: CallScreens) => {
    for (const side of [a, b]) {
      // OBS-015: the Calls SDK can throw "Container dimensions and number of tiles must be positive"
      // while tearing down the tile layout when the other person leaves. Logged, not asserted here.
      netOf(side).allow(/Container dimensions and number of tiles must be positive/);
      await expect(side.ongoing).toBeVisible({ timeout: 30_000 });
      // Connected = both participants listed and the call timer running.
      await expect(side.ongoing.getByRole('heading', { name: /\(2\)$/ })).toBeVisible({ timeout: 45_000 });
      await expect(side.ongoing.getByText(/^\d{2}:\d{2}$/).first()).not.toHaveText('00:00', { timeout: 15_000 });
    }
  };

  test('CALL-01 a voice call rings the callee; the caller cancels it and both chats record it', { tag: '@critical' }, async ({ alice, bob }) => {
    const { mine, theirs } = await ring(alice, bob, 'voice');
    await expect(theirs.incoming).toHaveAccessibleName(new RegExp(`Voice call from ${alice.user.name}$`, 'i'));

    await mine.endOutgoing.click();

    await expect(mine.outgoing).toBeHidden();
    await expect(theirs.incoming).toBeHidden({ timeout: 30_000 });
    // The live bubble does not update (BUG-018, CALL-01b) — the recorded status is checked after a reload.
    await alice.app.reload();
    await alice.app.openChatWith(bob.user); // a chat holding only call messages is not listed in Chats (OBS-014)
    await expect(alice.app.messages.log.getByText(t('call_action_cancelled'))).toBeVisible();
    await bob.app.openChatWith(alice.user);
    await expect(bob.app.messages.log.getByText(t('call_action_missed'))).toBeVisible();
  });

  test(
    'CALL-01b the caller\'s chat shows "Cancelled Call" as soon as the call is cancelled',
    { annotation: { type: 'bug', description: 'BUG-018 — call bubbles keep "Outgoing Call" until a reload' } },
    async ({ alice, bob }) => {
      test.fail(true, 'BUG-018');
      const { mine, theirs } = await ring(alice, bob, 'voice');

      await mine.endOutgoing.click();
      await expect(theirs.incoming).toBeHidden({ timeout: 30_000 });

      await expect(alice.app.messages.log.getByText(t('call_action_cancelled'))).toBeVisible();
    }
  );

  test('CALL-02 the callee declines a video call; the caller is told', async ({ alice, bob }) => {
    const { mine, theirs } = await ring(alice, bob, 'video');
    await expect(theirs.incoming).toHaveAccessibleName(new RegExp(`Video call from ${alice.user.name}$`, 'i'));

    await theirs.decline.click();

    await expect(theirs.incoming).toBeHidden();
    await expect(mine.outgoing).toBeHidden({ timeout: 30_000 });
    await expect(alice.app.messages.log.getByText(t('call_action_rejected'))).toBeVisible();
  });

  test('CALL-03/04 an accepted voice call connects both users', { tag: '@critical' }, async ({ alice, bob }) => {
    const { mine, theirs } = await ring(alice, bob, 'voice');

    await theirs.accept.click();

    await expect(theirs.incoming).toBeHidden();
    await expect(mine.outgoing).toBeHidden({ timeout: 30_000 });
    await connect(mine, theirs);
  });

  test('CALL-09 mute and unmute during a call', async ({ alice, bob }) => {
    const { mine, theirs } = await ring(alice, bob, 'voice');
    await theirs.accept.click();
    await connect(mine, theirs);

    await mine.ongoing.getByRole('button', { name: /^mute microphone$/i }).click();
    await expect(mine.ongoing.getByRole('button', { name: /^unmute microphone$/i })).toBeVisible();
    await mine.ongoing.getByRole('button', { name: /^unmute microphone$/i }).click();

    await expect(mine.ongoing.getByRole('button', { name: /^mute microphone$/i })).toBeVisible();
  });

  test('CALL-08 leaving ends the call for both; both chats show "Call Ended"', { tag: '@critical' }, async ({ alice, bob }) => {
    const { mine, theirs } = await ring(alice, bob, 'voice');
    await theirs.accept.click();
    await connect(mine, theirs);

    await mine.ongoing.getByRole('button', { name: /^leave session$/i }).click();

    await expect(mine.ongoing).toBeHidden({ timeout: 30_000 });
    await expect(theirs.ongoing).toBeHidden({ timeout: 30_000 });
    await alice.app.reload();
    await alice.app.openChatWith(bob.user);
    await expect(alice.app.messages.log.getByText(t('call_action_ended')).last()).toBeVisible();
  });

  test(
    'CALL-08b "Call Ended" appears in the chat as soon as the call ends',
    { annotation: { type: 'bug', description: 'BUG-018 — call bubbles keep "Answered Call" until a reload' } },
    async ({ alice, bob }) => {
      test.fail(true, 'BUG-018');
      const { mine, theirs } = await ring(alice, bob, 'voice');
      await theirs.accept.click();
      await connect(mine, theirs);

      await mine.ongoing.getByRole('button', { name: /^leave session$/i }).click();
      await expect(mine.ongoing).toBeHidden({ timeout: 30_000 });

      await expect(alice.app.messages.log.getByText(t('call_action_ended'))).toBeVisible();
    }
  );

  test('CALL-10 a video call offers camera control', async ({ alice, bob }) => {
    const { mine, theirs } = await ring(alice, bob, 'video');
    await theirs.accept.click();
    await connect(mine, theirs);

    await expect(mine.ongoing.getByRole('button', { name: /camera|video/i }).first()).toBeVisible();
  });

  test('CALL-12 call logs list the call for both users', async ({ alice, bob }) => {
    const { mine, theirs } = await ring(alice, bob, 'voice');
    await mine.endOutgoing.click();
    await expect(theirs.incoming).toBeHidden({ timeout: 30_000 });

    for (const [me, other] of [[alice, bob], [bob, alice]] as const) {
      await me.app.home.openTab('calls');
      await expect(me.app.home.callsPane.getByRole('button', { name: new RegExp(other.user.name) }).first()).toBeVisible({ timeout: 30_000 });
    }
  });

  test('CALL-06 an unanswered call stops ringing on its own and is recorded as unanswered / missed', async ({ alice, bob }) => {
    const { mine, theirs } = await ring(alice, bob, 'voice');

    // Nobody acts: the server times the call out (about 45 s on this app).
    await expect(mine.outgoing).toBeHidden({ timeout: 90_000 });
    await expect(theirs.incoming).toBeHidden({ timeout: 30_000 });
    await alice.app.reload(); // BUG-018: the live bubble does not update
    await alice.app.openChatWith(bob.user);
    await expect(alice.app.messages.log.getByText(t('call_action_unanswered'))).toBeVisible();
    await bob.app.reload();
    await bob.app.openChatWith(alice.user);
    await expect(bob.app.messages.log.getByText(t('call_action_missed'))).toBeVisible();
  });

  test(
    'CALL-07 calling someone who is already in a call ends as busy and does not interrupt them',
    { annotation: { type: 'bug', description: 'BUG-019 — no busy handling: the caller rings until the ~45 s timeout; the callee gets an incoming alert mid-call' } },
    async ({ alice, bob, carol }) => {
      test.fail(true, 'BUG-019');
      const first = await ring(bob, carol, 'voice');
      await first.theirs.accept.click();
      await connect(first.mine, first.theirs);

      await alice.app.openChatWith(bob.user);
      await callButton(alice.app.header.banner, 'voice').click();
      const mine = new CallScreens(alice.page);
      users.set(mine, alice);
      await expect(mine.outgoing).toBeVisible(); // the call was placed

      // The server does not answer "busy" itself (it returns "initiated" at once) — Bob's app has to.
      // Expected: Alice's screen closes well before the ~45 s unanswered timeout, and Bob is not interrupted.
      await expect(mine.outgoing).toBeHidden({ timeout: 20_000 });
      await expect(new CallScreens(bob.page).incomingFrom(alice.user.name)).toHaveCount(0);
      await expect(first.mine.ongoing.getByRole('heading', { name: /\(2\)$/ })).toBeVisible(); // Bob's call carries on
      await alice.app.reload();
      await alice.app.openChatWith(bob.user);
      await expect(alice.app.messages.log.getByText(t('call_action_busy'))).toBeVisible();
    }
  );

  test('CALL-13 a call log opens its details: who, participants and history', async ({ alice, bob }) => {
    const { mine, theirs } = await ring(alice, bob, 'voice');
    await mine.endOutgoing.click();
    await expect(theirs.incoming).toBeHidden({ timeout: 30_000 });
    await alice.app.home.openTab('calls');
    const row = alice.app.home.callsPane.getByRole('button', { name: new RegExp(bob.user.name) }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });

    await row.click();

    // The details panel's back arrow and tabs are click-only divs (A11Y-003 family), so they are found by text.
    const details = alice.page.locator('.cometchat-call-log-details');
    await expect(details.getByText(t('sample_call_details'), { exact: true })).toBeVisible();
    await expect(details.getByText(bob.user.name, { exact: true }).first()).toBeVisible();
    for (const tab of ['sample_participants', 'sample_recording', 'sample_history']) {
      await expect(details.getByText(t(tab), { exact: true })).toBeVisible();
    }
    await details.getByText(t('sample_history'), { exact: true }).click();
    await expect(details.getByText(/cancel|outgoing/i).first()).toBeVisible();
  });

  test('CALL-14 calling back from the call details rings the other user', async ({ alice, bob }) => {
    const first = await ring(alice, bob, 'voice');
    await first.mine.endOutgoing.click();
    await expect(first.theirs.incoming).toBeHidden({ timeout: 30_000 });
    await bob.app.home.openTab('calls');
    await bob.app.home.callsPane.getByRole('button', { name: new RegExp(alice.user.name) }).first().click();
    const details = bob.page.locator('.cometchat-call-log-details');

    await callButton(details, 'voice').click();

    const bobs = new CallScreens(bob.page);
    const alices = new CallScreens(alice.page);
    await expect(bobs.outgoing).toContainText(alice.user.name);
    await expect(alices.incomingFrom(bob.user.name)).toBeVisible({ timeout: 30_000 });
    await bobs.endOutgoing.click();
    await expect(alices.incoming).toBeHidden({ timeout: 30_000 });
  });
});

test.describe('Calls — group', { tag: ['@calls', '@regression'] }, () => {
  test.describe.configure({ timeout: 150_000 });

  test('CALL-11 a group call posts a meeting a member can join', async ({ alice, bob, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    await alice.app.openGroup(group.name);
    await bob.app.openGroup(group.name);

    await callButton(alice.app.header.banner, 'voice').click();

    const mine = new CallScreens(alice.page);
    await expect(mine.ongoing).toBeVisible({ timeout: 30_000 });
    const join = bob.app.messages.log.getByRole('button', { name: t('meeting_join') }).last();
    await expect(join).toBeVisible({ timeout: 30_000 });
    await join.click();
    const theirs = new CallScreens(bob.page);
    await expect(theirs.ongoing).toBeVisible({ timeout: 30_000 });
    await expect(theirs.ongoing.getByRole('heading', { name: /\(2\)$/ })).toBeVisible({ timeout: 45_000 });
  });
});
