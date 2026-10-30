# Main-app development and recovery report

Repository: `nicholasftes-hue/paramount-fire-app` · 26 October 2026.
Development branch: `paramount-main-app-development`.

## Source audit and consolidation

Inspected main `0e882fb64ece9022e3352f8ad50b06ce6dbefd2c`, all six
pre-existing branch trees, all ten main-history commits and their distinct HTML
files, and open PR #1 / Academy head
`9d980f68203c618590f41616c45f04995526e65d`. The workspace contained no uploaded
V6–V17 project files. No releases were returned. The connector did not permit
the tags endpoint, so tags were not verified.

| Source | Evidence / result |
| --- | --- |
| backup-original-app | `b4e35b91…`, VERSION 6, original local service/PAT/lighting/planner/job-pack/quote prototypes |
| backup-before-dashboard | `12167912…`, VERSION 7 TEST, adds separate Supabase property test |
| backup-before-new-home | Same commit and files as backup-before-dashboard |
| backup-26-october | `691b9bb9…`, white V9 dashboard and loader |
| main | `0e882fb6…`, same service-app logic plus six static Academy subject cards |
| PR #1 | Working Academy module, six draft lessons, four document templates, consent-based offline shell and tests |

V6, V7 and V9 labels are evidenced by the source. Separate V8 and V10–V17
application packages were not found in the inspected branches/history/files.
SVG path text such as `V13` / `V17` in old logos is not a version label.
Features requested from unavailable versions are treated as requirements, not
claimed as recovered code. Any original external ZIPs, design notes or chats
remain a future comparison source.

This branch starts at the exact PR #1 head. Its separate PR targets
`paramount-academy-update` so the Academy changes appear only in PR #1, rather
than being copied into another diff. Neither branch is merged into main.
The new workflows are an external module; the entire original inline app script
still matches the hash of main. Existing service/quote records remain visible
under preserved prototype sections and in property history. New forms replace
the primary service/quote/planner entry points instead of adding duplicate tabs.

## Feature status

“Implemented” below means a development draft workflow, not production approval.

| Feature | Before this branch | Current development result | Still needed |
| --- | --- | --- | --- |
| Fire alarm servicing | Basic engineer/date/battery/device/notes local form | Detailed scope, actual results, measurements, defects, actions, handover and declaration; reviewed drafts, editable revisions and PDF previews | Approved certification template, competent technical review, signatures and controlled issue |
| Extinguisher servicing / registers | Not found | Asset/serial/location/model/type/capacity, service type, actual checks/outcome, defects and next date; per-property history | Manufacturer/standard-specific checklist approval, QR scanning, batch-register export |
| Installation / commissioning | Not found | Stage-specific draft record with design/drawing references, devices, measurements, variations and handover | Approved schedules of tests, responsible-party signatures and compliant certificates |
| Scheduling / reminders | Local due-date/postcode grouping prototype | Engineer/time/duration visits, overlap prevention, status, overdue/upcoming and follow-up lists; original planner preserved | Unattended email/SMS, delivery logging, route optimisation and calendar integration |
| Customer enquiries / office | Dashboard mock summaries, no enquiry workflow | Office dashboard, customer/contact/site/owner/status/follow-up records, call-out and document counts | Public intake endpoint, permissions for office teams and delivery integrations |
| Call-outs / defects / repairs | Free-text service observations only | Priority/status, affected equipment, observed defects, actions, follow-up and revision history | Assignment notifications, parts stock and verified closure policy |
| Quotations / invoicing | Local materials/labour quotes, job-pack draft invoice; PR #1 blank templates | Numbered itemised drafts, integer-pence totals, VAT checks, unique document numbers, quote-to-invoice preparation, billing/terms, editable revisions and PDF previews | Controlled issuing, numbering across teams, payments/credit notes, exact branded-template merge and accounting integration |
| Voice dictation | Not found | Optional browser speech recognition, explicit audio-provider notice/consent, stop control, transcript and mandatory review reset | Real-device accuracy/privacy acceptance; provider support varies |
| SmartCell library / guides | Not found | Model/revision-specific equipment-reference records and HTTPS guide links | Verified official SmartCell manuals/content/licensing; no procedures invented |
| Drawing Studio | Not found | Saved editable rectangle/marker layouts with validation, live SVG, legend/limitations, revisions and draft PDF | Touch dragging, scaled CAD/imports, backgrounds, layers and site-survey approval |
| Training Academy | Static on main; working in PR #1 | PR #1 retained without copying/replacing lessons; links from workflows and original navigation remain | Remaining planned subjects/levels, assessed competency and cloud learning records |
| Property history | Separate local tables | Combined new forms/quotes/invoices/visits/defects/equipment/drawings and read-only legacy records per property | Shared cloud property IDs and attachments |
| Mobile workflows | Responsive prototype | Large controls, single-column forms, persisted unfinished drafts, narrow-layout browser suite | Physical Samsung / Samsung Internet acceptance and PDF-editor save checks |
| Cloud records | Supabase auth + separate dummy-properties test | Optional manual immutable account-owned snapshot upload/list/download, additive JSON restoration, review-only RLS SQL | Owner-approved schema setup, runtime RLS tests, live sign-in acceptance, automatic synchronisation/team access |

