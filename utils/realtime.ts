import type { Page, WebSocket } from '@playwright/test';

/** CometChat's realtime socket, e.g. wss://<appId>.websocket-us.cc-cluster-2.io (not Vite's HMR socket). */
export const REALTIME_SOCKET = /\.websocket-[a-z0-9]+\./;

export class RealtimeNotConnectedError extends Error {}

/**
 * Holds CometChat's realtime socket until `release()` is called, so a test can
 * decide exactly when the connection completes. Must be installed before the
 * page (re)loads.
 */
export async function holdRealtimeSocket(page: Page): Promise<{ release: () => void }> {
  let release!: () => void;
  const gate = new Promise<void>(resolve => (release = resolve));
  await page.routeWebSocket(REALTIME_SOCKET, async ws => {
    await gate;
    ws.connectToServer();
  });
  return { release };
}

/**
 * Runs `action` (navigation, reload, login…) and resolves once CometChat's
 * realtime socket is open and has received its first frame.
 *
 * Opening a conversation while this connection is still being established
 * can leave the message list blank (BUG-002). Tests that are not about that
 * race synchronise on it here; tests/messaging/history-load.spec.ts covers the
 * race itself.
 */
export async function withRealtimeConnected(
  page: Page,
  action: () => Promise<unknown>,
  timeoutMs = 60_000
): Promise<WebSocket> {
  let onSocket!: (ws: WebSocket) => void;
  let timer: NodeJS.Timeout | undefined;
  const seen: string[] = [];
  const started = Date.now();
  const note = (what: string) => seen.push(`+${Date.now() - started}ms ${what}`);
  // The frame listener is attached synchronously inside the 'websocket' event,
  // so the server's auth acknowledgement can't slip past; a socket that closes
  // before any frame (SDK reconnect) is ignored and the next one is awaited.
  const connected = new Promise<WebSocket>((resolve, reject) => {
    onSocket = ws => {
      if (!REALTIME_SOCKET.test(ws.url())) return;
      note('socket created');
      ws.on('framesent', () => note('frame sent'));
      ws.on('close', () => note('socket closed'));
      ws.once('framereceived', () => resolve(ws));
    };
    page.on('websocket', onSocket);
    timer = setTimeout(
      () =>
        reject(
          new RealtimeNotConnectedError(
            `CometChat realtime socket did not connect within ${timeoutMs} ms. Seen: ${seen.join(', ') || 'no realtime socket'}`
          )
        ),
      timeoutMs
    );
  });
  try {
    await action();
    return await connected;
  } finally {
    clearTimeout(timer);
    page.off('websocket', onSocket);
  }
}
