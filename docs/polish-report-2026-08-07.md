# Frontend polish pass — 2026-08-07

Branch: `polish/frontend-pass-2026-08-07`
Scope: visual polish only — no new dependencies, no build tooling, no redesign.
Method: full-page audit at 1440 / 1024 / 768 / 620 / 390 px (headless Chrome,
all viewports re-shot after the fixes), contrast measured numerically against
WCAG AA (4.5:1 body text, 3:1 large text/UI), keyboard/focus review of every
interactive element.

---

## Changes made

### 1. Corrected swapped Hajj / AlUla imagery (`index.html`)

Two asset files hold each other's content:

- `images/hajj-umrah/makkah-clock-tower-aerial-sunset.jpg` is actually an
  **AlUla palm-valley** photo (two figures overlooking the valley).
- `images/experiences/alula-valley-vista.jpg` is actually the **Makkah Royal
  Clock Tower + Masjid al-Haram aerial** at sunset.

As shipped, the sacred Hajj & Umrah section showed a desert valley while the
"Heritage & Discovery" thumbnail showed Makkah. Fixed by swapping references,
not files:

- **Hajj & Umrah side image** → `images/experiences/alula-valley-vista.jpg`
  (real Makkah aerial; existing alt text was already accurate for it).
- **Vision 2030 rail, "Heritage & Discovery"** →
  `images/experiences/hegra-tombs-alula.jpg` (Hegra tombs; matches the caption
  and was previously unused). New alt: "Nabataean rock-hewn tombs at Hegra
  (Mada'in Saleh) near AlUla".
- **Services card 1 (Spiritual Journeys)** keeps the valley photo (it suits the
  card and avoids duplicating the hero's Kaaba image) but its alt text claimed
  it was "Masjid al-Haram…" — corrected to "Two travellers in Saudi dress
  overlooking the palm valley of AlUla".

The two mis-named files were deliberately **not renamed** (see "Left alone").

### 2. Colour & contrast — WCAG AA (`assets/css/styles.css`)

- New token `--gold-700: #7A5F18`. `gold-500` (#C9A24B) is only 2.4:1 on white
  and 1.8:1 on sand-200, so every **eyebrow label on a light surface** failed
  AA. `.eyebrow` (and the form's required-field `*`) now use `gold-700`
  (5.3:1 on sand-100, 4.6:1 on sand-200, 6.0:1 on white). `gold-500`/`gold-300`
  remain for decorative strokes, icons, fills, and all text on dark surfaces
  (where gold-300 measures 7.7:1).
- **Footer legal disclosure** was `rgba(246,239,226,0.45)` = 3.4:1 at 0.75rem —
  failed AA. Raised to 0.7 (6.1:1); the company-number `<strong>` to 0.9.
- **Form placeholders** were `#9a9488` = 2.6:1 on the sand-100 field background.
  Now `#6E695D` (4.8:1).
- **Focus ring on gold buttons**: the global gold `:focus-visible` outline was
  invisible on the gold fill. Gold buttons (and the WhatsApp float) now get an
  emerald-900 outline (7.7:1 against gold).

### 3. Hover / focus / disabled states (`assets/css/styles.css`)

- `.btn:disabled` — dimmed, `cursor: progress`, no lift (the submit button is
  disabled while sending; previously it kept full hover styling).
- `.btn:active` — press returns the button to rest position.
- `.contact-item` (phone/email/WhatsApp strip) — previously no hover or focus
  feedback at all. Icon now lifts with a gold border on hover/focus-visible,
  value colour deepens on hover.
- `.wa-inline` (WhatsApp link in the form success panel) — hover now deepens
  colour and reveals a gold underline.
- `.wa-float` — keyboard focus now matches hover (scale + tooltip reveal);
  tooltip was previously hover-only, invisible to keyboard users.

### 4. Responsive (`assets/css/styles.css`)

- **Trust pills (Why Choose)**: jumped straight from 3-up to full-width at
  ≤768px. Now 2-up between 561–768px, 1-up below.
- **Footer**: stayed 2-column down to the smallest phones, wrapping the email
  address mid-word at 390px. Now single-column ≤640px.
- **Footer bottom bar**: added bottom padding on small screens so the legal
  disclosure isn't covered by the floating WhatsApp button.

### 5. Typography rhythm (`assets/css/styles.css`)

- Section headings sat directly on the body copy (`h2` margin 0, body margin 0).
  `.about__body`, `.hajj__body`, `.partners__body`, `.vision__body`,
  `.commit__body` now have `margin-top: clamp(1.1rem, 2vw, 1.5rem)` —
  consistent heading→copy gap everywhere (collapses cleanly where a
  `.section-head` already provides space).

### 6. Micro-detail & hygiene

- `.vrail-item` radius 14px → `var(--radius-card)` (16px) — all card-like
  surfaces now share one radius token.
- Footer link rows: 0.7rem → 0.85rem spacing (closer to 44px touch targets).
- Removed dead CSS: `.eyebrow--caps`, `.lead`, `.btn--emerald`,
  `.divider--light` (defined, never used).
- Added `<meta name="theme-color" content="#0B3D2E">` (mobile browser chrome
  matches brand).
- Added `tabindex="-1"` to `<main>` so the skip link reliably moves keyboard
  focus, not just scroll position.

---

## Found but deliberately left alone

- **The two mis-named image files were not renamed.** Renaming
  `makkah-clock-tower-aerial-sunset.jpg` / `alula-valley-vista.jpg` to match
  their contents would be the "real" fix, but the filenames are referenced in
  `docs/design-handoff.md` §7 and possibly elsewhere outside this repo; a
  reference swap carries zero risk. Recommend renaming the files (and updating
  the handoff manifest) in a future housekeeping pass.
- **`brand__sub` ("TRAVEL & TOURS") in gold-500 on white** when the nav is
  scrolled: 2.4:1, but it's part of the logotype — exempt under WCAG 1.4.3
  (logo/brand-name text). Left as designed.
- **`og:image` / hero use of `images/hajj-umrah/kaaba.jpg`** — not in the
  handoff's original manifest but present in the repo and clearly a deliberate
  post-handoff addition; hero looks strong. Untouched.
- **JS scroll-reveal implementation** (`getBoundingClientRect` + fallback
  timers instead of IntersectionObserver) — unusual but deliberately defensive
  per its own comments; works in every audited viewport. Untouched.
- **Footer social row** — still HTML-commented pending real handles
  (tracked in `docs/post-build-patches.md`).
- **Card 1 image choice** — the handoff nominally assigns the Makkah thumbnail
  to Services card 1; with the hero already using the Kaaba photo, the AlUla
  valley shot was kept for subject variety. Flagging in case the client prefers
  strict handoff fidelity.

## Verification

- Re-shot full page at 1440 / 768 / 620 / 390 after fixes: layout, imagery,
  footer, pills, and rhythm all render as intended; no overflow at any width.
- Headless Chrome console on load: no page errors.
- Site still works opened directly as `index.html` (no build step added).
