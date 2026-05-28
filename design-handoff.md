# SoulTrip — Design Handoff (One-Shot Brief)

You are building the **complete production frontend** for SoulTrip Travel and Tours Ltd in a single pass. This document is the only source of truth — do not ask follow-up questions, do not stub, do not leave TODOs. Output deployable code.

---

## 1. Deliverable contract

- **What to output:** one self-contained static site, ready to drop into a `/` of a GitHub Pages repo.
- **Files expected:**
  - `index.html`
  - `assets/css/styles.css`
  - `assets/js/main.js`
  - (optionally) `assets/fonts/` if you self-host a brand font; otherwise use Google Fonts via `<link>`.
  - **Do NOT include** any image files — they already exist at `images/...` (see manifest §7). Reference them in HTML/CSS with those exact paths.
- **No build step.** Vanilla HTML, CSS, JS. No npm, no bundler, no framework, no TypeScript. The site must work by double-clicking `index.html`.
- **No external runtime deps** beyond: Google Fonts, a CDN icon font OR inline SVG icons (prefer inline SVG), and the Formspree form action URL (a placeholder constant — see §6).
- **Browser support:** modern evergreen browsers (last 2 versions of Chrome/Safari/Firefox/Edge) + iOS Safari 15+. No IE.
- **Perf budget:** First contentful paint < 1.5s on a throttled 4G mobile. Total page weight < 2 MB *excluding* images. Lazy-load all `<img>` below the fold (`loading="lazy"`).
- **Accessibility:** semantic HTML5, all images have meaningful `alt`, form fields have `<label>`, contrast meets WCAG AA, focus states visible, skip-to-content link, `prefers-reduced-motion` respected.
- **SEO basics:** descriptive `<title>`, meta description, Open Graph tags (og:title, og:description, og:image pointing to `images/business/kafd-vision-2030.jpg`), favicon link (placeholder `/favicon.ico`).

---

## 2. Site structure — single long landing page

One scrolling page with sticky top nav anchoring to in-page sections. Order:

1. **Header / Nav** (sticky, transparent over hero, solid on scroll)
2. **Hero** (full-viewport)
3. **Short Intro Strip** (the "shorter homepage version" copy)
4. **About**
5. **Services** (4 cards in a 2×2 / responsive grid)
6. **Why Choose SoulTrip** (6 trust pills)
7. **Vision 2030** (image-led section)
8. **Hajj & Umrah** (separate hero-style block, gold-accented)
9. **Trusted Partnerships** (15-years-experience trust block)
10. **Customer Commitment** (short reassurance block)
11. **Price Match Guarantee** (CTA-style band)
12. **Enquiry Form**
13. **Footer**
14. **Floating WhatsApp button** (bottom-right, all viewports)

Nav links: `About`, `Services`, `Vision 2030`, `Hajj & Umrah`, `Enquire`. Hide nav links on mobile behind a hamburger; show CTA "Enquire" button always.

---

## 3. Brand system

### 3.1 Colour palette

| Token | Hex | Use |
|---|---|---|
| `--emerald-900` | `#0B3D2E` | Primary brand; nav (scrolled), section headings, footer bg |
| `--emerald-700` | `#14573F` | Hover states, accents |
| `--gold-500`    | `#C9A24B` | Primary accent (buttons, dividers, icon strokes) |
| `--gold-300`    | `#E6CB85` | Hover gold, soft highlights |
| `--sand-100`    | `#F6EFE2` | Section backgrounds (alternating) |
| `--sand-200`    | `#EADFC8` | Card backgrounds, subtle dividers |
| `--ink-900`     | `#1A1A1A` | Body text |
| `--ink-600`     | `#4A4A4A` | Secondary text |
| `--white`       | `#FFFFFF` | Base bg, button text on emerald |

### 3.2 Typography

