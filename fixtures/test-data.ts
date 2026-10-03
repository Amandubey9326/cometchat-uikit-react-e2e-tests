import type { CometChatApi } from '@api/cometchat-api';
import type { GroupType } from '@api/groups.api';
import { KEEP_TEST_DATA, RUN_PREFIX } from '@config/run';
import type { TestUser } from '@data/personas';
import { ownedId } from '@data/unique';

export interface TestGroup {
  guid: string;
  name: string;
  type: GroupType;
  password?: string;
}

export interface GroupSpec {
  owner: TestUser;
  type?: GroupType;
  name?: string;
  password?: string;
  admins?: TestUser[];
  moderators?: TestUser[];
  participants?: TestUser[];
}

const displayName = (label: string, id: string) =>
  `${label.charAt(0).toUpperCase()}${label.slice(1)} ${id.slice(RUN_PREFIX.length + 2)}`;

/** Per-test users and groups, created through REST and deleted after the test. */
export class TestData {
  private readonly users: string[] = [];
  private readonly groups: string[] = [];
  private readonly uiGroupNames: string[] = [];

  constructor(private readonly api: CometChatApi) {}

  async user(label = 'user'): Promise<TestUser> {
    const uid = ownedId('u', label);
    const user = { uid, name: displayName(label, uid) };
    await this.api.users.create(user);
    this.users.push(uid);
    return user;
  }

  async group(spec: GroupSpec): Promise<TestGroup> {
    const type = spec.type ?? 'public';
    const guid = ownedId('g', spec.name ?? type);
    const group: TestGroup = {
      guid,
      name: spec.name ?? displayName(`${type} group`, guid),
      type,
      password: type === 'password' ? (spec.password ?? 'pw-secret-1') : undefined,
    };
    const uids = (list?: TestUser[]) => list?.map(u => u.uid);
    await this.api.groups.create({
      guid,
      name: group.name,
      type,
      password: group.password,
      owner: spec.owner.uid,
      members: {
        admins: uids(spec.admins),
        moderators: uids(spec.moderators),
        participants: uids(spec.participants),
      },
    });
    this.groups.push(guid);
    return group;
  }

  /**
   * Registers a group the test creates through the UI (the app generates its guid). It is found
   * by name and deleted at cleanup while its pw- owner still exists — once the owner is deleted
   * the server hands the group to `app_system` and the framework may no longer delete it.
   */
  uiGroup(name: string): string {
    this.uiGroupNames.push(name);
    return name;
  }

  /**
   * Deletes this test's groups, then its users. Every user a test talks to is
   * created by the test itself, so no surviving user is left holding a
   * conversation with a deleted one (that would crash their app — BUG-008).
   * Deleting per test also keeps the app under its plan's 100-user quota.
   */
  async cleanup(): Promise<void> {
    if (KEEP_TEST_DATA) return;
    for (const guid of this.groups.splice(0)) await this.api.groups.delete(guid).catch(() => {});
    for (const name of this.uiGroupNames.splice(0)) {
      const matches = await this.api.groups.search(name).catch(() => []);
      for (const g of matches.filter(m => m.name === name)) await this.api.groups.deleteCreatedByFramework(g).catch(() => {});
    }
    for (const uid of this.users.splice(0)) await this.api.users.delete(uid).catch(() => {});
  }
}
