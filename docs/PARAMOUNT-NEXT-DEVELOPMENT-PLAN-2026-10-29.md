# Paramount development review and implementation plan

Date: 29 October 2026. Reviewed baseline: `ebdcb0b7d4660df05ec35c46432b70cf3361f0d4`.
Status: specifications and test plans, not implemented application features.
Scope: isolated development only. Do not merge, deploy, publish, change main, production Supabase, the live app or Mark's demo.

## Evidence and limits

Read directly using the connected GitHub integration: the complete baseline tree, PR #2 metadata, main-app.js, academy.js, document-templates.js, tests/original-lessons.json, tests/README.md, .github/workflows/academy-checks.yml, academy-training-next-draft.md and TEMPLATE-BRANDING-VISITS-DEVELOPMENT.md.
The tree contains no AGENTS.md. PR #2 was open, draft and unmerged at the stated baseline when inspected.
This document is on a separate branch based on that exact commit. PR #2's branch, title, description and status were not changed.

Direct UTF-8 source reads succeeded. This review did not recover or execute the complete application, browser fixtures or document binaries. No proxy retries, production connections or manual user transfers were needed.
Source observations below are static review findings; proposed features and acceptance criteria are not test results.
The older training draft is substantially represented by fire-servicing and cctv-diagnosis already; do not add duplicate versions of those lessons.
tests/README.md still describes six quizzes and older counts; update it to match the actual 22-lesson suite when the next tested runtime change is made.

## Priority 1: existing functionality and improvements

| Area | Observed baseline | Proposed next increment |
| --- | --- | --- |
| Fire alarms | Structured device rows, unique identities, zone/address, results, readings, defects/actions; grouped branded draft Word/PDF/print output | Capture scope and test-method evidence per device, expected versus actual interface response, restoration and limitations as structured fields; reconcile summaries against rows |
| Batch PAT | Existing/preloaded repeat registers, unique IDs, Pass/Fail/Not Tested buttons, clone with new identity, actual readings and defects; repeats reset results | Compact appliance cards, search/scan by ID, location groups, next-untested navigation, structured method/units and instrument context; preserve large-register responsiveness |
| Emergency lighting | Per-fitting rows, duration, functional/duration test types, actual-duration validation and repeat resets | Separate rated and observed duration visibly; start/end and interruption evidence, inaccessible reasons, restoration/charging state and follow-up responsibility |
| Extinguishers | Batch IDs, serial/model/type/capacity/location, manufacture/prior service, readings, result, actions and next date | Type-specific reviewed inspection checklists, missing/removed asset lifecycle, remedial/replacement tracking and discrepancy report |
| Office and documents | Enquiry/call-out counts, quotes/invoices, planner, follow-ups, built-in Word/PDF, local versioned template library, separate controlled delivery modules | Searchable review/action queue, exact-revision document packs, explicit delivery states and office ownership; retain controlled-issue permissions |
| Property/repeat visits | Property overview/history/registers, last completed register reuse, whole-visit draft preparation, explicit visit IDs and source provenance | Asset reconciliation before repeat, visit selection without typing IDs, location filtering and clear current-versus-historical state |

### A. Mobile servicing workflow (first runtime increment)

Entry path: property -> choose visit or prepare new visit -> choose service -> reconcile preload -> work through assets -> review exceptions -> save draft -> office review.
Use an existing explicit visit ID or allocate one new UUID for a new visit; never group separate same-day visits by date.
Show property, visit, service and save status in a compact persistent header. Do not equate a local save with server sync or approval.
Retain complete forms as a details view. The working list shows asset ID, short description/location, result and exception count; stable details collapse until requested.
Use at least 44px result targets, visible text, aria-pressed, keyboard access and focus that remains on the selected asset.
Fail opens/focuses defect entry. Pass never inserts readings, signatures, review or completion. Next untested is explicit; a result tap must not unexpectedly change focus.
Filters: all, not tested, failed, exceptions and location; show counts for the entire register and the filtered subset separately.
Search exact/partial asset IDs and descriptions. Optional camera scanning must also have manual entry, explicit permission and duplicate-ID handling.
Save through existing draft persistence; show saving/saved/error accurately. On quota failure, retain in-memory work and provide recovery export without claiming it was saved.
Render large lists incrementally only after measuring the 100/500/1000-row fixtures; preserve off-screen edits and accessible navigation.
No bulk Pass. Copying equipment copies stable identity/specification only.

