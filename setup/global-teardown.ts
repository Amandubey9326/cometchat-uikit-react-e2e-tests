import { CometChatApi } from '../api/cometchat-api';
import { KEEP_TEST_DATA, RUN_ID, RUN_PREFIX } from '../config/run';

/** Safety net: deletes anything this run created that a test did not clean up (users, groups). */
export default async function globalTeardown(): Promise<void> {
  if (KEEP_TEST_DATA) {
    console.log(`[teardown] keeping test data of run ${RUN_ID} (reuse with PW_RUN_ID=${RUN_ID})`);
    return;
  }
  const removed = await new CometChatApi().deleteOwned(RUN_PREFIX);
  console.log(`[teardown] run ${RUN_ID}: deleted ${removed.users} users, ${removed.groups} groups`);
}
