# Continued development — 29 October 2026

Continues exact commit `805f1f355aae7a47539c360be9c9aba1ef77bc5e` on
`paramount-main-app-development`, draft PR #2. The new environment did not
contain the reported recovered checkout. All 85 blobs, modes, root tree and
baseline commit were recovered and hash-verified through the GitHub connector.
No existing source was replaced with a new implementation.

## Changes

- Repeating single-asset PAT, lighting or extinguisher services combines unique
  assets recorded on the latest completed service date, newest revision first.
  Different properties, unfinished services and older dates are excluded. An
  explicit batch is the authoritative inventory snapshot; older removed assets
  are not resurrected. Multiple visits on the same day cannot be distinguished
  without a visit identifier; review the prepared inventory on site.
- Single-service and whole-property preparation share the same reset logic.
  Previous tests, readings, signatures, declarations and review state are excluded.
  New drafts remain independent from saved records and revision history. Prepared
  services have resume links, including from Property History. Existing draft
  replacement still requires confirmation.
- Property directory shortcuts open service history, latest service dates,
  recorded next dates with overdue labels, open call-outs and latest asset
  failure counts. Property-specific equipment register access is available.
  These are recorded observations, not automatic certification of defect closure.
- Each asset has large Not Tested / Pass / Fail buttons. Fail focuses the defect
  entry. Changes use the same durable local draft path as ordinary entry. Mobile
  background/page-hide events also save unfinished forms. Shell cache is v14.
- Extinguisher and installation drafts now use the existing branded certificate
  sections in preview, editable Word and Unicode PDF. Both forms accept optional
  engineer/customer acknowledgements. Word footers include reference, revision
  and automatic page fields. Existing certificate issue controls are retained.
- The isolated preview contains two fictional properties, four completed service
  registers, four untested repeat drafts, an open defect and a convertible quote.
  It includes all 22 Academy lessons, Word/PDF templates, a test guide, a file
  checksum manifest and a complete ZIP with SHA-256 sidecar. Regenerate using
  `python scripts/prepare-fictional-preview.py`.

Preview output: `test-results/paramount-fictional-preview.zip`; expanded package:
`test-results/fictional-preview`. Use a fresh local development origin. It has
separate storage keys, dummy cloud credentials and CSP blocking cloud/external
connections and service workers. This static package does not demonstrate
service-worker offline reload; that is covered by the application tests.
Nothing was uploaded or hosted.

## Verification

- 94 Node tests passed, zero failed, including all 22 Academy quizzes, original
  content preservation, six-type result resets, single-asset aggregation,
  batch inventory boundaries, history preservation, local draft reconstruction,
  preview seeding/package integrity and existing role/sync/offline logic.
- Populated Word edit/save/reopen and strict quotation PDF checks passed.
- Both blank Word templates and all 88 fillable PDF fields passed save/reopen.
- Added independent strict PDF and Word table edit/save/reopen checks passed for
  extinguisher and installation certificates, including revision/page footers.
- Controlled evidence and cryptographic signature PDFs independently parsed.
- All seven Node browser suites and the Python Academy browser suite were
  attempted. Local loopback sockets are denied before application execution.
- Disposable PostgreSQL runner was attempted; `psql` is unavailable. Browser PDF
  and register document checks lack their browser-generated fixtures locally.
- CI retains all existing browser/database suites and adds new preview/mobile
  interactions and independent premium document checks. New-head CI must pass;
  baseline CI success does not establish validation of this change.

## Remaining work and boundaries

Physical Android/iPhone and actual Microsoft Word acceptance remain outstanding,
as do competent certificate review and production-history mapping/acceptance.
A full visit identity model for separate same-day visits, broader property date
aggregation, further document layout work and office sharing remain future work.
Quote-to-invoice conversion is retained and gets preview browser coverage; no
new billing or delivery automation is claimed. All 22 lessons are preserved.
No hosted permissions, signing/delivery infrastructure or production migrations
were configured. Production Supabase, main, live hosting and Mark's demo remain
untouched. No merge, deployment or publication.
