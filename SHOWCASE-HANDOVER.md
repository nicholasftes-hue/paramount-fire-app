# Mark's full isolated showcase — 27 October 2026

Source: paramount-main-app-development at d5001256b6ef047f324816810981090a7db1b3c8. PR #1 and #2 inspected and remain unmerged. Showcase branch initially points to that same source. Existing development functionality is retained in the isolated showcase/ directory, with cloud and speech adapters removed. The root entry points are also replaced with sanitized copies, so opening the branch root cannot start the original production authentication.

## Source audit
Inspected current branch heads for main, four backups, Academy, main-app development and both earlier demonstration branches. MAIN-APP-PROGRESS.md records the prior full branch/history audit: original V6 local records, V7 cloud experiment, V9 white dashboard, PR #1 Academy and templates, PR #2 expanded draft workflows. This showcase uses the full PR #2 source, already based on PR #1. It does not replace that source with the smaller Mark demo.

## Functional local demonstration
- White and sky-blue dashboard; navigation to every preserved module.
- Fictional properties; equipment inventory/register; property history.
- Detailed reviewed fire service, PAT, emergency lighting, extinguisher and installation/commissioning draft records.
- Save/reopen drafts, edit revisions, per-record preview and browser Print / Save as PDF.
- Itemised quotations and invoices, integer-pence totals and VAT, quotation-to-invoice preparation, saved engineering job-to-quotation preparation.
- Planner, engineer visit scheduling with overlap rejection, on-screen follow-ups.
- Office enquiries, call-outs/defects, local JSON backup downloads.
- Job-pack draft report/invoice previews (legacy prototype: uses legacy records, not the expanded record store).
- Six Academy beginner lessons and quizzes across fire/CCTV, with session-only progress.
- Four blank editable Word/fillable PDF templates (manual totals; app does not merge saved data into them).
- Local SVG layout editor and equipment reference register remain prototypes. Layout editing uses coordinates, not touch dragging. Verified manuals are not bundled.
- Offline service worker caches the static app, Academy and templates after the first successful HTTPS load. Actual browser/offline test status must be read from the workflow; a physical Samsung/iPhone pass is not claimed.

## Coming Soon / unfinished
Cloud sync, real authentication, team permissions, unattended email/SMS reminders, AI assistant, voice dictation, external manuals, payment/accounting integration, approved certificates/signatures, remaining Academy subjects and intermediate/advanced courses. These are labelled Coming Soon or explicitly described as unavailable.

## Isolation
All 12 initial records are fictional. Separate namespaced local storage; reset clears only this showcase's records. No production URL/key/authentication or database adapter is in the deployed folder. CSP restricts resources/connectivity to the same origin; runtime guards reject external fetch/XHR/beacon/socket and speech APIs, and external links are disabled. No remote database can be modified by this package. No data imports are offered, to keep real customer records out. Do not enter real records manually. Publish on a new repository/origin, never under the live app's repository path.

## Verification
Local PASS: JavaScript parsing, offline asset existence, absence of production adapters/credentials, validation of all 12 fixtures, integer-pence calculations, mandatory review and overlap prevention. The original four binary templates were fetched and passed Python DOCX edit/save/reopen and all 88 PDF field fill/save/reopen checks. Original icon-192 and all templates are preserved byte-for-byte. Local browser attempt failed before app execution with listen EPERM. This is an environment limitation, not a browser pass.
A separate read-only showcase-checks workflow runs navigation, save/edit/reload, calculations, conversion/preview, overlap validation, job packs, history, downloads, Academy rendering, mobile width checks, request monitoring and offline reload. Check its actual result on the delivered commit. It does not deploy.

## Separate GitHub Pages deployment
Publishing is blocked here: the GitHub connector has no create-repository or Pages administration capability; shell GitHub credentials are invalid and the network proxy is unavailable. No production Pages configuration was queried or changed, and no public showcase URL is claimed.
1. Download paramount-mark-full-showcase.zip and extract it.
2. In GitHub create a NEW public repository named paramount-mark-full-showcase (do not use paramount-fire-app or paramount-mark-demo).
3. Upload the extracted files with index.html at repository root. Include templates/ and every JS/CSS/manifest/icon file; do not upload only the ZIP.
4. In the NEW repository only, Settings > Pages > Deploy from a branch > main > /(root) > Save.
5. Wait for its Pages deployment to succeed. Expected URL (not verified): https://nicholasftes-hue.github.io/paramount-mark-full-showcase/
6. Open that URL on Samsung and iPhone; check the fictional-data banner, edit/save a draft, preview an invoice, download a template, complete a quiz. After one full online load, test flight mode and reload. Browser Print / Save as PDF depends on the phone's print/share support.
The ZIP contains deployment files only, not the original development app, Git history, customer data or credentials.
