import { shortId } from '@data/unique';
import { expect, test, type ChatUser } from '@fixtures/test.fixture';
import { t } from '@i18n/t';
import { CallScreens, callButton } from '@pages/calls/CallScreens';
import { delayResponse } from '@utils/network';

/**
 * Calls — cases from the "Calls" tab of CometChat_Features_All_Test_Cases.xlsx (CALLS_xxx) that the
 * core suite did not cover yet. Tests that place calls are tagged @calls (fake camera + mic project).
 * Blocked-user calls (CALLS_074) are covered by USERS-032 / USERS-033.
 */
const CALL_LOGS = /\/v3(\.0)?\/calls(\?|$)/;
const deniedMedia = () => {
  navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
};

async function ring(caller: ChatUser, callee: ChatUser, type: 'voice' | 'video' = 'voice') {
  await caller.app.openChatWith(callee.user);
  await callButton(caller.app.header.banner, type).click();
  const mine = new CallScreens(caller.page);
  const theirs = new CallScreens(callee.page);
  await expect(mine.outgoing).toBeVisible();
  await expect(theirs.incomingFrom(caller.user.name)).toBeVisible({ timeout: 30_000 });
  return { mine, theirs };
}

async function cancelledCall(caller: ChatUser, callee: ChatUser, type: 'voice' | 'video' = 'voice') {
  const { mine, theirs } = await ring(caller, callee, type);
  await mine.endOutgoing.click();
  await expect(theirs.incoming).toBeHidden({ timeout: 30_000 });
}

async function connectedCallThenEnd(caller: ChatUser, callee: ChatUser) {
  const { mine, theirs } = await ring(caller, callee);
  await theirs.accept.click();
  await expect(mine.ongoing.getByRole('heading', { name: /\(2\)$/ })).toBeVisible({ timeout: 45_000 });
  for (const u of [caller, callee]) u.net.allow(/Container dimensions and number of tiles must be positive/); // OBS-015
  await mine.ongoing.getByRole('button', { name: /^leave session$/i }).click();
  await expect(theirs.ongoing).toBeHidden({ timeout: 30_000 });
}

const logRow = (u: ChatUser, name: string) => u.app.home.callsPane.getByRole('button', { name: new RegExp(name) }).first();
const details = (u: ChatUser) => u.page.locator('.cometchat-call-log-details');

