# Draft certificates, PAT and emergency lighting continuation

Continues 4fdf3d841918b55b2ff6f81d20896741c266e13d on paramount-main-app-development, draft PR #2. No merge or deployment is requested or performed.

## Delivered

- Branded navy/cyan Paramount fire alarm service certificates, repeated draft footer, record reference/revision, saved site details, actual scope/results, handover/declaration and optional engineer/customer typed signature acknowledgements with dates. Signatures acknowledge the draft only; competent review and controlled issue remain pending.
- PAT quick-entry appliance buttons and Save draft & next appliance. Tester, instrument, calibration, date, location and follow-up carry forward; asset numbers increment when they end in digits. Appliance, class, readings, visual result, outcome, defects, signatures and review never carry forward. Individual PDFs and selected-site PAT registers contain every saved current record, including failures and limitations. Site reports include all saved dates; each record retains its date/reference/revision.
- Lighting records include functional/duration/visual scope, actual observed duration, individual fitting/circuit/location references, results, outcome, supply-restoration/charging observations, responsible-person notification and signatures. New duration-test saves require a positive actual duration; invalid new durations are rejected. Individual and selected-site PDFs are available.
- Local DejaVu Sans Mono TrueType font embedding, CID glyph mapping and ToUnicode extraction in every new engineering PDF. Supported accented names, Greek/electrical symbols, check marks and punctuation render directly. Characters outside the bundled font coverage are explicitly represented as U+ codes; the source text remains intact in saved records and preview. Font license is included. No font/CDN request occurs.
- Original inline application/authentication byte-preservation test retained; Supabase config/schema untouched. Storage version/keys, backups, revision histories and original device records remain unchanged. PAT/lighting gain immutable site snapshots on future saves; historical records without snapshots explicitly identify current site details in reports.

## Verification

`npm test`: 34 tests plus existing Academy/loader adapter checks passed locally. `python tests/templates.py`: original editable Word and fillable PDF save/reopen checks passed. Independent pypdf strict parsing confirmed a four-page service draft with preserved £ and Ω and correct pagination/offsets.

Local full-browser execution is blocked by sandbox EPERM on localhost listeners and Chromium sockets. The existing GitHub Actions workflow now runs `npm run test:certificates-browser` alongside preserved app/Academy and main-app browser suites, and independently parses every generated mobile PDF. Check PR #2 / its head workflow for final CI results.

The new touch/mobile Chromium scenarios cover 320, 360, 412px and 800x360 landscape: no horizontal overflow; signature save/reopen; draft preview escaping; certificate downloads; PAT quick-entry without copied outcomes; sequential assets; pass/fail site report; revisions; lighting duration rejection; save/reload; individual/site PDF downloads. Fictional records only, external requests aborted and asserted absent. CI retains screenshots/PDFs/results and complete source backup artifacts.

## Outstanding before controlled issue

Competent-person review and approval of certificate content, scope, applicable standards/editions, company details and signing/issue procedure. Typed acknowledgements are not verified electronic signatures; wet/drawn signatures and controlled issue are not implemented. Physical iPhone/Samsung, Safari/Samsung Internet and native save/share acceptance remain required. Full CJK/emoji coverage, PAT numeric reading/limit rules and tester-specific imports are not implemented; actual readings/method/limits are recorded as reviewed free text. No automatic pass decision is made. Existing optional manual Supabase snapshots are unchanged; automatic team sync and simultaneous transactional edits remain outstanding.

Main, paramount-academy-update, Mark's demo repository, production data and Supabase configuration are not modified. Original binary assets are preserved by reusing the base Git tree.
