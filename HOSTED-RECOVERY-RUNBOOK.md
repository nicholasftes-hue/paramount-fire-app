# Hosted backup/restore acceptance — prepared, NOT RUN

Gate L03 requires two owner-approved disposable Supabase projects containing
synthetic data only. The previously noted Paramount Fire Test project is not
assumed empty or sufficient for restoration. Never use production reference
`ehlfgmfjzwfsudowaxku`, the live app or Mark's demo. This session has no hosted
credentials and has not created infrastructure or contacted Supabase.

`scripts/hosted-recovery-acceptance.py` automates complete private pg_dump capture,
archive checksum verification, deterministic hashes of **all** application,
managed Auth and storage table contents, application/public schema/RPC/ACL/RLS
DDL and downloaded synthetic object bytes. It checks all source Auth UUIDs equal
the approved synthetic cohort, verifies source unchanged before/after backup and
restore, and compares the isolated restored target. It never starts a worker,
sends mail, restores onto a database, drops a project or claims approval itself.
The provider-supported managed restore step remains an explicit operator action:
blind pg_restore over Supabase-owned Auth/storage schemas is not a safe workflow.

## Operator preparation

1. Owner records disposable source and target refs, synthetic-only approval,
   budget/deletion date, full candidate SHA, approved RPO/RTO seconds and private
   approval/change-record reference. Disable schedulers, outbound hooks and email
   workers in both projects; no sender credentials in the restore target.
2. DBA reviews migration order and restores only the supported managed backup
   mechanism. Seed fictional users, staff/ACLs/revocation, records/history/issues,
   template scans (pending/blocked/clean), original bytes, signed receipts,
   outbox states and at least one **private** storage object under an
   `acceptance-*` bucket with `synthetic/` path. Freeze all writes during capture.
   Synthetic Auth usernames alone are insufficient: inspect all managed schemas
   for pre-existing/customer records before approving the cohort.
3. Store the manifest outside Git, with this shape (placeholders intentionally
   do not pass validation):

```json
{
  "version": 1,
  "owner_approved_disposable": true,
  "synthetic_only": true,
  "owner": "REQUIRED",
  "approval_reference": "REQUIRED",
  "source_sha": "FULL_CANDIDATE_SHA",
  "source_ref": "SOURCE_PROJECT_REF",
  "target_ref": "DISTINCT_TARGET_PROJECT_REF",
  "synthetic_user_ids": ["UUID_OF_EACH_SYNTHETIC_USER"],
  "rpo_seconds": 0,
  "rto_seconds": 600,
  "objects": [{"bucket": "acceptance-fixture", "path": "synthetic/original.pdf", "sha256": "EXPECTED_SHA256"}]
}
```

The example targets are illustrative, **not owner-approved service objectives**.
Inject `PARAMOUNT_SOURCE_DB_URL`, `PARAMOUNT_TARGET_DB_URL` and matching
`PARAMOUNT_SOURCE_SERVICE_KEY` / `PARAMOUNT_TARGET_SERVICE_KEY` privately.
DB URLs must use `postgres` user, `/postgres`, direct `db.<ref>.supabase.co`,
port 5432, no query/fragment. TLS verify-full and configured trusted CA are
required. No production/pooler aliases or fallback identities are accepted.
Never paste credentials into command lines, reports or browser configuration.

4. Use a new mode-0700 directory outside the checkout on encrypted private
   storage. With PostgreSQL tools matching the hosted server installed:

```sh
python3 scripts/hosted-recovery-acceptance.py backup --manifest /private/acceptance.json --private-directory /private/paramount-recovery
```

The private archive includes synthetic Auth/queue secrets. Do not upload it as
CI evidence. Retain its checksum in a separately trusted approval record. A
same-directory checksum alone does not authenticate a backup.
5. Operator restores to the approved distinct target using the provider-supported
   managed process. Record source/target refs, candidate/archive hashes, provider
   evidence, UTC restore start/finish and actual recovered checkpoint. Recreate
   storage **bytes**, not only object rows. Restore roles/grants/extensions and
   server secrets through reviewed provider procedures; do not re-enable delivery.
6. Independently sign in with restored synthetic identities. Test anonymous,
   foreign and revoked users, private storage and pending/blocked upload gates;
   verify restored queue cannot send duplicate messages. Record a private
   `operator-restore.json` in the evidence directory containing `source_ref`,
   `target_ref`, `source_sha`, `archive_sha256`, `reviewer`,
   `provider_restore_evidence`, numeric `restore_started` / `restore_finished`
   Unix seconds, `measured_rpo_seconds`, and each of these actual results:
   `auth_signin`, `anonymous_denied`, `foreign_user_denied`, `revoked_user_denied`,
   `worker_disabled`, `no_duplicate_delivery`, `storage_private`,
   `scanner_quarantine`. Each must be the literal `PASS`, backed by private
   screenshots/logs/defect references. No pre-filled approval is supplied.
7. Run the same command with `verify` instead of `backup`. Any configuration,
   archive, row/schema/object, source-change, manual-gate or RPO/RTO mismatch
   fails closed. A PASS means isolated recovery acceptance only. Owner and DBA
   review evidence before closing L03; there is no production cutover authority.

Limitations: managed restoration and real Auth/permission tests require people
and credentials; the harness validates their recorded evidence and exact database
state, not the truth of a human attestation. Global/provider configuration,
network policy, scheduler, SMTP, key custody and disaster access must also be
reviewed. Any expected provider-version differences require a documented DBA
investigation; do not weaken comparisons to make a drill green.
