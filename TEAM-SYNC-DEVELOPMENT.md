# Isolated three-staff synchronisation


> Update — 28 October 2026: the owner confirms Paramount Fire Test exists,
> the isolated migration ran successfully, all four tables were verified and
> one test Auth user exists. Proceed with feature development and single-user
> smoke acceptance using that user; two more hosted users are not a prerequisite.
> Additional identities are only needed for later hosted multi-user acceptance.
> This session has not independently connected to the hosted project. Historical
> setup steps below describe the earlier state. See [session report](SESSION-2026-10-28.md).

Continuation of draft PR #2 on `paramount-main-app-development`, based on
`411dd6443b1d70de487fe8ef499f536e7561f54d`. No merge or deployment is requested.

## Inspection and scope

The existing inline app uses password/refresh-token Supabase REST authentication,
sessionStorage, and a separate dummy `public.properties` table. Its queries imply
`property_name`, `address`, `note`, and `created_at`; the repository does not prove
the deployed table definition or policies. Production was not queried. Device
properties use `paramount-demo-v1`; newer service/PAT/lighting records and their
revisions use `paramount-main-app-v1:<account>`. Existing cloud snapshots are
immutable account-owned JSON, with review-only SQL in `sql/main-app-snapshots.sql`.

New `team-sync-test.html` reuses property/service/PAT/lighting forms, validation,
revision history and draft PDFs through a small optional adapter in `main-app.js`.
Normal entry points do not load the sync modules and keep existing behavior.
The original inline HTML/auth code, original schema SQL, service worker, Academy,
assets, local storage formats and Mark's demo are unchanged.

The test entry is loopback-only, disables original cloud requests and legacy
writes, and never auto-imports properties, prototype data, snapshots or unfinished
forms. It requires a separately loaded isolated configuration, rejects the
original Supabase endpoint, and creates new shared UUID property identities.
Remote test projects must match an explicit `testProjectRef`. There is no default
endpoint or API key. Never serve this test on a production app origin.

## Implemented protections

- A durable local outbox and record update are written together. Namespace includes
  test endpoint, workspace and staff UUID. Draft forms remain local. Polling every
  15 seconds and an explicit sync button pull/push changes while signed in.
- Cloud writes use expected server versions, not device clocks. A transaction
  serialises writes and property-parent checks. A stable operation UUID makes
  retries after lost responses idempotent; changing an existing operation fails.
- Conflicting copies remain visible for explicit comparison. Keep-cloud discards
  the selected local copy only after confirmation; keep-local rebases engineering
  history onto the reviewed cloud revision. Original site links are immutable in
  team mode. Frozen site details remain part of each saved record/revision.
- Web Locks grant one editing tab per staff workspace. Missing lock support blocks
  editing. Pending edits survive reload, timeouts, quota errors, denied access and
  expired sessions. Corrupt storage is not replaced; raw recovery export is offered.
- The new private schema enables/forces RLS on every table, grants no client table
  access, and exposes only two authenticated RPCs with fixed search paths and
  staff checks. Exactly three numbered staff slots are available per workspace.
  Anonymous, fourth/unlisted, other-workspace and revoked staff cannot read/write.
  No client can manage membership, choose an audit actor, erase audit or delete
  records. Each accepted write appends its request/result to immutable audit.
- Server checks cover kinds, IDs, parent existence, payload sizes, reviewed values,
  required results, dates, lighting duration and preserved history. Existing
  competent-review/draft-document requirements still apply.
- Authentication is independent of the original session. Tokens remain in memory,
  are excluded from exports and are discarded on close/reload/401. No service-role
  key is accepted. Server error bodies are not displayed. Token refresh is not
  automatic: sign in again on expiry, retaining the queue.

Offline records are intentionally accessible to someone using the same browser
profile/device. Closing a workspace does not erase its cache or revoke already
issued JWTs. Revoked staff cannot synchronise, but previously downloaded offline
copies cannot be remotely erased. Device access controls/retention need owner
agreement before real customer records are used.

## Setup requiring owner approval (not performed)

1. Approve a **new disposable Supabase test project**, with no production customer
   data or production auth accounts. Confirm its project reference independently.
   Decide staff/offline retention and audit/backups policy. No production setup is
   necessary for the development tests.
