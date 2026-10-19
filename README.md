# CometChat React UIKit v7 — E2E Tests

Automated end-to-end tests for the **CometChat React UIKit v7 sample app**.

A robot (Playwright) opens real browsers, signs in as test users and uses the chat app the way a person would — sends messages, reacts, starts threads, creates groups, makes calls — and checks that every step works, also for a second user in another browser and after a page reload.

```
 This project (the tests)  ──tests──►  UIKit sample app  ──talks to──►  CometChat server
   Playwright + TypeScript              ~/uikit-react/sample-app          your app (keys in .env)
```

**What you get**

- ~340 tests across 28 areas — login, chats, messages, groups, calls, search, extensions, moderation, accessibility, mobile layout, visual, network …
- A **live dashboard** that shows pass / fail while the tests run
- Screenshots, video and a step-by-step trace for every failure
- A documented list of product bugs found ([docs/findings.md](docs/findings.md))

> Already set up? Jump to **[Daily use](#4-daily-use)** or the one-page cheat sheet **[HOW-TO-RUN.md](HOW-TO-RUN.md)**.

---

## Contents

1. [What you need](#1-what-you-need)
2. [One-time setup](#2-one-time-setup)
3. [Run your first test](#3-run-your-first-test)
4. [Daily use](#4-daily-use)
5. [See and understand the results](#5-see-and-understand-the-results)
6. [Watch the tests run](#6-watch-the-tests-run)
7. [Project structure](#7-project-structure)
8. [Writing a new test](#8-writing-a-new-test)
9. [Troubleshooting](#9-troubleshooting)
10. [CI on GitHub (optional)](#10-ci-on-github-optional)
11. [More documentation](#11-more-documentation)

---

## 1. What you need

| Requirement | Check with | Notes |
|---|---|---|
| **Node.js 20+** | `node -v` | [nodejs.org](https://nodejs.org) |
| **Git** | `git --version` | |
| **The UIKit repo** (`cometchat-team/uikit-react`) | — | Cloned to `~/uikit-react` (the app under test) |
| **A CometChat app** | — | App ID, region, Auth Key and REST API Key from the CometChat dashboard |
| **~10 GB free disk** | `df -h` | Videos and traces need space during a run |
| Python 3 *(optional)* | `python3 --version` | Only for the coverage-matrix report |

---

## 2. One-time setup

### Step 1 — Get this project

```bash
git clone git@github.com:Amandubey9326/cometchat-uikit-react-e2e-tests.git
cd cometchat-uikit-react-e2e-tests
npm install
npx playwright install
```

### Step 2 — Get the app under test (UIKit sample app)

```bash
git clone <uikit-react repo URL> ~/uikit-react
cd ~/uikit-react && git checkout master-v7
cd sample-app && npm install
```

Back in this project, apply the small test hooks to the sample app (lets the tests pass credentials and language via environment variables):

```bash
cd -          # back to this project
npm run app:patch
```

### Step 3 — Add your CometChat keys

```bash
cp .env.example .env
```

Open `.env` and fill in:

| Key | Where to find it |
|---|---|
| `COMETCHAT_APP_ID` | CometChat dashboard → your app → Credentials |
| `COMETCHAT_REGION` | e.g. `us`, `eu`, `in` |
| `COMETCHAT_AUTH_KEY` | Dashboard → Credentials → Auth Key |
| `COMETCHAT_API_KEY` | Dashboard → Credentials → REST API Key (full access) |

> 🔒 `.env` is git-ignored — your keys never leave your computer. Never paste them into code or docs.
>
> 🍎 On macOS where Firefox cannot launch, also add `PW_NO_FIREFOX=1`.

### Step 4 — Check everything works

```bash
npm run typecheck && npm run lint
npm run test:smoke
```

If the last line says **`16 passed`** (or similar) with no `failed`, you are ready. 🎉

---

## 3. Run your first test

```bash
npm run test:live -- --grep @smoke
```

- Your browser opens a **live dashboard** at `http://localhost:9400`.
- In ~1–5 minutes you see the result per area and an overall ✅ / ❌.

---

## 4. Daily use

**Before each run** — get the developers' latest code:

```bash
cd ~/uikit-react && git stash && git pull && git stash pop && cd -
```

(`stash` keeps the test hooks from Step 2.)

**Then pick what to run:**

| I want to… | Command | Time |
|---|---|---|
| Quick health check | `npm run test:smoke` | ~1–5 min |
| **Run everything, with the live dashboard** ⭐ | `npm run test:live` | ~25 min |
| Run everything (no dashboard) | `npm test` | ~25 min |
| Only the most important flows | `npm run test:critical` | ~10 min |
| One area (e.g. groups) | `npx playwright test tests/groups` | varies |
| One test by its ID | `npx playwright test --grep "MSG-01"` | < 1 min |
| Calls (fake camera + mic) | `npm run test:calls` | ~10 min |
| Tablet + phone layouts | `npm run test:responsive` | ~3 min |

Any command can be combined with the dashboard: `npm run test:live -- <options>`, e.g. `npm run test:live -- tests/groups`.

---

## 5. See and understand the results

| Where | How | What it shows |
|---|---|---|
| **Live dashboard** | Opens by itself with `npm run test:live` | Progress, pass / fail per area, failures with error + screenshot |
| Saved dashboard | `npm run dashboard` | The last live run, final state |
| Full HTML report | `npm run report` | Every test, every step, screenshots, video |
| Trace of one failure | `npx playwright show-trace test-results/<folder>/trace.zip` | Time-travel through the failure |
| Coverage | `npm run coverage:matrix` → `docs/coverage-matrix.md` | Which scenarios passed / failed / are missing |

### How to read a result

The last lines in the terminal:

```
330 passed (24.7m)      ← fine
  3 failed              ← look at these
```

| You see | Meaning | Action |
|---|---|---|
| **passed** | Works as expected | — |
| **failed** | Something broke | Open the report / dashboard, check the screenshot and error |
| ✘ next to a test that counts as passed, or amber **"Known bug"** on the dashboard | A test for a **known product bug** (`BUG-xxx`, `A11Y-xxx`) — written to fail until the bug is fixed | Nothing — it is expected |
| **"Expected to fail, but passed"** / purple **"Bug fixed?"** | That known bug may be fixed | Re-check it, then remove the `test.fail` line |
| **skipped** | Not meant for this browser / needs an optional setting | — |

Bug details: [docs/findings.md](docs/findings.md).

---

## 6. Watch the tests run

See the browser while a test runs:

```bash
npx playwright test --headed --workers=1 --project=chromium --grep "SMK-01"
```

Interactive mode — pick tests, watch them, step through each action:

```bash
npm run test:ui
```

Some tests open 2–3 browser windows — one per test user (Alice, Bob, Carol).

---

## 7. Project structure

```
tests/          the tests, one folder per area (auth, messaging, groups, calls, …)
pages/          page objects — one class per screen / UIKit component
fixtures/       test users (alice … frank), per-test data, network watcher
api/            CometChat REST helpers (test data setup / cleanup only)
config/         reads .env, picks prod / staging
dashboard/      the live dashboard (reporter + page)
docs/           findings (bugs), coverage matrix, plan, app map
scripts/        coverage matrix + CI e-mail summary
app-patches/    small test hooks for the sample app
.github/        CI workflow
```

**How test data works:** every test creates its own users and groups (named `pw-…`) through the REST API and deletes them when it ends. The framework **never** touches anything that is not named `pw-…`, so it is safe on a shared app.

---

## 8. Writing a new test

```ts
import { uniqueText } from '@data/unique';
import { expect, test } from '@fixtures/test.fixture';

test('MSG-11 receiver gets a 1:1 message live', { tag: ['@messaging', '@critical'] }, async ({ alice, bob }) => {
  // Arrange
  const text = uniqueText();
  await alice.app.openChatWith(bob.user);

  // Act
  await alice.app.composer.send(text);

  // Assert — the second user sees it live
  await bob.app.openConversation(alice.user.name);
  await expect(bob.app.messages.message(text).root).toBeVisible();
});
```

**Rules**

1. Start the title with the scenario ID from `docs/coverage-matrix.md` (e.g. `MSG-11`) and add tags.
2. Use the page objects in `pages/` — no raw CSS selectors in tests.
3. **Never** use `waitForTimeout` (lint blocks it) — wait for something visible instead.
4. A test that changes data creates its own users / groups with `data.user()` / `data.group()`.
5. For saved state, check again after `app.reload()`.
6. For a confirmed product bug: `test.fail(true, 'BUG-xxx')` + a `bug` annotation, and remove it when the bug is fixed.
7. In a brand-new 1:1 chat, call `api.users.waitForConversation()` before reacting, deleting, reloading or reading (server needs a few seconds — BUG-012).

Check your code: `npm run typecheck && npm run lint`

---

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| `Missing COMETCHAT_…` | Fill in `.env` (Step 3) |
| Many tests fail at login | Check the keys in `.env` and your internet |
| `ENOSPC: no space left on device` | Free disk space (≥ 10 GB) and run again |
| `Port 3105 / 9400 already in use` | Another run is still going — wait, or stop it with `Ctrl+C` |
| `402 … PLAN_QUOTA` (user limit) | `npm run cleanup` — deletes leftover `pw-…` test users |
| `git pull` conflict in `~/uikit-react` | Use the `git stash && git pull && git stash pop` command |
| `npm run app:patch` fails | The hooks are already applied, or the UIKit code changed — check `git -C ~/uikit-react status` |
| Firefox does not start (macOS) | Add `PW_NO_FIREFOX=1` to `.env` — Firefox runs in CI |
| A test is flaky | Run it alone: `npx playwright test --grep "<ID>" --repeat-each 3` |

**Useful switches** (put before a command, e.g. `LIVE_KEEP=1 npm run test:live`):

| Switch | Effect |
|---|---|
| `LIVE_KEEP=1` | Keep the dashboard open after the run |
| `PW_WORKERS=2` | Run fewer tests in parallel (keep ≤ 4) |
| `KEEP_TEST_DATA=1` | Keep test users / groups for debugging |
| `NET_STRICT=0` | Don't fail tests on unexpected console / network errors |
| `PW_LOCALE=fr` | Run against the French UI |

Run only one test command at a time — runs share the app's user limit.

---

## 10. CI on GitHub (optional)

`.github/workflows/e2e.yml` can run the tests on GitHub automatically:

| When | What |
|---|---|
| New commit on `uikit-react` `master-v7` (checked every 30 min) | Smoke + critical tests on that commit |
| Nightly | Full regression + coverage matrix |
| Push / PR to this repo | Smoke tests |
| Manual — **Actions → Run workflow** | Any suite |

It needs repository secrets (**Settings → Secrets and variables → Actions**):
`COMETCHAT_APP_ID`, `COMETCHAT_REGION`, `COMETCHAT_AUTH_KEY`, `COMETCHAT_API_KEY`, `UIKIT_REPO_TOKEN` (read access to the UIKit repo) and, for result e-mails, `MAIL_USERNAME`, `MAIL_PASSWORD` (Google App Password), `MAIL_TO`.

Without the secrets every run **skips quietly** (no failure e-mails). To stop it from starting at all: **Actions → E2E — CometChat UIKit v7 → ⋯ → Disable workflow**.

---

## 11. More documentation

| Document | What's inside |
|---|---|
| [HOW-TO-RUN.md](HOW-TO-RUN.md) | One-page command cheat sheet |
| [docs/findings.md](docs/findings.md) | Product bugs found, with steps and evidence |
| [docs/coverage-matrix.md](docs/coverage-matrix.md) | Every scenario and its latest result |
| [docs/automation-summary.md](docs/automation-summary.md) | Overview of the framework and the last full run |
| [docs/feature-inventory.md](docs/feature-inventory.md) | Every feature of the app |
| [docs/test-data-map.md](docs/test-data-map.md) | How test users and groups are created and cleaned up |
| [docs/application-map.md](docs/application-map.md) | Screens and components of the sample app |
