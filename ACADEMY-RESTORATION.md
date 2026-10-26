# Academy restoration — 26 October 2026

Reconstructed from genuine GitHub branch head
`03faa09e60959fd57a2d6cab4dfbd42270d82530`, using its draft syllabus.
The disappeared uncommitted files were not recovered; these are new replacements.
All 26 downloaded baseline files were checked against their Git blob SHAs.
Publishing uses that remote commit as parent, without a local snapshot history.

## Changes

- Adds `fire-servicing` and `cctv-diagnosis`, each with six questions,
  explanations, retries, session progress and a supervised fictional exercise.
  Both are labelled draft training pending competent review.
- Retains six subjects and the four original lessons byte-equivalent as lesson
  data, including their quizzes and exercises. Adds previous/next navigation
  through the third Fire and CCTV lessons using the existing UI.
- Retains the full existing main-app script, Supabase configuration, account
  isolation and service safeguards. No customer or production data accessed.
- Bumps module URLs to academy-3 and shell cache to v5, including all four
  templates in the explicit same-origin offline allowlist. Cloud/auth requests
  remain excluded; worker replacement still requires user consent.
- Adds two editable Word documents and two fillable PDFs in `templates/`, using
  the existing Documents links. These are blank recreated commercial templates,
  with placeholders for unverified details, manual totals, no guessed bank/VAT
  details and explicit draft/non-certification notices. Quotation has 43 PDF
  fields; invoice has 45. The generator is `scripts/build-templates.py`.

## Local verification

- `npm test`: 21 test entries pass, including 82 loading/logic adapter checks,
  all six quizzes and progress isolation, original-lesson hashes, whole app
  script preservation, syntax, offline shell/templates, cache failures and consent.
- `python3 tests/templates.py`: both DOCX packages valid and editable after
  save/reopen; both one-page PDFs valid, all 88 fields editable, blank, labelled
  and successfully filled/saved/reopened with fictional values and appearances.
- Python compilation and JavaScript syntax checks pass. Quotation PDF rendered
  and visually inspected. Word desktop pagination and actual PDF editor behavior
  on Samsung have not been tested.
- Real-browser attempts were blocked before execution: loopback HTTP server
  `listen EPERM` / Python `PermissionError`, and headless Chromium socket
  `setsockopt: Operation not permitted`. A permission-enabled retry did not finish.
  No browser/mobile/offline browser pass is claimed for this local environment.
- Existing Node and Python browser runners expanded for all six lessons. Node
  runner includes four template downloads, narrow-width new lessons and offline
  new quizzes/templates. GitHub Actions runs them read-only with local fixtures;
  it has no deployment steps or application secrets. Consult the run on the new
  branch commit for remote results.

## Outstanding acceptance

Physical Samsung testing (including Samsung Internet and PDF save behavior),
competent fire engineer technical review, manufacturer-model-specific procedure
verification and desktop Word visual review remain outstanding. No live sign-in,
customer-data operations or certification workflows were exercised. Knowledge
checks never establish competence or permission to work.

Do not merge into main or deploy without the owner's explicit approval. This
restoration only updates the existing development branch and PR #1.
