import { test as cleanup } from '@playwright/test';
import { CometChatApi } from '@api/cometchat-api';
import { OWNED_PREFIX } from '@config/run';

/**
 * `npm run cleanup` — deletes ALL framework-owned data (every `pw-*` user and
 * group, any age). Do not run while another test run is in progress.
 */
cleanup('delete all framework-owned test data', async () => {
  const removed = await new CometChatApi().deleteOwned(OWNED_PREFIX);
  console.log(`[cleanup] deleted ${removed.users} users, ${removed.groups} groups`);
});
