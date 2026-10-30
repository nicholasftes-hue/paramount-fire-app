# Trusted server upload security — isolated integration

L02: implementation complete in development; hosted operational acceptance is
pending. Nothing here authorises production migrations, publishing customer
files or deploying a service. Use only the approved isolated project and
synthetic fixtures. A local scan report cannot authorise database publication.

## Data path and enforcement

1. Authenticated workspace admin requests a scan through
   `paramount_template_scan_request`. PostgreSQL validates exact SHA-256, size,
   format, workspace role and bounded private quarantine quota. Identical bytes
   reuse the existing state; blocked uploads cannot be cleared by a client.
2. `server/template-scan-worker.cjs` claims one queued upload with a unique
   five-minute lease through a server-only service-role RPC. Other roles have
   no table access or claim/finish permission. Failed/crashed workers never
   create a clean result; an expired claim can be recovered with a new lease.
3. Worker verifies bytes/hash, copies to private files, runs the same bounded
   structural PDF/DOCX inspection and ClamAV, rechecks immutable bytes and records
   clean fields or blocked. Signatures missing, older than 48h or future-dated,
   engine errors/timeouts/infection/structural rejection/tampering all block.
   Reports and rejected originals stay private for retention/security review.
4. Browser retries publication only after clean status. The public RPC wrapper
   and table trigger bind workspace, original bytes/hash, format and inspected
   field list. A forged client clean flag, idempotent publish retry or direct
   insert/activation cannot bypass the gate. Unscanned/blocked historical rows
   are excluded from ordinary list/get; admin recovery export is intentionally
   retained for audit/recovery and must remain private.

A clean scan is point-in-time evidence, not proof of authorised artwork,
technical correctness or legal approval. Those remain L10/L11. Database owners
and the trusted worker credential are security authorities; PostgreSQL cannot
protect against an authorised owner deliberately forging a verdict.

## Isolated operator setup — not executed here

Apply the reviewed migration chain through `template-security-isolated.sql`
only to a confirmed disposable project. Set `paramount.isolated_sync_test=yes`
in the same SQL session. Existing schema is not disposable merely because the
setting was supplied. Configure server-only:

- `PARAMOUNT_ISOLATED_SCAN=yes`
- `PARAMOUNT_TEST_URL=https://<isolated-ref>.supabase.co`
- `PARAMOUNT_TEST_PROJECT_REF=<same-isolated-ref>`
- `PARAMOUNT_SCAN_KEY=<server-only-matching-service-role-credential>`
- `PARAMOUNT_QUARANTINE_DIR=<absolute-private-directory-outside-served-source>`

Inject credentials privately, never into Git/browser/test reports. Provision a
separate worker identity with a mode-0700 directory outside all served roots on
encrypted storage. Code checks real paths, ownership and mode, including symlink
redirects into the source tree. It creates mode-0600 originals/reports. Run the
worker from a private server checkout, not a public upload endpoint:

```sh
node server/template-scan-worker.cjs
```

One invocation claims at most one upload. Use a reviewed isolated scheduler;
no scheduler is installed/enabled by this continuation. Install a supported
ClamAV engine and maintained signature updater. Alert on last successful update,
blocked scans, pending age, expired leases, quota/disk usage and worker failures.
Never disable structural/AV/date checks to clear a queue. Service-role custody
must be approved; it is a broad Supabase server credential, not a browser key.

Do not serve the quarantine directory through another static root, symlink,
bucket or download route. Browser users can request only scan state, not private
bytes/reports. An owner reviews retention/deletion, storage encryption and access
logging. No automatic deletion or client unblock exists. To investigate a false
positive, retain exact hash, engine/signature version and restricted report;
security operator approves any rescan/reset and records audit/change evidence.
A blocked verdict is never changed to clean merely to meet a launch date.

## Required evidence

CI covers trusted publication/role/hash/fields/lease fencing, retry and blocked
read/activation paths in disposable PostgreSQL, plus real updated ClamAV benign
PDF and harmless EICAR rejection. Mock tests cover absent/error/tampered scanner
and private path restrictions. Hosted acceptance must additionally demonstrate
malformed PDF/DOCX, infected fixture, unavailable/stale AV, worker crash/lease
reclaim and foreign/revoked/admin verdict-denial cases. Record exact source SHA,
project ref, fixture hashes, scanner engine/signature versions/times, RPC/queue
outcomes, private quarantine permissions, no-public-download proof, UTC times,
defects and security/operator signature. Human approval and hosted evidence are
still pending; a clean CI fixture does not close L02 by itself.
