// API used by the browser extension. It only answers questions about Wolt
// venues (by slug), so it can't be used as a general Google Places proxy.
//
//   GET /v1/venues/:slug           -> rating summary
//   GET /v1/venues/:slug/reviews   -> rating summary + up to 5 reviews
//   optional ?lang=xx for review/display language

import { getPlace, searchText, GoogleApiError, type GooglePlace } from "./google";
import { pickBestMatch } from "./match";
import { fetchWoltVenue, searchQuery, SLUG_RE } from "./wolt";

export interface Env {
  GOOGLE_PLACES_API_KEY: string;
  PLACE_IDS: KVNamespace;
  RATE_LIMITER: RateLimit;
  ALLOWED_ORIGINS: string;
}

const NO_MATCH = "none";
const NO_MATCH_TTL = 7 * 24 * 3600;
// Google's terms don't allow storing ratings/reviews, so clients may only
// cache responses briefly.
const CLIENT_CACHE = "private, max-age=3600";

const ROUTE = /^\/v1\/venues\/([^/]+)(\/reviews)?\/?$/;
const LANG_RE = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);

    const allowed = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
    const origin = request.headers.get("Origin");
    if (allowed.length > 0 && (!origin || !allowed.includes(origin))) {
      return json({ error: "forbidden" }, 403);
    }

    const url = new URL(request.url);
    const m = ROUTE.exec(url.pathname);
    if (!m) return json({ error: "not_found" }, 404);
    const slug = decodeURIComponent(m[1]).toLowerCase();
    if (!SLUG_RE.test(slug)) return json({ error: "bad_slug" }, 400);
    const withReviews = Boolean(m[2]);
    const lang = url.searchParams.get("lang") ?? undefined;
    if (lang && !LANG_RE.test(lang)) return json({ error: "bad_lang" }, 400);

    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const { success } = await env.RATE_LIMITER.limit({ key: ip });
    if (!success) return json({ error: "rate_limited" }, 429);

    try {
      const place = await resolve(env, slug, withReviews, lang);
      return json({ match: place ? toResponse(place, withReviews) : null }, 200, CLIENT_CACHE);
    } catch (err) {
      console.error(err);
      const status = err instanceof GoogleApiError && err.status === 429 ? 503 : 502;
      return json({ error: "upstream_error" }, status);
    }
  },
} satisfies ExportedHandler<Env>;

async function resolve(env: Env, slug: string, withReviews: boolean, lang?: string): Promise<GooglePlace | null> {
  const opts = { apiKey: env.GOOGLE_PLACES_API_KEY, withReviews, languageCode: lang };

  const cached = await env.PLACE_IDS.get(slug);
  if (cached === NO_MATCH) return null;
  if (cached) {
    try {
      return await getPlace(cached, opts);
    } catch (err) {
      // Place IDs can go stale; drop it and search again.
      if (!(err instanceof GoogleApiError && err.status === 404)) throw err;
      await env.PLACE_IDS.delete(slug);
    }
  }

  const venue = await fetchWoltVenue(slug);
  if (!venue) return null;

  const results = await searchText(searchQuery(venue), opts);
  const best = pickBestMatch(
    venue,
    results.map((p) => ({ ...p, name: p.displayName?.text ?? "", formattedAddress: p.formattedAddress ?? "" })),
  );
  if (best) await env.PLACE_IDS.put(slug, best.id);
  else await env.PLACE_IDS.put(slug, NO_MATCH, { expirationTtl: NO_MATCH_TTL });
  return best;
}

function toResponse(p: GooglePlace, withReviews: boolean) {
  return {
    placeId: p.id,
    name: p.displayName?.text ?? "",
    address: p.formattedAddress ?? "",
    rating: p.rating ?? null,
    userRatingCount: p.userRatingCount ?? 0,
    mapsUrl: p.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${p.id}`,
    ...(withReviews && {
      reviews: (p.reviews ?? []).map((r) => ({
        rating: r.rating ?? null,
        text: r.text?.text ?? r.originalText?.text ?? "",
        relativeTime: r.relativePublishTimeDescription ?? "",
        publishTime: r.publishTime ?? null,
        url: r.googleMapsUri ?? null,
        author: {
          name: r.authorAttribution?.displayName ?? "Google user",
          url: r.authorAttribution?.uri ?? null,
          photoUrl: r.authorAttribution?.photoUri ?? null,
        },
      })),
    }),
  };
}

function json(body: unknown, status: number, cacheControl = "no-store"): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": cacheControl },
  });
}