Preload reconciliation: display source record/revision/date/visit and compare retained, new, missing and removed items.
A missing asset stays visible for reconciliation until the engineer records its disposition; an explicitly removed asset must not reappear from an older register.
Do not add new row fields directly to existing serialized equipment: equipmentRows currently rejects unknown fields. Introduce a reviewed additive schema and importer/exporter migration first.
Use the existing Not Tested result with a separate future limitation reason, rather than silently converting inaccessible items to Pass.
Current Completed validation rejects any Not Tested row. A future closed-with-limitations state requires an explicit domain/schema decision and tests; do not weaken that validation incidentally.

Acceptance: reopen a partially completed fictional visit after reload; all entered values survive and source history is byte-identical. Two same-day visits never share assets accidentally.
At 320/360/412px there is no page-level horizontal scrolling, controls work with keyboard and results remain legible without colour.
Measure time and taps for 20 preloaded assets before and after; target fewer navigation actions without removing evidence fields. Report measurements, not an assumed speed gain.

### B. Engineering evidence and professional reports

Fire: record exact panel identity/manual reference, agreed scope, per-device identity and actual evidence, cause-and-effect references, outstanding defects, impairment/restoration and recipient.
Treat zone+loop/address as structured identities with model-aware validation; review current address uniqueness rules against actual loop addressing before changing them.
PAT: retain instrument/calibration per visit; add per-asset class evidence, method, actual measurement with units, selected limits and their reference, visual finding and disposition.
A quick Pass remains an engineer-entered result, not automatic calculation from unspecified readings. A competent reviewer must approve any future automated limits.
Lighting: retain fitting identity and test type; distinguish rating from observation, partial/interrupted tests, defects, restoration and recharge/protection handover.
Extinguishers: retain serial/model/type/capacity; add reviewed applicability for each checklist item rather than universal tasks or assumed servicing intervals.
All: record who was notified, when, agreed action/owner and target date. Report totals from rows; mixed results cannot become a whole-system pass.
Do not infer compliance from Completed, a signature, branding, a clear panel or an Academy quiz.

### C. Office dashboard

Default queue columns: property/customer, visit, service/document type, record/reference/revision, owner, work state, review state, due/follow-up date, defect count, delivery state and last update.
Queues: today/unassigned, drafts needing information, ready for review, returned for correction, approved for controlled issue, delivery failed/pending and overdue actions.
These are proposed queue states; map them to existing controlled-issue/delivery schemas before implementing, rather than creating a conflicting approval model.
Filters: company branding, property, engineer/owner, service, date range and state. Search references, property name/postcode and asset IDs; paginate large results.
Counts and lists must use identical predicates and authorised scope. Never label every stored quote/invoice a draft without checking its actual lifecycle.
Selecting a row opens the exact revision and its missing-evidence checklist. Assigning or changing state uses the existing permission model and concurrency protection.
A pack contains explicit linked visit records plus a manifest of record IDs/revisions/digests. Legacy unassigned records require deliberate selection; no date-based inclusion.
Delivery: generated, downloaded, queued, provider accepted, failed and acknowledged remain distinct. Offline exports cannot be remotely recalled.
Office acceptance uses fictional users in isolated role/database fixtures; no new live sender, public form or automatic email is configured.

## Priority 2: Academy review

academy.js defines 22 lessons across six subjects. Most contain six questions; fire-basics and cctv-basics have three, fire-ctec and cctv-faults have two.
Intermediate/advanced lessons contain useful scenarios but often repeat generic distractors and the same three exercise steps. Replace repetition with subject-specific evidence packs and credible wrong answers.
Existing progress uses sessionStorage key `paramount-academy-session-v1:<account-or-guest>`, keyed by lesson ID with revision and passedAt; it is tab/session scoped, not a staff competency database.

### All 22 lessons: preservation and enrichment matrix

