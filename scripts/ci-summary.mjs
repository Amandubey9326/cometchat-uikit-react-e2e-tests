// Builds the CI result e-mail (and the GitHub run summary) from reports/results.json.
//
// Usage (CI):  node scripts/ci-summary.mjs
// Env in:      SUITE, UIKIT_SHA, UIKIT_SUBJECT, UIKIT_AUTHOR, RUN_URL, GITHUB_OUTPUT, GITHUB_STEP_SUMMARY
// Writes:      reports/email.html · outputs: has_results, subject, status
//
// Categories: passed · failed (unexpected — real problems) · known bug (test.fail, still failing as
// expected) · fixed? (known-bug test now passing) · flaky · skipped.
/* global process, console */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RESULTS = path.join(ROOT, 'reports', 'results.json');
const OUT = path.join(ROOT, 'reports', 'email.html');
const env = process.env;

const output = (k, v) => env.GITHUB_OUTPUT && fs.appendFileSync(env.GITHUB_OUTPUT, `${k}<<__EOF__\n${v}\n__EOF__\n`);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// eslint-disable-next-line no-control-regex
const stripAnsi = s => String(s ?? '').replace(/\u001b\[[0-9;]*m/g, '');

if (!fs.existsSync(RESULTS)) {
  console.log('No results.json — the tests did not run (setup failed). No e-mail.');
  output('has_results', 'false');
  process.exit(0);
}

const report = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));
const tests = [];
(function walk(suites, file) {
  for (const s of suites ?? []) {
    const f = s.file ?? file;
    for (const spec of s.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const last = t.results?.at(-1) ?? {};
        const bug = t.annotations?.find(a => a.type === 'bug')?.description;
        let category;
        if (t.status === 'skipped') category = 'skipped';
        else if (t.status === 'flaky') category = 'flaky';
        else if (t.expectedStatus === 'failed') category = t.status === 'expected' ? 'known' : 'fixed';
        else category = t.status === 'expected' ? 'passed' : 'failed';
        const error = stripAnsi(last.errors?.[0]?.message ?? last.error?.message ?? '').split('\n').find(l => l.trim()) ?? '';
        tests.push({ title: spec.title, file: f, project: t.projectName, category, bug, error, duration: last.duration ?? 0 });
      }
    }
    walk(s.suites, f);
  }
})(report.suites);

const count = c => tests.filter(t => t.category === c).length;
const n = { passed: count('passed'), failed: count('failed'), known: count('known'), fixed: count('fixed'), flaky: count('flaky'), skipped: count('skipped') };
if (n.passed + n.failed + n.known + n.fixed + n.flaky === 0) {
  console.log('No test actually ran (all skipped). No e-mail.');
  output('has_results', 'false');
  process.exit(0);
}
const ok = n.failed === 0 && n.fixed === 0;
const sha = (env.UIKIT_SHA ?? '').slice(0, 7);
const suite = env.SUITE ?? 'tests';
const minutes = Math.round((report.stats?.duration ?? 0) / 60000);

const subject = ok
  ? `✅ E2E passed — uikit-react ${sha} (${suite}) — ${n.passed} passed`
  : `❌ E2E failed — ${n.failed} failure${n.failed === 1 ? '' : 's'}${n.fixed ? `, ${n.fixed} bug(s) maybe fixed` : ''} — uikit-react ${sha} (${suite})`;

// Unique open bugs (known-bug tests still failing as expected), e.g. "BUG-012 — …".
const bugs = [...new Set(tests.filter(t => t.category === 'known' && t.bug).map(t => t.bug))].sort();
const fixed = tests.filter(t => t.category === 'fixed');
const failed = tests.filter(t => t.category === 'failed');

const row = cells => `<tr>${cells.map(c => `<td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;vertical-align:top">${c}</td>`).join('')}</tr>`;
const table = (head, rows) =>
  `<table style="border-collapse:collapse;width:100%;font-size:13px"><tr>${head.map(h => `<th style="text-align:left;padding:6px 10px;border-bottom:2px solid #d1d5db;color:#6b7280;font-size:11px;text-transform:uppercase">${h}</th>`).join('')}</tr>${rows.join('')}</table>`;
