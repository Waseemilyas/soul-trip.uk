# Post-build patch list

The handoff to Claude Design went out **before** the registered company details and the domain were captured. Apply the following patches to the returned site before deploying.

## 1. Footer — legal disclosure (REQUIRED)

The original handoff footer ended with:
> © 2026 SoulTrip Travel and Tours Ltd. All rights reserved.
> *Trusted UK & Saudi-based travel specialists.*

Replace the bottom bar with a two-line version that satisfies the **Companies (Trading Disclosures) Regulations 2008** + **Companies Act 2006 s.82**:

> © 2026 Soul Trip Travel and Tours Ltd. All rights reserved. · *Trusted UK & Saudi-based travel specialists.*
>
> SOUL TRIP TRAVEL AND TOURS LTD is a company registered in England & Wales. Company number **16843871**. Registered office: 71-75 Shelton Street, Covent Garden, London, WC2H 9JQ.

Keep the registered name in caps exactly as shown. Do not omit the company number or registered office.

## 2. Domain wiring

Primary domain: **soul-trip.uk** (Cloudflare).

- Update canonical link tag: `<link rel="canonical" href="https://soul-trip.uk/">`
- Update Open Graph URL: `<meta property="og:url" content="https://soul-trip.uk/">`
- Update any hard-coded URLs in JSON-LD / meta if present.
- Add `CNAME` file at repo root containing the single line: `soul-trip.uk`

## 3. Contact placeholders

Replace placeholders in both the contact strip (enquiry section) and footer:

| Placeholder | Replace with |
|---|---|
| `info@soultrip.[TBC]` | `info@soul-trip.uk` |
| `+44 [TBC]` (phone) | *still TBC — leave as `[TBC]` until client provides* |
| `+44 [TBC]` (WhatsApp) | *still TBC — leave as `[TBC]`* |
| `https://wa.me/[TBC]` | *still TBC* |
| Social links `[TBC]` | *still TBC — leave links inert (`#`) until handles confirmed* |

Phone, WhatsApp and socials are not yet known. Keep them flagged visibly so the client can spot and fill them.

## 4. Formspree

Replace `FORMSPREE_FORM_ID` in `index.html` with the real form ID after creating the form at https://formspree.io. Confirm a test submission lands in the destination inbox before going live.

## 5. Deploy checklist

- [ ] Repo pushed to GitHub (public or private with Pages enabled).
- [ ] `CNAME` file present at repo root.
- [ ] GitHub Pages settings → Source: `main` / root, custom domain `soul-trip.uk`, "Enforce HTTPS" ticked once cert provisions.
- [ ] Cloudflare DNS: A + AAAA records to GitHub IPs (see `company-details.md` §Domain & hosting), `www` CNAME to `<user>.github.io`, both **DNS-only** initially.
- [ ] After TLS cert issued by GitHub: optionally flip Cloudflare proxy to **proxied** (orange cloud) for caching + WAF.
- [ ] Cloudflare Email Routing: `info@soul-trip.uk` → personal inbox.
- [ ] Lighthouse check: ≥95 accessibility, ≥90 performance on mobile.
- [ ] Test enquiry submission end-to-end.
- [ ] Test WhatsApp button once number is in.