| Stable ID | Existing title | Questions | Proposed enrichment |
| --- | --- | --- | --- |
| `fire-intermediate` | Planning a documented cause-and-effect review | 6 | Supply a small fictional cause-and-effect matrix with expected and actual columns; ask learners to identify an untested interface. |
| `fire-advanced` | Evaluating conflicting fire-system evidence | 6 | Give two conflicting witness sheets and a worked successor-revision example; assess the precise unsupported claim. |
| `cctv-intermediate` | Tracing an authorised recording fault | 6 | Use a fictional recording schedule, playback timestamp and storage alert; ask which evidence distinguishes schedule, permissions and storage causes. |
| `cctv-advanced` | Reviewing CCTV changes and retention | 6 | Add a worked storage estimate with stated bitrate/unit assumptions, capacity uncertainty, measured acceptance and rollback criteria. |
| `electrical-intermediate` | Reviewing PAT evidence without inventing results | 6 | Provide a fictional tester report with missing method/units and a worked correction request; do not invent measured readings. |
| `electrical-advanced` | Managing ambiguous electrical safety evidence | 6 | Use two reports with similar asset names but different IDs; assess whether records actually conflict before escalation. |
| `intruder-intermediate` | Building a secure intruder fault handover | 6 | Supply fictional local/remote event timestamps and ask which evidence is still needed from the authorised monitoring contact. |
| `intruder-advanced` | Assessing a security-system change proposal | 6 | Add a change-impact worksheet with protection dependencies, rollback and authorised acceptance. |
| `lighting-intermediate` | Reconciling luminaire-level test evidence | 6 | Provide six fictional fittings: pass, fail and inaccessible cases; require accurate totals and explicit limitations. |
| `lighting-advanced` | Reviewing emergency-lighting recovery plans | 6 | Add a premises-specific test/recovery planning exercise with occupancy, protection, restoration and responsible owners. |
| `skills-intermediate` | Writing a testable fault hypothesis | 6 | Add a hypothesis table with predicted observations and stop conditions; assess evidence quality rather than confidence. |
| `skills-advanced` | Auditing a completed job pack | 6 | Supply a revision/issue/receipt timeline and ask which exact document the customer received. |
| `electrical-safety` | Electrical safety: boundaries, evidence and escalation | 6 | Add a dedicated PAT companion: asset identity/class evidence, visual findings, selected competent test method, instrument/calibration, readings/units and disposition. |
| `intruder-basics` | Intruder alarms: components, access and handover | 6 | Add a labelled component diagram and redacted handover example without codes or access routes. |
| `lighting-basics` | Emergency lighting: system types and factual test records | 6 | Add a fitting-by-fitting functional versus duration worksheet, rated versus observed duration, restoration and recharge handover. |
| `skills-diagnosis` | Engineer skills: systematic diagnosis and clear handover | 6 | Replace the repeated generic exercise with a worked ticket showing two hypotheses and the evidence that discriminates between them. |
| `fire-basics` | Fire alarms: systems, components and safe observation | 3 | Add an annotated fictional zone chart and an exercise distinguishing zone, circuit and address. Ask learners to trace one reported event through the documented signal path. |
| `fire-ctec` | C-TEC conventional panels: identify before acting | 2 | Add a CFP-specific companion after exact model/manual verification: preparation checklist, labelled indication examples, symptom/evidence matrix and supervised restoration worksheet. Expand the two-question quiz with plausible model-specific alternatives. |
| `cctv-basics` | CCTV from the beginning: camera to recording | 3 | Add a supervised installation planning worksheet: compatible camera/recorder, cable route, power/PoE budget, coverage/privacy and handover evidence. |
| `fire-servicing` | Fire alarm servicing: planning, records and supervised review | 6 | Provide a completed fictional visit pack, ordered engineer checklist, scope/device reconciliation, unresolved impairment handover and reviewer checklist. |
| `cctv-diagnosis` | CCTV diagnosis: symptom, scope, evidence and escalation | 6 | Add an evidence-led decision tree and example ticket showing observation, hypothesis, approved check, result and escalation. |
| `cctv-faults` | CCTV: safe first checks and fault reporting | 2 | Expand the two questions with one-channel/all-channel/remote-only cases and credible alternative next checks. |

### New companion syllabus: C-TEC CFP

Do not replace fire-ctec or its existing progress. Proposed new ID: fire-cfp-practical.
Prerequisites: fire-basics, fire-ctec and fire-servicing knowledge; supervised practical competence is separate.
Authoring gate: verified exact CFP variant, official user/maintenance manual title/revision/page references, site configuration and competent technical reviewer.
Ordered lesson: identify model -> gather site evidence -> agree authorised scope and impairment arrangements -> document initial state -> supervisor-led applicable inspections/tests -> record actual findings -> verify restoration -> handover limitations and actions.
Each practical step needs purpose, prerequisites, exact verified manual reference, expected observation, actual-evidence field and stop/escalation condition.
Fault cases: zone fault indication; power/battery-related indication; disabled function; intermittent report with no current indication.
For each, supply fictional indication evidence, competing causes, what the indication cannot prove, authorised next evidence and restoration acceptance. Do not diagnose a failed component from a label alone.
Six short questions should cover model applicability, required site coordination, evidence distinction, missing manual, unresolved impairment and restoration.
Worked example: a prior report says all devices passed but the current scoped list leaves device F-07 untested; learner produces a limited factual handover.
No invented control sequences, wiring, battery limits or universal test intervals; verified manufacturer procedures and competent review are outstanding dependencies.

### New companion syllabus: EMS SmartCell