2. Review `sql/team-sync-isolated.sql`. In that isolated database only, execute
   `SET paramount.isolated_sync_test = 'yes';` and then the migration in the same
   SQL session. The acknowledgement is an operator guard, not host verification.
   The migration is transactional, refuses an existing schema, and never alters
   `public.properties`, snapshots or auth settings. Do not retry by dropping an
   existing schema: inspect/export it first. Roll back an unused failed migration
   transaction; preserving a populated test schema requires a separate plan.
3. Create three **fictional/test staff accounts** using owner tools. The actual
   three authorised staff identities were not supplied. Do not hard-code emails,
   permit self-enrolment or grant membership based on user-editable metadata.
   As database owner, insert one generated workspace UUID into
   `paramount_sync.workspaces(id,label)`, then insert the three auth UUIDs into
   `paramount_sync.staff(workspace_id,user_id,slot)` with slots 1, 2 and 3. Only
   those owner-managed rows authorise staff. A fourth test account must be denied.
   For membership changes/revocation, lock the workspace row `FOR UPDATE` and
   change membership in the same transaction, serialising against active writes.
4. Prepare an **untracked local JSON file**, containing only the public anon or
   publishable key and test identifiers, for example:

   ```json
   {
     "mode": "isolated-test",
     "url": "https://TESTPROJECTREF.supabase.co",
     "testProjectRef": "TESTPROJECTREF",
     "workspace": "REPLACE-WITH-TEST-WORKSPACE-UUID",
     "publicKey": "REPLACE-WITH-TEST-PUBLISHABLE-OR-ANON-KEY"
   }
   ```

   Use the actual lowercase test project ref. Local Supabase also accepts
   `http://127.0.0.1:54321` without a project ref. Never enter a service key,
   production key, password or access token in this configuration.
5. Serve the checkout on a new loopback origin, e.g.
   `python3 -m http.server 8099 --bind 127.0.0.1`, and open
   `http://127.0.0.1:8099/team-sync-test.html`. Load the JSON, then sign in using
   test staff credentials. Create fictional properties and reviewed drafts.
   Repeat in three browser profiles/devices. There is no customer-data migration
   or deployment step. To reopen cached data offline, reload the local page,
   reload the public test config and choose the explicit offline button.

## Tests and limitations

`node --test --test-isolation=none tests/team-sync.test.cjs tests/main-app.test.cjs`
tests durable queues, three-replica convergence for all four kinds, conflicts,
rebase/history, idempotent lost-response recovery, edits during upload, account
separation, parent ordering, malformed data, quota/network/auth denial and JSONB
key ordering, plus existing main-app behavior.

`node tests/team-sync-browser.cjs` exercises the integrated forms with fictional
REST mocks and blocks all external requests: three staff, four record kinds,
legacy exclusion, offline reconnect, conflict comparison, redacted access errors
and second-tab lock denial. Existing browser suites still run independently.

`python3 tests/team-sync-db.py` targets only loopback port 55432 and database
`paramount_sync_test`, with a fixed fictional test password. CI starts disposable
PostgreSQL 16; the test emulates Supabase `auth.uid()` and roles, applies the real
migration, checks rollback/reapply guards, access denials, three staff, a fourth
account, real concurrent connections/CAS, retries, record validation, immutable
history and revocation. This is not a hosted Supabase Auth/PostgREST acceptance
test. No CI step needs application credentials or production access.

Local Node checks pass. Local browser execution is sandbox-blocked at loopback
server startup (`listen EPERM`); a permission-dependent retry was interrupted.
Local PostgreSQL/psql are unavailable. The connector text checkout lacks unchanged
binary assets, so the local full suite's shell-asset existence check cannot pass.
Read the exact delivered commit's CI checks for complete repository validation.

Remaining approval/acceptance gates: isolated Supabase provisioning and actual
three staff identities; live Auth/PostgREST/RLS end-to-end tests (including token
expiry, revoked users and two physical devices); mobile/Safari Web Locks and
offline acceptance; owner retention/backup review; any later production migration,
configuration change or rollout. Production promotion is intentionally disabled.
Automatic legacy-ID mapping/import, attachments, record deletion, large-database
pagination/realtime delivery and cross-team transfers are not implemented. The
current pull RPC returns a complete workspace and is intended for bounded test
datasets. Test source files must be locally available to reopen offline; they are
not added to the production service worker cache.

