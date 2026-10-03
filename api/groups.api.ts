import { OWNED_PREFIX } from '@config/run';
import { RestClient, assertOwned } from './rest-client';

export type GroupType = 'public' | 'private' | 'password';

export interface GroupMembers {
  admins?: string[];
  moderators?: string[];
  participants?: string[];
}

export interface ApiGroup {
  guid: string;
  name: string;
  type: GroupType;
  owner: string;
  membersCount: number;
  createdAt?: number;
}

export class GroupsApi {
  constructor(private readonly rest: RestClient) {}

  create(group: {
    guid: string;
    name: string;
    type: GroupType;
    owner: string;
    password?: string;
    members?: GroupMembers;
  }): Promise<ApiGroup> {
    assertOwned(group.guid);
    return this.rest.post<ApiGroup>('/groups', { body: group });
  }

  async delete(guid: string): Promise<void> {
    assertOwned(guid);
    await this.rest.delete(`/groups/${encodeURIComponent(guid)}`);
  }

  /**
   * Deletes a group created through the UI (its guid is app-generated, e.g.
   * group_1790…). Allowed only when its owner is a framework user (pw-*).
   */
  async deleteCreatedByFramework(group: ApiGroup): Promise<void> {
    if (!group.guid.startsWith(OWNED_PREFIX) && !group.owner?.startsWith(OWNED_PREFIX)) {
      throw new Error(`Refusing to delete group "${group.guid}": not created by a framework user.`);
    }
    await this.rest.delete(`/groups/${encodeURIComponent(group.guid)}`);
  }

  async addMembers(guid: string, members: GroupMembers): Promise<void> {
    assertOwned(guid);
    await this.rest.post(`/groups/${encodeURIComponent(guid)}/members`, { body: members });
  }

  async search(searchKey: string): Promise<ApiGroup[]> {
    const out: ApiGroup[] = [];
    for (let page = 1; ; page++) {
      const batch = await this.rest.get<ApiGroup[]>(
        `/groups?searchKey=${encodeURIComponent(searchKey)}&perPage=100&page=${page}`
      );
      out.push(...batch);
      if (batch.length < 100) return out;
    }
  }
}
