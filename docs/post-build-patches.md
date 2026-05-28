# Post-build patch status

Tracking the patches that need to be applied between the Claude Design build landing and the site going live at `soul-trip.uk`.

Legend: ✅ done · ⏳ in progress / waiting on info · ❌ not started

---

## 1. ✅ Footer — legal disclosure

Footer bottom bar now carries the registered name in caps, company number, and registered office, per the Companies (Trading Disclosures) Regulations 2008 + Companies Act 2006 s.82. Added a `.footer__legal` style for the smaller compliance line.

Applied in commit on `index.html` and `assets/css/styles.css`.

## 2. ✅ Domain wiring

- `<link rel="canonical" href="https://soul-trip.uk/">` added.
- `<meta property="og:url" content="https://soul-trip.uk/">` added.
- `og:image` upgraded to absolute URL `https://soul-trip.uk/images/hajj-umrah/kaaba.jpg`.
- `CNAME` file at repo root containing `soul-trip.uk`.

## 3. Contact placeholders

| Placeholder | Status | Value |
|---|---|---|
| `info@soultrip.[TBC]` | ✅ replaced | `info@soul-trip.uk` |
| Phone `+44 [TBC]` | ❌ TBC | client to provide |
| WhatsApp `+44 [TBC]` | ❌ TBC | client to provide |
| `https://wa.me/[TBC]` | ❌ TBC | client to provide |
| Social handles `[TBC]` | ❌ TBC | Instagram / Facebook / LinkedIn handles |

## 4. ❌ Formspree

`FORMSPREE_FORM_ID` placeholder still in the form action. Need to:
1. Create a free Formspree form pointed at the destination email.
2. Replace the literal string `FORMSPREE_FORM_ID` in `index.html`.
3. Test a real submission lands in the inbox.

## 5. Deploy steps

| Step | Status | Notes |
|---|---|---|
| Repo on GitHub | ❌ | Need GitHub username + repo name. Repo must be **public** for free Pages, OR on GitHub Pro/Team for private. |
| Push current branch to GitHub | ❌ | After repo exists. |
| `CNAME` file at repo root | ✅ | Present. |
| GitHub Pages enabled, custom domain set | ❌ | After push. Source: `main` / root, custom domain `soul-trip.uk`, Enforce HTTPS once cert provisions. |
| Cloudflare DNS — apex A records | ✅ | 4 × A → 185.199.108–111.153, DNS-only (grey cloud). |
| Cloudflare DNS — apex AAAA records | ✅ | 4 × AAAA → 2606:50c0:8000–8003::153, DNS-only. |
| Cloudflare DNS — `www` CNAME | ❌ | Waiting on GitHub username — `www` → `<username>.github.io`, DNS-only. |
| Cloudflare proxy flip to orange | ❌ | After GitHub issues TLS cert (usually within minutes of Pages setup). Optional but recommended for caching + WAF. |
| Cloudflare Email Routing | ❌ | Add MX records for `soul-trip.uk` → Cloudflare's MX, then create routing rule `info@soul-trip.uk` → personal inbox. Free. |
| Lighthouse mobile (perf ≥90, a11y ≥95) | ❌ | After deploy. |
| Test enquiry form end-to-end | ❌ | After Formspree configured. |
| Test WhatsApp button | ❌ | After WhatsApp number provided. |

---

## What I still need from you

1. **GitHub username + chosen repo name** (e.g. `waseem-ilyas/soul-trip-website`). Public or private?
2. **Phone number** + **WhatsApp number** (separate or same)
3. **Social handles** for Instagram, Facebook, LinkedIn (or confirm we drop the icons that aren't applicable)
4. **Formspree form ID** (or confirm you want me to walk you through creating one, or want an alternative like Cloudflare Workers)
5. **Inbox to route `info@soul-trip.uk` to** (your personal email)
6. **ATOL / ABTA membership** status — only relevant if you'll sell flights / packaged holidays

## Security note

The Cloudflare API token shared in chat (`cfut_…`) should be **rotated** at the Cloudflare dashboard once deploy work is finished. Anything in chat may be cached or logged. Replace it with a new token if you need me to do more DNS work later.
