# Paramount isolated preview — 69c45d4

Source: nicholasftes-hue/paramount-fire-app at 69c45d4da2a1c92ba259d7c0507a2fc5f727a0f9. Preview branch: preview/69c45d4-fictional-20261028. This branch contains only the sanitized static app plus verification fixtures; its parent is the requested commit. No changes to main, production Supabase, the live site, or Mark's demo.

The safety transformations reuse scripts/build-mark-demo.py from the existing engineering demo commit 7cb3740fb657739d8de04566349312c42ac81d01: remove original cloud endpoint, key, auth and snapshot handlers; disable voice services; apply self-only connection CSP; separate browser storage and offline cache; add a fictional-data notice and scoped reset. Adapted to retain the latest property editor, forms, PDF font, editable documents, planner and 22 Academy lessons. Blank templates are included.

Fictional data only. Records and unfinished forms stay in this browser. Draft PDFs, quotes, invoices and optional typed draft acknowledgements are not issued documents or verified signing. No backend, cross-device sync, customer email-code verification, email delivery, signing service, signing secret, payments or production credentials are included. Those backend features cannot be exercised in this static preview.

## Publishing — new isolated destination only

The ZIP contains index.html and assets at its root; no build or environment variables are needed. Never upload it to the existing live site or Mark's demo.

1. Download paramount-preview-69c45d4-2026-10-28.zip and unzip it.
2. Sign in at https://app.netlify.com/ and open Projects → Add new project → Deploy manually (Netlify Drop: https://app.netlify.com/drop).
3. Drag the extracted folder containing index.html into the upload area. Create a NEW project; do not select or update an existing project. No Git connection or environment variables.
4. Wait until deployment says Published. Optionally name the new project paramount-preview-69c45d4-20261028 if available. Use the HTTPS URL Netlify actually returns; an intended name is not a verified URL.
5. Open that URL on the phone. Confirm PREVIEW 69c45d4 / FICTIONAL DATA ONLY, no login, and two fictional properties. Do the acceptance checks below before treating it as verified.

Alternative: create a NEW repository paramount-preview-69c45d4-20261028, upload only the ZIP contents at the root of its default branch, then Settings → Pages → Deploy from a branch → default branch / (root). Do not change Pages on paramount-fire-app. Wait for its Pages workflow to succeed and use the URL GitHub reports.

Sites destination reserved but UNPUBLISHED: appgprj_6ae221236f048191b1be9137559e6175. Source Git endpoint could not be reached because proxy:8080 is unreachable from the restricted executor. Do not reuse Mark's Site. Its expected URL is not a verified published URL.

## Verification

Original exact commit: 78/78 Node tests passed. Sanitized preview: 50/50 Node tests passed, using the existing main/Academy/PDF tests with preview storage namespaces and additional isolation checks. All root JavaScript and inline scripts parse; local assets and offline cache references exist. Production endpoint/key, auth/REST clients, email delivery and signing workers are absent. The ZIP includes no SQL, server, .env, tests or Git metadata.

Local browser tests were blocked: HTTP listen EPERM and Chromium setsockopt Operation not permitted. A branch-only GitHub Actions workflow runs the main browser, certificate/mobile and offline/mobile suites with external requests aborted and fictional fixtures. Consult the exact branch head's Actions result and artifacts; passing local unit tests do not establish browser/mobile acceptance. No physical phone testing has been performed.

Acceptance: test 320/360/390/412px portrait and landscape. Navigate every tab and Academy; save/reopen fictional property, service, PAT and lighting records; check required fields, revisions, quotation/invoice totals, planner overlaps, PDF/Word and blank-template downloads; export/restore backup; verify reset affects only this preview. After an online load installs the worker, reopen offline and repeat navigation. Confirm zero external service requests. Opening the same URL in a second browser starts a separate workspace.
