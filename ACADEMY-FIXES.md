# Academy integration for PR #1

Repository: `nicholasftes-hue/paramount-fire-app`
Development branch: `paramount-academy-update`

The supplied `paramount-academy-update-1.patch` was inspected and integrated on
top of development commit `5effb2f05ce44a76d67534aec3e4e0d745e1d63c`.
The patch targets an older snapshot, so applying it without conflict resolution
would overwrite newer navigation, caching and tests.

## Corrected files integrated

- The loader explicitly loads external scripts in order after replacing the
  document, preserving the inline app and injected white theme. Module failures
  leave the service app usable and show an Academy error message.
- Academy initialisation supports existing markup and delayed DOM readiness,
  prevents duplicate handlers, reports readiness, and validates quizzes before
  grading. All four lesson bodies, quiz questions and feedback are preserved.
- `academy-test.html` provides all six cards and four lessons independently of
  app loading, authentication and service-worker registration.
- Asset URLs use `academy-2`. The shell cache advances to v4, retaining both
  PWA icons and adding the standalone page. Existing explicit update consent,
  cache-quota handling and cached fallback for server errors are retained.

## Conflict resolutions

- Retained the main-app return control and selected-subject focus restoration.
- Kept the current Academy stylesheet, manifest and app-update module.
- Preserved the existing regression suite. The patch's colliding test file is
  integrated as `tests/academy-loading.test.cjs` with its adapter updated for the
  retained return control; its 70 checks pass.
- Included the patch's Python browser runner, adding support for the runner's
  installed Chrome binary. Expanded the existing browser suite to cover the
  standalone page, offline reopening and recoverable script-load failures.
- Replaced the patch's historical handover status with current instructions.
  Its old claims of GitHub write failures and unrun browser checks do not
  describe the current integration; see PR #1 and its checks for delivery status.

The complete existing inline app script still matches main commit
`0e882fb64ece9022e3352f8ad50b06ce6dbefd2c`. No database migration or customer-data
operation is needed. Planned modules remain explicitly unavailable.

No merge, publication or live deployment is part of this update.
