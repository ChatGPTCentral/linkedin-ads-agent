# Google integration — GA4 (read) + Tag Manager (read/write) + Search Console (read)

Makes the app the funnel's **source of truth**: read GA4 to see what actually
happens, read/write **GTM** to deploy and repair tags (the LinkedIn Insight Tag,
purchase events) without hand-editing the site, and read Search Console for
organic context. Mirrors the LinkedIn integration (encrypted httpOnly cookie
token; single operator).

## 1. Google Cloud setup (one-time, ~10 min)
1. Create/pick a Google Cloud project.
2. **Enable APIs**: Google Analytics Data API, Tag Manager API, Google Search
   Console API. (Analytics Admin API is also used for property discovery.)
3. **OAuth consent screen**: External, publishing mode **Testing** is fine for a
   single operator — add your Google account under **Test users**. (The
   `analytics`/`tagmanager` scopes are sensitive; production/verification is
   only needed if you go beyond test users.)
4. **Credentials → Create OAuth client ID → Web application**. Authorized
   redirect URIs:
   - `https://linkedin-ads-agent-alexs-projects-566a42f9.vercel.app/api/google/callback`
   - `http://localhost:3000/api/google/callback` (local dev)
5. Make sure this Google account has access to the GA4 property, the GTM
   container, and the Search Console property for `thecentral.ai`.

## 2. Environment variables (Vercel → Production, then redeploy)
| Var | Value |
|-----|-------|
| `GOOGLE_CLIENT_ID` | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_REDIRECT_URI` | Exactly one authorized redirect URL above |
| `TOKEN_ENC_KEY` | already set for LinkedIn — reused |

Optional pins (otherwise discovered/passed per request): `GA4_PROPERTY_ID`,
`GTM_ACCOUNT_ID`, `GTM_CONTAINER_ID`, `SC_SITE_URL`, `LINKEDIN_INSIGHT_PARTNER_ID`
(defaults to `5552676`).

## 3. Connect & use
1. Open **`/api/google/auth`** (redirects to Google consent; grant the scopes).
2. **`/api/google/status`** → `connected:true` + discovered GA4 properties, GTM
   accounts/containers, Search Console sites.
3. **GA4** — `/api/google/ga4?propertyId=<id>&preset=channels|campaigns|landing|events&days=30`.
   Independent truth for "3,275 clicks → 0 tracked purchases": does GA4 record
   `purchase`, where do paid sessions land/drop.
4. **GTM** — read: `/api/google/gtm?accountId=&containerId=&workspaceId=`
   (cascades: no ids → accounts; then containers; then workspaces; then a full
   tags/triggers/variables inventory). Confirm whether the Insight Tag `5552676`
   and a purchase event exist and on which triggers.
5. **Search Console** — `/api/google/searchconsole?siteUrl=sc-domain:thecentral.ai&dimensions=query&days=28`.

## 4. Fixing tags via GTM (staged, safe)
Writes are staged in a workspace and only go live on an explicit, confirm-gated
publish. Flow (all `POST /api/google/gtm`):
1. `{ action:"build_insight_tag" }` → returns the ready Custom-HTML Insight tag
   payload (does **not** create it) for review.
2. `{ action:"create_tag", accountId, containerId, workspaceId, tag }` → creates
   it in the workspace (DRAFT, not live).
3. `{ action:"create_version", accountId, containerId, workspaceId, name, notes }`
   → snapshots the workspace into a container version.
4. `{ action:"publish", accountId, containerId, versionId, confirm:true }` →
   **goes live**. Without `confirm:true` it returns `needsConfirm` and does
   nothing.

Then verify the tag fires (GA4 realtime / LinkedIn Insight Tag status / Tag
Assistant) — first signal can take up to ~24h.

## Architecture
- `src/lib/google/` — `config`, `oauth` (offline access + refresh),
  `tokenStore` (`g_token` cookie), `client` (`getValidGoogleToken`, `gGet/gPost`),
  `types`. Shared crypto/state: `src/lib/tokenCrypto.ts`, `src/lib/oauthState.ts`.
- `src/app/api/google/*` — `auth`, `callback`, `status`, `disconnect`, `ga4`,
  `gtm`, `searchconsole`.
- Token: encrypted (AES-256-GCM) httpOnly cookie, separate from LinkedIn's.
  Upgrade to Supabase if multiple operators need shared state.
