import {
  test as base,
  type Browser,
  type BrowserContextOptions,
  type PlaywrightWorkerOptions,
  type TestInfo,
} from '@playwright/test';
import { CometChatApi } from '@api/cometchat-api';
import type { PersonaKey, TestUser } from '@data/personas';
import { signIn } from '@flows/sign-in';
import { openChatUser, type ChatUser, type OpenedChatUser } from './chat-user';
import { NetWatch } from './net-watch';
import { TestData } from './test-data';

type TestFixtures = {
  /** Context options of the current project (device, viewport, locale, colour scheme…). */
  userContextOptions: BrowserContextOptions;
  /** Network / console watch for the default `page`. */
  net: NetWatch;
  /** Per-test users and groups (REST), all deleted when the test ends. */
  data: TestData;
  /** Signs `user` in through the full UI (credentials screen included) in a new context. */
  loginAs: (user: TestUser) => Promise<ChatUser>;
  /**
   * Named users, created fresh for THIS test and signed in, Home open.
   * alice = sender / group owner, bob = receiver, carol = admin, dave = moderator,
   * erin = participant, frank = outsider — each test sets the actual roles.
   */
  alice: ChatUser;
  bob: ChatUser;
  carol: ChatUser;
  dave: ChatUser;
  erin: ChatUser;
  frank: ChatUser;
};

type WorkerFixtures = {
  api: CometChatApi;
};

type LoginDeps = {
  browser: Browser;
  userContextOptions: BrowserContextOptions;
  video: PlaywrightWorkerOptions['video'];
};

async function login(
  { browser, userContextOptions, video }: LoginDeps,
  user: TestUser,
  label: string,
  testInfo: TestInfo,
  seedCredentials: boolean
): Promise<OpenedChatUser> {
  const chatUser = await openChatUser(browser, userContextOptions, user, label, testInfo, video, { seedCredentials });
  const { recoveredFromBug003 } = await signIn(chatUser.page, user.uid);
  if (recoveredFromBug003) {
    testInfo.annotations.push({
      type: 'BUG-003',
      description: `${user.uid}: realtime did not connect after login; recovered by reload`,
    });
  }
  return chatUser;
}

async function withNamedUser(
  key: PersonaKey,
  deps: LoginDeps & { data: TestData },
  use: (u: ChatUser) => Promise<void>,
  testInfo: TestInfo
): Promise<void> {
  const user = await deps.data.user(key);
  const chatUser = await login(deps, user, key, testInfo, true);
  try {
    await use(chatUser);
  } finally {
    await chatUser.dispose(testInfo);
  }
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  api: [async ({}, use) => use(new CometChatApi()), { scope: 'worker' }],

  userContextOptions: async (
    { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, locale, colorScheme, baseURL, permissions, timezoneId },
    use
  ) => {
    await use({
      viewport,
      userAgent,
      deviceScaleFactor,
      isMobile,
      hasTouch,
      locale,
      colorScheme,
      baseURL,
      permissions,
      timezoneId,
    });
  },

  net: async ({}, use) => use(new NetWatch('page')),

  page: async ({ page, net }, use, testInfo) => {
    net.attach(page);
    await use(page);
    await net.finish(testInfo);
  },

  data: async ({ api }, use) => {
    const data = new TestData(api);
    try {
      await use(data);
    } finally {
      await data.cleanup();
    }
  },

  // Depends on `data` so these contexts close before the test's users are deleted.
  loginAs: async ({ browser, userContextOptions, video, data }, use, testInfo) => {
    void data;
    const opened: OpenedChatUser[] = [];
    try {
      await use(async (user: TestUser) => {
        const label = user.name.split(' ')[0].toLowerCase();
        const chatUser = await login({ browser, userContextOptions, video }, user, label, testInfo, false);
        opened.push(chatUser);
        return chatUser;
      });
    } finally {
      for (const u of opened) await u.dispose(testInfo);
    }
  },

  alice: async ({ browser, userContextOptions, video, data }, use, testInfo) =>
    withNamedUser('alice', { browser, userContextOptions, video, data }, use, testInfo),
  bob: async ({ browser, userContextOptions, video, data }, use, testInfo) =>
    withNamedUser('bob', { browser, userContextOptions, video, data }, use, testInfo),
  carol: async ({ browser, userContextOptions, video, data }, use, testInfo) =>
    withNamedUser('carol', { browser, userContextOptions, video, data }, use, testInfo),
  dave: async ({ browser, userContextOptions, video, data }, use, testInfo) =>
    withNamedUser('dave', { browser, userContextOptions, video, data }, use, testInfo),
  erin: async ({ browser, userContextOptions, video, data }, use, testInfo) =>
    withNamedUser('erin', { browser, userContextOptions, video, data }, use, testInfo),
  frank: async ({ browser, userContextOptions, video, data }, use, testInfo) =>
    withNamedUser('frank', { browser, userContextOptions, video, data }, use, testInfo),
});

export { expect } from '@playwright/test';
export type { ChatUser } from './chat-user';
