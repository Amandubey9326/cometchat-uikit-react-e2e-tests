# Test Data Map

_Phase 0 · 2026-09-27 · updated 2026-09-29_

## 1. The app is shared, so the framework owns a namespace

The production app (`us`) already holds data from other QA work. As of 2026-09-27 that is 44 users and 35 groups:

| Existing data | Examples | Framework rule |
|---|---|---|
| Sample users | `cometchat-uid-1` … `cometchat-uid-5` | **Read-only.** Never modified. Used only by the discovery crawler (`cometchat-uid-1`; read receipts only). |
| Other QA tickets | `qa-user-*`, `qa39535-u01…u35`, `qa39535-g01…g15`, `ENG-395xx` groups, `modtoggle-*` | **Never touched.** Not read, not written, not deleted. |
| Sample group | `cometchat-guid-1` "Hiking Group" (private) | Read-only. |

Everything the framework creates is namespaced:

```
pw-<runId>-<name>        runId = base36 timestamp + 3 random chars, e.g. pw-mg2k9x7ab-alice
```

Only IDs matching `^pw-` are ever deleted. That is enforced in the API client, which refuses to delete anything else.

## 2. Per-test users (updated in Phase 3)

> **Changed in Phase 3:** users are no longer shared per run. Two facts forced this:
> - **BUG-008.** Deleting a user mid-run crashes the app of anyone who messaged them.
> - **ENV-002.** The plan allows 100 users, and 44 already exist.
>
> Each test now creates every user it needs (the `alice`…`frank` fixtures and `data.user()`) and deletes them all when it ends, so no survivor ever holds a conversation with a deleted user. About 4 tests run at once with 2–5 users each, which stays well under the quota. Users that only need to exist (for example group members that are never shown in a browser) are created through REST, with no UI login.

## 2a. Former design: personas created once per run (replaced)

| Persona | UID | Role in tests |
|---|---|---|
| Alice | `pw-<run>-alice` | Primary actor: sender, group **owner** |
| Bob | `pw-<run>-bob` | Receiver: second browser context for realtime |
| Carol | `pw-<run>-carol` | Group **admin** |
| Dave | `pw-<run>-dave` | Group **moderator** |
| Erin | `pw-<run>-erin` | Group **participant** |
| Frank | `pw-<run>-frank` | **Outsider** (not a member): join, permission and privacy checks |

- Each persona logs in **once** through the real UI in a Playwright setup project, and its `storageState` (credentials + SDK session) is saved to `.auth/<persona>.json`. That folder is git-ignored.
- New personas start with **empty conversation lists**, so empty states and ordering are deterministic.

## 3. Per-test data (fixtures)

| Need | Created by | ID pattern | Why per-test |
|---|---|---|---|
| Groups (public / private / password) with chosen members and scopes | `group` fixture → REST | `pw-<run>-g-<testId>` | Tests kick, ban, promote and leave; must not affect other tests |
| Users whose state gets mutated (block/unblock, presence) | `tempUser` fixture → REST | `pw-<run>-u-<testId>` | Blocking a shared persona would break parallel tests |
| Seeded history (pagination, search) | REST `POST /messages` with `onBehalfOf` | inside a per-test group or 1:1 | Fast and deterministic |
| Messages under test | **UI** (the behaviour being tested) | unique text `msg-<testId>-<n>` | Unique text makes assertions exact |
| Attachments | `test-assets/` (png, jpg, mp4, mp3, pdf, oversized, unsupported) | — | Committed, small |

A two-user test uses `alice` + `bob` in two separate browser contexts. Group-role tests use `alice`/`carol`/`dave`/`erin` as needed, and each test runs in its **own** group.

## 4. Cleanup

1. **Per test:** fixtures delete their own groups and temp users in teardown, even when the test fails.
2. **Per run:** global teardown deletes `pw-<run>-*` users (permanent delete) and groups.
3. **Sweeper:** at the start of a run, anything `pw-*` older than 24 h is deleted. This catches runs that crashed.
4. `KEEP_TEST_DATA=1` skips steps 1–2 for debugging a failure.

## 5. Environment & secrets

| Variable | Purpose | Where |
|---|---|---|
| `COMETCHAT_ENV` | `prod` (default) or `staging`; selects the REST host and app hosts | `.env` |
| `COMETCHAT_APP_ID`, `COMETCHAT_REGION`, `COMETCHAT_AUTH_KEY` | UI login | `.env` |
| `COMETCHAT_API_KEY` | REST setup and cleanup (admin key) | `.env` |
| `APP_DIR`, `APP_PORT` | Sample-app location, port (3105) | `.env` (defaults provided) |

- `.env` is git-ignored with mode `600`. `.env.example` lists the keys with no values.
- The logger masks any value of `*_KEY`, auth tokens and `apikey` headers.
- CI reads the same variables from CI secrets.

## 6. Risks

| Risk | Mitigation |
|---|---|
| REST rate limits (429) or network drops during setup | API client retries 408/429/5xx and network-level failures with backoff; bulk member add |
| Others using the same app while tests run | Framework data is isolated by prefix; tests never assert on global counts (e.g. "total users") |
| Users-list pagination includes other people's users | Assert the loading behaviour, not absolute counts; search for our own personas |
| User limit of the plan (100, ENV-002) | Users are per test and deleted when the test ends; ≤ 4 workers locally, 2 in CI; one run at a time |

## 7. Constraints discovered in Phase 3

| Constraint | Detail | How the framework handles it |
|---|---|---|
| **User quota** (ENV-002) | Plan `free-2023-01`: 100 users max; 44 exist → ~56 free | Per-test users deleted at test end; CONV-16 uses 31 *groups* instead of 31 users |
| **Moderation** (ENV-003) | Enabled rules: AI spam / scam / platform-circumvention (> 50%), toxicity (> 70%), profanity, phone-number regex, e-mail regex, image / video AI — all **block** | Message text = natural sentence + word marker (`uniqueText`, `uniqueSentences`); never long digit runs or `x@y.z`; repeated fillers avoided |
| **New-conversation window** (BUG-012) | For 1–4 s after the first message of a new 1:1 chat the server rejects reactions, deletes, reads and thread replies, and does not list the chat | UI tests call `api.users.waitForConversation()` before such steps; `tests/api` pins the bug down |
| **Search index lag** | Attachment search (e.g. Photos filter) finds a new image only a few seconds after it is sent | SRCH-06 re-applies the filter until the photo appears |
| **UI-created groups** | Get app-generated guids (`group_…`); when the owner user is deleted the server makes `app_system` the owner | Named with the run prefix and registered with `data.uiGroup(name)`, so the test's cleanup deletes them **before** their owner; groups orphaned by earlier runs are left for a manual decision (the framework only deletes groups owned by a `pw-*` user) |
