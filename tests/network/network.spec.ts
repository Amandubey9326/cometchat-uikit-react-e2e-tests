import { t } from '@i18n/t';
import { uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { delayResponse } from '@utils/network';

/**
 * Network resilience. Offline / online is simulated per browser context (context.setOffline),
 * server errors and latency with page.route. Every test waits on UI state, never on time.
 */
test.describe('Network & resilience', { tag: ['@network', '@regression'] }, () => {
  test('NET-01 messages missed while offline appear once the connection is back', { tag: '@critical' }, async ({ alice, bob, api }) => {
    await alice.app.openChatWith(bob.user);
    await alice.app.sendAndConfirm(uniqueText('before the outage'));
    await api.users.waitForConversation(alice.user.uid, bob.user.uid); // BUG-012
    alice.net.allow(/ERR_INTERNET_DISCONNECTED|net::ERR_|WebSocket|Failed to fetch/i);

    await alice.context.setOffline(true);
    const missed = [uniqueText('while you were away'), uniqueText('and one more')];
    for (const text of missed) await api.messages.sendText(bob.user.uid, { uid: alice.user.uid }, text);
    await alice.context.setOffline(false);

    for (const text of missed) await expect(alice.app.messages.message(text).root).toBeVisible({ timeout: 60_000 });
  });

  test('NET-02 after a short network blip, sending and receiving work again', async ({ alice, bob, api }) => {
    await alice.app.openChatWith(bob.user);
    await bob.app.openChatWith(alice.user);
    await alice.app.sendAndConfirm(uniqueText('first'));
    await api.users.waitForConversation(alice.user.uid, bob.user.uid);
    alice.net.allow(/ERR_INTERNET_DISCONNECTED|net::ERR_|WebSocket|Failed to fetch/i);

    await alice.context.setOffline(true);
    await expect(alice.app.header.banner).toBeVisible(); // the UI stays usable while offline
    await alice.context.setOffline(false);

    const outgoing = uniqueText('after the blip');
    await alice.app.sendAndConfirm(outgoing);
    await expect(bob.app.messages.message(outgoing).root).toBeVisible({ timeout: 30_000 });
    const incoming = uniqueText('reply after the blip');
    await bob.app.sendAndConfirm(incoming);
    await expect(alice.app.messages.message(incoming).root).toBeVisible({ timeout: 60_000 });
  });

  test('NET-03 if a chat\'s history fails to load, an error with Retry is shown and Retry recovers', async ({ alice, data, api }) => {
    const peer = await data.user('peer');
    const text = uniqueText('history');
    await api.messages.sendText(peer.uid, { uid: alice.user.uid }, text);
    await api.users.waitForConversation(alice.user.uid, peer.uid); // BUG-012
    alice.net.allow(/500 GET .*\/messages/, /status of 500/); // the injected failure
    let failing = true;
    await alice.page.route(/\/users\/[^/]+\/messages\?/, route =>
      failing ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"code":"ERR_INTERNAL"}}' }) : route.continue()
    );

    await alice.app.home.openTab('users');
    await alice.app.users.search(peer.name);
    await alice.app.users.item(peer.name).click();
    await expect(alice.app.messages.errorState).toBeVisible();
    failing = false;
    await alice.app.messages.errorState.getByRole('button', { name: t('error_boundary_retry') }).click();

    await expect(alice.app.messages.message(text).root).toBeVisible();
    await expect(alice.app.messages.errorState).toBeHidden();
  });

  test('NET-04 a slow send shows "Sending" and never duplicates the message', async ({ alice, bob }) => {
    await alice.app.openChatWith(bob.user);
    await bob.app.openChatWith(alice.user);
    await delayResponse(alice.page, /\/v3\.0\/messages$/, { method: 'POST', ms: 4_000 });
    const text = uniqueText('slow network');

    await alice.app.composer.sendWithEnter(text);

    await expect(alice.app.messages.message(text).receipt('sending')).toBeVisible();
    await alice.app.messages.message(text).waitUntilSent();
    await expect(bob.app.messages.message(text).root).toHaveCount(1);
    await expect(alice.app.messages.message(text).root).toHaveCount(1);
  });

  test('MSG-23 a message sent while offline is shown as failed, not lost silently', async ({ alice, data }) => {
    await alice.app.openChatWith(await data.user('peer'));
    // OBS-016: the offline send also raises an unhandled promise rejection (a plain object) — logged, not asserted.
    alice.net.allow(/ERR_INTERNET_DISCONNECTED|net::ERR_|WebSocket|Failed to fetch/i, /^: Object$/);
    await alice.context.setOffline(true);
    const text = uniqueText('offline attempt');

    await alice.app.composer.sendWithEnter(text);

    await expect(alice.app.messages.message(text).root).toBeVisible();
    await expect(alice.app.messages.message(text).receipt('error')).toBeVisible({ timeout: 30_000 });
    await alice.context.setOffline(false);
  });
});
