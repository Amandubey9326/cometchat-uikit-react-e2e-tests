import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';

/**
 * Live dashboard reporter (`npm run test:live`).
 *
 * Serves dashboard/index.html on http://localhost:9400 and streams every test start / result to it
 * with Server-Sent Events. When the run ends it also writes a static copy with the final state to
 * reports/live/index.html, so the result can be opened later without a server.
 *
 * Env: LIVE_PORT (default 9400) · LIVE_OPEN=0 (do not open the browser) · LIVE_KEEP=1 (keep the
 * server running after the run until Ctrl+C).
 */

const ROOT = path.resolve(__dirname, '..');
const PAGE = path.join(__dirname, 'index.html');
const STATIC_OUT = path.join(ROOT, 'reports', 'live', 'index.html');

/** Folder under tests/ → area shown on the dashboard. */
const AREAS: Record<string, string> = {
  a11y: 'Accessibility', api: 'API', attachments: 'Attachments', auth: 'Authentication', calls: 'Calls',
  composer: 'Composer', conversations: 'Conversations', extensions: 'Extensions', groups: 'Groups',
  home: 'Navigation', localization: 'Localization', mentions: 'Mentions', messaging: 'Messaging',
  moderation: 'Moderation', network: 'Network', perf: 'Performance', reactions: 'Reactions',
  responsive: 'Responsive', search: 'Search', smoke: 'Smoke', theme: 'Theme', threads: 'Threads',
  users: 'Users', visual: 'Visual',
};

type Outcome = 'pending' | 'running' | 'passed' | 'failed' | 'known-bug' | 'fixed?' | 'skipped' | 'flaky';

interface LiveTest {
  key: string;
  scenario: string;
  title: string;
  area: string;
  project: string;
  file: string;
  tags: string[];
  bug?: string;
  outcome: Outcome;
  durationMs?: number;
  startedAt?: number;
  error?: string;
  screenshots: string[];
  trace?: string;
}

interface LiveState {
  meta: Record<string, string | number>;
  startedAt: number;
  endedAt?: number;
  status: 'running' | 'passed' | 'failed' | 'interrupted' | 'timedout';
  total: number;
  tests: Record<string, LiveTest>;
}

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
const stripAnsi = (s: string) => s.replace(ANSI, '');
const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join('/');

function readVersion(pkg: string): string {
  try {
    return (JSON.parse(fs.readFileSync(pkg, 'utf8')) as { version?: string }).version ?? '?';
  } catch {
    return '?';
  }
}

export default class LiveReporter implements Reporter {
  private readonly port = Number(process.env.LIVE_PORT ?? 9400);
  private readonly clients = new Set<http.ServerResponse>();
  private server?: http.Server;
  private state!: LiveState;

  printsToStdio(): boolean {
    return false;
  }

  onBegin(config: FullConfig, suite: Suite): void {
    const uikitDir = process.env.UIKIT_DIR ?? path.join(process.env.HOME ?? '', 'uikit-react');
    this.state = {
      meta: {
        run: process.env.PW_RUN_ID ?? '',
        environment: `${process.env.COMETCHAT_ENV ?? 'prod'} · ${process.env.COMETCHAT_REGION ?? ''}`,
        uikit: readVersion(path.join(uikitDir, 'package.json')),
        playwright: config.version,
        workers: config.workers,
        projects: [...new Set(suite.allTests().map(t => t.parent.project()?.name ?? ''))].filter(Boolean).join(', '),
      },
      startedAt: Date.now(),
      status: 'running',
      total: suite.allTests().length,
      tests: {},
    };
    for (const test of suite.allTests()) this.state.tests[this.key(test)] = this.describe(test);
    this.startServer();
  }

  onTestBegin(test: TestCase): void {
    const t = this.state.tests[this.key(test)] ?? this.describe(test);
    Object.assign(t, { outcome: 'running', startedAt: Date.now(), error: undefined });
    this.state.tests[t.key] = t;
    this.broadcast('test', t);
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const t = this.state.tests[this.key(test)] ?? this.describe(test);
    t.durationMs = result.duration;
    t.outcome = this.outcomeOf(test, result);
    const err = result.errors[0];
    t.error = err ? stripAnsi(err.message ?? err.value ?? '').slice(0, 4000) : undefined;
    t.screenshots = result.attachments.filter(a => a.contentType === 'image/png' && a.path).map(a => rel(a.path!));
    t.trace = result.attachments.find(a => a.name === 'trace' && a.path)?.path;
    if (t.trace) t.trace = rel(t.trace);
    this.state.tests[t.key] = t;
    this.broadcast('test', t);
  }

