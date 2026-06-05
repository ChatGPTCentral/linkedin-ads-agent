# LinkedIn Ads API integration

Connects the app to your LinkedIn ad account to **(1) validate audience reach**,
**(2) pull reporting**, and **(3) create paused draft campaigns** from the
audiences we designed. Campaigns are always created **PAUSED** — nothing spends
money without a human launching it in Campaign Manager.

> Status: foundation built. The OAuth + token flow is standard and ready. The
> LinkedIn **read/write payload encodings** (Audience Counts query, targeting
> URN resolution, campaign/creative bodies) are best-effort and need tuning
> against live API responses — the routes return raw responses + the resolved
> targeting so we can iterate quickly once connected. **Creative creation is not
> yet automated** (add the creative in Campaign Manager for now).

## 1. LinkedIn developer app
- App must have the **Advertising API** product approved, with scopes
  `r_ads`, `rw_ads`, `r_ads_reporting` (you confirmed full `rw_ads`).
- Under **Auth**, add Authorized redirect URLs:
  - `http://localhost:3000/api/linkedin/callback` (local)
  - `https://<your-domain>/api/linkedin/callback` (production)

## 2. Environment variables
Set these in **Vercel → Settings → Environment Variables** (Production) and in
`.env.local` for local dev (see `.env.local.example`):

| Var | Value |
|-----|-------|
| `LINKEDIN_CLIENT_ID` | App's Client ID |
| `LINKEDIN_CLIENT_SECRET` | App's Client Secret |
| `LINKEDIN_REDIRECT_URI` | Exactly matches an authorized redirect URL above |
| `LINKEDIN_API_VERSION` | e.g. `202411` (optional) |
| `TOKEN_ENC_KEY` | `openssl rand -base64 32` (encrypts the token cookie) |

Redeploy after setting them.

## 3. Connect & use
1. Open **/connect** in the app.
2. Click **Connect LinkedIn** → authorize → you're redirected back connected.
3. Pick your **Ad account URN** (`urn:li:sponsoredAccount:…`).
4. **Live reach** → real Audience Counts for each designed audience.
5. **Create draft campaign** → PAUSED campaign group + campaign with mapped
   targeting; add a creative + review, then launch in Campaign Manager.

## Architecture
- `src/lib/linkedin/` — config, OAuth, encrypted cookie token store, REST client,
  facet→URN targeting resolver.
- `src/app/api/linkedin/*` — route handlers: `auth`, `callback`, `status`,
  `disconnect`, `audience-counts`, `analytics`, `campaigns`.
- Token: encrypted (AES-256-GCM) httpOnly cookie. Upgrade to Supabase if multiple
  operators need shared state.

## Known verification points (tune once live)
- `adTargetingEntities` typeahead query encoding (locations, industries, titles, skills).
- Seniority / function / staffCountRange URN ids.
- `audienceCounts` and `adAnalytics` query parameter encoding (RestLi).
- Created-entity id header name on POST (`x-restli-id`).
- Creative creation (image upload + sponsored post) — not yet implemented.
