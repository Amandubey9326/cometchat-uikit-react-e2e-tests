import { OWNED_PREFIX } from '@config/run';
import { GroupsApi } from './groups.api';
import { MessagesApi } from './messages.api';
import { RestClient } from './rest-client';
import { UsersApi } from './users.api';

export class CometChatApi {
  readonly users: UsersApi;
  readonly groups: GroupsApi;
  readonly messages: MessagesApi;

  constructor(rest = new RestClient()) {
    this.users = new UsersApi(rest);
    this.groups = new GroupsApi(rest);
    this.messages = new MessagesApi(rest);
  }

  /**
   * Deletes framework-owned groups and users whose id starts with `prefix`
   * (always within `pw-`), optionally only those created before `createdBefore`
   * (unix seconds). Groups go first so no owner is removed from under a group.
   */
  async deleteOwned(prefix: string, createdBefore?: number): Promise<{ users: number; groups: number }> {
    if (!prefix.startsWith(OWNED_PREFIX)) throw new Error(`Prefix must start with "${OWNED_PREFIX}"`);
    const stale = (createdAt?: number) => createdBefore === undefined || (createdAt ?? 0) < createdBefore;

    // Groups created through the UI carry the prefix in their name and a pw-* owner.
    const groups = (await this.groups.search(prefix)).filter(
      g => (g.guid.startsWith(prefix) || (g.name.startsWith(prefix) && g.owner?.startsWith(OWNED_PREFIX))) && stale(g.createdAt)
    );
    for (const g of groups) await this.groups.deleteCreatedByFramework(g);

    const users = (await this.users.search(prefix)).filter(u => u.uid.startsWith(prefix) && stale(u.createdAt));
    for (const u of users) await this.users.delete(u.uid);

    return { users: users.length, groups: groups.length };
  }
}
