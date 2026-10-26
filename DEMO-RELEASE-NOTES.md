# Mark demonstration candidate — 27 October 2026

This is a **development candidate**, not a published website or a certified fire safety system.

## Source and verification
- Demo branch: `mark-demo-2026-10-27`, cut from development commit `d5001256b6ef047f324816810981090a7db1b3c8`.
- GitHub Actions `Main app and Academy checks` passed on that source commit: https://github.com/nicholasftes-hue/paramount-fire-app/actions/runs/40382513517
- This document-only commit does not change application code.
- Existing GitHub Pages site and production `main` remain untouched.

## Demonstration scope
- White dashboard and property records
- Fire alarm servicing draft and saved revisions
- PAT appliance test draft and emergency lighting test draft
- Draft quotation and invoice workflow, PDF previews
- Visit planner and on-screen 30/7-day follow-up summary
- Academy training subjects, lessons and quizzes

## Preview hosting decision
GitHub Pages ordinarily exposes one configured published site per repository; switching its branch to this demo branch would modify the existing live site. **Do not do that.**

To enable a separate phone-accessible preview, configure an isolated preview deployment (e.g. a distinct Pages repository or external static hosting project) with test-only credentials, no production Supabase write access, and separate storage/origin. Check that the current CSP, service worker, manifest and absolute paths work on the chosen host. No preview URL is claimed until a real deployment succeeds.

## Safety and remaining work
Use only fictional properties and results. Local draft records are not shared across staff phones. Do not use live certificates, production credentials, real customer data or fire panel controls. A competent fire engineer must review technical forms before real use. Physical Samsung tests and preview-host testing remain outstanding.

## Walkthrough
See `MARK-DEMO-GUIDE.md` for the ten-minute demonstration and acceptance questions.
