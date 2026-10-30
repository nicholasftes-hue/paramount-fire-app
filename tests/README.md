# Academy checks

These checks run against local test fixtures. They never sign in to Supabase,
write customer data, publish a site or deploy the app.

Use Node 24:

```sh
npm install --ignore-scripts
npm test
npx playwright install --with-deps chromium
npm run test:browser
```

The browser check starts a temporary loopback HTTP server with the same
`/paramount-fire-app/` path as GitHub Pages. It tests the loader and direct app
entry, six subjects, all six quizzes, retries and feedback, planned paths,
previous/next/back buttons, keyboard controls, preservation of an unsaved property
draft, existing app views, draft reports/invoices, narrow screens, offline
reopening, transient server errors, a fresh browser session and consent before
service-worker updates. Unexpected external requests or JavaScript errors fail
the check. Screenshots and results are saved in `test-results/`.

The supplied repair's adapter checks (expanded to 82) are retained in
`academy-loading.test.cjs` alongside the regression tests. Its Python browser
runner is in `academy-browser.py`; GitHub runs this against Chrome as well.
The browser checks include the standalone Academy page, its offline cache,
readiness feedback and recovery after an Academy script-load failure.

GitHub Actions runs the same checks for PRs to `main` on Ubuntu 24.04, with read
access only. The workflow has no deployment steps or application secrets.

`app-preservation.test.cjs` checks the entire inline app script against the
existing `main` commit `0e882fb64ece9022e3352f8ad50b06ce6dbefd2c`. If an authorised
app change is made later, review that change before updating the baseline hash.

Automated narrow-screen checks do not replace testing on a physical Samsung
phone. Phone acceptance should cover Chrome/Samsung Internet, all six cards,
quizzes, back buttons, rotation, adding the app to the home screen, reopening
offline after an online visit, and returning to an unsaved main-app form. Use a
separate development origin so test data and service workers stay separate from
the live app. This repository update does not publish that origin.

The Documents view now downloads four recreated blank templates from `templates/`.
They contain no customer information or invented company registration, banking or
VAT details. Totals are manual. PDF saving depends on the chosen editor.

Verify Word editing and all PDF field save/reopen operations:

```sh
python -m pip install python-docx==1.2.0 pypdf==6.1.1
python tests/templates.py
```

Rebuild the files only when intentionally changing their layout:

```sh
python -m pip install python-docx==1.2.0 reportlab==4.4.3
python scripts/build-templates.py
```

The expanded browser suite also tests downloads byte-for-byte, the new lessons
at narrow widths, new quizzes offline and all four template downloads offline.
Local browser execution in the rebuild environment was blocked by socket
permissions (`listen EPERM`, Python `PermissionError` and Chromium `setsockopt`).
The read-only GitHub Actions workflow runs these scenarios on a normal runner.
See ACADEMY-RESTORATION.md for current results and remaining acceptance work.

Shared-template continuation: `npm test` includes scoped offline snapshot races,
expiry/reload/tampering/denial, real imported mappings in engineer/office controls,
quarantine scanner failures and actual local receipt rendering/signing with an
injected provider. `git ls-files -z | node scripts/security-checks.cjs` scans tracked
source without network. The team browser runner now exercises shared engineer and
office selection, mapping pins, offline mapped download and deactivation/history.
The disposable database runner also performs pg_dump/restore into a separate test
database, compares every synthetic table, rechecks permissions/hashes and drops
only that restore database. Never run it against hosted/production data.

Launch-blocker continuation: the disposable DB harness now applies
`template-security-isolated.sql` and tests missing/pending/blocked scans,
worker-only leases, direct/table/RPC/idempotent publication and retrieval gates.
The separate CI antivirus job requires fresh ClamAV signatures and checks a
benign original and the harmless EICAR fixture; it fails if the scanner is absent
or stale. Hosted acceptance is prepared in HOSTED-RECOVERY-RUNBOOK.md and is not
a local mock PASS. Real mailbox/identity and physical/Word checks remain human
gates in PRODUCTION-LAUNCH-CHECKLIST.md.
