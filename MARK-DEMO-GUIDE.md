# Paramount Fire Protection — Mark demo and testing plan

**Target:** 27 October 2026. **Status:** development candidate only. No deployment or production database changes authorised.

## Before anyone opens the demo
1. Confirm GitHub Actions checks pass on the exact demo commit (Academy, main app, documents, browser).
2. Confirm the test branch is hosted separately from production (or use a local preview); **do not** change GitHub Pages' production branch just to show the demo.
3. Use fictional names, addresses and test results only. Do not use real customers, real passwords or live certificates.
4. Confirm the demo starts with an empty isolated test workspace and has a working reset/back-up process.
5. Mark all report and invoice previews **DRAFT / NOT ISSUED**.

## Ten-minute walkthrough
- **Minute 0–2:** White home dashboard; choose a fictional property; explain which records are local and which are cloud-backed.
- **Minute 2–4:** Fire service form: enter engineer, panel, actual test readings, limitations and a defect. Save and reopen draft.
- **Minute 4–6:** PAT Testing: record one fictional kettle with asset number, class, readings and outcome. Then show emergency lighting and a duration-test draft.
- **Minute 6–8:** From the saved service or PAT record, select **Prepare quotation**; review job reference and observations; enter dummy line items and prepare an invoice from a saved quote. Show DRAFT preview.
- **Minute 8–9:** Show planner, 30-day/7-day on-screen follow-ups, and office enquiries.
- **Minute 9–10:** Show Academy fire and CCTV lessons and quizzes; ask Mark for three improvements.

## Acceptance notes to capture
- Can an engineer use the forms one-handed on a Samsung without zooming?
- How many taps does it take to record ten appliances?
- Are the required technical fields and result choices appropriate? Mark or another competent fire engineer must review them.
- Can the office understand what is unfinished, ready for review or still needing approval?
- Does draft information survive closing/reopening the app?
- Does a printed PDF fit and display clearly?
- Are data separation and offline warnings understandable?

## Known limitations
No production-ready cross-user sync, automated SMS/email reminders, compliant certificate issuing, electronic signing or real Samsung test has yet been verified. PAT and emergency lighting forms currently record one asset/test record at a time; rapid multi-appliance entry is a further improvement. Avoid treating draft records as certified results.

## Release decision
**No merge, GitHub Pages switch, customer data migration or Supabase schema change without explicit approval after successful tests.** If checks fail, demonstrate only the previously verified sections or defer the demo; never call a failing build ready.
