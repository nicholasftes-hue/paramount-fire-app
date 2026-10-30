# Paramount Fire Protection — development acceptance checklist

Status: DEVELOPMENT ONLY. This checklist does not authorise merging, deployment, database changes, or sending customer documents.

## Phase 1 — engineer field workflow
- [ ] On Samsung Internet, sign in with a test account and choose a fictional HMO property.
- [ ] Start a fire alarm service, enter actual inspection and measurement results, record a defect and save an unfinished draft.
- [ ] Reload the app and confirm the draft is retained, with no other user's records exposed.
- [ ] Complete the draft, review the PDF preview and ensure it is clearly marked NOT ISSUED / NOT A COMPLIANCE CERTIFICATE.
- [ ] Confirm a competent fire engineer approves the technical content and any future issued certificate format.

## Phase 2 — quote, invoice and office handover
- [ ] Convert a fictional defect/job into an itemised quotation, check pence/VAT rounding and revise it.
- [ ] Prepare an invoice from an accepted quote without accidentally issuing or emailing it.
- [ ] Confirm unique numbering under simultaneous users before enabling real document issue.
- [ ] On an office laptop, test enquiries, job statuses, property history and follow-up views.

## Phase 3 — shared data and recovery
- [ ] Back up source code separately from customer data; verify both can be restored to isolated test environments.
- [ ] Review snapshot SQL and policies with the owner before applying to an isolated Supabase test project.
- [ ] Verify authenticated per-account isolation, cross-user sharing requirements, offline behaviour, conflict handling and audit history.
- [ ] Do not enable automatic cloud sync until these tests pass; existing local legacy records are device-wide.

## Phase 4 — device and release gates
- [ ] Run full Node, browser, Academy and document checks on the final commit.
- [ ] Test physical Samsung/Samsung Internet, home-screen PWA installation, offline/online transitions, PDF download and printing.
- [ ] Check dictation consent, actual device support, transcript review and privacy.
- [ ] Obtain competent fire-engineer review and explicit owner approval before any merge or live deployment.
- [ ] Make a rollback plan, record the exact release SHA and confirm the live app's existing customer data remains untouched.

## Deferred features — do not mistake for finished
- Automatic email/SMS reminders, shared cloud editing, production permissions, electronic signatures, compliant certificate issue, verified SmartCell manuals, scaled CAD drawings and unattended communications.

This checklist supplements MAIN-APP-PROGRESS.md. PR #2 remains stacked on PR #1; do not retarget or merge without review.

## 30 October continuation — no launch approval

Use DEVELOPMENT-2026-10-30.md for current implementation and validation status.
Physical mobile/Word and competent-person review now have explicit acceptance
packs. ISOLATED-RECOVERY-AND-DELIVERY-ACCEPTANCE.md separates automated synthetic
checks from still-pending hosted/inbox acceptance. Shared engineer/office mapping
and scoped cache are implemented in the isolated entry point; production scanner
promotion enforcement, full offline shell acceptance and real operational restore
remain open. Main/production/live/demo are not release targets for this work.
