# Production launch decision — NO-GO

Development continuation from `3380c08`; PR #2 stays draft. This file does not
authorise production access, migration, merge, deployment or customer contact.
The release owner must record the **exact candidate SHA**, passing CI URL,
evidence bundle checksum, reviewer/date and decision for every gate. Blank,
blocked, expired or failed evidence means NO-GO. Earlier green commits do not
approve a later candidate. This work covers launch blockers only.

| Gate | GO criterion | Current status / accountable approval |
|---|---|---|
| L01 Source and regression | Exact-head Node, browser, documents, source restore, disposable DB restore and real updated antivirus jobs pass; no unresolved critical/high defects | Automation prepared; final-head CI must be read |
| L02 Trusted upload security | Isolated hosted migration/worker test proves no publish, retrieval or activation of unscanned/blocked originals; EICAR, malformed, unavailable/stale AV and lease races fail closed; private quarantine and monitored update/retention procedure demonstrated | Server enforcement implemented; hosted credentials and security/operator approval pending |
| L03 Hosted recovery | Separate disposable source/target; complete source backup; provider-supported managed Auth/storage restore; exact records/revisions/audit/ACL/scan/queue and object-byte comparisons; real Auth/denial checks; owner-approved measured RPO/RTO | Harness prepared; two projects, credentials, restore execution and owner targets/approval pending |
| L04 Safe delivery | Owner-controlled allowlisted inbox only; invitation/challenge/receipt actually arrive; HTTPS origin/expiry; scheduler single delivery, retries/rejections and restored queue suppression; received signed PDF hash equals persisted attachment | Mocks/local cryptography covered; approved sender, test inbox, provider credentials, isolated HTTPS/scheduler and actual evidence pending |
| L05 Signing identity | Intended legal issuer approves certificate fingerprint/chain, key custodian, validity, protected key storage, renewal/revocation and independent viewer trust; tampering rejected | Temporary local certificates only; real identity/credentials and custodian approval pending |
| L06 Data/migration safety | DBA maps actual production migration history and auth/storage dependencies from an authorised export; tests reviewed ordered migrations and recovery on a disposable copy; no unsupported down migration | Repository review/rollback prepared; DBA history, recovery evidence and owner approval pending; production not queried |
| L07 Samsung | Physical Samsung, Chrome **and** Samsung Internet matrix PASS, including offline/reconnect/export/print/update and enlarged text | Human device execution/sign-off pending |
| L08 iPhone | Physical iPhone/Safari/Files/share/print matrix PASS; cold offline requirement explicitly tested or excluded by owner-approved scope | Human device execution/sign-off pending |
| L09 Microsoft Word | Actual office-used Word versions edit/save/close/reopen/print/export complete document cohort without repair/clipping/lost data | Office execution/sign-off pending |
| L10 Competent person | Per-discipline technical standards/scope/readings/limitations/Not Tested/declarations and controlled issuer workflow signed by qualified reviewer; all blocking defects closed | Competent-person approval pending |
| L11 Branding and retention | Absolute artwork/legal presentation, contractor/issuer labels, cache/export retention and revocation limitations approved | Owner/legal approval pending |
| L12 Release authority | Owner approves exact SHA, monitoring/on-call, backup retention, rollback authority, launch window and separately authorised migration/merge/deploy steps | No approval requested or granted; PR remains draft |

No conditional GO may waive L02–L06 or technical/device acceptance silently.
If a feature is removed from launch scope, record that owner decision and verify
it is disabled before re-evaluating the candidate. A green test suite alone is
not authority to send, issue a certificate or deploy.

## Who can close what

Automatically: source and synthetic regression tests; quarantine and database
fencing; safe recipient blocking; temporary-key cryptographic verification;
source/disposable DB restore; hosted inventory/archive/object comparisons once
isolated infrastructure and credentials exist. A prepared script is not PASS.

Credentials/infrastructure: isolated source and restore projects, matching DB
and service credentials, maintained ClamAV, owner-controlled sender/inbox,
isolated HTTPS/scheduler, real signing key/certificate. Never paste secrets into
Git, browser configuration, screenshots, logs or acceptance reports.

Humans: physical Samsung/iPhone, actual Word and competent-person tests;
production-history mapping; supported managed restore and operational runbook
review; RPO/RTO targets; signing identity, branding/legal/retention and final
release authority. See MIGRATION-ROLLBACK-AND-RECOVERY.md,
HOSTED-RECOVERY-RUNBOOK.md, SAFE-DELIVERY-AND-SIGNING-ACCEPTANCE.md and the existing
physical-device/Word and competent-person packs. This continuation performs no
merge, deployment, production change or customer communication.
