# Soul Trip browser-error monitoring

## Boundary

This static GitHub Pages site reports only first-party production browser exceptions. It does **not** monitor Formspree's service or server failures.

Production monitoring is active. `#sentry-sdk[data-dsn]` holds the public browser-ingest DSN managed under the BWS key `STW1_SENTRY_WEB_DSN`; its value must not be copied into documentation, comments, or a different project. A browser DSN is necessarily visible in the released page, and is not an authentication credential. Do not commit an auth token or create a source-map upload flow for this unbuilt static site.

## Privacy controls

- No tracing, profiling, replay, breadcrumbs, user identifiers, request data, tags, contexts, or extra data.
- Events without a first-party stack are dropped; this excludes third-party widgets.
- Exception messages and source context are redacted before ingest. First-party stack filenames are reduced to paths without URL/query data.

## Release and proof

1. The JavaScript / Browser production project has its error alert routed to Waseem's Automancer inbox, where the normal Magnus ingestion path processes it.
2. Keep the public DSN in BWS as `STW1_SENTRY_WEB_DSN`. No Sentry release/auth token is required because there are no source maps or build step.
3. Any DSN change remains a separately approved production release. Change only the public DSN; do not add a token or contact data to the page.
4. Run `node scripts/check-sentry-integration.mjs --expect-inert` against a pre-release candidate and `node scripts/check-sentry-integration.mjs` after activation. For an approved DSN change, capture one controlled first-party exception, verify its redaction and alert/inbox ingestion, then resolve or remove the test artefact.

The source contains no source maps; keep it that way unless a future build pipeline adds hidden-map upload with a build-only token and independent review.
