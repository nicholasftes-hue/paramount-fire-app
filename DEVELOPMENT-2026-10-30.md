# Offline draft recovery and launch review — 30 October 2026

Development branch `paramount-main-app-development`, draft PR #2. Continues
`ebdcb0b7d4660df05ec35c46432b70cf3361f0d4`. No merge or deployment.

## Completed

Workspace backup restore previously discarded all exported unfinished forms.
It now restores absent forms, preserves existing forms, checks account scope,
validates partial-form structure and edit-source revisions, and rejects malformed
input before writing any records. Completed-certificate validation is deliberately
not applied to partial field work. Conflicting saved records still abort the
entire merge. Updated restore wording describes the behaviour. The app-shell
cache version is incremented; update consent remains required.

## Verification

- All 104 Node tests pass locally (102 baseline, two recovery regressions).
  Tests cover reload recovery, repeated import, current-form preservation,
  account isolation, malformed input, atomic failure and edit-source revisions.
- Populated service/quote Word edit/save/reopen and strict quotation PDF pass.
- Both blank Word templates and all 88 fillable PDF fields pass save/reopen.
- Mapped template Word edit/save/reopen, both branded Word/PDF documents,
  attribution and draft labels pass; PDFs also render independently with PDFium.
- Controlled evidence and incremental cryptographic PDF parsing pass.
- Template browser runner blocked before application execution by Chromium
  `setsockopt: Operation not permitted`. Disposable database runner blocked by
  missing `psql`. No production database or hosted account was contacted.
- Git transport cannot reach configured proxy. All 93 source blobs recovered
  through the authenticated GitHub connector match pinned tree sizes and hashes.
  Commit via GitHub API retains the existing development head as its parent.

## Launch blockers and next priorities

1. Run full CI for the new head, then physical Samsung/iPhone offline/reconnect,
   save/resume, sharing/printing and actual Microsoft Word acceptance.
2. Obtain competent technical review of fire alarm, lighting and batch PAT scope,
   declarations and layouts. Generated documents remain unissued drafts.
3. Shared customer-template storage still needs server ACLs, audit and backup
   recovery tests; current template libraries are personal/device-local and need
   their separate backup. Fillable imported-PDF mapping and Word-to-PDF conversion
   remain unimplemented. Approved Absolute logo and issuer presentation remain
   outstanding; no logo or company/legal identity was invented.
4. Complete isolated hosted permissions/concurrency and source/data restore
   acceptance, production-history mapping and owner-reviewed migration/rollback
   planning. Local JSON recovery is not proof of hosted database backups.
5. Delivery still needs isolated sender/scheduler/HTTPS/signing configuration and
   real delivery acceptance described in DELIVERY-AND-PERMISSIONS-DEVELOPMENT.md.
   Do not enable customer delivery or treat local exports as controlled issue.

Main, production Supabase, live app and Mark's demo remain untouched.
