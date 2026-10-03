import { env } from '@config/env';
import type { CometChatApi } from './cometchat-api';

export interface ClientResponse<T = unknown> {
  status: number;
  code?: string;
  data?: T;
}

/**
 * Calls the CometChat *client* API as a framework user — the same endpoints the SDK uses in the
 * browser. Only for API-level checks of server behaviour the UI depends on (tests/api); UI tests
 * never use it. The auth token is created per session and never logged.
 */
export class ClientSession {
  private constructor(
    readonly uid: string,
    private readonly authToken: string
  ) {}

  static async open(api: CometChatApi, uid: string): Promise<ClientSession> {
    return new ClientSession(uid, await api.users.createAuthToken(uid));
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<ClientResponse<T>> {
    const res = await fetch(`${env.clientBase}${path}`, {
      method,
      headers: { appid: env.appId, authtoken: this.authToken, 'content-type': 'application/json', accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: T; error?: { code?: string } };
    return { status: res.status, code: json.error?.code, data: json.data };
  }

  sendText(to: { uid: string } | { guid: string }, text: string) {
    const isGroup = 'guid' in to;
    return this.call<{ id: string }>('POST', '/messages', {
      receiver: isGroup ? to.guid : to.uid,
      receiverType: isGroup ? 'group' : 'user',
      category: 'message',
      type: 'text',
      data: { text },
    });
  }

  react(messageId: string, emoji: string) {
    return this.call('POST', `/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, {});
  }

  deleteMessage(messageId: string) {
    return this.call('DELETE', `/messages/${messageId}`);
  }

  /** Latest messages of the 1:1 chat with `withUid`, as this user sees them (includes `readAt`). */
  messagesWith(withUid: string) {
    return this.call<Array<{ id: string; readAt?: number }>>('GET', `/users/${encodeURIComponent(withUid)}/messages?per_page=30`);
  }

  /** What CometChat.markConversationAsRead sends for a 1:1 chat. */
  markConversationRead(withUid: string) {
    return this.call('POST', `/users/${encodeURIComponent(withUid)}/conversation/read`, {});
  }
}
