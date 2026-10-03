import { ClientSession } from '@api/client-session';
import { uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';

/**
 * BUG-012 at the API level, where it is deterministic. In the UI the same 403s show up as a
 * reaction or delete that silently disappears, a chat that never becomes "Read", or a new chat
 * missing from the Chats list — but only when the user acts within the first 1–4 s, so UI tests
 * cannot pin it down reliably.
 */
test.describe('New 1:1 conversation — server consistency', { tag: ['@api', '@regression'] }, () => {
  const bug = { type: 'bug', description: 'BUG-012 — the first seconds of a new 1:1 chat reject follow-up actions with 403' };

  test('API-01 a reaction on the first message of a new chat is accepted at once', { annotation: bug }, async ({ api, data }) => {
    test.fail(true, 'BUG-012');
    const [me, peer] = [await data.user('first'), await data.user('peer')];
    const session = await ClientSession.open(api, me.uid);
    const sent = await session.sendText({ uid: peer.uid }, uniqueText('first ever'));
    expect(sent.status).toBe(200);

    const reaction = await session.react(sent.data!.id, '😂');

    expect(reaction, 'server answer').toMatchObject({ status: 200 });
  });

  test('API-02 the new chat can be marked as read at once', { annotation: bug }, async ({ api, data }) => {
    test.fail(true, 'BUG-012');
    const [me, peer] = [await data.user('first'), await data.user('peer')];
    const sender = await ClientSession.open(api, peer.uid);
    const reader = await ClientSession.open(api, me.uid);
    expect((await sender.sendText({ uid: me.uid }, uniqueText('hello there'))).status).toBe(200);

    const read = await reader.markConversationRead(peer.uid);

    expect(read, 'server answer').toMatchObject({ status: 200 });
  });

  test('API-03 the first message can be deleted at once', { annotation: bug }, async ({ api, data }) => {
    test.fail(true, 'BUG-012');
    const [me, peer] = [await data.user('first'), await data.user('peer')];
    const session = await ClientSession.open(api, me.uid);
    const sent = await session.sendText({ uid: peer.uid }, uniqueText('oops'));

    const deleted = await session.deleteMessage(sent.data!.id);

    expect(deleted, 'server answer').toMatchObject({ status: 200 });
  });

  test('API-04 once the conversation exists, the same actions succeed (control)', async ({ api, data }) => {
    const [me, peer] = [await data.user('first'), await data.user('peer')];
    const session = await ClientSession.open(api, me.uid);
    const sent = await session.sendText({ uid: peer.uid }, uniqueText('settled'));
    await api.users.waitForConversation(me.uid, peer.uid);

    expect(await session.react(sent.data!.id, '😂')).toMatchObject({ status: 200 });
    expect(await session.markConversationRead(peer.uid)).toMatchObject({ status: 200 });
    expect(await session.deleteMessage(sent.data!.id)).toMatchObject({ status: 200 });
  });
});