  async onEnd(result: FullResult): Promise<void> {
    this.state.status = result.status;
    this.state.endedAt = Date.now();
    this.broadcast('end', { status: result.status, endedAt: this.state.endedAt });
    this.writeStatic();
    if (process.env.LIVE_KEEP === '1' && this.server) {
      console.log(`\n[live] dashboard stays open at http://localhost:${this.port} — press Ctrl+C to stop`);
      await new Promise<void>(resolve => process.once('SIGINT', () => resolve()));
    }
    for (const c of this.clients) c.end();
    this.server?.close();
    console.log(`[live] final dashboard saved: ${rel(STATIC_OUT)}`);
  }

  // ---------------------------------------------------------------------------------------------

  private key(test: TestCase): string {
    return `${test.parent.project()?.name ?? ''}::${test.id}`;
  }

  private describe(test: TestCase): LiveTest {
    const file = rel(test.location.file);
    const folder = file.split('/')[1] ?? '';
    const bug = test.annotations.find(a => a.type === 'bug')?.description;
    const scenario = /^([A-Z0-9]+-[0-9]+[a-z]?(?:\/[0-9]+[a-z]?)*)\s/.exec(test.title)?.[1] ?? '';
    return {
      key: this.key(test),
      scenario,
      title: scenario ? test.title.slice(scenario.length).trim() : test.title,
      area: AREAS[folder] ?? folder,
      project: test.parent.project()?.name ?? '',
      file,
      tags: test.tags,
      bug,
      outcome: 'pending',
      screenshots: [],
    };
  }

  private outcomeOf(test: TestCase, result: TestResult): Outcome {
    if (result.status === 'skipped') return 'skipped';
    const expectedFail = test.expectedStatus === 'failed';
    if (expectedFail) return result.status === 'failed' ? 'known-bug' : 'fixed?';
    if (result.status === 'passed') return result.retry > 0 ? 'flaky' : 'passed';
    return 'failed';
  }

  private broadcast(event: string, data: unknown): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const c of this.clients) c.write(payload);
  }

  private startServer(): void {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname === '/') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(fs.readFileSync(PAGE, 'utf8'));
      } else if (url.pathname === '/state') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(this.state));
      } else if (url.pathname === '/events') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
        res.write(`event: state\ndata: ${JSON.stringify(this.state)}\n\n`);
        this.clients.add(res);
        req.on('close', () => this.clients.delete(res));
      } else if (url.pathname === '/artifact') {
        // Only PNG screenshots inside test-results/ are served.
        const file = path.resolve(ROOT, url.searchParams.get('p') ?? '');
        if (!file.startsWith(path.join(ROOT, 'test-results') + path.sep) || !file.endsWith('.png') || !fs.existsSync(file)) {
          res.writeHead(404).end();
          return;
        }
        res.writeHead(200, { 'content-type': 'image/png' });
        fs.createReadStream(file).pipe(res);
      } else {
        res.writeHead(404).end();
      }
    });
    server.on('error', e => console.log(`[live] dashboard not started: ${e.message}`));
    server.listen(this.port, '127.0.0.1', () => {
      const url = `http://localhost:${this.port}`;
      console.log(`[live] dashboard: ${url}`);
      if (process.env.LIVE_OPEN !== '0' && !process.env.CI && process.platform === 'darwin') {
        spawn('open', [url], { stdio: 'ignore', detached: true }).unref();
      }
    });
    this.server = server;
  }

  private writeStatic(): void {
    const html = fs
      .readFileSync(PAGE, 'utf8')
      .replace('<!--STATIC_STATE-->', `<script>window.__LIVE_STATE__ = ${JSON.stringify(this.state).replace(/</g, '\\u003c')};</script>`);
    fs.mkdirSync(path.dirname(STATIC_OUT), { recursive: true });
    fs.writeFileSync(STATIC_OUT, html);
  }
}
