# Credentials & secrets — where things live

This project's secrets live in `.env` at the repo root. That file is **gitignored** (`!.env.example` exception keeps the template committed). Do not paste credential values into chat, commit them, or include them in PR/issue text.

## What's in `.env`

| Var | Type | Rotate when |
|---|---|---|
| `FORMSPREE_PROJECT_ID` | Stable ID. Not a secret on its own. | Never (unless the Formspree project is replaced). |
| `FORMSPREE_DEPLOY_KEY` | **Secret** — grants deploy rights to the Formspree project. | Whenever shared, or on a quarterly schedule. Regenerate in the Formspree dashboard → project → CLI. |
| `CLOUDFLARE_ACCOUNT_ID` | Stable ID. Not a secret. | Never. |
| `CLOUDFLARE_ZONE_ID` | Stable ID. Not a secret. | Never (only if the zone is moved/recreated). |
| `CLOUDFLARE_API_TOKEN` | **Secret** — DNS edit access. Currently NOT stored — see below. | Each time it's shared, plus a quarterly rotation. |

## Cloudflare API token — special handling

The Cloudflare token used during initial setup was shared in a chat transcript and **must be rotated**. The `.env` deliberately keeps `CLOUDFLARE_API_TOKEN` empty with a `#` comment so future agents know to mint a fresh one rather than reuse a leaked value.

To mint a replacement:

1. https://dash.cloudflare.com/profile/api-tokens → **Create Token** → **Custom token**
2. Permissions: `Zone → Zone → Read` and `Zone → DNS → Edit`
3. Zone resources: **Include → Specific zone → soul-trip.uk**
4. (Optional) Client IP filtering, TTL ≤ 1 year
5. Paste the new token into the `.env` file's `CLOUDFLARE_API_TOKEN=` line, then delete the leading `#`.

## Formspree CLI — how to use the credentials

The form action URL pattern is `https://formspree.io/f/{form-hash}`. Deploying via the CLI produces those hashes from a `formspree.json` definition.

```bash
# From repo root
export $(grep -v '^#' .env | xargs)   # load .env into the shell
npx @formspree/cli deploy --key "$FORMSPREE_DEPLOY_KEY"
```

After `deploy`, each form's hash is printed to stdout — paste it into `index.html` wherever `FORMSPREE_FORM_ID` appears.

## What if `.env` is missing on a fresh checkout?

`.env` won't be in the cloned repo (it's gitignored). On a fresh machine:

1. Copy `.env.example` → `.env`.
2. Look up the missing values:
   - Formspree project + deploy key: Formspree dashboard for `soul-trip-enquiry` project.
   - Cloudflare account/zone IDs: `curl … /zones?name=soul-trip.uk` with any valid token, or read from the dashboard URL.
   - Cloudflare API token: mint a new one (see above).

Never restore from chat transcripts — assume any token in chat is burned.
