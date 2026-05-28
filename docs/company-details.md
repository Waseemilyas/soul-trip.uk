# Company Details — Soul Trip Travel and Tours Ltd

Source: Companies House — https://find-and-update.company-information.service.gov.uk/company/16843871
Fetched: 2026-05-28

## Registered details

| Field | Value |
|---|---|
| Registered name | **SOUL TRIP TRAVEL AND TOURS LTD** |
| Trading / brand name | SoulTrip Travel and Tours |
| Company number | **16843871** |
| Company type | Private limited company |
| Incorporation date | 10 November 2025 |
| Status | Active |
| Registered office | 71-75 Shelton Street, Covent Garden, London, WC2H 9JQ, United Kingdom |

## Nature of business (SIC codes)

- **79110** — Travel agency activities
- **79120** — Tour operator activities
- **96090** — Other service activities not elsewhere classified

## Domain & hosting

| Field | Value |
|---|---|
| Primary domain | **soul-trip.uk** |
| Registrar | Cloudflare (Automancer account) |
| DNS | Cloudflare |
| Hosting target | GitHub Pages (custom domain via `CNAME` file + DNS records) |
| Canonical URL | `https://soul-trip.uk/` |
| Suggested email | `info@soul-trip.uk` (mailbox to be set up; can route via Cloudflare Email Routing → personal inbox at zero cost) |

### DNS records to add at deploy time
For GitHub Pages on an apex domain (`soul-trip.uk`):
- **A** records pointing to GitHub Pages: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
- **AAAA** records: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`
- **CNAME** `www` → `<github-username>.github.io`
- Cloudflare proxy: leave **DNS-only (grey cloud)** for the apex records during initial certificate provisioning, then can be flipped to proxied (orange cloud) once GitHub issues the TLS cert.
- Add a `CNAME` file at the repo root containing `soul-trip.uk` (single line, no scheme).

## Compliance dates

- First accounts due: **10 August 2027** (period to 30 November 2026)
- First confirmation statement due: **23 November 2026** (statement date 9 November 2026)

## Notes for the website

UK companies are required under the **Companies (Trading Disclosures) Regulations 2008** and **Companies Act 2006 s.82** to display the following on any website operated by or for the company:

- Registered company name (as registered, exactly)
- Company registration number
- Place of registration (England & Wales)
- Registered office address

These belong in the **footer bottom bar** of the site. The brand wordmark elsewhere can still use the stylised "SoulTrip" — only the formal disclosure needs the registered name.

### Recommended footer disclosure block
> SOUL TRIP TRAVEL AND TOURS LTD is a company registered in England & Wales.
> Company number 16843871. Registered office: 71-75 Shelton Street, Covent Garden, London, WC2H 9JQ.

### Open items
- Director(s) name(s) not yet captured from Companies House (officers page).
- ATOL / ABTA membership status — required if the company sells flights or packaged holidays. Confirm before the site goes live and add the relevant logos + numbers to the footer if applicable.
- `info@soul-trip.uk` mailbox: configure via Cloudflare Email Routing once the site is live (free, forwards to a personal inbox).
