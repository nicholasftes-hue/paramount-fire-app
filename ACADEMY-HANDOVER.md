# Academy handover

PR: https://github.com/nicholasftes-hue/paramount-fire-app/pull/1

The supplied repair patch is integrated into `paramount-academy-update`, with
conflicts resolved against the newer navigation, caching and tests. The patch
contains the corrected text files; a separate ZIP is not needed to apply those
changes. See `ACADEMY-FIXES.md` for the conflict resolutions and PR #1 for the
latest commit, GitHub acceptance and browser results.

## Validation

Use Node 24 and run `npm test`. This includes the 70 checks from the supplied
patch plus the current Academy, app-preservation and service-worker tests.
Syntax is checked for standalone and inline JavaScript; the complete existing
service-app script is compared against the unchanged main baseline.

`npm run test:browser` runs Chrome checks using isolated local records and a
temporary loopback server. It covers the loader, direct app, standalone page,
cards, quizzes, navigation, keyboard access, narrow screens, offline reopening,
worker updates and script-load error recovery. See `tests/README.md` for setup.

The supplied Python runner is also available:

```sh
python -m pip install playwright==1.56.1
python -m playwright install chromium webkit firefox
python tests/academy-browser.py --browser chromium
python tests/academy-browser.py --browser webkit
python tests/academy-browser.py --browser firefox
```

An installed Chromium/Chrome can be selected with
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. The Python runner blocks service workers
and checks all three pages, six cards, four quizzes/retries and responsive
widths. The Node browser suite tests offline and update behavior separately.
GitHub runs both browser suites using installed Chrome with read-only repository
permissions, no application secrets and no deployment steps. Consult the current
PR check before treating browser execution as passed. WebKit/Firefox engines
and physical Samsung hardware are separate checks; a Chrome result does not
establish those results.

## Phone review and release boundary

The updated branch is separate from the live app. No hosted phone preview is
published by these changes. Test on a separate development origin before
release: all six cards, quizzes, feedback/retries, previous/next/back controls,
rotation, touch targets, home-screen installation, reopening offline after an
online visit, and returning to an unsaved service-app form. Save unfinished work
before accepting a worker update.

Progress remains limited to the browser tab/session and separated by signed-in
account where available. It is not synced to Supabase or an official competency
record. Four subjects and intermediate/advanced paths remain planned.

Existing document-template links reference four files absent from the repository
baseline. Supply the original quotation/invoice Word and PDF files under
`templates/` for those downloads; built-in draft previews are separate features.
Live authentication and customer-data operations are deliberately excluded from
the test suites.

Do not merge into main or deploy the live app without the owner's explicit
approval. No schema, credentials or customer records are changed by this patch.
