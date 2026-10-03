import { RestClient } from './rest-client';

export interface ApiMessage {
  id: string;
  data?: { text?: string; moderation?: { status?: string } };
  conversationId: string;
  sender: string;
  receiver: string;
  receiverType: 'user' | 'group';
  sentAt: number;
}

/** Seeds history (pagination, search, unread counts). Messages under test are sent through the UI. */
export class MessagesApi {
  constructor(private readonly rest: RestClient) {}

  sendText(from: string, to: { uid: string } | { guid: string }, text: string): Promise<ApiMessage> {
    const isGroup = 'guid' in to;
    return this.rest.post<ApiMessage>('/messages', {
      onBehalfOf: from,
      body: {
        receiver: isGroup ? to.guid : to.uid,
        receiverType: isGroup ? 'group' : 'user',
        category: 'message',
        type: 'text',
        data: { text },
      },
    });
  }

  /**
   * Waits until AI moderation (ENV-003, asynchronous on this app) has finished with every message
   * `asUid` received from `fromUid` containing `marker`, and returns the texts the server will show,
   * oldest first. "pending" messages are hidden from history until approved; blocked ones never show.
   */
  async waitForModeration(asUid: string, fromUid: string, marker: string, timeoutMs = 90_000): Promise<string[]> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const list = await this.rest.get<ApiMessage[]>(`/users/${encodeURIComponent(fromUid)}/messages?perPage=100`, { onBehalfOf: asUid });
      const ours = list.filter(m => m.data?.text?.includes(marker));
      if (!ours.some(m => m.data?.moderation?.status === 'pending') || Date.now() > deadline) {
        return ours
          .filter(m => m.data?.moderation?.status !== 'disapproved')
          .sort((a, b) => Number(a.id) - Number(b.id))
          .map(m => m.data!.text!);
      }
      await new Promise(resolve => setTimeout(resolve, 1_000));
    }
  }
}
