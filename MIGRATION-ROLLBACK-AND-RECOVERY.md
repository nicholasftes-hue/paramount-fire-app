# Migration review and rollback/recovery plan

Scope: repository SQL reviewed from `3380c08`, plus the additive security gate.
No production schema/history or customer data was read. Production compatibility
is **unverified**. The isolation setting is an acknowledgement, not proof of the
connected host. All application migrations remain manual; no startup auto-run.

| Order / file | Review finding and dependency | Rollback limit |
|---|---|---|
| Separate: main-app-snapshots.sql | Review-only append-only per-user snapshots; Auth FK, RLS and select/insert grants. Not a substitute for managed backup or sync migrations. Not used by isolated harness | Preserve/export snapshots; do not drop after use. Owner must decide retention and legacy mapping |
| 1 team-sync-isolated.sql | Creates private schema, workspaces/staff/documents/operations; synthetic Auth required in local harness; guards existing schema; CAS/history/audit | Never drop a used schema. Stop writers and recover isolated replacement |
| 2 controlled-issue-isolated.sql | Adds staff roles, frozen issues/signatures/audit; renames and revokes internal write RPC; expands approval model | Old code must not regain unrestricted internal RPCs; issued evidence stays immutable |
| 3 shared-records-isolated.sql | Expands kind constraint, adds restrictions/ACL/audit and replaces write/access functions | Narrowing kinds can fail on stored rows; removing ACLs leaks data. Preserve security and prefer forward repair |
| 4 verified-delivery-isolated.sql | Extends verification/event constraints, replaces invitation/signature RPCs, adds private outbox/lease/artifact/reminder/audit; worker-only grants | Old signature RPCs must remain revoked; stop scheduler/worker before any restore; preserve provider IDs and stable message keys |
| 5 shared-templates-isolated.sql | Immutable originals/hash/CAS/quota and admin publication; staff property-scoped reads; requires earlier ACL functions | Baseline publication alone is unsafe without order 6. Historical originals and template events must survive |
| 6 template-security-isolated.sql | Private pending/scanning/clean/blocked bytes; worker-only claim/finish with expiring UUID leases; admin request; wraps publication including idempotent path; exact bytes/hash/format/fields trigger; read/activation gate | Never roll back to unscanned publication. Stop uploads if worker unavailable. Existing unscanned versions remain hidden until scanned; admin recovery export retained |

Each file uses one transaction. The first application must succeed and a repeat
must fail without clobbering existing data. Apply in the listed dependency order
on a fresh disposable project only. Tests exercise missing acknowledgement,
reapply rejection, roles, CAS, queue fencing and full synthetic dump/restore.
`main-app-snapshots.sql` is deliberately outside that chain.

## Before an eventual production proposal — human gate L06

DBA supplies an authorised schema-only/history export and compares migration
checksums, applied objects/functions, owners, explicit/default grants, forced
RLS, search paths, extensions, Auth identities, storage policies, row counts,
foreign keys, customer/document IDs and numbering. Map legacy records and
historical certificates without inventing IDs or rewriting issued evidence.
Document every divergence and dry-run the reviewed forward change on isolated
infrastructure. Never infer production history from development filenames.
Record required locks, expected duration and abort thresholds in the approved
change record. No production migration is proposed as executable here.

## Abort and rollback sequence

1. Owner/incident lead declares NO-GO on failed access/scan checks, data/hash
   differences, unexpected identities, backup failure, duplicate delivery,
   technical document defects, or exceeded agreed recovery targets.
2. Stop isolated writers, schedulers, mail and scan workers; keep source database,
   quarantine, backups and audit immutable. Capture exact code/schema SHA,
   migration/checksums, UTC incident time and last successful backup checkpoint.
   Quarantine remains private. Do not purge failed files or queue evidence.
3. Roll application code back only to a reviewed compatible version in a future
   authorised release action. Disable upload/issue/signature/delivery routes if
   the older code cannot honour the current gates. Do not undo security wrappers,
   ACLs, verification requirements or immutable-history constraints.
4. For a failed in-transaction migration, confirm PostgreSQL rolled it back;
   compare schema/ACL inventory to the checkpoint. Do not rerun blindly. For a
   committed incompatible change, prefer a reviewed forward repair. No generic
   DROP/CASCADE/down script is safe once new records exist.
5. Restore backup into a **different approved disposable project** through the
   supported provider procedure. Validate archive SHA-256, managed Auth/storage,
   exact row/revision/audit/ACL/template/scan/queue inventories and object hashes.
   Prove actual Auth and unauthorised/revoked denials. Measure RPO/RTO. Retain
   both source and restored evidence; do not overwrite the source to recover it.
6. Keep restored worker/scheduler/provider credentials absent. Reconcile queued,
   leased, accepted and uncertain provider messages against the provider ledger
   before a separately authorised resume. Expiring the lease does not establish
   whether a provider already accepted a message; never replay after its dedupe
   window without an operator decision. Stored signed attachments remain exact.
7. Owner, DBA and security/operator reviewer sign recovery results and any data
   loss/communication reconciliation. Production cutover/resume needs a new
   explicit approval; this plan grants none.

Required private evidence: exact schema/code/archive hashes; source/target refs;
backup and restore UTC times; agreed and measured RPO/RTO; inventories and access
results; provider reconciliation; incident/defect IDs; named approvals. Deletion
of disposable infrastructure and quarantine is a separate retention decision.
