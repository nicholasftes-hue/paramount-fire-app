# Hosted Supabase acceptance checklist


> Update — 28 October 2026: the owner confirms Paramount Fire Test exists,
> the isolated migration ran successfully, all four tables were verified and
> one test Auth user exists. Proceed with feature development and single-user
> smoke acceptance using that user; two more hosted users are not a prerequisite.
> Additional identities are only needed for later hosted multi-user acceptance.
> This session has not independently connected to the hosted project. Historical
> setup steps below describe the earlier state. See [session report](SESSION-2026-10-28.md).

Prepared 27 October 2026 for draft PR #2, branch `paramount-main-app-development`,
source `a4f7b27635dc404f2e6fe878eb3a990dca476846`. Read
[TEAM-SYNC-DEVELOPMENT.md](TEAM-SYNC-DEVELOPMENT.md) first.

## Status and boundaries

**Hosted acceptance is NOT RUN.** No disposable project was identified in the
reviewed setup notes. The current cloud environment reports no secrets, runtime
variables or outbound identities, and no Supabase connector is available.
This does not prove that the owner has no test project; its availability remains
unverified. No Supabase endpoint, including production, was contacted.

Only a documentation file is added by this continuation. The app, original
authentication, SQL migrations and Mark's demo are unchanged. Do not merge,
deploy, enable production sync, import customer records or use production Auth.
Do not identify a project by trying keys against it. A matching project reference
is an operator check, not proof that a project is disposable.

## Beginner setup: owner actions, isolated project only

- [ ] In Supabase Dashboard, select an existing project only if its owner confirms
  it is disposable, empty of customer data and unrelated to production; otherwise
  create a new project named, for example, `paramount-sync-disposable-test`.
  Creating a project can incur charges; use the owner's approved plan.
- [ ] Record the test project name/reference, owner confirmation and planned
  deletion date in a private test log. Independently compare the reference in
  Dashboard Project Settings with the reference in the URL and local config.
  Never open or query production to make this comparison.
- [ ] Use fictional data only. Agree who can use each device, how long offline
  data/recovery exports/audit/backups are retained, and who performs cleanup.
- [ ] Review `sql/team-sync-isolated.sql`. In the **test project's SQL Editor**,
  run `SET paramount.isolated_sync_test = 'yes';` followed by the complete
  migration in the same execution/session. This acknowledgement does not verify
  the host. If the schema exists, stop and inspect; never drop it to force setup.
  Leave the private `paramount_sync` schema unexposed; the app uses public RPCs.
- [ ] In **Authentication → Users → Add user**, create the three fictional users
  below with separate strong temporary passwords. Use owner-created,
  email-confirmed test users rather than sending invitations. Keep passwords in
  a password manager, outside Git, JSON configuration, screenshots and reports.
  If Dashboard rejects reserved addresses, use three owner-controlled test
  aliases; never substitute actual staff/customer accounts.
- [ ] Copy each user's Auth UUID from Dashboard. Display names/emails alone do
  not authorise access. Create one workspace and membership using the SQL below.
- [ ] Copy only this project's publishable key (or legacy anon key). Never copy
  a secret/service-role key into a browser, repository or test report.
- [ ] Save the JSON example in TEAM-SYNC-DEVELOPMENT.md **outside the checkout**.
  Replace URL, lowercase `testProjectRef`, workspace UUID and public key with
  test values. Do not put passwords or tokens in it.
- [ ] Obtain the exact source checkout at the SHA above. From that folder run
  `python3 -m http.server 8099 --bind 127.0.0.1`. Open only
  `http://127.0.0.1:8099/team-sync-test.html` in three separate browser profiles.
  Load the JSON in each and sign in as A, B and C respectively.
  Do not use the normal app entry or an origin holding existing app/demo data.
- [ ] Keep the source server running for offline tests: block only the test
  Supabase hostname in browser developer tools. The test page is not cached by
  the production service worker. A phone's `127.0.0.1` means that phone; the
  current entry rejects LAN/public hosts. Physical-device acceptance needs a
  separately reviewed loopback setup and is still pending.

| Slot | Fictional display name | Suggested reserved test address |
| --- | --- | --- |
| 1 / A | Alex Example | alex.paramount@example.invalid |
| 2 / B | Blair Example | blair.paramount@example.invalid |
| 3 / C | Casey Example | casey.paramount@example.invalid |

Run as database owner in the confirmed disposable project after migration.
Replace all three UUID placeholders before execution; retain the returned
workspace UUID for the config. This creates only the three memberships:

```sql
begin;
with workspace as (
  insert into paramount_sync.workspaces(id,label)
  values (gen_random_uuid(),'FICTIONAL ACCEPTANCE ONLY')
  returning id
), members(user_id,slot) as (
  values
    ('REPLACE-A-AUTH-UUID'::uuid,1),
    ('REPLACE-B-AUTH-UUID'::uuid,2),
    ('REPLACE-C-AUTH-UUID'::uuid,3)
)
insert into paramount_sync.staff(workspace_id,user_id,slot)
select workspace.id,members.user_id,members.slot
from workspace cross join members
returning workspace_id,user_id,slot;
commit;
```

## Acceptance run: record actual evidence, never assume PASS

For each case log date, source SHA, browser/OS, fictional record UUID, expected
and actual outcome, and PASS/FAIL/BLOCKED. Keep evidence free of passwords,
Authorization headers, JWTs and customer data. Do not export raw network HARs.

