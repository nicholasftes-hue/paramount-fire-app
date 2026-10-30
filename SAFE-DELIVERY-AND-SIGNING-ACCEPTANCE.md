# Safe mailbox and PDF signing acceptance

L04/L05 status: local integration covered; actual mailbox/identity acceptance
**NOT EXECUTED**. No customer is a test recipient. No provider was contacted.

The isolated worker now requires `PARAMOUNT_TEST_RECIPIENT_ALLOWLIST`, a
comma-separated exact list of at most ten approved test inboxes. Claimed mail
to another address or containing recipient/subject CR/LF is permanently rejected
before PDF signing or provider contact. There is no wildcard/domain fallback.
Keep the list to the single owner-controlled acceptance inbox for a real drill.
`PARAMOUNT_FROM_EMAIL` must be the approved isolated sender. The worker still
rejects the known production Supabase project and missing isolated configuration.
Keys remain in server-only environment/mounted files, never browser config.

`npm test` uses injected transports and fictional reserved addresses. It covers
provider 400/429/500/unknown outcome, stable idempotency keys, persisted attachment
reuse, restricted recipients, header injection and actual local PDF generation
with temporary self-signed identity. Independent OpenSSL verification proves
signed content and detects tampering. Certificate expiry is rejected before
signing. These tests prove neither inbox delivery nor trust in a real issuer.

## Required isolated real-inbox run — operator evidence

| Case | Required evidence / GO criterion | Result |
|---|---|---|
| Configuration | Distinct approved test ref, HTTPS customer origin, single test inbox allowlist, sender/domain verified; scheduler paused until review; secret paths and masked config reviewed | Pending |
| Negative envelope | Seed one synthetic queued message outside allowlist; no provider submission or signing, permanent failure audited; valid synthetic item still proceeds | Pending hosted |
| Invitation | One synthetic frozen issue; one actual invitation arrives at approved inbox; URL origin/expiry correct, no token in logs/screenshots; provider ID and inbox Message-ID recorded | Pending |
| Verification | Challenge arrives only at intended inbox; wrong/expired/exhausted/revoked/replayed code/proof fails; no customer inbox used | Pending |
| Acknowledgement | Exact frozen revision, scope, consent and issuer reviewed; one signed receipt arrives; decoded received attachment SHA-256 equals persisted artifact and audit certificate fingerprint | Pending |
| Signature integrity | Independently inspect PDF ByteRange/CMS with OpenSSL and office PDF viewer, compare certificate fingerprint to approved identity; tampered copy fails; unsupported/encrypted/already-signed input rejects | Local temporary identity covered; real identity pending |
| Provider errors | Safe sandbox fault injection for transient/permanent/unknown results; stable ID and byte-identical stored attachment; no duplicate issue/receipt; provider acceptance distinguished from delivery/bounce | Mocks covered; provider evidence pending |
| Scheduler/recovery | Single owner-approved tick; due/disabled/revoked items behave correctly; restored worker stays disabled; uncertain deliveries reconciled before resume outside provider dedupe window | Pending |
| Identity operations | Legal issuer, trust chain, key access/custodian, validity/not-before, renewal/expiry alert, revocation/replacement and disaster recovery approved; private key file readable only by worker identity | Human approval pending |

Record exact candidate SHA, UTC times, source/issue/revision IDs, masked sender
and recipient, provider IDs, inbox Message-IDs, stored/received PDF hashes,
certificate fingerprint, reviewer, defect IDs and PASS/FAIL/BLOCKED per row.
Keep full links, codes, proof tokens, keys and raw mail containing secrets private.
Do not generate or send real-customer messages to prove the allowlist works.
A resend after the provider's dedupe window needs an operator decision, not an
automatic retry. Stop the isolated scheduler and remove sender credentials after
the drill; retain audit/evidence under the agreed policy.

The basic detached CMS signature is not qualified/PAdES-LT and has no trusted
timestamp. Owner/competent reviewer must approve whether it meets the intended
legal/technical use. A handwritten/name acknowledgement is not itself a trusted
cryptographic signing identity. No release approval is implied by this pack.