test.describe('Call logs and details (sheet cases)', { tag: ['@calls', '@regression'] }, () => {
  test.describe.configure({ timeout: 150_000 });

  test('CALLS-003/004/005/007 an outgoing call row shows avatar, date and time, an outgoing arrow and a call button', async ({ alice, bob }) => {
    await cancelledCall(alice, bob);

    await alice.app.home.openTab('calls');
    const row = logRow(alice, bob.user.name);

    await expect(row.getByRole('img', { name: bob.user.name })).toBeVisible();
    await expect(row.locator('.cometchat-call-logs__list-item-subtitle-icon-outgoing-call')).toBeVisible();
    await expect(row.locator('.cometchat-call-logs__list-item-subtitle-text')).toHaveText(/\d{1,2} \w{3}, \d{1,2}:\d{2}\s?(AM|PM)/i);
    await expect(row.getByRole('button', { name: t('accessibility_voice_call') })).toBeVisible();
  });

  test('CALLS-006/016 the callee sees a missed call with a red indicator and a "Missed Call" detail', async ({ alice, bob }) => {
    await cancelledCall(alice, bob);

    await bob.app.home.openTab('calls');
    const row = logRow(bob, alice.user.name);
    await expect(row.locator('.cometchat-call-logs__list-item-subtitle-icon-missed-call')).toBeVisible();
    await row.click();

    await expect(details(bob)).toContainText(t('sample_missed_call'));
  });

  test('CALLS-008/013 two calls are two rows, newest first', async ({ alice, bob }) => {
    await cancelledCall(alice, bob, 'voice');
    await cancelledCall(alice, bob, 'video');

    await alice.app.home.openTab('calls');
    const rows = alice.app.home.callsPane.getByRole('button', { name: new RegExp(bob.user.name) });

    await expect(rows).toHaveCount(2);
    await expect(rows.first().getByRole('button', { name: t('accessibility_video_call') })).toBeVisible(); // the newest
  });

  test('CALLS-009 the selected call log is highlighted', async ({ alice, bob }) => {
    await cancelledCall(alice, bob);
    await alice.app.home.openTab('calls');

    await logRow(alice, bob.user.name).click();

    await expect(logRow(alice, bob.user.name)).toHaveClass(/active|selected/);
  });

  test('CALLS-011 a very long caller name is cut with an ellipsis', async ({ alice, data, loginAs }) => {
    const peer = await data.user('long', { name: `Maximilian Alexander Bartholomew Montgomery ${shortId()}` });
    const callee = await loginAs(peer);
    await cancelledCall(alice, callee);

    await alice.app.home.openTab('calls');
    const row = logRow(alice, 'Maximilian');

    const truncated = await row.evaluate(el =>
      Array.from(el.querySelectorAll<HTMLElement>('*')).some(n => n.scrollWidth > n.clientWidth && getComputedStyle(n).textOverflow === 'ellipsis')
    );
    expect(truncated).toBe(true);
  });

  test('CALLS-012 the call logs list scrolls and keeps rows intact', async ({ alice, bob }) => {
    await alice.page.setViewportSize({ width: 1440, height: 420 });
    for (let i = 0; i < 4; i++) await cancelledCall(alice, bob);

    await alice.app.home.openTab('calls');
    const rows = alice.app.home.callsPane.getByRole('button', { name: new RegExp(bob.user.name) });
    await expect(rows).toHaveCount(4);
    await rows.last().scrollIntoViewIfNeeded();

    await expect(rows.last()).toBeInViewport();
    await expect(rows.last().locator('.cometchat-call-logs__list-item-subtitle-text')).not.toBeEmpty();
  });

  test('CALLS-017/024/025/026/027/028/029 an answered call\'s details show duration and both participants', async ({ alice, bob }) => {
    await connectedCallThenEnd(alice, bob);
    await alice.app.home.openTab('calls');
    await logRow(alice, bob.user.name).click();

    await expect(details(alice)).toContainText(/\d+\s?s|\d{1,2}:\d{2}/); // duration
    await details(alice).getByText(t('sample_participants'), { exact: true }).click();
    const people = details(alice).locator('.cometchat-call-log-participants__item');
    await expect(people).toHaveCount(2);
    const bobRow = people.filter({ hasText: bob.user.name });
    await expect(bobRow.locator('.cometchat-call-log-participants__avatar, .cometchat-call-log-participants__avatar-initials').first()).toBeVisible();
    await expect(bobRow).toContainText(/\d{1,2}:\d{2}/); // join time
    await expect(bobRow.locator('.cometchat-call-log-participants__duration')).not.toBeEmpty();
  });

  test('CALLS-030/032/034 a missed call\'s details: one participant, no recordings, only this call in history', async ({ alice, bob }) => {
    await cancelledCall(alice, bob);
    await bob.app.home.openTab('calls');
    await logRow(bob, alice.user.name).click();
    const panel = details(bob);

    await panel.getByText(t('sample_participants'), { exact: true }).click();
    await expect(panel.locator('.cometchat-call-log-participants__item').or(panel.getByText(t('sample_no_participants_data')))).toHaveCount(1);
    await panel.getByText(t('sample_recording'), { exact: true }).click();
    await expect(panel).toContainText(t('sample_no_recording_available'));
    await panel.getByText(t('sample_history'), { exact: true }).click();
    await expect(panel.locator('.cometchat-call-log-history__item, [class*="call-log-history__list-item"]')).toHaveCount(1);
  });

  test('CALLS-019/036 the details video button starts a video call', async ({ alice, bob }) => {
    await cancelledCall(alice, bob);
    await alice.app.home.openTab('calls');
    await logRow(alice, bob.user.name).click();

    await callButton(details(alice), 'video').click();

    const calls = new CallScreens(alice.page);
    await expect(calls.outgoing).toContainText(bob.user.name);
    await expect(new CallScreens(bob.page).incomingFrom(alice.user.name)).toHaveAccessibleName(/video/i, { timeout: 30_000 });
    await calls.endOutgoing.click();
  });

  test('CALLS-038 call logs fit a phone-sized window', async ({ alice, bob }) => {
    await cancelledCall(alice, bob);
    await alice.page.setViewportSize({ width: 412, height: 915 });

    await alice.app.home.openTab('calls');

    const row = logRow(alice, bob.user.name);
    await expect(row).toBeVisible();
    const box = (await row.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(412);
    expect(await alice.page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(412);
  });

  test('CALLS-060 a declined call shows in the caller\'s call logs', async ({ alice, bob }) => {
    const { mine, theirs } = await ring(alice, bob, 'voice');

    await theirs.decline.click();
    await expect(mine.outgoing).toBeHidden({ timeout: 30_000 });

    await alice.app.home.openTab('calls');
    await expect(logRow(alice, bob.user.name)).toBeVisible({ timeout: 30_000 });
  });

  test('CALLS-065 the camera can be turned off and on in a video call', async ({ alice, bob }) => {
    const { mine, theirs } = await ring(alice, bob, 'video');
    await theirs.accept.click();
    await expect(mine.ongoing.getByRole('heading', { name: /\(2\)$/ })).toBeVisible({ timeout: 45_000 });
    const off = mine.ongoing.getByRole('button', { name: /turn off camera|stop video|disable camera|camera off/i }).first();
    const on = mine.ongoing.getByRole('button', { name: /turn on camera|start video|enable camera|camera on/i }).first();

    await off.click();
    await expect(on).toBeVisible();
    await on.click();

    await expect(off).toBeVisible();
  });

  test('CALLS-070 calling a user who is offline ends as unanswered without errors', async ({ alice, data }) => {
    const peer = await data.user('offline');
    await alice.app.openChatWith(peer);
    await callButton(alice.app.header.banner, 'voice').click();
    const calls = new CallScreens(alice.page);
    await expect(calls.outgoing).toBeVisible();

    await expect(calls.outgoing).toBeHidden({ timeout: 90_000 });
    await alice.app.reload();
    await alice.app.openChatWith(peer);
    await expect(alice.app.messages.log.getByText(t('call_action_unanswered'))).toBeVisible();
  });

  test('CALLS-071 starting a call without network shows an error and no call starts', { tag: '@network' }, async ({ alice, bob }) => {
    await alice.app.openChatWith(bob.user);
    alice.net.allow(/.*/);

    await alice.context.setOffline(true);
    await callButton(alice.app.header.banner, 'voice').click();

    await expect(new CallScreens(bob.page).incoming).toHaveCount(0);
    await expect(new CallScreens(alice.page).ongoing).toHaveCount(0);
    await alice.context.setOffline(false);
  });

  test('CALLS-073 a denied microphone shows a message instead of a silent call', async ({ alice, bob }) => {
    await alice.page.addInitScript(deniedMedia);
    await alice.app.reload();
    alice.net.allow(/NotAllowedError|Permission denied/);
    await alice.app.openChatWith(bob.user);

    await callButton(alice.app.header.banner, 'voice').click();

    await expect(alice.page.getByRole('alert').or(alice.page.getByText(/permission|microphone|not allowed/i)).first()).toBeVisible({ timeout: 30_000 });
  });
});

test.describe('Group calls (sheet cases)', { tag: ['@calls', '@regression'] }, () => {
  test.describe.configure({ timeout: 150_000 });

  test('CALLS-051/069 a group video call posts a call message with type, time and Join', async ({ alice, bob, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    await alice.app.openGroup(group.name);
    await bob.app.openGroup(group.name);

    await callButton(alice.app.header.banner, 'video').click();

    const meeting = bob.app.messages.messages.filter({ has: bob.page.getByRole('button', { name: t('meeting_join') }) }).last();
    await expect(meeting).toBeVisible({ timeout: 30_000 });
    await expect(meeting).toContainText(/video/i);
    await expect(meeting).toContainText(/\d{1,2}:\d{2}/);
  });

  test('CALLS-049/050 after a group call ends, Join is gone and the details list who took part', async ({ alice, bob, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    await alice.app.openGroup(group.name);
    await bob.app.openGroup(group.name);
    await callButton(alice.app.header.banner, 'voice').click();
    const aliceCall = new CallScreens(alice.page);
    await expect(aliceCall.ongoing).toBeVisible({ timeout: 30_000 });
    const join = bob.app.messages.log.getByRole('button', { name: t('meeting_join') }).last();
    await join.click();
    const bobCall = new CallScreens(bob.page);
    await expect(bobCall.ongoing.getByRole('heading', { name: /\(2\)$/ })).toBeVisible({ timeout: 45_000 });
    for (const u of [alice, bob]) u.net.allow(/Container dimensions and number of tiles must be positive/);

    await bobCall.ongoing.getByRole('button', { name: /^leave session$/i }).click();
    await aliceCall.ongoing.getByRole('button', { name: /^leave session$/i }).click();
    await bob.app.reload(); // BUG-018: call bubbles do not update live
    await bob.app.openGroup(group.name);

    await expect(bob.app.messages.log.getByRole('button', { name: t('meeting_join') }).and(bob.page.locator(':enabled'))).toHaveCount(0);
    await alice.app.home.openTab('calls');
    await logRow(alice, group.name).click();
    await details(alice).getByText(t('sample_participants'), { exact: true }).click();
    await expect(details(alice).locator('.cometchat-call-log-participants__item').filter({ hasText: bob.user.name })).toBeVisible();
  });

  test('CALLS-052 joining a group call without camera / mic permission shows a message', async ({ alice, bob, data }) => {
    const group = await data.group({ owner: alice.user, participants: [bob.user] });
    await bob.page.addInitScript(deniedMedia);
    await bob.app.reload();
    bob.net.allow(/NotAllowedError|Permission denied/);
    await alice.app.openGroup(group.name);
    await bob.app.openGroup(group.name);
    await callButton(alice.app.header.banner, 'voice').click();

    await bob.app.messages.log.getByRole('button', { name: t('meeting_join') }).last().click({ timeout: 30_000 });

    await expect(bob.page.getByRole('alert').or(bob.page.getByText(/permission|microphone|camera|not allowed/i)).first()).toBeVisible({ timeout: 30_000 });
  });
});

test.describe('Call logs states (sheet cases)', { tag: ['@regression'] }, () => {
  test('CALLS-010 a user with no calls sees "No Call Logs Yet"', async ({ data, loginAs }) => {
    const { app } = await loginAs(await data.user('quiet'));

    await app.home.openTab('calls');

    // Hard-coded English in UIKit (CometChatCallLogs.tsx) — L10N finding.
    await expect(app.home.callsPane).toContainText('No Call Logs Yet');
  });

  test('CALLS-041 a loading state shows while call logs are slow', { tag: '@network' }, async ({ alice }) => {
    await delayResponse(alice.page, CALL_LOGS, { ms: 4_000 });

    await alice.app.home.openTab('calls');

    await expect(alice.app.home.callsPane.locator('[class*="call-logs__shimmer"]').first()).toBeVisible({ timeout: 3_000 });
  });

  test(
    'CALLS-042 if call logs fail to load, an error with a retry option is shown',
    { tag: '@network', annotation: { type: 'bug', description: 'BUG-022 — the call-log error state has no Retry' } },
    async ({ alice }) => {
      test.fail(true, 'BUG-022');
      alice.net.allow(/.*/);
      await alice.page.route(CALL_LOGS, route => (route.request().method() === 'GET' ? route.fulfill({ status: 500, body: '{}' }) : route.continue()));

      await alice.app.home.openTab('calls');

      await expect(alice.app.home.callsPane).toContainText(t('call_logs_error_subtitle'));
      await expect(alice.app.home.callsPane.getByRole('button', { name: /retry/i })).toBeVisible({ timeout: 3_000 });
    }
  );
});
