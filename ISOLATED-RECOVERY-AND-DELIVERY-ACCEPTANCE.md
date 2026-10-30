# Isolated recovery and document-delivery acceptance

Development only. No production credentials/endpoints, customer messages, hosted
migrations, deployment or merge are authorised here. Synthetic database tests
connect only to loopback `paramount_sync_test`; worker/provider tests use injected
fake transports. Record exact SHA, CI URL and evidence hashes for every run.

## Automated acceptance

`python tests/team-sync-db.py` creates a disposable synthetic auth/workspace schema,
runs existing role/CAS/issue/verification/queue/template regressions, then executes
`tests/backup-restore-db.py`. The latter uses `pg_dump` custom format, SHA-256,
creates a **different** database `paramount_restore_acceptance`, restores with
`pg_restore --exit-on-error`, compares deterministic hashes of every row in every
`auth`/`paramount_sync` table, checks template original hashes, anonymous/revoked/
direct-table denial, then drops only that test database. The source inventory must
remain identical. Audit, revisions, invitations, permissions and queued messages
must survive. Roles are shared in this disposable PostgreSQL cluster; this is not
proof of restoring Supabase-managed auth/storage or global roles from backup.

Run only on a fresh disposable cluster with PostgreSQL client tools. The runner
refuses arbitrary database targets. It fails if its restore database already
exists; it does not overwrite an existing database. Backups contain synthetic
secrets/queue material and stay in a temporary directory; no database dump is
uploaded as a public artifact. Corrupted archive bytes fail checksum comparison.
A trusted checksum kept separately is required for real recovery; a checksum next
to attacker-controlled bytes is not authentication.

`npm test` covers workspace JSON/draft merge recovery, shared template byte/mapping
verification and cache/account/expiry/race/denial failures. Delivery tests cover
stable retry keys, transient/permanent errors, lease-backed stored attachment
reuse and real local signed receipt generation. The new end-to-end worker test
renders/signs the frozen synthetic acknowledgement, persists exact attachment/hash
**before** provider submission, and verifies the submitted bytes match. Its
provider is mocked: provider acceptance is not inbox delivery. Existing database
tests cover private queue/claim fencing, verification lockout, replay/revocation,
idempotent acceptance and reminder scheduling. No real email is sent.

## Hosted recovery and real mailbox checks still required

These gates remain **NOT EXECUTED**. They need an owner-provisioned isolated hosted
project, authorised test mailboxes/sender, HTTPS callback/scheduler, signing
identity, access policy and approved isolated configuration. Never substitute the
production project or live app. Do not run a restored queue against a real sender.

| Check | Required evidence | Current result |
|---|---|---|
| Source recovery | Recover exact commit from retained source ZIP; verify checksum/tree, tests and all binary assets | Local exact-tree recovery passed; retained CI ZIP recovery pending |
| Hosted data recovery | Owner-approved backup to separate project; records/revisions, auth mapping, ACLs, templates/originals, audit and storage compare | Pending isolated hosted configuration |
| Recovery objective | Measured backup age/RPO and complete restore time/RTO versus owner-approved targets | Targets/measurements pending |
| Quarantine gate | Updated antivirus database; infected/malformed/timeout/missing-scanner fixtures remain quarantined; server publication requires trusted scan of exact hash | Local scanner prepared; enforced hosted publication gate pending |
| Invitation delivery | Single approved test recipient; invitation arrives with correct HTTPS origin, expiry and no token leakage; collect provider event and inbox evidence | Pending |
| Verification | Email challenge arrives only at intended mailbox; wrong/exhausted/expired/revoked/replayed proofs reject | Automated synthetic coverage; real mailbox pending |
| Receipt delivery | Actual acknowledged frozen revision; receipt arrives with exact stored signed attachment/hash, scope, issuer and audit | Local render/sign/provider-mock passed; inbox pending |
| Retry/failure | Provider timeout/429/5xx and permanent rejection; stable message ID/key, no duplicate issue/attachment, failed audit and operator procedure | Automated synthetic coverage; provider acceptance pending |
| Signing trust | Restricted key storage, renewal/revocation, intended signer/certificate trust and independent PDF verification | Local temporary-key checks passed; real identity pending |
| Restored queue safety | Disable worker/scheduler/sender in restored project; reconcile provider IDs/leases before any owner-approved resume | Documented; hosted drill pending |

Store evidence privately with reviewer/owner names, dates, exact SHA and defects.
No acceptance row may be signed from a screenshot of a green test count alone.

## Operational security boundary

`server/scan-template.cjs --isolated INPUT PRIVATE_QUARANTINE_DIRECTORY` copies a
bounded PDF/DOCX into a private newly-created directory, inspects structure, runs
`clamscan`, verifies the same bytes again, and writes a hash/verdict manifest.
Missing scanner, signature database errors, timeout, infection and structural
rejection all yield blocked. No file is served or published by this utility.
A clean result is point-in-time evidence, not a signed publish token. The current
isolated admin RPC still checks roles/hash/magic and permits trusted admin uploads;
it does not enforce this scanner. Enforcing a trusted scan/quarantine promotion
service and keeping its database current remains a production blocker.

CI source checks parse all tracked JavaScript, flag private-key material and common
credential-shaped tokens/privileged JWTs, check isolated SQL/search paths, and
ensure shared private caches never enter the public service-worker shell. Existing
npm dependency audit remains. These bounded checks do not replace a professional
security review, full secret-history scan or independent penetration testing.