const pill = (label, value, color) =>
  `<td style="padding:10px 14px;border:1px solid #e5e7eb;border-radius:8px;text-align:center"><div style="font-size:22px;font-weight:800;color:${color}">${value}</div><div style="font-size:11px;color:#6b7280;text-transform:uppercase">${label}</div></td>`;

const html = `<!doctype html><html><body style="margin:0;background:#f6f7fb;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111827">
<div style="max-width:760px;margin:0 auto;padding:24px 16px">
  <div style="background:#fff;border-radius:12px;padding:22px 24px;border-left:6px solid ${ok ? '#16a34a' : '#dc2626'}">
    <div style="font-size:20px;font-weight:800">${ok ? '✅ All good — the app works as expected' : `❌ ${n.failed} test${n.failed === 1 ? '' : 's'} failed`}</div>
    <div style="color:#6b7280;margin-top:6px;font-size:13px">CometChat UIKit v7 · E2E <b>${esc(suite)}</b> · ${tests.length} tests in ${minutes} min</div>
    <div style="margin-top:10px;font-size:13px">Tested <b>uikit-react ${esc(sha)}</b>${env.UIKIT_SUBJECT ? ` — “${esc(env.UIKIT_SUBJECT)}”` : ''}${env.UIKIT_AUTHOR ? ` by ${esc(env.UIKIT_AUTHOR)}` : ''}</div>
  </div>
  <table style="width:100%;border-spacing:8px;margin:12px -8px"><tr>
    ${pill('Passed', n.passed, '#16a34a')}${pill('Failed', n.failed, '#dc2626')}${pill('Known bugs', n.known, '#d97706')}${pill('Skipped', n.skipped, '#6b7280')}${n.flaky ? pill('Flaky', n.flaky, '#7c3aed') : ''}
  </tr></table>
  ${failed.length ? `<div style="background:#fff;border-radius:12px;padding:18px 20px;margin-top:12px">
    <div style="font-weight:800;color:#dc2626;margin-bottom:8px">Failures — need attention</div>
    ${table(['Test', 'Browser', 'Error'], failed.map(t => row([`<b>${esc(t.title)}</b>`, esc(t.project), `<code style="font-size:12px">${esc(t.error.slice(0, 220))}</code>`])))}
  </div>` : ''}
  ${fixed.length ? `<div style="background:#fff;border-radius:12px;padding:18px 20px;margin-top:12px">
    <div style="font-weight:800;color:#7c3aed;margin-bottom:8px">Known bugs that now pass — maybe fixed, please re-check</div>
    ${table(['Bug', 'Test', 'Browser'], fixed.map(t => row([esc(t.bug ?? ''), esc(t.title), esc(t.project)])))}
  </div>` : ''}
  ${bugs.length ? `<div style="background:#fff;border-radius:12px;padding:18px 20px;margin-top:12px">
    <div style="font-weight:800;color:#d97706;margin-bottom:8px">Open product bugs (still reproducing)</div>
    <ul style="margin:0;padding-left:18px;font-size:13px">${bugs.map(b => `<li style="margin:3px 0">${esc(b)}</li>`).join('')}</ul>
  </div>` : ''}
  ${env.RUN_URL ? `<p style="margin-top:16px;font-size:13px"><a href="${esc(env.RUN_URL)}">Open the run on GitHub</a> — report, screenshots and traces are under <b>Artifacts</b>.</p>` : ''}
</div></body></html>`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
output('has_results', 'true');
output('subject', subject);
output('status', ok ? 'passed' : 'failed');

if (env.GITHUB_STEP_SUMMARY) {
  const lines = [
    `## ${subject}`,
    '',
    `| Passed | Failed | Known bugs | Skipped | Flaky |`,
    `|---|---|---|---|---|`,
    `| ${n.passed} | ${n.failed} | ${n.known} | ${n.skipped} | ${n.flaky} |`,
    '',
    ...(failed.length ? ['### Failures', ...failed.map(t => `- **${t.title}** (${t.project}) — \`${t.error.slice(0, 160)}\``), ''] : []),
    ...(fixed.length ? ['### Known bugs now passing (maybe fixed)', ...fixed.map(t => `- ${t.bug} — ${t.title}`), ''] : []),
    ...(bugs.length ? ['### Open product bugs', ...bugs.map(b => `- ${b}`)] : []),
  ];
  fs.appendFileSync(env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
}
console.log(subject);
