// Adds a Google Maps place card to restaurant pages on wolt.com.
//
// Everything runs in the page: the venue's name and address come from the same
// public Wolt endpoint the site itself uses, and the rating comes from an
// embedded Google map (Maps Embed API: free, no usage limits, no backend).
// Wolt is a React SPA, so we rescan on DOM changes and follow navigations.

const VENUE_TITLE = '[data-test-id="venue-hero.venue-title"]';
// Wraps the hero banner (fixed height, overflow hidden) and the info row below it.
const VENUE_HEADER = '[data-test-id="venue-content-header.root"]';
const SLUG_IN_PATH = /\/(?:restaurant|venue)\/([a-z0-9][a-z0-9-]*)/i;
const VENUE_API = "https://consumer-api.wolt.com/order-xp/web/v1/pages/venue/slug/";

declare const __EMBED_KEY__: string;

// Wolt paths look like /en/fin/helsinki/restaurant/<slug>.
const pathLang = location.pathname.split("/")[1];
const lang = /^[a-z]{2}(-[a-z]{2,4})?$/i.test(pathLang) ? pathLang : undefined;

interface Venue {
  name: string;
  address: string;
  postCode: string;
  city: string;
}

const venues = new Map<string, Promise<Venue | null>>();

function fetchVenue(slug: string): Promise<Venue | null> {
  let p = venues.get(slug);
  if (!p) {
    p = fetch(`${VENUE_API}${encodeURIComponent(slug)}/static`, {
      credentials: "omit",
      headers: { Accept: "application/json" },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        const v = body?.venue;
        if (!v?.name) return null;
        return { name: v.name, address: v.address ?? "", postCode: v.post_code ?? "", city: v.city ?? "" };
      })
      .catch((err) => {
        venues.delete(slug); // allow a retry
        console.debug("[rating-lens]", slug, err);
        return null;
      });
    venues.set(slug, p);
  }
  return p;
}

// What Google searches for. The full street address keeps chain branches apart.
function embedQuery(v: Venue): string {
  return [v.name, v.address, [v.postCode, v.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

function embedUrl(v: Venue): string {
  const params = new URLSearchParams({ key: __EMBED_KEY__, q: embedQuery(v) });
  if (lang) params.set("language", lang);
  return `https://www.google.com/maps/embed/v1/place?${params}`;
}

function panel(slug: string, v: Venue): HTMLElement {
  const section = document.createElement("section");
  section.className = "wgr-panel";
  section.dataset.wgrSlug = slug;

  const frame = document.createElement("iframe");
  frame.className = "wgr-map";
  frame.src = embedUrl(v);
  frame.loading = "lazy";
  // Sends the wolt.com page URL as the referrer, which is what lets the API key
  // be restricted to https://wolt.com/* in Google Cloud. Don't weaken this.
  frame.referrerPolicy = "no-referrer-when-downgrade";
  frame.title = `${v.name} on Google Maps`;
  frame.setAttribute("allowfullscreen", "");

  const note = document.createElement("div");
  note.className = "wgr-note";
  note.textContent = "Rating and reviews from Google Maps";

  section.append(frame, note);
  return section;
}

let inFlight: string | null = null;

async function scanVenuePage() {
  const slug = SLUG_IN_PATH.exec(location.pathname)?.[1]?.toLowerCase();
  for (const p of document.querySelectorAll<HTMLElement>(".wgr-panel")) {
    if (p.dataset.wgrSlug !== slug) p.remove();
  }
  if (!slug || !document.querySelector(VENUE_TITLE) || document.querySelector(".wgr-panel") || inFlight === slug) return;

  inFlight = slug;
  try {
    const venue = await fetchVenue(slug);
    const current = SLUG_IN_PATH.exec(location.pathname)?.[1]?.toLowerCase();
    if (!venue || current !== slug || document.querySelector(".wgr-panel")) return;
    // Below the banner and info row; the banner clips anything placed inside it.
    const header = document.querySelector(VENUE_HEADER);
    const title = document.querySelector(VENUE_TITLE);
    if (header) header.append(panel(slug, venue));
    else (title?.closest("h1") ?? title)?.after(panel(slug, venue));
  } finally {
    inFlight = null;
  }
}

let scheduled = false;
function scheduleScan() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    scanVenuePage();
  });
}

scheduleScan();
new MutationObserver(scheduleScan).observe(document.body, { childList: true, subtree: true });
