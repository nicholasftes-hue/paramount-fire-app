# Repeat services and batch registers — development only

Implemented on paramount-main-app-development, based on source commit 69c45d4da2a1c92ba259d7c0507a2fc5f727a0f9. Source retrieved through the authenticated GitHub connector after one normal clone failed: proxy port 8080 unreachable. All 76 retrieved blob hashes matched the GitHub tree. No proxy bypass, credential changes, production requests, merge or deployment.

## Implemented

- Prominent Repeat Last Service and Repeat Entire Property Visit in fire alarm, PAT, lighting, extinguisher, installation and call-out forms. Visit repetition prepares independent drafts for available completed service types; missing types are skipped. Draft replacement requires confirmation and cancellation retains the drafts.
- Explicit In progress / Completed service progress. Existing records are not migrated or inferred completed from draft review. To use a legacy reviewed record as a source, an engineer must review it and explicitly mark completed, preserving its prior revision. This is a work-completion flag, never controlled certificate issue.
- Repetition selects the most recent completed matching property/type by service date and saved timestamp, copies an explicit stable-field allowlist, and starts a new record on save. Prior records/history/signatures are retained unchanged. Signature fields, dates, readings, defects, actions, declarations, instrument/calibration references and review approval are excluded from copying. Current record date is newly generated.
- PAT batch checklist is offered for new forms, with per-asset Pass / Fail / Not Tested, unique editable identifiers, identical-item addition, removal, location, stable specification, actual readings, defects and actions. Previous completed register loads on property selection; old single-appliance records can become a one-row checklist. Explicit single-appliance mode remains for older workflows. Equipment changes reset review approval.
- Lighting fitting checklist supports the same actions, monthly functional and annual full-duration test choices, rated duration, actual per-fitting duration, defects/remedials and preserved service history. Tested fittings in duration tests require a positive actual duration. Failed assets require defects. Not Tested assets cannot be marked completed.
- Batch saves create one service record and one consolidated editable DOCX/PDF report through the existing document generators, with human-readable asset rows. Existing draft autosave/resume, signatures, PDF and Word controls remain. No compliance approval is inferred.
- Fire alarm forms/certificates add panel serial, zone/device reference register, battery make/model and quantity alongside existing panel/category, rated capacity, readings, defects, recommendations and signatures. The existing branded navy/sky-blue document shell is retained.
- Mobile checklist controls have minimum 44px targets and wrapping grids. Existing voice dictation and save/resume remain. Offline app shell cache bumped to v12 with existing update-consent behavior preserved. Academy and original inline demo source are unchanged.

## Verification this session

- `npm test`: 84 passed, 0 failed (78 existing plus six focused repeat/batch tests).
- `node --check main-app.js`, `git diff --check`: passed.
- Batch DOCX ZIP/XML, both asset identifiers/readings: passed. python-docx edit/save/reopen: passed.
- Batch PDF: pypdf strict parse and both asset identifiers/readings passed.
- `python tests/templates.py`: quotation/invoice Word edit/save/reopen and all fillable PDF fields passed.
- `python tests/populated-documents.py`: populated service/quotation Word editing and strict quotation PDF checks passed.
- `python tests/service-pdf.py`: Node-generated service PDF passed; remaining browser-generated PDF fixtures unavailable because browser suite could not run locally. Full command therefore failed on missing `test-results/browser-service-draft.pdf`.
- Local main browser execution blocked at `listen EPERM 127.0.0.1`. Additional-network-permission attempt was aborted. No browser/mobile visual/offline service-worker acceptance claimed. Added `tests/repeat-browser.cjs` to the existing read-only CI workflow and adapted legacy certificate fixtures to explicitly choose single-appliance mode. CI results for the new head must be reviewed separately.

## Still unfinished / limits

- Browser and physical phone acceptance, browser-generated new batch downloads, offline shell reload and full CI validation for this head remain pending. Unit tests verify offline local storage and existing service-worker behavior, not real device acceptance.
- Dedicated premium certificate layout redesign beyond the added panel/device/battery fields remains outstanding. Existing branded layouts are reused.
- Fire alarm zone/device lists remain editable text. Extinguishers still use existing single-asset forms; a full batch extinguisher register is not implemented.
- Repetition uses the development workspace's new records, not read-only preserved prototype arrays or production Supabase history. No automatic legacy completion migration. New future service kinds must explicitly define safe reusable fields before repeat is enabled.
- Actual Microsoft Word/office staff acceptance, competent technical review and isolated hosted acceptance remain outstanding. Browser-generated reports remain draft documents under the existing controlled-issue boundary.

A safe preview can be prepared on a separate local/development origin with fictional device-only fixtures and all external requests blocked. It has not been published or deployed. Do not connect a preview to production Supabase or reuse Mark's demo origin/service-worker scope.
