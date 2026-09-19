# Google Reviews for Wolt

A browser extension that shows Google Maps ratings and reviews for restaurants on [wolt.com](https://wolt.com).

- **Restaurant lists:** a `G ★ 4.6 (1.2K)` badge under each restaurant card, loaded as you scroll.
- **Restaurant pages:** a panel under the title with the rating, a link to Google Maps and up to 5 recent reviews.

It only works on the Wolt website in a desktop browser, not in the Wolt mobile app.

## How it works

```
wolt.com page ──> extension ──> Cloudflare Worker ──> Wolt venue API  (name, address, postcode)
   (content script)  (background)       │
                                        └───────────> Google Places API (New)
```

1. The content script finds venue slugs on the page (`/restaurant/<slug>` links).
2. The Worker gets the venue's name and address from Wolt's public venue endpoint and runs a Google Places text search.
3. The Worker accepts a result only if the **name overlaps and the street or postcode matches**, so it doesn't pick another branch of a chain or a different restaurant at the same address. See [`worker/src/match.ts`](worker/src/match.ts).
4. The match from Wolt slug to Google place ID is stored in KV. Place IDs are the only Google data the Maps Platform terms allow storing permanently. Ratings and reviews are always fetched fresh, and clients cache them for at most 1 hour.

**Hard spending cap:** Google Cloud can't cap spending. Budgets only send alerts, and Places API quotas are per minute. So the Worker counts every billable Google request in a Durable Object and refuses to make more once `GOOGLE_DAILY_LIMIT` (default 100) or `GOOGLE_MONTHLY_LIMIT` (default 2000) is reached. Both are set in [`worker/wrangler.jsonc`](worker/wrangler.jsonc). At the defaults, the worst case (every request on the most expensive SKU) is about $40/month. Normal personal use should stay within the free allowance.

The Google API key lives only in the Worker. The Worker answers only for Wolt slugs, so nobody can use it as a free general-purpose Places API proxy. Requests are rate-limited per IP.

## Setup

### 1. Google API key

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and turn on billing.
2. Enable **Places API (New)**.
3. Create an API key and, under *API restrictions*, restrict it to **Places API (New)**.
4. As a second safety net alongside the Worker's cap, set a budget alert under *Billing → Budgets & alerts* and lower the per-minute quotas under *Google Maps Platform → Quotas → Places API (New)* (e.g. 10/min for Text Search and Place Details).

The key can't be restricted to Cloudflare. Workers don't send requests from a fixed IP address, and a referrer restriction does nothing for a server-side key. The API restriction plus keeping the key in the Worker's secret store is the protection.

About cost: rating fields bill at the Places **Enterprise** tier, and reviews add **Atmosphere**. Each tier has a monthly free allowance, which covers personal use. Current prices are on the [pricing page](https://developers.google.com/maps/billing-and-pricing/pricing). A restaurant page is 1 request. On a list page, each card you scroll past is 1 request. You can turn list badges off in the extension options.

### 2. Worker (Cloudflare, free tier is enough)

```sh
npm install
cd worker
npx wrangler login
npx wrangler secret put GOOGLE_PLACES_API_KEY
npx wrangler deploy        # creates the PLACE_IDS KV namespace and the UsageCap Durable Object
```

For local development, put `GOOGLE_PLACES_API_KEY=...` in `worker/.dev.vars` and run `npm run dev` (serves on `http://localhost:8787`).

### 3. Extension

```sh
cd extension
API_BASE=https://wolt-google-reviews.<your-subdomain>.workers.dev npm run build
```

(Without `API_BASE` it points to `http://localhost:8787`.)

In Chrome, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and select `extension/dist`. Then open wolt.com.

## Publishing checklist

- [ ] Icons (16/48/128 px) in `extension/static` and listed in the manifest
- [ ] Once the extension has a fixed ID, set `ALLOWED_ORIGINS` in `worker/wrangler.jsonc` to `chrome-extension://<id>`
- [ ] Privacy policy for the store listing (the extension sends Wolt venue slugs to your Worker; nothing personal)
- [ ] `npm run package --workspace extension` → upload `wolt-google-reviews.zip`
- [ ] Firefox build (MV3 background `scripts` instead of `service_worker`)

## Development

```sh
npm test          # matching logic unit tests
npm run typecheck
npm run build     # extension -> extension/dist
npm run watch --workspace extension
```

If badges stop showing up, Wolt has probably changed its markup. The selectors are at the top of [`extension/src/content.ts`](extension/src/content.ts).

Not affiliated with Wolt or Google.
