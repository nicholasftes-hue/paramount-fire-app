# Development access recovery — 29 October 2026

Recovered repository: `nicholasftes-hue/paramount-fire-app`.
Development branch: `paramount-main-app-development`; existing draft PR #2.
Verified baseline: `f71b61c384ff022a9a49ae428545b198090245b4`.
Verified root tree: `9f5814079cc546c59e7d4c054deecaab2c36f63e`.

## Recovery procedure

No existing checkout was available. One Git remote probe failed because the
environment could not connect to its configured proxy on port 8080. Do not
repeat that connection or bypass the proxy.

The authenticated GitHub connector can recover binary files:
1. Read the development branch and PR metadata; pin the resolved commit SHA.
2. Fetch its recursive Git tree and require `truncated: false`.
3. For every blob, call `fetch_file` with the pinned `ref`, repository path,
   and `encoding: base64`. Omit line limits: a line-limited response is partial.
4. Decode base64 to bytes without UTF-8 conversion. Verify length against the
   tree entry and Git SHA-1 over `blob <byte-length>\0<bytes>`.
5. Preserve paths and Git modes. Stage files and compare `git write-tree`
   with the commit's actual root tree SHA.
6. Keep remote ancestry when committing through the GitHub API. A locally
   reconstructed checkout may be shallow; do not replace remote branch history
   with an unrelated local snapshot.

All **84 blobs** matched their exact byte lengths and Git hashes, including
both PNG icons and all four binary Word/PDF templates. The root tree matched.
The exact baseline commit object was also recovered and hash-verified locally;
its commit message has no trailing newline. No source files or assets are missing.
Text-only `fetch_blob` and generic `fetch` rejected binary content; that does
not imply the assets are absent from GitHub or broken in the application.

## Local validation on the recovered baseline

- Node 24: all **88 tests passed**, including asset preservation and PDF signing.
- Populated Word edit/save/reopen and strict quotation PDF checks passed.
- Both blank Word templates and all 88 fillable PDF fields passed save/reopen.
- Controlled evidence PDFs and incremental cryptographic PDF parsing passed.
- All seven Node browser runners and the Python Academy browser runner were
  attempted. Loopback sockets are denied (`listen EPERM` / `PermissionError`),
  before application execution.
- Service/register Python document checks were attempted; their browser-generated
  PDF fixtures are unavailable because browser startup was blocked.
- Disposable database runner was attempted; `psql` and a local PostgreSQL service
  are unavailable. This also blocks its controlled-issue/verified-delivery suites.
- Dependency installation was attempted once with retries disabled; proxy socket
  access is denied. Preinstalled Playwright was found and used for browser attempts.
  A fresh dependency audit could not run locally.

These local infrastructure blocks are not application regressions. Independent
GitHub API verification confirmed baseline CI run
[40902883327](https://github.com/nicholasftes-hue/paramount-fire-app/actions/runs/40902883327)
completed successfully for exactly `f71b61c384ff022a9a49ae428545b198090245b4`.
New commits require their own CI result.

The previous feature-priority instructions are absent from this conversation.
Repository handover documents describe completed work and remaining acceptance
limits; they do not establish a new ordered feature request. Further feature work
requires that missing priority context. Recovery changes only this documentation.

Production Supabase, `main`, live hosting and Mark's demo are untouched.
No merge or deployment.
