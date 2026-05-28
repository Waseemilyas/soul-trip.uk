# Post-build patch status

Tracking the patches that need to be applied between the Claude Design build landing and the site going live at `soul-trip.uk`.

Legend: ✅ done · ⏳ in progress / waiting on info · ❌ not started

---

## 🚀 Live at https://soul-trip.uk

Site built and reachable at **https://soul-trip.uk** (apex). Repo: `waseemilyas/soul-trip.uk` (public). Pages serving `main` / root.

---

## 1. ✅ Footer — legal disclosure

Bottom bar carries the registered name in caps, company number, and registered office, per Companies (Trading Disclosures) Regulations 2008 + Companies Act 2006 s.82. `.footer__legal` is centred (specificity fix applied).

## 2. ✅ Domain wiring

- `<link rel="canonical" href="https://soul-trip.uk/">`
- `<meta property="og:url" content="https://soul-trip.uk/">`
- `og:image` absolute URL
- `CNAME` file at repo root containing `soul-trip.uk`
- GitHub Pages: custom domain `soul-trip.uk`, **HTTPS enforced**

## 3. Contact placeholders

| Placeholder | Status | Value |
|---|---|---|
| `info@soultrip.[TBC]` | ✅ replaced | `info@soul-trip.uk` |
| Phone `+44 [TBC]` | ✅ baked in | `+44 7577 177172` |
| WhatsApp `+44 [TBC]` | ✅ baked in | `+44 7577 177172` (same number) |
| `https://wa.me/[TBC]` | ✅ replaced | `https://wa.me/447577177172` |
| Social handles `[TBC]` | ⏳ row hidden | HTML-commented in footer until handles arrive |

## 4. ✅ Formspree

- Project deployed via `@formspree/cli`: project `3011773691026472174`, form key `enquiry`.
- `<form action>` is `https://formspree.io/p/3011773691026472174/f/enquiry`.
- Probe submission was sent to confirm the endpoint accepts — that entry will be in the Formspree inbox; safe to discard.
- `formspree.json` checked in; credentials live in `.env`.

## 5. Deploy steps

| Step | Status | Notes |
|---|---|---|
| GitHub repo | ✅ | `waseemilyas/soul-trip.uk`, public |
| Push `main` | ✅ | All commits up to date |
| `CNAME` file at repo root | ✅ | `soul-trip.uk` |
| GitHub Pages enabled | ✅ | Source: `main` / root |
| GitHub Pages custom domain | ✅ | `soul-trip.uk` |
| GitHub Pages — HTTPS enforced | ✅ | TLS cert provisioned by GH |
| Cloudflare DNS — apex A records | ✅ | 4 × A → 185.199.108–111.153, DNS-only |
| Cloudflare DNS — apex AAAA records | ✅ | 4 × AAAA → 2606:50c0:8000–8003::153, DNS-only |
| Cloudflare DNS — `www` CNAME | ✅ | `www` → `waseemilyas.github.io`, DNS-only |
| Cloudflare proxy flip to orange | ⏳ | Optional. Keep DNS-only unless you want CF caching/WAF. If flipped, SSL mode must be **Full (strict)** to avoid loops with GH Pages. |
| Cloudflare Email Routing | ✅ | Configured manually in dashboard: `info@soul-trip.uk` → `waseem@automancer.uk`. |
| Lighthouse mobile (perf ≥90, a11y ≥95) | ❌ | Run from Chrome DevTools or PageSpeed Insights once you've eyeballed the live site. |
| Test enquiry form end-to-end | ⏳ | Probe POST returned `{"ok":true}`; recommend one real test from the live page. |

### Known minor caveats

- `https://www.soul-trip.uk` still TLS-fails — the apex cert (issued at 17:02 UTC, 2026-05-28) was provisioned **before** the `www` CNAME existed, so the SAN covers `soul-trip.uk` only. Cycled the cname off/on to nudge GH to re-issue; their cert pipeline can take up to 24 h. If a faster fix is wanted, verify the domain at https://github.com/settings/pages — that unlocks immediate re-issuance covering both apex + www.

## 6. ✅ Cloudflare Email Routing — done

Configured manually in the Cloudflare dashboard. `info@soul-trip.uk` → `waseem@automancer.uk`.

When Talib's Zoho mailbox is ready, swap the routing destination to that address, or migrate MX records over to Zoho directly.

---

## What I still need from you

1. **Social handles** for Instagram / Facebook / LinkedIn when ready (row hidden in footer).
2. **ATOL / ABTA membership** status — needed only if Soul Trip will sell flights / packaged holidays.

## Security follow-up

The Cloudflare API token shared earlier (`cfut_…`) should now be **rotated**. Cloudflare → My Profile → API Tokens → revoke. If you need me to do more DNS work later, mint a fresh scoped token (Zone:Read + DNS:Edit + Email Routing if applicable) and paste it then.
