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
entry, six subjects, all four quizzes, retries and feedback, planned paths,
previous/next/back buttons, keyboard controls, preservation of an unsaved property
draft, existing app views, draft reports/invoices, narrow screens, offline
reopening, transient server errors, a fresh browser session and consent before
service-worker updates. Unexpected external requests or JavaScript errors fail
the check. Screenshots and results are saved in `test-results/`.

The supplied repair's 70 adapter checks are retained in
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

The existing Documents view links to four files under `templates/` that are
absent from the repository baseline. Those links have been preserved; the
original editable Word/PDF quotation and invoice files must be supplied before
their downloads can work. The built-in draft report and invoice previews are
tested separately.
