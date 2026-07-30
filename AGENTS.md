# SoulTrip Website — agent instructions

Static single-page site (plain `index.html`, no build step, no framework).
Served as-is (GitHub Pages via `CNAME` → soul-trip.uk).

- `index.html` — the entire site; edit directly.
- `assets/`, `images/` — static assets referenced by `index.html`.
- `docs/spec.md` — copy/structure source of truth (headline, sections, CTAs).
- `docs/design-handoff.md` — visual/design reference.
- `docs/company-details.md` — Companies House registration facts used in the
  footer legal disclosure; treat as authoritative, don't invent numbers.
- `docs/post-build-patches.md` — live patch tracker; update status there when
  you land one of its items.
- **Do not touch `docs/credentials.md`** — orchestrator-managed secrets.
