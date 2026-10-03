/**
 * One id per `playwright test` invocation, shared by the runner and every
 * worker (workers inherit the runner's environment).
 *
 * Pass PW_RUN_ID=<id> to reuse the personas of an earlier run; their data is
 * then kept at teardown so the next run can reuse it again.
 */
if (process.env.PW_RUN_REUSED === undefined) {
  process.env.PW_RUN_REUSED = process.env.PW_RUN_ID ? '1' : '0';
}
if (!process.env.PW_RUN_ID) {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 5);
  process.env.PW_RUN_ID = `${stamp}${rand}`;
}

export const RUN_ID: string = process.env.PW_RUN_ID;
export const RUN_REUSED = process.env.PW_RUN_REUSED === '1';
export const KEEP_TEST_DATA = process.env.KEEP_TEST_DATA === '1' || RUN_REUSED;

/** Every id the framework creates starts with this; nothing else is ever deleted. */
export const OWNED_PREFIX = 'pw-';
export const RUN_PREFIX = `${OWNED_PREFIX}${RUN_ID}-`;
