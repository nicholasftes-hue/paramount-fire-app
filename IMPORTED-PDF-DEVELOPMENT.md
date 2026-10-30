# Imported certificate PDFs — 30 October 2026

Continues verified development commit `8f588863989422a196f7164170905f22d45949b8`.
All 94 source blobs, root tree and commit object recovered exactly via GitHub API.
No accessible uncommitted source survived the lost workspace. Git transport cannot
reach the configured proxy. PR #2 remains draft. No deployment or production access.

## Import and mapping

`imported-pdf.js` parses a deliberately bounded classic PDF subset, checks every
object and decoded dictionary name, all references, cross-reference offsets and
trailer, and rejects malformed/ambiguous structures before storage. No uploaded
PDF is rendered or executed in the app. Encryption, actions (including escaped
names and unreachable objects), embedded/external files, signatures, XFA,
compressed object/xref streams and incremental revisions are rejected. Normal
compressed page/appearance streams are preserved without decompression. Limits:
2 MB, 5,000 objects, 100 pages, 200 fields, bounded token count and nesting.
This is a restricted importer, not a general malware scanner or PDF repair tool.
Continue using the organisation's file-scanning process.

Text fields can be mapped to an explicit certificate-value allowlist. Signature,
declaration and approval fields are excluded. Unsupported controls remain manual.
Mappings are separate immutable records bound to the template ID and SHA-256;
forms and saved records pin the chosen mapping ID. New versions never silently
inherit an old mapping. Original byte hashes are verified before mapping and export.

Mapped exports generate field appearances and visible draft/branding/contractor
stamps on every page. Existing page content remains unchanged. Fixed artwork in an
imported template is never rebranded: select authorised matching artwork and review
all fields and overlays. Printable ASCII only; Unicode, overlong values or fields
that need text smaller than 6 points reject rather than silently clip/substitute.
The original download remains byte-identical. Modern/object-stream PDFs require a
reviewed classic blank from the template owner. No Word-to-PDF conversion added.

## Storage and workflow

Personal local library upgrades from the old array to a version-2 envelope on its
next write. Templates and mappings share one atomic localStorage write and one
separate library backup. Account-change and quota failures retain existing data.
Saved mapping selection survives form reload and service repeat. Company/property
changes clear selection. The importer is included in the consent-based offline
shell and isolated fictional preview. No approved Absolute logo was supplied;
existing text branding and explicit Paramount contractor/issuer remain.

## Verification at first checkpoint

- 110 Node tests pass (104 baseline plus six PDF suites), including actual bundled
  forms, encoded/unreachable active content, malformed xrefs, field restrictions,
  overflow/Unicode rejection, original preservation, immutable mapping versions,
  hash tampering, account isolation and storage failures.
- Independent pypdf strict parsing, field appearance/value checks, unchanged page
  content and edit/save/reopen pass for both invoice/quotation and both brands.
- Existing populated/mapped Word, both blank Word files, all 88 PDF fields,
  branded documents, controlled evidence and cryptographic PDF checks pass.
- Chromium startup is blocked by `setsockopt: Operation not permitted` before app
  execution. PostgreSQL binaries are absent. CI retains browser/database checks
  and now runs independent imported-PDF validation. CI result is not yet claimed.

Shared server template ACL/storage/audit work follows separately. Personal storage
is not a hosted team backup. Physical mobile and actual Microsoft Word acceptance,
competent certificate review and approved branding artwork remain required.