| Case | Steps | Expected result |
| --- | --- | --- |
| Auth | Each user signs in; try a wrong password; close/reload then sign in again. | All three provisioned users work; wrong password gives no workspace; reload requires sign-in for network access. |
| Hosted transport | With only test-host requests visible, inspect Auth and RPC status codes (without copying headers). | Password Auth and both public RPCs work with the public key; no request to original Supabase or other external host. |
| Shared records | A creates FICTIONAL Training Hall, then reviewed service, PAT and lighting drafts with explicit fictional results. B and C Sync now and reopen the tab. Each edits a different record and all sync. | Same IDs, values and revisions on all profiles; no legacy/demo properties uploaded; unfinished forms stay local. |
| Snapshot/history | Rename the property after saving a record, then revise the record. | Earlier frozen site details and prior results remain in history; current shared property changes propagate. |
| Offline durability | Block test-host requests for A. Save a reviewed record, reload local page, reload config, select offline workspace. Restore requests, sign in, Sync now twice. | Queue and edits survive; exactly one accepted version per operation; B/C receive the record; queue clears. |
| Conflicts: cloud | A/B sync the same baseline. Block B's test host; both edit the same property. A syncs first; reconnect B and sync. Export recovery, compare copies, choose cloud. | Both copies are displayed before decision; cloud wins only after confirmation; no silent overwrite. |
| Conflicts: local | Repeat with a service record and distinct fictional result text; choose local, sync again. | Local result is kept with a new revision based on cloud history; prior cloud results remain; all profiles converge. |
| Expired token | In the test project, wait beyond its configured JWT lifetime; keep queued work and sync, then sign in again. | 401 clears in-memory session, queue survives, reauthentication recovers. No automatic refresh is claimed. Record actual lifetime rather than changing production settings. |
| Exclusive tab | Open the same staff/workspace in a second tab. | Second tab cannot edit while first holds Web Lock; closing first permits reopening. Missing Web Locks blocks editing. |
| Retention | Export recovery, close workspace, reload and explicitly open cached workspace offline. Inspect export locally. | Offline records remain; export has records/history but no auth token/password. Sign-out is not cache deletion or server JWT revocation. |
| Revocation | Owner revokes C using the transaction below; C retries list/write with its existing session. Then C opens its cached workspace offline. | Both RPCs deny C; queued edits survive; cached data remains readable. This is a documented limit, not remote erasure. |
| Device cleanup | After evidence review, remove site data for the dedicated loopback origin in each test profile; remove downloads/exports and temporary config. | Offline workspace no longer opens there. Server audit/backups persist until the agreed isolated-project cleanup. |

Use known C UUID and workspace UUID in the **test project only**:
```sql
begin;
select id from paramount_sync.workspaces
where id='REPLACE-WORKSPACE-UUID'::uuid for update;
update paramount_sync.staff set active=false
where workspace_id='REPLACE-WORKSPACE-UUID'::uuid
  and user_id='REPLACE-C-AUTH-UUID'::uuid;
commit;
```
Run revocation last. Restore membership only by the same owner transaction/lock
pattern if another fictional test is required.

## Access-control checks needing a technical tester

Use only the confirmed test URL and public key with ordinary test user JWTs.
Do not use owner/service-role credentials to claim client access was denied.
Use a local REST client without storing headers in logs. A successful Auth
response alone does not prove membership; check both list and write RPCs.

- Anonymous RPC requests must fail; no data may be returned.
- A/B/C must not read private tables directly, change staff membership, delete
  documents/audit or spoof an audit actor. Do not expose the private schema to
  test this; PostgREST rejection is expected. Owner SQL can separately inspect
  grants and RLS. PostgreSQL role-level coverage exists in prior disposable CI.
- Supply a random different workspace UUID to both RPCs; read/write must fail.
- For a live unlisted-user check, temporarily create a fourth fictional Auth
  user with no staff row. Both RPCs must deny it. Do not add a fourth slot:
  the schema permits only 1–3. Remove that test user during cleanup.
- Retry one successful write with the identical operation UUID/body/actor:
  returned version must be unchanged. Changed body or actor must be rejected.
  Deliberately interrupting a response is optional; engine retry behavior is
  already automated with mocks.
- Submit two writes at the same expected version from separate sessions:
  exactly one succeeds and the other receives HTTP 409. Verify PostgREST maps
  SQLSTATE PT409 correctly. Invalid reviewed fields/history must fail without
  changing accepted data.
- Owner verifies operation audit records identify the authenticated actor and
  retain accepted results. Client deletion is denied. There is no automatic
  retention expiry or record-deletion feature.

## Automated evidence and remaining work

Executed this session against source fetched at the exact SHA:
`node --test --test-isolation=none tests/team-sync.test.cjs tests/main-app.test.cjs`
— **26 passed, 0 failed**. Coverage includes three replicas/four record kinds,
durable queues, account separation, conflicts/rebase, lost-response idempotency,
in-flight edits, malformed data, denied/expired auth, snapshots and main-app
persistence/PDF behavior. These use mocks and local storage, not hosted Supabase.
The first partial-checkout run lacked pdf-font.js and snapshot SQL; after
fetching unchanged dependencies, the complete targeted run passed.

Independently checked GitHub's workflow API: exact source head run
[40521774383](https://github.com/nicholasftes-hue/paramount-fire-app/actions/runs/40521774383)
completed successfully. The existing PR records browser mocks, disposable
PostgreSQL role/CAS/revision tests and preservation suites in that run. Those
suites were not rerun locally this session. Git clone failed because the runtime
proxy was unavailable; GitHub connector reads supplied the targeted source.

All hosted matrix rows above remain **BLOCKED / NOT RUN**, including actual
Auth/PostgREST status mapping, token expiry and hosted RLS. Manual project
creation, migration application, account creation, membership, hosted test data
and cleanup were **not performed**. Physical-device/Safari acceptance and owner
retention/backup decisions remain open. No production access, merge or deployment
occurred. This checklist is preparation, not approval for real customer use.

