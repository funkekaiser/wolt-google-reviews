// Decides which Google Places result (if any) is the same restaurant as a Wolt venue.
// Pure functions so they can be unit tested without network access.

export interface WoltVenue {
  slug: string;
  name: string;
  // Chain name without the location suffix ("Eat Poke" for "Eat Poke Tripla"), if Wolt has one.
  brandName?: string;
  address: string;
  postCode: string;
  city: string;
}

export interface Candidate {
  id: string;
  name: string;
  formattedAddress: string;
}

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function tokens(s: string): string[] {
  return normalize(s).split(" ").filter(Boolean);
}

// Words that say nothing about which business it is. Sharing only these
// (e.g. "Pizza Kebab" vs "Kebab House") must not count as a name match.
const GENERIC = new Set([
  "restaurant", "ravintola", "restaurang", "cafe", "kahvila", "bar", "baari", "kitchen", "keittio",
  "pizzeria", "grill", "bistro", "and", "ja", "och", "the", "by", "co", "oy", "ab",
]);

const MIN_NAME_OVERLAP = 0.5;

function nameTokens(s: string, ignore: Set<string>): Set<string> {
  return new Set(tokens(s).filter((t) => !GENERIC.has(t) && !ignore.has(t)));
}

// Shared tokens relative to the shorter name, so "McDonald's" vs
// "McDonald's Helsinki Kamppi" still counts as a full match. Tokens in
// `ignore` (the city) are dropped from both sides.
export function nameOverlap(a: string, b: string, ignore: Set<string> = new Set()): number {
  const ta = nameTokens(a, ignore);
  const tb = nameTokens(b, ignore);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.min(ta.size, tb.size);
}

// Names usually lead with the brand and end with a location ("McDonald's
// Kamppi"), so overlap alone can be carried by a shared district or mall
// name. Also require the leading distinctive word of one name to appear in
// the other.
export function namesMatch(a: string, b: string, ignore: Set<string> = new Set()): boolean {
  if (nameOverlap(a, b, ignore) < MIN_NAME_OVERLAP) return false;
  const ta = [...nameTokens(a, ignore)];
  const tb = [...nameTokens(b, ignore)];
  return tb.includes(ta[0]) || ta.includes(tb[0]);
}

// Street name + house number, e.g. "Fredrikinkatu 46 B 12" -> ["fredrikinkatu", "46"].
function streetTokens(address: string): string[] {
  return tokens(address).slice(0, 2);
}

export function addressMatches(venue: WoltVenue, formattedAddress: string): { street: boolean; postCode: boolean } {
  const addr = new Set(tokens(formattedAddress));
  const street = streetTokens(venue.address);
  const pc = normalize(venue.postCode).replace(/ /g, "");
  return {
    street: street.length > 0 && street.every((t) => addr.has(t)),
    postCode: pc.length > 0 && normalize(formattedAddress).replace(/ /g, "").includes(pc),
  };
}

export function pickBestMatch<C extends Candidate>(venue: WoltVenue, candidates: C[]): C | null {
  let best: C | null = null;
  let bestScore = 0;
  // Prefer the brand name: Wolt venue names often end in a mall or district
  // ("Eat Poke Tripla"), which would otherwise match other shops in that mall.
  const woltName = venue.brandName || venue.name;
  const ignore = new Set(tokens(venue.city));
  for (const c of candidates) {
    const { street, postCode } = addressMatches(venue, c.formattedAddress);
    // Name alone is not enough for chains, and address alone is not enough
    // for food courts, so require some of both.
    if (!namesMatch(woltName, c.name, ignore) || !(street || postCode)) continue;
    const score = nameOverlap(woltName, c.name, ignore) * 2 + (street ? 2 : 0) + (postCode ? 1 : 0);
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}
