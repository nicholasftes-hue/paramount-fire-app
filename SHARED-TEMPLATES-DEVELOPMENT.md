# Shared certificate template foundation — 30 October 2026

Development branch only. No migration has been applied to a hosted service.
`main`, production Supabase, live hosting and Mark's demo remain untouched.

## Isolated server library

`sql/shared-templates-isolated.sql` is additive to the existing isolated sync,
controlled-issue and shared-records migrations. It requires the same explicit
session acknowledgement; repeat application fails rather than clobbering data.
Tables use forced RLS with no client table privileges. Security-definer RPCs have
fixed search paths, require active workspace membership and apply property ACLs.
Only admins can publish/deactivate/export full backups. Staff can list metadata
and retrieve authorised exact versions, including inactive historical originals.

PostgreSQL stores original bytes, validates SHA-256 itself and constrains file and
workspace sizes. Versions, payloads and mapping definitions cannot be overwritten
through client RPCs. A workspace lock serialises family CAS, retries, publication,
deactivation and backup snapshots. Reusing the identical request ID is idempotent;
changed content/metadata or competing family versions conflict. Old versions
remain retrievable. Every availability change/publication has an audit event.
Limits: 2 MB per file, 100 versions / 20 MB per workspace including history.

The SQL layer validates storage metadata, byte hashes and format magic; it is not
a PDF/DOCX malware scanner. The client inspects on both upload and download with
the same restricted local inspector. Privileged publishers still require authorised
blank templates and organisational file scanning. Do not expose this as an
untrusted public upload endpoint. A reviewed server scanning/quarantine service is
required before broader public upload or production activation.

## Isolated user workflow

`shared-templates.js` has no endpoint or credentials. It accepts only an explicit
RPC service, inspector and mapping-source list. It verifies every fetched original
and backup, checks exact publish acknowledgement and detects account changes
during asynchronous work. Mappings persist with the immutable server version.

The panel is loaded only from localhost `team-sync-test.html`, through the existing
isolated authenticated transport. It has brand/type assignment, admin upload,
new-family/new-version selection, library refresh, verified original download,
deactivation and original/audit backup. Retrying an unchanged uncertain upload
retains the same ID within the panel session. Account changes clear the displayed
library. It never reads normal production Supabase configuration or credentials.

Both Paramount and Absolute text branding are available. No Absolute logo or legal
issuer identity was invented. Fixed uploaded artwork is preserved. Shared originals
currently download for manual completion: shared mapping editor/selection inside
team engineering forms and a durable offline shared-template cache remain next.
The existing personal library's pinned PDF mappings and Word drafts are separate.
No shared template is automatically inserted into an engineering record.

## Verification and remaining gates

113 Node tests pass locally, including upload/download/backup hash verification,
unsafe mapping rejection, exact-version acknowledgement, account changes and
transport failures. Independent imported PDF/Word regressions remain green.
The new disposable PostgreSQL suite exercises migration guards, roles, hashes,
brand assignment, immutable originals, idempotency, CAS races, historical reads,
deactivation/audit backup, restricted property visibility and revoked users.
It is wired into the existing loopback-only CI database fixture. Local execution
is blocked by absent `psql`; no local database success is claimed.

The template browser suite now checks PDF upload/mapping selection, reload,
actual download and company-change reset at 320/360/412/1024px. Local Chromium
startup is blocked by sandbox `setsockopt`; CI must verify the new scenarios.

Exports include original versions and audit, with client hash re-verification.
They do not replace PostgreSQL operational backups, nor is an automatic restore
RPC provided. Before production: isolated hosted integration and restore drills,
server scanning/quarantine, shared form mapping/offline workflows, physical mobile
and actual Microsoft Word acceptance, competent certificate review, approved
Absolute artwork and owner-reviewed migration/rollback planning. No deployment.
