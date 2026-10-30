# Development continuation — 30 October 2026

Development branch only; PR #2 remains open and draft. No merge or deployment.
Main, production Supabase, live app and Mark's demo remain untouched.

## Verified recovery and checkpoints

`712d490589bd16e0603fc15a72263c98669e3d3c` is the direct child of
`6555bb9a39706e13864cb55f409b7bdf52b924a0`. Reviewed both changed files:
decoded PDF control names reject and conservative appearance sizing prevents
wide-glyph clipping, with regressions. Updated only the development ref using
force=false and an expected-old-head guard. Fresh branch and PR reads confirmed
the new head, open/draft status and unchanged base `paramount-academy-update`.
Git transport cannot reach its proxy; recovered all 104 files via the GitHub
connector, verified blob sizes/hashes and exact tree, and reconstructed the exact
baseline commit locally. Further checkpoints use the same non-force ref update.

Checkpoint `362f0b5` integrates shared template/mapping selection into isolated
engineer and office forms, with a scoped, verified, 24-hour offline snapshot.
See SHARED-TEMPLATES-DEVELOPMENT.md for cache boundaries. This continuation adds
server-side local quarantine scanning, source security checks, shared browser
regressions, complete disposable PostgreSQL backup/restore verification and a
real local signed-receipt generation/provider-mock acceptance test. The public
app-shell cache is bumped to v18 with update consent retained; shared files/data
remain outside it. No production auth or legacy inline app source was rewritten.

## Tests and CI

Current local **npm test exits 0: 122 Node tests pass**, plus 90 legacy
loading/content checks. Independent imported PDF parsing/appearances, preserved
content, both brands and save/reopen pass. Populated service/quote and mapped
Word editing/save/reopen pass; both branded PDFs render independently with PDFium.
Blank Word and all 88 fillable PDF fields pass. Extinguisher/installation strict
PDF/Word tests pass. Controlled evidence and cryptographic PDF checks pass.
A source ZIP was restored into a separate temporary directory: checksum, member
set and all 114 baseline Git blob hashes matched; the verifier is wired into CI.
Tracked-source credential patterns, all JavaScript parsing, SQL isolation/search
paths and private-cache boundary checks pass. Local quarantine CLI correctly
returns blocked without an available antivirus service. Injected scanner tests
cover clean/infected/missing/error and post-scan byte tampering.

Initial checkpoint CI run 41103753296 for head `362f0b5` failed npm test because
the legacy loader-order assertion expected the pre-imported-PDF module sequence
and old document-template query version. Its 120 named Node tests were green,
but the legacy async check set process exit code 1. Earlier test-count-only
statements overstated full-suite success. The assertion now checks the complete
actual ordered module list, including imported PDF and the updated template
module query version; local process exit 0 is verified. That checkpoint's
browser/document suites and disposable database job passed. Continuation run 41104765917 for head `17f1ce9` passed its disposable database
job, including the complete pg_dump/restore drill, exact table hashes, original
bytes, permission denials and unchanged source database. Its new browser fixture initially failed because selecting a template correctly
cleared the human-review checkbox after the fixture had ticked it. The fixture
now asserts that reset, then explicitly reviews the selected template before
saving. This preserves the safety behaviour; no validation was weakened.
CI run [41105370127](https://github.com/nicholasftes-hue/paramount-fire-app/actions/runs/41105370127)
for exact head `39b8a58d3498c0af536cacb7e489afcd6f1f6f6d` completed successfully:
both academy/browser/document and isolated database jobs passed. The corrected
shared engineer/office mapping, offline mapped PDF download, deactivation/history,
source archive verifier and full database restore checks passed. npm audit found
zero vulnerabilities. The retained source ZIP and browser/document evidence are
attached to that run. This is implementation-head evidence; subsequent report-only
commits must also have their exact-head CI status checked on draft PR #2.

Local browser startup is blocked by Chromium setsockopt denial; local database
runner is blocked by missing psql. No local browser/database success is claimed.
Full browser tests, new shared form/mapping/offline export cases, main/Academy/
offline consent regressions, database roles/CAS/queue and the new pg_dump/restore
run remain wired into CI with read-only repository permissions. No hosted service
or actual provider/mailbox was contacted. CI status must be read for the final
exact development SHA, not inferred from a previous green job.

## Acceptance packs prepared

- PHYSICAL-DEVICE-AND-WORD-ACCEPTANCE.md: physical Samsung/Chrome/Samsung Internet,
  iPhone/Safari, offline/reconnect/save/share/print and actual Microsoft Word
  editing/reopen/pagination/export checks, with evidence and sign-off fields.
- COMPETENT-PERSON-CERTIFICATE-REVIEW.md: per-discipline scope, standards edition,
  methods/readings/units, Not Tested, limitations, declarations, issuer/brand,
  template mapping and controlled issue review, with explicit approval record.
- ISOLATED-RECOVERY-AND-DELIVERY-ACCEPTANCE.md: disposable source/data restore and
  signed delivery checks, plus outstanding hosted/inbox/security acceptance.

## Launch assessment: NOT READY

Remaining gates: physical mobile and actual Word execution;
competent-person certificate review; approved Absolute artwork/legal presentation;
trusted server scan/quarantine enforcement before publication (the local scanner
is not connected to the admin RPC); isolated hosted restore including managed
Supabase auth/storage and measured owner-approved RPO/RTO; actual sender/inbox,
HTTPS/scheduler/signing identity acceptance; production-history mapping and
owner-reviewed migration/rollback. The isolated test shell has no service worker,
so cold offline navigation is not claimed. Cached drafts cannot prove current
roles, resist device-clock tampering or recall previous exports. Word-to-PDF
conversion remains a manual Word acceptance step, not an app service.

Earlier offline draft backup merging remains implemented and tested: missing
partial forms restore without replacing current work, account/edit-source checks
apply, record conflicts abort atomically, and no completion is inferred.
