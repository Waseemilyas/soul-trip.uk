# Soul Trip browser-error monitoring

## Boundary

This static GitHub Pages site reports only first-party production browser exceptions. It does **not** monitor Formspree's service or server failures.

The SDK is inert in git: `#sentry-sdk[data-dsn]` is blank. The production release replaces that attribute with the public ingest DSN held under the BWS key `STW1_SENTRY_WEB_DSN`. A browser DSN is necessarily visible in the released page; it is not an authentication credential. Do not commit an auth token, and do not create a source-map upload flow for this unbuilt static site.

## Privacy controls

- No tracing, profiling, replay, breadcrumbs, user identifiers, request data, tags, contexts, or extra data.
- Events without a first-party stack are dropped; this excludes third-party widgets.
- Exception messages and source context are redacted before ingest. First-party stack filenames are reduced to paths without URL/query data.

## Release and proof

1. In Sentry, create a **JavaScript / Browser** project for `soul-trip.uk`, with a production-only environment and an error alert routed to Waseem's Automancer inbox. Ensure Magnus's normal inbox ingestion receives that alert.
2. Store the public DSN in BWS as `STW1_SENTRY_WEB_DSN`. No Sentry release/auth token is required because there are no source maps or build step.
3. In the separately board-approved production release, inject the BWS-derived DSN into `data-dsn` in the release artifact only. Do not add a token or contact data to the page.
4. Run `node scripts/check-sentry-integration.mjs` before release. After release, capture one controlled first-party exception, verify the Sentry event is redacted, verify the alert email and Magnus ingestion, then remove any test artefact.

The source contains no source maps; keep it that way unless a future build pipeline adds hidden-map upload with a build-only token and independent review.
