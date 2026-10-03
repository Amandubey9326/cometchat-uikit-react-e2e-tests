import { CometChatApi } from '../api/cometchat-api';
import { env } from '../config/env';
import { OWNED_PREFIX, RUN_ID, RUN_REUSED } from '../config/run';

const DAY_SECONDS = 24 * 60 * 60;

/** Validates the environment and sweeps framework data left behind by crashed runs (> 24 h old). */
export default async function globalSetup(): Promise<void> {
  console.log(
    `\n[setup] run ${RUN_ID}${RUN_REUSED ? ' (reused)' : ''} · ${env.cometchatEnv} app ${env.appId} (${env.region}) · ${env.baseURL}`
  );
  const api = new CometChatApi();
  const cutoff = Math.floor(Date.now() / 1000) - DAY_SECONDS;
  const swept = await api.deleteOwned(OWNED_PREFIX, cutoff);
  if (swept.users || swept.groups) {
    console.log(`[setup] swept stale test data: ${swept.users} users, ${swept.groups} groups`);
  }
}
