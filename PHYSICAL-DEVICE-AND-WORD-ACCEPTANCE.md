# Samsung, iPhone and Microsoft Word acceptance

Status: **NOT EXECUTED — launch gate open.** These are physical-device checks,
not browser-emulation results. Use fictional records and an isolated test service.
No production Supabase, live app or Mark demo. Record the exact development SHA,
CI run, date, tester, device model, OS/browser/Word version and screenshots/file
SHA-256s. Each row requires Pass / Fail / Blocked plus evidence and defect ID.
No blank row means approval. Retest affected checks after fixes.

| Device | Required configuration | Tester/date/result/evidence |
|---|---|---|
| Physical Samsung | Current supported Android; Chrome and Samsung Internet; portrait/landscape; normal and enlarged font | Pending |
| Physical iPhone | Current supported iOS; Safari; Files/share sheet; portrait/landscape; enlarged text | Pending |
| Windows desktop | Actual Microsoft Word desktop, version recorded; default A4 printer/PDF printer | Pending |
| Office secondary device | Word for Mac or actual office-used Word version; version recorded | Pending |

## Mobile field work

1. On a fresh isolated origin, sign in as engineer; confirm fictional property and
   account/workspace. Confirm anonymous/foreign/revoked staff cannot refresh or
   retrieve shared templates; admin-only publish/deactivation reject for engineer.
2. Create service, PAT, lighting, extinguisher and installation drafts. Exercise
   equipment batches, whole-visit repeat and quote/invoice preparation. Check
   touch targets, focus, keyboard/date entry, voice input if used, no horizontal
   overflow at normal/enlarged text, and clear Not Tested/Fail/limitations.
3. As admin publish an authorised blank and named PDF mapping for each applicable
   document kind. Assign company/property; refresh on engineer and office devices.
   Check only matching templates appear; company/property change clears selection
   and review. Save/resume/reload preserves exact template version and mapping.
4. Refresh templates online, then use airplane mode on a loaded isolated shell.
   Record/queue edits, background/foreground the browser, lock/unlock, interrupt
   download and force-close. Reopen last cached staff workspace; confirm drafts
   and immutable selected originals remain available only within cache lifetime.
   The localhost test shell has no service worker: a cold navigation without an
   available shell is **not** a demonstrated offline app launch. Record this as a
   remaining deployment acceptance requirement; do not treat a loaded tab as proof.
5. Download mapped PDF and Word drafts offline. Open with device PDF viewer/Files;
   verify visible DRAFT, brand, Paramount contractor/issuer, field values, page
   count, clipping, Unicode rejection/manual fallback, file names and unchanged
   original hash. Test share sheet, Save to Files, print preview and cancellation.
6. Reconnect; synchronise once and repeatedly. Check exact records, no duplicate
   assets/visits, competing edits produce reviewable conflicts, history unchanged,
   uncertain retries retain identity, and drafts are not issued automatically.
7. Deactivate/publish another template version on a second device, then refresh.
   Old records retain historical bytes; new work cannot pick inactive versions.
   Revoke property/user access; online retrieval rejects and cache refresh removes
   availability. Sign-out/account switch never displays the prior user's library.
   Confirm expired, corrupted and full-storage caches fail visibly without losing
   saved records. Test after 24 hours and device-clock change. Prior exports
   cannot be remotely recalled; obtain retention-policy acceptance.
8. Test app-shell update consent separately in the normal fictional app fixture:
   decline while editing, then accept; saved drafts/results survive. No production
   worker registration or live URL testing is permitted in this acceptance pack.

## Microsoft Word and office handover

1. Generate both branded built-in service/PAT/lighting/extinguisher/installation,
   quotation/invoice drafts, mapped imported DOCX, and untouched blank originals.
   Record source record ID/revision, visit ID, selected template/hash and filename.
2. Open each in **actual Microsoft Word**, without accepting repair prompts or
   enabling macros/external content. Check headers, original artwork, navy/blue
   sections, A4 margins, page breaks, tables, long addresses, multiple equipment
   pages, symbols, dates, totals/VAT, DRAFT and contractor/issuer distinctions.
3. Edit table cells and placeholders, save as DOCX, close, reopen and compare.
   Test automatic page fields and revision footers after adding/removing pages;
   print preview and actual representative paper copy. Check no field clips or
   disappears, signatures/declarations remain manual and Not Tested is explicit.
4. Use Word's own PDF export; compare every page and field to the edited DOCX.
   This is manual acceptance, not an implemented Word-to-PDF conversion service.
5. Open imported mapped PDFs in the office PDF application and mobile viewers;
   verify appearances, all mapped values, manual fields, draft stamp, both brands,
   reference/revision, and unchanged original content. No scripts, attachments,
   signed originals, XFA, encrypted or unsupported PDFs are accepted.
6. Office admin and competent reviewer sign below only after defects are resolved.
   Approved Absolute artwork/legal presentation is a separate prerequisite.

| Role | Name | SHA and evidence bundle | Open defects / decision | Signature/date |
|---|---|---|---|---|
| Field engineer (Samsung) | Pending | Pending | Not executed | Pending |
| Field engineer (iPhone) | Pending | Pending | Not executed | Pending |
| Office Word reviewer | Pending | Pending | Not executed | Pending |
| Owner release decision | Pending | Pending | No launch approval | Pending |
