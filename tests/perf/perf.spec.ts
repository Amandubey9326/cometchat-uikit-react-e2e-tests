import { uniqueSentences, uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';
import { ASSETS } from '@pages/messages/MessageComposer';

/**
 * Performance signals — measured and reported (annotation + JSON attachment), never asserted:
 * there are no documented targets, and one shared production app is a noisy place to set any.
 */
const report = async (name: string, samplesMs: number[]) => {
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  test.info().annotations.push({ type: 'perf', description: `${name}: median ${median} ms (n=${sorted.length}, min ${sorted[0]}, max ${sorted.at(-1)})` });
  await test.info().attach(`${name}.json`, { body: JSON.stringify({ name, samplesMs, median }, null, 2), contentType: 'application/json' });
};

test.describe('Performance signals', { tag: ['@perf', '@regression'] }, () => {
  test('PERF-01 login → Home ready', async ({ data, loginAs }) => {
    const started = Date.now();
    const { app } = await loginAs(await data.user('timer'));
    await expect(app.conversations.region).toBeVisible();

    // When BUG-003 hits, the time includes the 15 s realtime wait and the recovery reload.
    const hitBug003 = test.info().annotations.some(a => a.type === 'BUG-003');
    await report(hitBug003 ? 'login-to-home (BUG-003 hit: includes 15 s wait + reload)' : 'login-to-home', [Date.now() - started]);
  });

  test('PERF-02 send → received by the other user (median of 5)', async ({ alice, bob }) => {
    await alice.app.openChatWith(bob.user);
    await bob.app.openChatWith(alice.user);
    const samples: number[] = [];
    for (const text of uniqueSentences(5, 'latency').texts) {
      const started = Date.now();
      await alice.app.composer.sendWithEnter(text);
      await expect(bob.app.messages.message(text).root).toBeVisible();
      samples.push(Date.now() - started);
      await alice.app.messages.message(text).waitUntilSent();
    }

    await report('send-to-receive', samples);
  });

  test('PERF-03 open a chat → first message visible', async ({ alice, data, api }) => {
    const peer = await data.user('history');
    const text = uniqueText('waiting here');
    await api.messages.sendText(peer.uid, { uid: alice.user.uid }, text);
    await api.users.waitForConversation(alice.user.uid, peer.uid);
    await expect(alice.app.conversations.item(peer.name)).toBeVisible();

    const started = Date.now();
    await alice.app.conversations.item(peer.name).click();
    await expect(alice.app.messages.message(text).root).toBeVisible();

    await report('open-chat-first-message', [Date.now() - started]);
  });

  test('PERF-04 image upload → sent', async ({ alice, data }) => {
    await alice.app.openChatWith(await data.user('peer'));

    const started = Date.now();
    await alice.app.composer.attach('image', ASSETS.image);
    await alice.app.messages.bubbleOfType('image').waitUntilSent();
    const elapsed = Date.now() - started;

    await expect(alice.app.messages.ofType('image')).toHaveCount(1);
    await report('image-upload', [elapsed]);
  });
});