## Data, safety and release boundaries

- No production sign-in, customer-data read/write, schema execution, credential
  change, merge or deployment was performed. Existing Supabase code is unchanged.
- New records and drafts use `paramount-main-app-v1:<account-id>`; guest storage
  is explicitly shared on the device. Existing prototype storage is unchanged
  and is still device-wide, not made private by the new module.
- Local backups contain customer/engineering data and should be stored securely.
  They exclude authentication tokens. Export the workspace and the separate
  existing-device backup. A source-code ZIP does not back up live Supabase data.
- Corrupt storage is not silently replaced. Raw backup recovery is available.
  Saves append revisions, reject stale revisions and preserve concurrent appended
  records in normal sequential browser-tab operations. LocalStorage is not a
  transactional multi-user database; truly simultaneous cross-tab writes remain
  a limitation. Use one editing tab until database-backed record sync is built.
- Import is additive and account-bound. Conflicting existing records are rejected
  atomically. Exported unfinished forms are retained for manual recovery and do
  not overwrite current forms on import. Legacy properties must already exist.
- SQL is review-only. Applying it is a separate owner-controlled action. It adds
  only `main_app_snapshots`, enables/forces RLS, grants authenticated SELECT/INSERT
  for the matching user, and supplies no application UPDATE/DELETE policy.
- Documents remain conspicuously DRAFT / NOT ISSUED / NOT A COMPLIANCE CERTIFICATE.
  Review checkboxes are neither digital signatures nor evidence of competence.
  No alarm reset, silence, isolate, control or commissioning commands exist.
- No automated reminders or messages are sent. Manufacturer instructions are
  referenced only when entered and verified by a competent person.

## Validation and reproducibility

Local Node checks passed: nine new business/persistence tests (pence/VAT,
invalid dates, required review/scope, drawing bounds, document-number uniqueness,
overlapping visits, account isolation, corrupt storage, additive/conflicting
imports, immutable revisions and stale-edit rejection); Academy lesson and loader
checks; all original lesson hashes; inline-app preservation; JavaScript syntax.

The complete local `npm test` cannot pass because this connector-only checkout
cannot download the six pre-existing binary icons/templates. Those unchanged
blobs are retained by SHA in the remote Git tree. The two remaining local test
failures are missing asset checks, not suppressed tests. Binary/document checks
must be read from the remote workflow on the delivered commit.

Local real-browser execution was attempted and blocked before testing by
`listen EPERM` / Python socket `PermissionError`. No local mobile/browser pass
is claimed. Read-only GitHub Actions runs both the preserved Academy browser
suite and the new main-app suite against local fictional fixtures, with external
service requests blocked and no deployment steps or application secrets.

The new browser suite covers all ten record types, saving/reloading, quote to
invoice, draft printing and totals, edits/revisions/escaping, overlap errors,
property history, unfinished forms, account changes, backup downloads and
320/360/412px plus landscape layouts. See the PR checks for actual results.

Commands: `npm test`, `npm run test:browser`, `npm run test:main-browser`,
`python tests/templates.py`, `python tests/academy-browser.py --browser chromium`.
Use Node 24 and the pinned dependencies in package.json. Browser suites accept
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

The workflow creates a complete `git archive` source ZIP and SHA256 checksum as
an Actions artifact. GitHub also offers a complete ZIP at
`https://github.com/nicholasftes-hue/paramount-fire-app/archive/<commit-sha>.zip`.
Use the exact delivered commit from the separate PR, not a moving branch, for
the backup. Restore into a separate directory/origin and never overwrite live
customer records from a source archive.

Release gates still open: owner approval; passing remote checks; competent fire
engineer review of forms and certificate requirements; physical-device and
PDF-editor testing; runtime Supabase/RLS acceptance in an isolated test project.
