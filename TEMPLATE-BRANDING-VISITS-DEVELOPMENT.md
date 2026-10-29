# Template, branding and visit development — 29 October 2026

Continues exact verified source `6f8135b6cb6388a0f5a6bc710dec42f8084c9107` on
`paramount-main-app-development`, draft PR #2. No production data, hosted project,
main branch, Mark demo, merge or deployment is involved.

## Implemented

Every additive main-app document form has a Document branding / issued for choice
(default Paramount; Absolute Property Surveys) and Use Existing Certificate /
Template selector. Built-in Word/PDF and engineering print previews retain the
selected branding and explicitly identify Paramount as contractor and draft
issuer. Branding is saved per record, retained in revisions, repeated service
and whole-property drafts, next-appliance entry and quote-to-invoice conversion.
The Absolute name is text only; no invented logo or unapproved asset is included.
Legal layouts remain drafts pending owner/competent approval.

The new device-local template library supports authorised blank DOCX/PDF upload,
naming, company/property/document-type assignments, text/capability preview,
original download, replacement as a new version, deactivation without deletion,
and separate account-scoped JSON backup/restore. SHA-256 checks protect original
bytes; restoration rejects conflicting versions. Async account changes cannot
save into the wrong workspace. Original files and past record selections remain
unchanged. Deactivated versions remain available to existing record selections;
new selections require active compatible versions. Workspace backups carry the
version reference, not the file: keep the separate template-library backup.

Supported Word mapping uses contiguous `{{fieldName}}` placeholders in Word XML
text, including headers/footers, to existing record fields plus reference,
revision, branding, contractor, issuer and draft status. XML escaping preserves
entered values. Generated Word downloads append a draft/provenance statement.
Signatures and declarations require manual review/completion. Split-run or
unmapped placeholders require manual editing of the original in Microsoft Word.
The original and mapped outputs are separate downloads. Built-in reports remain
available separately and are not claimed to reproduce the imported layout.

PDFs are retained unchanged for manual completion. Fillable-PDF mapping, scanned
PDF conversion, arbitrary in-browser Word editing and conversion of imported
Word layouts to PDF are **not implemented**. Existing built-in Word/PDF exports
and blank fillable quotation/invoice templates remain available.

Import limits: 2 MB input, 300 ZIP entries, 12 MB total expansion, bounded ratios
and streamed decompression. DOCX requires actual OOXML content types, root
relationships and document part; ZIP paths, duplicate entries, CRC/lengths,
encryption, macros, embedded objects, external relationships, DTD/entities and
known active content are checked. PDF header/EOF and detected active/encrypted
content are checked. Uploaded files are never rendered as HTML or embedded PDF.
These checks are not an antivirus or a guarantee that arbitrary office files
are safe; organisational scanning/review is still required for original downloads.

New records receive independent UUID visit IDs. Whole-property repetition shares
one new ID across its service drafts. Staff may explicitly reuse an ID across
services. Cross-property links and inconsistent engineering visit dates reject
saving; quotations/invoices may have later document dates for the same visit.
Same-day single-asset repetition aggregates only the source's explicit visit;
legacy date grouping remains confined to other unassigned legacy records.
Engineer job packs show exact linked visit records, with no inferred legacy links.
Older records and history are not backfilled or rewritten.

## Deliberate remaining boundaries

- Template administration is disabled in isolated shared-team mode until a
  server-enforced template ACL/storage/audit schema exists. Personal local
  libraries are usable offline on the same account/device; they do not sync.
- Future arbitrary branding profiles, approved logo embedding, office document
  search/sharing improvements and server-side immutable template delivery remain.
- Final issuer/contractor/VAT presentation needs owner approval and competent
  review. All generated documents remain drafts, not issued certificates.
- Physical Android/iOS and actual Microsoft Word acceptance remain outstanding.
- Existing offline worker behaviour is preserved and the new module is cached.
  The isolated static preview deliberately blocks workers and cloud access.

## Preview

Run `python scripts/prepare-fictional-preview.py`.
Upload-ready artifact: `test-results/paramount-fictional-preview.zip`, checksum
sidecar and expanded `test-results/fictional-preview` directory.

Contains fictional same-day records with distinct IDs, both branding choices,
a real blank OOXML sample with mapped fields, repeat-service/reset and batch
workflows, office quotation conversion and all 22 Academy lessons. Separate
record/authentication/Academy/template storage namespaces and CSP isolate it.
README.txt and TEST-GUIDE.txt include review and upload instructions. Hosting
requires approval; nothing has been hosted or published.

## Local verification

- 102 Node tests passed, zero failed, including new import, mapping, version,
  account/team boundary, same-day, branding/history and preview assertions.
- Independent Python Word edit/save/reopen and strict PDF parsing passed for
  populated service/quote, extinguisher/installation and mapped existing Word;
  both brands' exported PDFs rendered with PDFium. Both blank Word templates
  and all 88 blank PDF form fields passed fill/save/reopen.
- Controlled evidence and incremental cryptographic PDF parsing passed.
- All existing browser runners attempted: blocked before app execution by denied
  loopback sockets. New route-backed template browser runner also attempted:
  Chromium startup blocked by setsockopt permission denial. New CI scenario
  covers 320/360/412/1024px upload, branding, selection and draft reload.
- PostgreSQL runner blocked by missing `psql`; dependent service/register PDF
  browser fixtures are unavailable locally. These are infrastructure limits,
  not reported as passing application tests.
- Fresh dependency installation/audit cannot use the unreachable configured proxy.
  CI retains the existing dependency audit, full browser/document/Academy and
  isolated PostgreSQL role/concurrency/delivery checks, with new template checks.

New-head CI must be checked independently; previous baseline CI is not evidence
for these changes. No claim of complete production readiness is made.