- **Display / Headings:** `"Playfair Display", "Cormorant Garamond", serif` — elegant, editorial. (Google Fonts.)
- **Body / UI:** `"Inter", system-ui, -apple-system, sans-serif`.
- **Optional accent (use sparingly, eyebrow labels only):** `"Cormorant Garamond"` italic for the small eyebrow above section headings, e.g. *"Our Services"*.
- Sizes (fluid `clamp()`):
  - H1 hero: `clamp(2.5rem, 6vw, 4.5rem)`
  - H2 section: `clamp(2rem, 4vw, 3rem)`
  - H3 card title: `1.5rem`
  - Body: `1.0625rem / 1.6 line-height`
  - Eyebrow: `0.875rem`, uppercase, letter-spacing `0.18em`, gold

### 3.3 Visual language

- **Aesthetic:** luxury Islamic modern. Minimal, generous whitespace, editorial photography, hairline gold accents.
- **Decorative element:** a subtle Arabic-inspired geometric line motif (e.g. an 8-point star or interlocking arabesque) used as a divider between sections — render as inline SVG, stroked in `--gold-500`, 1px. Use **sparingly** — once per section divider max. Do not bury text behind it.
- **Corners:** soft, 12–16px radius on cards. Buttons 8px or fully pill (chooser's call, pick one and stay consistent).
- **Shadows:** very soft, e.g. `0 8px 30px rgba(11,61,46,0.08)`. Avoid harsh drop shadows.
- **Imagery treatment:** full-bleed where it works; warm, slightly desaturated overlay (e.g. `linear-gradient(180deg, rgba(11,61,46,0.55), rgba(11,61,46,0.15))`) when text sits on top.
- **No emoji** in copy or UI. Icons are line-style SVG, 24×24, stroke `--emerald-900` or `--gold-500`.

### 3.4 Motion

- Subtle. Fade + 12px translate-up on scroll-in (IntersectionObserver). 400ms ease-out.
- Button hover: background colour transition 200ms.
- Respect `@media (prefers-reduced-motion: reduce)` — disable all transitions/animations.

---

## 4. Page sections — copy verbatim + layout notes

> All copy below is final. Use **exactly** these words. Markdown is for this brief; render as appropriate HTML.

### 4.1 Header / Nav

- Logo: text-only wordmark **"SoulTrip"** in Playfair Display, with smaller "Travel & Tours" eyebrow underneath in Inter caps. Colour: white over hero, emerald-900 once scrolled.
- Right side: nav links + a gold-filled "Enquire" button that scrolls to `#enquiry`.

### 4.2 Hero

- Background image: `images/business/kafd-vision-2030.jpg` (Riyadh skyline w/ Vision 2030 logo — note the Vision 2030 mark is visible in the photo, that's fine and on-brand) OR `images/business/riyadh-skyline-night-aerial.jpg` if a cleaner backdrop is preferred. **Choose one, use it full-bleed.** Apply a dark emerald gradient overlay so text is readable.
- Headline (H1):
  > **Reconnect With Your Soul. Discover New Opportunities. Experience Saudi Arabia.**
- Subheading (paragraph):
  > SoulTrip Travel and Tours Ltd offers spiritually enriching journeys, premium Hajj & Umrah experiences, business travel solutions, trade delegation support, hotel bookings, transportation services, and tailored Saudi Arabia travel experiences aligned with the exciting future of Vision 2030.
- Two buttons side-by-side:
  - Primary (gold fill, emerald text): **Start Your Journey** → scrolls to `#enquiry`
  - Secondary (transparent w/ white border): **Enquire Today** → scrolls to `#enquiry`

### 4.3 Short Intro Strip (sits directly under hero)

A narrow band, sand-100 background, centred text, two short paragraphs:

> Trusted UK & Saudi-based travel specialists offering spiritual journeys, Hajj & Umrah packages, business travel support, hotels, transport, exhibitions, and investment trips throughout Saudi Arabia.
>
> Working with officially registered Saudi partners built on over 15 years of trusted relationships, we focus on customer satisfaction, ease, reliability, and competitive pricing — taking the stress away so you can focus on your journey.

### 4.4 About — `#about`

Eyebrow: *About Us*
Heading: **Welcome to SoulTrip Travel and Tours Ltd**

Body:
> At SoulTrip Travel and Tours Ltd, we believe travel should transform both the heart and the mind.
>
> Our mission is to help individuals, families, entrepreneurs, and organisations reconnect spiritually while also exploring the incredible opportunities emerging across Saudi Arabia through Vision 2030.

Sub-heading: *Whether you are travelling for:*

Two-column list (8 items, render as a clean two-column grid with gold bullet markers):
- Hajj or Umrah
- Spiritual reflection and Islamic heritage
- Business expansion
- Trade exhibitions and conferences
- Property investment
- Relocation opportunities
- Corporate networking
- Tourism and leisure

Closing paragraph:
> we provide a seamless, personalised, and premium travel experience designed around your needs. We combine spiritual journeys with modern travel solutions, helping our clients discover both purpose and opportunity.

Layout: text left, supporting image right on desktop — use `images/experiences/diriyah-heritage-village.jpg` (warm Najdi architecture, reads as "heritage + heart"). Stack on mobile.

### 4.5 Services — `#services`

Eyebrow: *What We Offer*
Heading: **Our Services**

Four service cards in a responsive grid (2×2 desktop, 1-column mobile). Each card: image at top, then title, description, then a bulleted list of offerings.

**Card 1 — Spiritual Journeys**
- Image: `images/hajj-umrah/makkah-clock-tower-aerial-sunset.jpg`
- Description: Reconnect with your faith and inner peace through carefully curated spiritual experiences.
- Bullets: Hajj Packages · Umrah Packages · Islamic Heritage Tours · Group Spiritual Retreats · Family Religious Tours · VIP & Custom Packages

**Card 2 — Business Travel & Saudi Opportunities**
- Image: `images/business/kafd-financial-district-aerial.jpg`
- Description: Saudi Arabia is rapidly becoming one of the world's leading destinations for business, innovation, tourism, and investment.
- Bullets: Business Travel Planning · Trade Show & Exhibition Visits · Corporate Delegations · Networking Trips · Market Exploration Visits · Export & Import Support · Relocation Guidance · Property Viewing Trips · Investor Visits

**Card 3 — Hotels & Accommodation**
- Image: `images/experiences/intercontinental-hotel-entrance.jpg`
- Description: Premium accommodation solutions across Saudi Arabia.
- Bullets: Luxury Hotels · Family Accommodation · Executive Business Stays · Short & Long-Term Bookings · Group Accommodation

**Card 4 — Transportation Services**
- Image: `images/business/al-faisaliah-tower-night.jpg` *(reads as "premium city travel")*
- Description: Reliable transportation tailored to your journey.
- Bullets: Airport Transfers · Chauffeur Services · Group Coaches · VIP Transport · Intercity Travel · Business Transport Solutions

### 4.6 Why Choose SoulTrip — `#why`

Eyebrow: *Our Promise*
Heading: **Why Choose SoulTrip?**

Background: sand-100. Six pill/badge cards in a 3×2 grid (1-column mobile). Each is a small card with a line-style gold SVG icon + label. No body copy:

- Personalised Travel Experiences
- Spiritual & Business Expertise
- Trusted Saudi Arabia Travel Knowledge
- Professional & Reliable Service
- Tailor-Made Packages
- Strong Focus on Comfort, Purpose & Growth

Suggested icons (pick reasonable line-SVGs): user-star, briefcase, map-pin, shield-check, sliders, heart.

### 4.7 Vision 2030 — `#vision-2030`

Full-bleed image-led section. Background image: `images/business/saudi-pavilion-trade-show.jpg` *or* `images/business/riyadh-skyline-night-aerial.jpg` — pick the more cinematic. Dark emerald overlay. Light text.

Eyebrow: *The Future is Here*
Heading: **Discover the Future of Saudi Arabia**

Body:
> Saudi Arabia is opening its doors to the world through Vision 2030 — creating exciting opportunities in tourism, technology, hospitality, construction, trade, sports, and investment.
>
> With global events including the upcoming FIFA World Cup and rapid national development, now is the perfect time to explore Saudi Arabia for both spiritual enrichment and business growth.
>
> SoulTrip helps you navigate these opportunities with confidence.

Below body, a horizontal scrolling rail (or simple 3-up grid) of small images with captions:
- `images/business/kafd-vision-2030.jpg` — *Vision 2030*
- `images/business/jax-district-towers-rendering.jpg` — *New Riyadh Districts*
- `images/experiences/sheybarah-red-sea-villas.jpg` — *Tourism & Hospitality*
- `images/experiences/alula-valley-vista.jpg` — *Heritage & Discovery*

### 4.8 Hajj & Umrah — `#hajj-umrah`

Distinct treatment: emerald-900 background, gold heading. Suggests reverence and warmth.

Eyebrow (in gold-300): *A Sacred Journey*
Heading: **Your Sacred Journey Starts Here**

Body (light cream text):
> We understand the importance of Hajj and Umrah and the emotions connected to these blessed journeys.
>
> Our team aims to make your experience peaceful, comfortable, organised, and spiritually uplifting from beginning to end.

Sub-heading: *Packages can include:*

Six-item grid (3×2 desktop, 2-column mobile), each with a small gold icon:
- Flights
- Hotels
- Visa Assistance
- Guided Support
- Ground Transportation
- Group & Private Packages

CTA at bottom: gold pill button **"Enquire About Hajj & Umrah"** → `#enquiry` with the form's enquiry-type pre-set to "Umrah" via URL fragment (`#enquiry?type=umrah`) — JS reads the fragment and sets the select default.

Side image (or background): `images/hajj-umrah/makkah-clock-tower-aerial-sunset.jpg`.

### 4.9 Trusted Partnerships — `#partnerships`

Sand-200 background.
Eyebrow: *15+ Years of Trust*
Heading: **Trusted Partnerships Across Saudi Arabia**

Body:
> At SoulTrip Travel and Tours Ltd, we proudly work alongside officially registered and trusted business partners based in Saudi Arabia, with over 15 years of strong relationships and experience built on trust, professionalism, and reliability.
>
> These long-standing partnerships allow us to provide our clients with:

Bulleted list (2-column on desktop, gold check icons):
- Reliable local support
- Trusted accommodation providers
- Professional transportation services
- Business networking opportunities
- Access to exhibitions and trade events
- Local guidance and assistance throughout your journey

Closing:
> Whether you are travelling for spiritual purposes, tourism, or business expansion, you can travel with confidence knowing you are supported both in the UK and within Saudi Arabia.

Supporting image (right column on desktop): `images/business/saudi-trade-delegation.jpg`.

### 4.10 Customer Commitment

White background, narrow centred column, no image.
Eyebrow: *Customer First*
Heading: **Your Journey Made Simple**

Body:
> Our main priority is customer satisfaction, comfort, and ease.
>
> We understand that organising international travel, spiritual journeys, or business trips can sometimes feel overwhelming — which is why we aim to take away the stress and handle every detail for you.
>
> From flights and hotels to transport and local arrangements, our goal is to provide a smooth, professional, and hassle-free experience from beginning to end.

### 4.11 Price Match Guarantee

Full-width band, emerald-900 background, gold accent rule, centred text.
Eyebrow (gold-300): *Competitive Pricing*
Heading (white): **Try Our Price Match Guarantee**

Body (cream):
> We are committed to offering exceptional value without compromising on quality or service.
>
> If you receive a like-for-like quote elsewhere, speak to our team about our **Price Match Guarantee** — because we aim to provide some of the most competitive prices available while still delivering a premium experience.

Sub-line (gold, smaller): *Affordable. Reliable. Professional.*

Single CTA button (gold pill): **"Request a Quote"** → `#enquiry`.

### 4.12 Enquiry Form — `#enquiry`

Sand-100 background. Two-column layout on desktop: left column holds heading + reassurance copy + contact strip; right column holds the form card (white, soft shadow).

Eyebrow: *Get in Touch*
Heading: **Start Your Journey**
Sub: *Tell us about your trip and our team will respond within one working day.*

Contact strip (left column, under heading):
- Phone: `+44 [TBC]`
- Email: `info@soultrip.[TBC]`
- WhatsApp: `+44 [TBC]`

Form fields (in this order):

| Field | Type | Required | Notes |
|---|---|---|---|
| Full Name | text | yes | |
| Phone Number | tel | yes | |
| Email Address | email | yes | |
| Type of Enquiry | select | yes | Options: Hajj, Umrah, Spiritual Tour, Business Travel, Trade Shows & Exhibitions, Property Visits, Hotel Booking, Transportation, Other |
| Preferred Travel Dates | text | no | placeholder "e.g. March 2026 or flexible" |
| Number of Travellers | number | no | min 1 |
| Message | textarea | no | rows=5, placeholder "Tell us about your journey…" |

Submit button (gold pill, full-width on mobile): **Submit Enquiry**

After successful submission: replace form with a centred confirmation panel —
> **Thank you. Your enquiry has been received.**
>
> Our team will be in touch within one working day, inshaAllah.
>
> Need a faster response? Message us on WhatsApp.

### 4.13 Footer

Emerald-900 background, cream text.

Column 1 — Brand:
> **SoulTrip Travel and Tours Ltd**
> *Reconnect Spiritually. Explore Globally.*

Column 2 — What we offer (link list, anchors to sections):
- Hajj & Umrah
- Spiritual Retreats
- Saudi Business Travel
- Hotels & Transportation
- Vision 2030 Opportunities

Column 3 — Contact:
- Phone: `+44 [TBC]`
- Email: `info@soultrip.[TBC]`
- WhatsApp: `+44 [TBC]`
- Social: Instagram `[TBC]`, Facebook `[TBC]`, LinkedIn `[TBC]` (icon row)

Bottom bar (centred, smaller text):
> © 2026 SoulTrip Travel and Tours Ltd. All rights reserved.
> *Trusted UK & Saudi-based travel specialists.*

### 4.14 Floating WhatsApp button

Fixed bottom-right, 56×56 circle, WhatsApp green (`#25D366`), white icon. Subtle hover scale. Tooltip on hover: "Chat on WhatsApp". `href="https://wa.me/[TBC]"` — leave the number as `[TBC]` in the URL too.

---

## 5. Deliberately deferred (do not build)

To keep cost zero and turnaround tight, the following spec items are **explicitly out of scope** for this build:

- Online brochure PDF download (no PDF exists yet)
- Instagram gallery embed (avoids paid API quota; the Instagram link in footer suffices)
- Testimonials section (no real testimonials yet — fake ones erode trust)
- Multi-page architecture (single page covers all sections)
- CMS / admin (copy edits happen in HTML directly)
- Cookie banner / consent UI (no analytics, no third-party trackers — so not required)

If the design naturally calls for a placeholder spot for testimonials, you may include a simple "Testimonials coming soon" empty state, but don't fabricate quotes.

---

## 6. Form integration

The form posts to **Formspree** (free tier). Use this exact pattern:

```html
<form action="https://formspree.io/f/FORMSPREE_FORM_ID" method="POST" id="enquiry-form">
```

Leave the literal string `FORMSPREE_FORM_ID` in the markup — the deploy step replaces it.

JS requirements:
- Intercept submit (`fetch` POST, JSON `Accept` header for Formspree's async response).
- On 200, hide form, show success panel.
- On error, show inline error: *"Something went wrong. Please try again or message us on WhatsApp."*
- Honeypot field: hidden `<input name="_gotcha">` for spam protection.
- Set `data-type` on the select; on page load read `location.hash` — if it contains `type=umrah` (or any value), preselect.

---

## 7. Image manifest — final filenames

These are the only image assets available. Use them as suggested in §4; do not invent paths.

**`images/business/`**
- `kafd-vision-2030.jpg` — Riyadh skyline at sunset with Vision 2030 logo overlay
- `kafd-financial-district-aerial.jpg` — King Abdullah Financial District towers, golden hour, vertical aerial
- `riyadh-skyline-night-aerial.jpg` — Riyadh skyline at night with Kingdom Centre, wide aerial
- `riyadh-kingdom-centre-night.jpg` — Kingdom Centre tower at dusk, city lights below
- `al-faisaliah-tower-night.jpg` — Al Faisaliah tower at night, vertical, dramatic
- `jax-district-towers-rendering.jpg` — Modern glass tower rendering, daytime
- `saudi-exhibition-crowd.jpg` — Trade exhibition crowd in thobes
- `saudi-pavilion-trade-show.jpg` — Saudi tourism pavilion at international expo
- `saudi-trade-delegation.jpg` — Saudi delegation in formal dress at a trade event

**`images/hajj-umrah/`**
- `makkah-clock-tower-aerial-sunset.jpg` — Aerial of Makkah Royal Clock Tower and Masjid al-Haram at sunset

**`images/experiences/`**
- `empty-quarter-camels-dunes.jpg` — Camels and figures crossing golden sand dunes
- `hegra-tombs-alula.jpg` — Hegra (Mada'in Saleh) Nabataean rock tombs at AlUla
- `hegra-camels-grazing.jpg` — Camels grazing near AlUla rock formation
- `alula-valley-vista.jpg` — Two figures in Saudi dress overlooking AlUla palm valley
- `diriyah-heritage-village.jpg` — Traditional Najdi mud-brick architecture, Diriyah
- `intercontinental-hotel-entrance.jpg` — Luxury hotel entrance, illuminated, night
- `sheybarah-red-sea-villas.jpg` — Sheybarah overwater villas, Red Sea Project

**`images/styleboard/`** — moodboard reference for visual direction (do **not** embed in the site)
- `styleboard-01.jpg` through `styleboard-09.jpg`
- **`styleboard-04.jpg` is the client's preferred reference for overall look and feel** — lean the design's typography, palette balance, photo treatment, and spacing toward what that image conveys.

### Sourcing additional imagery
If a section genuinely needs an image that isn't in the manifest (e.g. richer Madinah / Masjid an-Nabawi imagery for the Hajj & Umrah section, or supporting hotel/transport visuals), you may source **royalty-free, commercial-use** photography from **Unsplash, Pexels, or Pixabay**. Constraints:
- Licence must explicitly permit commercial use with no attribution required (Unsplash / Pexels / Pixabay licences all qualify; Wikimedia and Flickr CC-BY-SA do **not** — skip them).
- Save any sourced images under the appropriate themed folder (`images/hajj-umrah/`, `images/experiences/`, `images/business/`) using the same kebab-case naming convention.
- Add the new file paths into your HTML; do not link to remote URLs.
- Cap additional images at **5 total** — the site should remain image-light and fast.
- Prefer images that match the warm, editorial, gold-toned palette of `styleboard-04.jpg`.

### Image use notes
- Hero candidates: `kafd-vision-2030.jpg` *or* `riyadh-skyline-night-aerial.jpg`. Choose the one that frames more open sky for headline overlay.
- For the Hajj/Umrah section, you only have one Makkah image. Use it as the section background **and** as the Card 1 thumbnail — that's fine, it's a hero asset.
- If a section needs a small decorative image and the suggested one is taken, fall back to another image from the same theme folder.
- Always include meaningful `alt` text describing the photo (e.g. "Aerial view of Masjid al-Haram and the Makkah Royal Clock Tower at sunset"). Don't repeat the filename.

---

## 8. Tech checklist (final, before you finish)

- [ ] Single `index.html`, valid HTML5, lang="en"
- [ ] CSS uses custom properties for all colour/font tokens declared in §3
- [ ] Mobile-first responsive: works at 320, 375, 768, 1024, 1440 widths
- [ ] All sections have `id`s matching anchor links
- [ ] Sticky nav transitions transparent → solid on scroll
- [ ] Hamburger menu on mobile (≤768px)
- [ ] All images have `loading="lazy"` except the hero image
- [ ] All images have meaningful `alt`
- [ ] Form has labels, required attributes, honeypot, JS submit handler, success/error states
- [ ] Floating WhatsApp button on every viewport
- [ ] `prefers-reduced-motion` honoured
- [ ] Page passes Lighthouse accessibility ≥ 95
- [ ] No console errors

Ship it.