Proposed ID: fire-smartcell-introduction; retain all existing IDs and results.
No dedicated EMS/SmartCell lesson is present in the reviewed 22. The main app's equipment library asks for exact model and verified manual instead.
Authoring inputs: exact panel/device variants, firmware applicability, verified official EMS documentation and competent review.
Steps: identify system/components -> compare device inventory/locations with approved records -> capture exact panel/device events and timestamps -> distinguish battery/radio/communications hypotheses using documented evidence -> plan authorised supervised checks -> record outcome/restoration and remaining impairment.
Exercises: fictional intermittent device communication ticket; incorrect location label; battery-related warning with incomplete evidence.
Quiz examples: does a current normal indication prove an intermittent fault resolved? No. Is a communications warning proof of a flat battery? No; investigate using model-specific evidence.
Use actual verified vocabulary and screenshots only after source/licensing review. Do not invent signal thresholds, battery substitutions, enrolment/reset sequences or radio planning rules.

### PAT, lighting and CCTV practical companions

PAT new ID electrical-pat-procedure: identify asset -> determine class from evidence -> inspect under competent procedure -> select justified method/instrument -> perform authorised testing -> enter actual readings/units -> record result/defect/disposition -> label and hand over under reviewed procedure.
Example: preloaded kettle A-012 has last year's Pass; current visual defect means the new record must reflect today's evidence, with no copied measurements.
Lighting companion: plan type/scope and protection -> reconcile fitting list -> authorised test -> record observed duration and individual outcomes -> restoration/charging observations -> exceptions and handover.
Example: fitting L-03 illuminates briefly; this does not establish its rated duration.
CCTV companion: requirements/privacy -> site/cable/power design -> compatibility/PoE/storage calculation -> authorised installation/configuration -> live and playback checks -> secure remote access -> customer handover/rollback.
Example: local image works but playback is absent on one channel; investigate schedule, time/access and storage evidence without formatting or changing other channels.
Technical procedures and numeric acceptance criteria must cite verified applicable documents; these are authoring outlines, not released work instructions.

### Progress and quiz compatibility

Preserve all lesson bodies, stable IDs, ordering/navigation and existing passedAt/revision records when adding companions.
Prefer additive companion lessons so a new practical syllabus cannot silently rewrite what an old pass represented.
If editing an existing quiz, introduce a content revision with explicit historical-pass display; do not erase or automatically upgrade old passes.
Never change the sessionStorage namespace or migrate it to cloud/local persistent staff records as part of content enrichment.
New exercises use fictional evidence. Practical assessment stores supervisor/date/rig/tasks/feedback separately only after a separately designed permission/retention model.
Quizzes: 4–6 focused questions, plausible distractors tied to misconceptions, balanced answer positions, explanation for every option, retry and no completion on partial answers.
Reference blocks must identify document title, revision, applicability, reviewed date and reviewer; existing generic manufacturer homepages do not verify a practical procedure.

## Priority 3: document and company architecture

### One certificate layout model

Create a pure presentation model from a record snapshot: identity, branding profile/version, actual contractor/issuer, site snapshot, visit, scope, equipment/results, limitations/defects/actions, restoration, review/acknowledgement and provenance.
Produce Word, PDF and print adapters from the same ordered sections and labels. Keep domain validation outside layout functions.
Layout: A4, branded header, clear document type/status/reference/revision, compact site/system table, scope/method, repeatable asset table, conspicuous exceptions, restoration/handover, declarations and page footer.
Repeat table headings on new pages; keep individual short asset rows together, split very long narratives safely and retain all text. Never shrink to unreadable type to force one page.
Footer: reference/revision, page X of Y and draft/issued state. Signature and customer receipt meanings remain explicit.
Snapshot template/profile version and issuer details at issue; rebranding never rewrites historical documents.
Acceptance corpus: no assets, one asset, 100/1000 assets, long defects, Unicode, multiline addresses, missing optional data, both brands, mixed results and page boundaries.

### Paramount and Absolute profiles

Baseline supports Paramount and Absolute Property Surveys as branding choices, but retains Paramount contractor and draft issuer; Absolute artwork is absent.
Future profile fields: immutable ID/version, display name, approved logo asset/hash, colours, postal/contact details, legal entity/registration/VAT fields where applicable and approved footer.
Keep branding/issued-for, contractor, issuer, customer and property as separate identities. Selecting Absolute must not invent a legal issuer or VAT number.
A brand profile is presentation, never authorisation. Template eligibility, workspace ownership and issue roles need server-enforced checks.
When artwork/details are unavailable, retain explicit text branding and missing-detail validation; no guessed logo, signature, accreditation or company identity.
Test profile switching, repeat visits, quote conversion and historical outputs; verify no cross-company template leakage.

