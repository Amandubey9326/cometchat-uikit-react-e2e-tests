import type { Page, TestInfo } from '@playwright/test';

export interface NetIssue {
  kind: 'pageerror' | 'console' | 'http' | 'requestfailed';
  severity: 'error' | 'warning';
  detail: string;
  /** ms since the watch started — used to pair a rejection with the request a reload cancelled. */
  at: number;
}

/** Requests cut off by a reload, a navigation or a media preload. */
const CANCELLED = /net::ERR_ABORTED|NS_BINDING_ABORTED|Load request cancelled|cancelled$/;

/** Noise that is expected in every run. Keep this list short and explained. */
const ALWAYS_ALLOWED: RegExp[] = [
  /JitsiMeetJS\.ts.*Analytics disabled/, // Calls SDK init warning
  CANCELLED, // requests cut off by reload / navigation / media preload
  /favicon\.ico/,
];

const redactUrl = (url: string) => url.split('?')[0];

/**
 * When a reload cancels an in-flight SDK request (e.g. POST /user_sessions), WebKit reports the
 * rejected promise as "Unhandled Promise Rejection: [object Object]" or the aborted fetch as
 * "Fetch API cannot load … due to access control checks"; Chromium reports neither (OBS-017).
 * The page is being torn down, so it is noise — but only when it directly follows a cancelled request.
 */
const REJECTION_AFTER_CANCEL =
  /^Unhandled Promise Rejection: \[object Object\]$|^Fetch API cannot load .+ due to access control checks\.$/;
const CANCEL_WINDOW_MS = 2_000;

/**
 * Collects page errors, console errors, HTTP ≥ 400 and failed requests for one
 * page. Everything is attached to the report; uncaught page errors, 5xx and
 * failed requests fail an otherwise-passing test unless allowed (NET_STRICT=0
 * turns that off). 4xx and console errors are reported, not failed — negative
 * tests produce them on purpose.
 */
export class NetWatch {
  readonly issues: NetIssue[] = [];
  private readonly allowList: RegExp[] = [...ALWAYS_ALLOWED];
  private readonly started = Date.now();

  constructor(readonly label: string) {}

  attach(page: Page): void {
    page.on('pageerror', e => this.add('pageerror', 'error', `${e.name}: ${e.message}`));
    page.on('console', m => {
      if (m.type() === 'error') this.add('console', 'warning', m.text().slice(0, 500));
    });
    page.on('response', r => {
      const status = r.status();
      if (status >= 400) {
        this.add('http', status >= 500 ? 'error' : 'warning', `${status} ${r.request().method()} ${redactUrl(r.url())}`);
      }
    });
    page.on('requestfailed', r =>
      this.add('requestfailed', 'error', `${r.method()} ${redactUrl(r.url())} ${r.failure()?.errorText ?? ''}`.trim())
    );
  }

  /** Mark issues matching these patterns as expected for this test. */
  allow(...patterns: RegExp[]): void {
    this.allowList.push(...patterns);
  }

  /** Every recorded issue (any severity) that is not allowed. */
  unexpectedIssues(): NetIssue[] {
    return this.issues.filter(i => !this.isAllowed(i));
  }

  unexpectedErrors(): NetIssue[] {
    return this.issues.filter(i => i.severity === 'error' && !this.isAllowed(i));
  }

  private isAllowed(issue: NetIssue): boolean {
    if (this.allowList.some(p => p.test(issue.detail))) return true;
    return (
      issue.kind === 'pageerror' &&
      REJECTION_AFTER_CANCEL.test(issue.detail) &&
      this.issues.some(
        i => i.kind === 'requestfailed' && CANCELLED.test(i.detail) && i.at <= issue.at && issue.at - i.at <= CANCEL_WINDOW_MS
      )
    );
  }

  async finish(testInfo: TestInfo): Promise<void> {
    if (this.issues.length) {
      await testInfo.attach(`${this.label}-network-console.json`, {
        body: JSON.stringify(this.issues, null, 2),
        contentType: 'application/json',
      });
    }
    const unexpected = this.unexpectedErrors();
    const passed = testInfo.status === testInfo.expectedStatus;
    if (unexpected.length && passed && process.env.NET_STRICT !== '0') {
      throw new Error(
        `[${this.label}] unexpected browser errors:\n` + unexpected.map(i => `  - ${i.kind}: ${i.detail}`).join('\n')
      );
    }
  }

  private add(kind: NetIssue['kind'], severity: NetIssue['severity'], detail: string): void {
    this.issues.push({ kind, severity, detail, at: Date.now() - this.started });
  }
}
