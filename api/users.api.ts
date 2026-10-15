import { ApiError, RestClient, assertOwned } from './rest-client';

export interface ApiUser {
  uid: string;
  name: string;
  status?: 'online' | 'offline';
  createdAt?: number;
}

export class UsersApi {
  constructor(private readonly rest: RestClient) {}

  create(user: { uid: string; name: string; avatar?: string }): Promise<ApiUser> {
    assertOwned(user.uid);
    return this.rest.post<ApiUser>('/users', { body: user });
  }

  async get(uid: string): Promise<ApiUser | null> {
    try {
      return await this.rest.get<ApiUser>(`/users/${encodeURIComponent(uid)}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  }

  /** Creates the user unless it already exists (idempotent). */
  async ensure(user: { uid: string; name: string }): Promise<ApiUser> {
    return (await this.get(user.uid)) ?? this.create(user);
  }

  async delete(uid: string): Promise<void> {
    assertOwned(uid);
    await this.rest.delete(`/users/${encodeURIComponent(uid)}`, { body: { permanent: true } });
  }

  /** Creates a login session (auth token) for a framework-owned user. Never log the token. */
  async createAuthToken(uid: string): Promise<string> {
    assertOwned(uid);
    const res = await this.rest.post<{ authToken: string }>(`/users/${encodeURIComponent(uid)}/auth_tokens`, { body: {} });
    return res.authToken;
  }

  /** `uid` blocks `blockedUid` (REST, so a test can start from a blocked state). */
  async block(uid: string, blockedUid: string): Promise<void> {
    assertOwned(uid);
    await this.rest.post(`/users/${encodeURIComponent(uid)}/blockedusers`, { body: { blockedUids: [blockedUid] } });
  }

  /** Revokes one login session (auth token) of a framework-owned user. */
  async revokeAuthToken(uid: string, authToken: string): Promise<void> {
    assertOwned(uid);
    await this.rest.delete(`/users/${encodeURIComponent(uid)}/auth_tokens/${encodeURIComponent(authToken)}`);
  }

  /** The user's conversations as the server returns them (read-only; used to wait for server state). */
  conversations(uid: string): Promise<Array<{ conversationId: string; conversationWith?: { uid?: string; guid?: string } }>> {
    return this.rest.get(`/users/${encodeURIComponent(uid)}/conversations?perPage=100`);
  }

  /**
   * Waits until the server lists `uid`'s conversation with `withId` (a uid or guid).
   * A new conversation is not usable for ~1–4 s after its first message (BUG-012): reactions,
   * mark-as-read and the conversation list all miss it. Tests that are not about that window
   * call this before reacting or reloading. Polls every 250 ms (server state; no UI to wait on).
   */
  async waitForConversation(uid: string, withId: string, timeoutMs = 45_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const list = await this.conversations(uid);
      if (list.some(c => c.conversationWith?.uid === withId || c.conversationWith?.guid === withId)) return;
      if (Date.now() > deadline) {
        throw new Error(`Conversation ${uid} ↔ ${withId} not on the server after ${timeoutMs} ms`);
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  /** All users whose uid or name matches `searchKey` (follows pagination). */
  async search(searchKey: string): Promise<ApiUser[]> {
    const out: ApiUser[] = [];
    for (let page = 1; ; page++) {
      const batch = await this.rest.get<ApiUser[]>(
        `/users?searchKey=${encodeURIComponent(searchKey)}&perPage=100&page=${page}`
      );
      out.push(...batch);
      if (batch.length < 100) return out;
    }
  }
}