### Future fillable PDF mapping

Baseline uploaded PDFs remain unchanged manual-completion downloads; existing blank quotation/invoice form PDFs do not imply arbitrary imported PDF mapping.
Use a maintained PDF parser to inspect AcroForm field names/types, flags, export values and appearances in an isolated processor. Regex checks are not a PDF security boundary.
Support reviewed text, checkbox, radio and choice mappings first. Reject or explicitly mark unsupported XFA, encryption, signatures, scripts/actions and malformed documents.
Mapping identity: template version/hash + mapping version + field path/type + source field + format/unit + required policy + checkbox export value + overflow policy.
Do not map signatures, approvals or declarations automatically.
Preview unresolved required fields and overflow before generation; missing fields fail visibly rather than silently truncate. Flat/scanned PDFs remain unsupported.
Keep original bytes immutable. Generate a distinct draft; record input/mapping/output hashes and renderer version. Flatten only a deliberate final output after verifying appearances; keep an editable draft if required.
Tests: nonstandard checkbox export names, multiline/Unicode, duplicate/unsupported fields, read-only fields, malformed inputs, fonts/appearances, save/reopen in independent readers and pixel render checks.

### Future Word-to-PDF conversion

Built-in Word/PDF exports are separate renderers; an imported DOCX is not currently converted to PDF.
Use an isolated, version-pinned conversion worker with approved fonts, no outbound network, bounded CPU/memory/time and temporary-file cleanup.
Queue immutable DOCX input hash + template/mapping/profile versions + source record revision; enforce workspace ACL at submit and download.
State machine: queued -> converting -> succeeded or failed/cancelled. Retry idempotently; never silently substitute a built-in layout after conversion failure.
Retain editable Word, original template and distinct PDF output with provenance. Conversion cannot issue/sign a certificate or change its approval state.
Golden corpus: section breaks, headers/footers/page fields, tables across pages, logos, Unicode, long text, split placeholders and unsupported features.
Compare page counts/text and rendered layout; perform actual Microsoft Word and target PDF-reader acceptance before claiming layout fidelity.
Shared template storage/ACL/audit must precede shared conversion or mapping; local library checks alone do not secure server processing.

## Delivery sequence and test plan

1. Documentation (this change): commit this review only on the planning branch. No runtime or CI/deployment files change.
2. Mobile increment: compact existing cards/filter/next-untested using current schema; test existing saves/repeats before adding any evidence schema.
3. Academy increment: add verified CFP/SmartCell/PAT companions and stronger evidence packs; preserve all 22 original lessons and session progress.
4. Office increment: implement read-only scoped queues first, then explicit reviewed assignment/actions using existing concurrency/roles.
5. Documents increment: shared presentation model and versioned branding; then isolated PDF mapping/conversion after ACL/storage design.

For each runtime increment run the existing Node preservation, main app, repeat, template, Academy and scoped-sync tests as applicable; retain assertions rather than refreshing baselines to hide regressions.
Browser scenarios: property -> repeat visit -> partial results -> fail defect -> reload -> review -> Word/PDF; same-day separate visits; account switch; offline/reconnect/update consent; 320/360/412/1024px keyboard and focus.
Academy: enumerate all original IDs/bodies, preserve original lesson hashes, all quiz retries, missing-answer rejection, previous/next/back, offline loading and old session progress.
Documents: independently parse generated DOCX/PDF, edit/save/reopen Word tables, verify actual field values and Unicode, render multipage outputs and compare summaries with source rows.
Server features: disposable database/users only; test tenant/company isolation, role denial, stale revision rejection, revocation, idempotent job/delivery retries and exact acknowledged revision.
Security cases: malicious labels/HTML, corrupt backups, duplicate asset IDs, account changes during asynchronous operations, ZIP/PDF limits and unavailable template versions.
Performance: record device/browser, dataset, median interaction/save times and memory; compare baseline and candidate using the same fixture.
Physical Samsung/iPhone, actual Microsoft Word and competent engineering review remain separate acceptance work. They are not claimed complete and require no user action now.

## Validation status and blockers

No application tests were run for this documentation-only change. Prior PR test claims were read as historical context, not rerun or inherited validation.
Direct GitHub reads are available; full local source/dependencies and runtime execution have not been established in this turn. No broken-proxy recovery attempts were made.
Exact CFP and SmartCell official manuals, approved Absolute assets/legal details, competent practical review, future shared template ACL/storage and a conversion processor remain dependencies.
This plan makes those tasks concrete without changing production or asking the busy user to download/upload anything.
