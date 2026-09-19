import type { WoltVenue } from "./match";

// Public endpoint wolt.com itself uses to render a venue page.
const VENUE_URL = "https://consumer-api.wolt.com/order-xp/web/v1/pages/venue/slug/";

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,127}$/;

export async function fetchWoltVenue(slug: string): Promise<WoltVenue | null> {
  const res = await fetch(VENUE_URL + encodeURIComponent(slug) + "/static", {
    headers: { Accept: "application/json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Wolt API ${res.status}`);
  const { venue } = await res.json<{
    venue?: {
      slug?: string;
      name?: string;
      brand_name?: string | null;
      address?: string;
      post_code?: string;
      city?: string;
    };
  }>();
  if (!venue?.name) return null;
  return {
    slug,
    name: venue.name,
    brandName: venue.brand_name ?? undefined,
    address: venue.address ?? "",
    postCode: venue.post_code ?? "",
    city: venue.city ?? "",
  };
}

export function searchQuery(v: WoltVenue): string {
  return [v.name, v.address, [v.postCode, v.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}
