// Decides which Google Places result (if any) is the same restaurant as a Wolt venue.
// Pure functions so they can be unit tested without network access.

export interface WoltVenue {
  slug: string;
  name: string;
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

// Shared tokens relative to the shorter name, so "McDonald's" vs
// "McDonald's Helsinki Kamppi" still counts as a full match.
export function nameOverlap(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.min(ta.size, tb.size);
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

const MIN_NAME_OVERLAP = 0.5;

export function pickBestMatch<C extends Candidate>(venue: WoltVenue, candidates: C[]): C | null {
  let best: C | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const overlap = nameOverlap(venue.name, c.name);
    const { street, postCode } = addressMatches(venue, c.formattedAddress);
    // Name alone is not enough for chains, and address alone is not enough
    // for food courts, so require some of both.
    if (overlap < MIN_NAME_OVERLAP || !(street || postCode)) continue;
    const score = overlap * 2 + (street ? 2 : 0) + (postCode ? 1 : 0);
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}
