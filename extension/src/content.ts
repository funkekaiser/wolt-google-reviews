// Adds Google ratings to restaurant cards and a reviews panel to venue pages
// on wolt.com. Wolt is a React SPA, so we rescan on DOM mutations and keep
// results in memory to re-attach UI when React re-renders a card.
import { DEFAULT_SETTINGS, loadSettings, type LookupRequest, type LookupResponse, type PlaceMatch, type Review } from "./types";

const CARD_TITLE = '[data-test-id="venue-title"]';
const VENUE_TITLE = '[data-test-id="venue-hero.venue-title"]';
// Wraps the hero banner (fixed height, overflow hidden) and the info row below it.
const VENUE_HEADER = '[data-test-id="venue-content-header.root"]';
const SLUG_IN_PATH = /\/(?:restaurant|venue)\/([a-z0-9][a-z0-9-]*)/i;

let settings = DEFAULT_SETTINGS;
// Wolt paths look like /en/fin/helsinki/restaurant/<slug>.
const pathLang = location.pathname.split("/")[1];
const lang = /^[a-z]{2}(-[a-z]{2,4})?$/i.test(pathLang) ? pathLang : undefined;

// Results keyed by `${slug}|${withReviews}`; the promise dedupes in-flight lookups.
const results = new Map<string, Promise<PlaceMatch | null>>();

// When the extension is reloaded or updated, copies of this script already
// running in open tabs are orphaned: chrome.runtime becomes undefined (or
// throws). Detect that and stop, instead of throwing on every DOM change.
let orphaned = false;
const stopHandlers: (() => void)[] = [];

function extensionAlive(): boolean {
  if (orphaned) return false;
  try {
    if (chrome.runtime?.id) return true;
  } catch {
    // "Extension context invalidated"
  }
  orphaned = true;
  stopHandlers.forEach((stop) => stop());
  return false;
}

function lookup(slug: string, withReviews: boolean): Promise<PlaceMatch | null> {
  if (!extensionAlive()) return Promise.resolve(null);
  const key = `${slug}|${withReviews}`;
  let p = results.get(key);
  if (!p) {
    const req: LookupRequest = { type: "lookup", slug, withReviews, lang };
    p = chrome.runtime
      .sendMessage<LookupRequest, LookupResponse>(req)
      .catch((err): LookupResponse => {
        extensionAlive(); // stops everything if this was an invalidated context
        return { ok: false, error: String(err) };
      })
      .then((res) => {
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
stopHandlers.push(() => visible.disconnect());

// The card's footer row reads "€0.00 · €€ · 😊 8.4"; the badge goes right after
// Wolt's own score. Wolt has no test IDs there, so find the score by its shape.
// Returns the element to insert after and the card to check for an existing badge.
function badgeSlot(title: HTMLElement): { after: Element; card: Element } {
  let card: Element | null = title.parentElement;
  for (let depth = 0; card && depth < 6; depth++, card = card.parentElement) {
    const score = [...card.querySelectorAll("span")].find(
      (s) => s.childElementCount === 0 && /^\d{1,2}\.\d$/.test(s.textContent?.trim() ?? "") && !s.closest(".wgr-badge"),
    );
    const item = score?.parentElement?.closest("span");
    if (item && card.contains(item)) return { after: item, card };
  }
  // No Wolt score (e.g. a new venue): fall back to next to the title.
  return { after: title, card: title.parentElement ?? title };
}

async function attachBadge(title: HTMLElement) {
  const slug = title.dataset.wgrSlug!;
  const m = await lookup(slug, false);
  if (!m || m.rating == null || !title.isConnected || !settings.showOnLists) return;
  const slot = badgeSlot(title);
  if (slot.card.querySelector(".wgr-badge")) return;
  slot.after.after(badge(m));
}

function hasBadge(title: HTMLElement): boolean {
  return Boolean(badgeSlot(title).card.querySelector(".wgr-badge"));
}

function scanCards() {
  if (!settings.showOnLists) return;
  for (const title of document.querySelectorAll<HTMLElement>(CARD_TITLE)) {
    const href = title.closest("a")?.getAttribute("href") ?? "";
    const slug = SLUG_IN_PATH.exec(href)?.[1]?.toLowerCase();
    if (!slug) continue;
    if (title.dataset.wgrSlug === slug) {
      // Already handled; React may have dropped our badge on re-render.
      if (results.has(`${slug}|false`) && !hasBadge(title)) attachBadge(title);
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
    const current = SLUG_IN_PATH.exec(location.pathname)?.[1]?.toLowerCase();
    if (!m || current !== slug || document.querySelector(".wgr-panel")) return;
    // Below the banner and info row; the banner clips anything placed inside it.
    const header = document.querySelector(VENUE_HEADER);
    const title = document.querySelector(VENUE_TITLE);
    if (header) header.append(panel(slug, m));
    else (title?.closest("h1") ?? title)?.after(panel(slug, m));
  } finally {
    venueSlugInFlight = null;
  }
}

// ---- Wiring ---------------------------------------------------------------

let scheduled = false;
function scheduleScan() {
  if (scheduled || !extensionAlive()) return;
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
  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, { childList: true, subtree: true });
  stopHandlers.push(() => observer.disconnect());
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync" || !changes.showOnLists) return;
  settings = { ...settings, showOnLists: changes.showOnLists.newValue as boolean };
  if (!settings.showOnLists) document.querySelectorAll(".wgr-badge").forEach((b) => b.remove());
  scheduleScan();
});
