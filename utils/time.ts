/**
 * CometChat stamps messages and conversations with one-second resolution (`sentAt`, `updatedAt`),
 * and items stamped in the same second come back in arbitrary order (BUG-009).
 *
 * Call this after the server has acknowledged a write (the REST call returned, or the bubble lost
 * its "Sending" receipt) to make sure the next write gets a strictly later timestamp. This is a
 * deliberate, documented wait: there is no UI or network event that signals "the server clock
 * has moved on".
 */
export async function nextServerSecond(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 1_050));
}
