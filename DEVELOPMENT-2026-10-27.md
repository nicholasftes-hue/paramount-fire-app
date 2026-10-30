# Property database, service records and draft PDF continuation

Work stays on `paramount-main-app-development`, continuing PR #2. Inspected the
branch source/tests and open PRs #1, #2 and #3. PR #3 is separate engineering/demo
work and was not merged or copied. The separate demo repository is untouched.

## Changes

- Search and edit local property names, addresses, postcodes, panels and contacts;
  add properties with UUIDs. Validate service dates/intervals. Read fresh storage
  before writes, preserve schedules, settings and all unrelated records, and
  reject stale edits or corrupt storage. Properties retain the original shared
  device storage and identifiers; no database migration or cloud calls occur.
- New service saves capture site details. Later property renaming cannot alter
  those saved details. Revisions retain earlier values; changing the linked site
  captures that site's details for the new revision. Old records stay readable;
  their PDF explicitly identifies the absence of an original snapshot.
- Optional battery voltage/capacity readings are validated and preserved when
  reopening; older records do not require these fields.
- Download a real, paginated PDF directly from a saved reviewed service, including
  results, limitations, handover, declaration, record reference and revision.
  Each page says DRAFT / NOT ISSUED / NOT A COMPLIANCE CERTIFICATE. No pop-up,
  external rendering service or dependency is needed. This basic Courier export
  displays non-ASCII characters as visible U+ codes. Existing browser print
  preview retains original Unicode text. Approved templates, controlled issue
  and signatures remain outstanding; no issued certificate is claimed.
- Shell cache version advances with the existing explicit update-consent policy.

## Validation

Local `npm test`: 31/33 pass. The two failures are missing pre-existing binary
icons/templates in the connector-only text checkout. Remote blob SHAs are left
unchanged, and no fixture substitutes or suppressed checks were introduced.
All 12 main-app persistence/business tests pass, including property saving and
reopening, stale-write/corrupt-storage protection, service snapshots, battery
readings, immutable revisions and multipage PDF byte/xref validation. Original
inline application, Supabase/auth code and original Academy lesson preservation
checks pass. Syntax and whitespace checks pass. `pdftotext -layout` independently
parsed the three-page fictional PDF and retained its final device/defect text.

Local browser execution is blocked at server startup by `listen EPERM` on
127.0.0.1. Expanded the existing isolated Chrome suite with property edit/search/
reload, service edit/reopen, snapshot preservation and direct PDF download, plus
property layout and PDF downloads at 320/360/412px and landscape. External service
requests remain blocked. CI also independently parses both generated PDFs using
pypdf. Check the exact commit's Actions result for current browser outcome.

## Boundaries and blockers

No production Supabase access, schema/configuration change, customer data read or
write, merge, deployment or main-branch change. Only fictional test records were
used. Properties remain device-wide and services account-scoped; automatic cloud
sync and team database access remain future work. LocalStorage is not a database
transaction; truly simultaneous writes remain a limitation. Physical iPhone,
Samsung/Samsung Internet, Safari and native PDF save/share require device testing.
Approved certificate content/signatures require competent technical review.
