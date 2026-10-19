# How to run the E2E tests

Quick, copy-paste guide. Every command runs from the project folder (first time? see the step-by-step setup in [README.md](README.md)):

```bash
cd cometchat-uikit-react-e2e-tests   # or wherever you cloned it
```

---

## 1. Before every run (30 seconds)

| Check | Command | Why |
|---|---|---|
| Get the devs' latest UIKit code | `cd ~/uikit-react && git stash && git pull && git stash pop` | Tests run against `~/uikit-react/sample-app`. `stash` keeps the local test hooks. |
| Free disk space ≥ 10 GB | `df -h /System/Volumes/Data` | A full disk crashes the run (`ENOSPC`). |
| `.env` has the 4 keys | open `.env` | `COMETCHAT_APP_ID`, `COMETCHAT_REGION`, `COMETCHAT_AUTH_KEY`, `COMETCHAT_API_KEY` — never commit this file. |

---

## 2. Run the tests

| What | Command | Time |
|---|---|---|
| **Quick health check** (smoke) | `npm run test:smoke` | ~1–5 min |
| **Everything + live dashboard** ⭐ | `npm run test:live` | ~25 min |
| Everything (no dashboard) | `npm test` | ~25 min |
| Critical flows only | `npm run test:critical` | ~10 min |
| One area (e.g. messaging) | `npx playwright test tests/messaging` | varies |
| One test by ID | `npx playwright test --grep "MSG-01"` | < 1 min |
| Calls (fake camera / mic) | `npm run test:calls` | ~10 min |
| Tablet + mobile layouts | `npm run test:responsive` | ~3 min |
| Chromium only | `npm run test:chromium` | ~20 min |

**Combine with the live dashboard:** add `-- <options>` after `test:live`, e.g.

```bash
npm run test:live -- --grep @smoke
```

---

## 3. Watch the browser (headed mode)

```bash
npx playwright test --headed --workers=1 --project=chromium --grep "SMK-01"
```

Interactive mode — pick tests, watch them, step through:

```bash
npm run test:ui
```

Some tests open 2–3 browser windows (one per user: Alice, Bob, Carol).

---

## 4. See the results

| Report | Command | Shows |
|---|---|---|
| **Live dashboard** | opens itself during `npm run test:live` (`http://localhost:9400`) | Live progress, pass / fail per area, failures with screenshots |
| Saved dashboard (last `test:live` run) | `npm run dashboard` | Same page, final result |
| Playwright HTML report | `npm run report` | Every test, steps, screenshots, video, trace |
| Trace of one failure | `npx playwright show-trace test-results/<folder>/trace.zip` | Time-travel debugger |
| Coverage matrix | `npm run coverage:matrix` → open `docs/coverage-matrix.md` | Which scenarios passed / failed / are missing |

### How to read the result

The last lines in the terminal:

```
330 passed (24.7m)        ← all good
  3 failed                ← look at these
```

- **Only the `failed` count matters.**
- A **✘ in the list can be fine**: tests for *known bugs* (`BUG-xxx`, `A11Y-xxx`) are written to fail until the bug is fixed — they count as passed. On the dashboard they are amber **"Known bug"**.
- **"Expected to fail, but passed"** / dashboard **"Bug fixed?"** → that known bug may be fixed — re-check it.
- Bug details: `docs/findings.md`.

---

## 5. Useful switches

Put them before the command, e.g. `LIVE_KEEP=1 npm run test:live`.

| Switch | Effect |
|---|---|
| `LIVE_KEEP=1` | Keep the dashboard open after the run (Ctrl+C to stop) |
| `LIVE_PORT=9500` | Dashboard on another port |
| `LIVE_OPEN=0` | Don't open the browser automatically |
| `PW_WORKERS=2` | Fewer parallel tests (slower Mac / flaky network) |
| `KEEP_TEST_DATA=1` | Don't delete the test users / groups (for debugging) |
| `NET_STRICT=0` | Don't fail tests on unexpected console / network errors |

---

## 6. Maintenance

| Task | Command |
|---|---|
| Delete leftover test data (`pw-*` users / groups) | `npm run cleanup` |
| Update visual baselines after an intended UI change | `npm run test:visual:update` |
| Check the code | `npm run typecheck && npm run lint` |
| First-time setup on a new Mac | `npm install && npx playwright install` |

---

## 7. If something goes wrong

| Problem | Fix |
|---|---|
| `ENOSPC: no space left on device` | Free disk space (≥ 10 GB), run again |
| `Port 3105 / 9400 already in use` | Another run is still going — wait, or close it (`Ctrl+C`) |
| `402 … PLAN_QUOTA` (user limit) | `npm run cleanup` — the app allows 100 users |
| Many tests fail at login | Check `.env` keys and your internet |
| `git pull` conflict in `~/uikit-react` | Use the `git stash … git stash pop` command from step 1 |
| Firefox does not start on this Mac | Known (ENV-001) — Firefox runs in CI only |

---

## 8. Good to know

- The tests use the **production CometChat app (us)** — shared with others. Every test creates and deletes its own `pw-…` users; nothing else is touched.
- AI moderation is on: test messages are natural sentences on purpose.
- Docs: `docs/automation-summary.md` (overview) · `docs/findings.md` (bugs) · `docs/coverage-matrix.md` (coverage).

---

## 9. Automatic runs on GitHub (CI)

| When | What runs | Time |
|---|---|---|
| **New commit on `uikit-react` `master-v7`** (checked every 30 min) | Smoke + critical tests on **that commit** | ~10 min |
| Every night 01:00 UTC (6:30 AM IST) | Full regression + coverage matrix | ~30 min |
| Push / PR to this e2e repo | Smoke on Chromium, Firefox, WebKit | ~5 min |
| Manual: **Actions → E2E — CometChat UIKit v7 → Run workflow** | Pick a suite (and optionally a uikit-react branch / commit) | — |

- Each `master-v7` commit is tested **once**; you get an e-mail only if it fails.
- Results: **Actions** tab → open the run → summary shows the tested commit; **Artifacts** → download the report.
- **Needs 5 repository secrets** (Settings → Secrets and variables → Actions): `COMETCHAT_APP_ID`, `COMETCHAT_REGION`, `COMETCHAT_AUTH_KEY`, `COMETCHAT_API_KEY`, `UIKIT_REPO_TOKEN` (read access to `cometchat-team/uikit-react`, from the dev team). Until they are set, runs **skip quietly** — no failure e-mails.

### Result e-mail

After every run in which the tests **actually ran**, CI e-mails the result:

- ✅ **Passed** — counts and the tested `uikit-react` commit.
- ❌ **Failed** — each failing test with its error, known bugs that may be fixed, and the open bug titles (`BUG-xxx — …`).
- **No e-mail** when the run is skipped or breaks before the tests (missing secrets, bad token, install problem).

Setup (once): add 3 more secrets — `MAIL_USERNAME` (a Gmail / Google Workspace address), `MAIL_PASSWORD` (a Google **App Password** for it, not the normal password), `MAIL_TO` (where to send, comma-separated allowed).

Tip: turn off GitHub's own Actions e-mails (GitHub → Settings → Notifications → Actions) so you only get these.
