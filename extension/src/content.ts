// Adds Google ratings to restaurant cards and a reviews panel to venue pages
// on wolt.com. Wolt is a React SPA, so we rescan on DOM mutations and keep
// results in memory to re-attach UI when React re-renders a card.
import { DEFAULT_SETTINGS, loadSettings, type LookupRequest, type LookupResponse, type PlaceMatch, type Review } from "./types";

const CARD_TITLE = '[data-test-id="venue-title"]';
const VENUE_TITLE = '[data-test-id="venue-hero.venue-title"]';
const SLUG_IN_PATH = /\/(?:restaurant|venue)\/([a-z0-9][a-z0-9-]*)/i;

let settings = DEFAULT_SETTINGS;
// Wolt paths look like /en/fin/helsinki/restaurant/<slug>.
const pathLang = location.pathname.split("/")[1];
const lang = /^[a-z]{2}(-[a-z]{2,4})?$/i.test(pathLang) ? pathLang : undefined;

// Results keyed by `${slug}|${withReviews}`; the promise dedupes in-flight lookups.
const results = new Map<string, Promise<PlaceMatch | null>>();

function lookup(slug: string, withReviews: boolean): Promise<PlaceMatch | null> {
  const key = `${slug}|${withReviews}`;
  let p = results.get(key);
  if (!p) {
    const req: LookupRequest = { type: "lookup", slug, withReviews, lang };
    p = chrome.runtime.sendMessage<LookupRequest, LookupResponse>(req).then((res) => {
      if (res?.ok) return res.match;
      // Keep the failure briefly so DOM churn doesn't hammer the API, then allow a retry.
      setTimeout(() => results.delete(key), 30_000);
      console.debug("[wolt-google-reviews]", slug, res?.error);
      return null;
    });
    results.set(key, p);
  }
  return p;
}

// ---- DOM helpers ----------------------------------------------------------

type Child = Node | string | null | false | undefined;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) if (c) node.append(c);
  return node;
}

function link(href: string, ...children: Child[]) {
  return el("a", { href, target: "_blank", rel: "noopener noreferrer" }, ...children);
}

function formatCount(n: number): string {
  return new Intl.NumberFormat(lang, { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function stars(rating: number): string {
  const full = Math.round(rating);
  return "★".repeat(full) + "☆".repeat(5 - full);
}

// ---- List cards -----------------------------------------------------------

function badge(m: PlaceMatch): HTMLElement {
  return el(
    "span",
    {
      class: "wgr-badge",
      title: `${m.name} on Google Maps: ${m.rating?.toFixed(1)} from ${m.userRatingCount} reviews`,
    },
    el("span", { class: "wgr-g" }, "G"),
    el("span", { class: "wgr-star" }, "★"),
    m.rating!.toFixed(1),
    el("span", { class: "wgr-count" }, `(${formatCount(m.userRatingCount)})`),
  );
}

const visible = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      visible.unobserve(e.target);
      attachBadge(e.target as HTMLElement);
    }
  },
  { rootMargin: "200px" },
);

async function attachBadge(title: HTMLElement) {
  const slug = title.dataset.wgrSlug!;
  const m = await lookup(slug, false);
  if (!m || m.rating == null || !title.isConnected || !settings.showOnLists) return;
  if (title.parentElement?.querySelector(".wgr-badge")) return;
  title.after(badge(m));
}

function scanCards() {
  if (!settings.showOnLists) return;
  for (const title of document.querySelectorAll<HTMLElement>(CARD_TITLE)) {
    const href = title.closest("a")?.getAttribute("href") ?? "";
    const slug = SLUG_IN_PATH.exec(href)?.[1]?.toLowerCase();
    if (!slug) continue;
    if (title.dataset.wgrSlug === slug) {
      // Already handled; React may have dropped our badge on re-render.
      if (!title.parentElement?.querySelector(".wgr-badge") && results.has(`${slug}|false`)) attachBadge(title);
      continue;
    }
    title.dataset.wgrSlug = slug;
    visible.observe(title);
  }
}

// ---- Venue page -----------------------------------------------------------

function reviewItem(r: Review): HTMLElement {
  return el(
    "li",
    { class: "wgr-review" },
    el(
      "div",
      { class: "wgr-review-head" },
      r.author.photoUrl && el("img", { src: r.author.photoUrl, alt: "", referrerpolicy: "no-referrer", loading: "lazy" }),
      r.author.url ? link(r.author.url, r.author.name) : el("span", {}, r.author.name),
      r.rating != null && el("span", { class: "wgr-stars", title: `${r.rating}/5` }, stars(r.rating)),
      el("span", { class: "wgr-muted" }, r.relativeTime),
    ),
    el("p", {}, r.text),
  );
}

function panel(slug: string, m: PlaceMatch): HTMLElement {
  const reviews = m.reviews ?? [];
  const list = el("ul", { class: "wgr-reviews", hidden: "" }, ...reviews.map(reviewItem));
  const toggle =
    reviews.length > 0 &&
    el("button", { type: "button", class: "wgr-toggle", "aria-expanded": "false" }, `Show ${reviews.length} reviews`);
  if (toggle) {
    toggle.addEventListener("click", () => {
      const open = list.hidden;
      list.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "Hide reviews" : `Show ${reviews.length} reviews`;
    });
  }
  return el(
    "section",
    { class: "wgr-panel", "data-wgr-slug": slug },
    el(
      "div",
      { class: "wgr-summary" },
      m.rating != null
        ? el("span", { class: "wgr-rating" }, el("span", { class: "wgr-star" }, "★"), m.rating.toFixed(1))
        : el("span", { class: "wgr-muted" }, "No rating yet"),
      el("span", { class: "wgr-muted" }, `${m.userRatingCount.toLocaleString(lang)} Google reviews`),
      toggle,
      link(m.mapsUrl, "Open in Google Maps"),
    ),
    list,
    el("div", { class: "wgr-attribution" }, "Ratings and reviews from Google Maps"),
  );
}

let venueSlugInFlight: string | null = null;

async function scanVenuePage() {
  const slug = SLUG_IN_PATH.exec(location.pathname)?.[1]?.toLowerCase();
  for (const p of document.querySelectorAll<HTMLElement>(".wgr-panel")) {
    if (p.dataset.wgrSlug !== slug) p.remove();
  }
  const title = document.querySelector(VENUE_TITLE);
  if (!slug || !title || document.querySelector(".wgr-panel") || venueSlugInFlight === slug) return;

  venueSlugInFlight = slug;
  try {
    const m = await lookup(slug, true);
    const anchor = document.querySelector(VENUE_TITLE)?.closest("h1") ?? document.querySelector(VENUE_TITLE);
    const current = SLUG_IN_PATH.exec(location.pathname)?.[1]?.toLowerCase();
    if (!m || !anchor || current !== slug || document.querySelector(".wgr-panel")) return;
    anchor.after(panel(slug, m));
  } finally {
    venueSlugInFlight = null;
  }
}

// ---- Wiring ---------------------------------------------------------------

let scheduled = false;
function scheduleScan() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    scanCards();
    scanVenuePage();
  });
}

loadSettings().then((s) => {
  settings = s;
  scheduleScan();
  new MutationObserver(scheduleScan).observe(document.body, { childList: true, subtree: true });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync" || !changes.showOnLists) return;
  settings = { ...settings, showOnLists: changes.showOnLists.newValue as boolean };
  if (!settings.showOnLists) document.querySelectorAll(".wgr-badge").forEach((b) => b.remove());
  scheduleScan();
});
