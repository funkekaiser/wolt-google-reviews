// Minimal client for the Google Places API (New).
// https://developers.google.com/maps/documentation/places/web-service/op-overview

const BASE = "https://places.googleapis.com/v1";

export interface GoogleReview {
  rating?: number;
  text?: { text: string; languageCode?: string };
  originalText?: { text: string; languageCode?: string };
  relativePublishTimeDescription?: string;
  publishTime?: string;
  googleMapsUri?: string;
  authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
}

export interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: GoogleReview[];
}

// Rating fields bill at the Enterprise tier; reviews add Atmosphere. Only ask
// for reviews when the caller will actually show them.
export function fieldList(withReviews: boolean): string[] {
  const fields = ["id", "displayName", "formattedAddress", "rating", "userRatingCount", "googleMapsUri"];
  if (withReviews) fields.push("reviews");
  return fields;
}

export class GoogleApiError extends Error {
  constructor(
    readonly status: number,
    body: string,
  ) {
    super(`Google Places API ${status}: ${body.slice(0, 300)}`);
  }
}

async function call<T>(url: string, init: RequestInit, apiKey: string, fieldMask: string): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
  });
  if (!res.ok) throw new GoogleApiError(res.status, await res.text());
  return res.json<T>();
}

export async function searchText(
  query: string,
  opts: { apiKey: string; withReviews: boolean; languageCode?: string },
): Promise<GooglePlace[]> {
  const fieldMask = fieldList(opts.withReviews)
    .map((f) => `places.${f}`)
    .join(",");
  const data = await call<{ places?: GooglePlace[] }>(
    `${BASE}/places:searchText`,
    { method: "POST", body: JSON.stringify({ textQuery: query, languageCode: opts.languageCode }) },
    opts.apiKey,
    fieldMask,
  );
  return data.places ?? [];
}

export async function getPlace(
  placeId: string,
  opts: { apiKey: string; withReviews: boolean; languageCode?: string },
): Promise<GooglePlace> {
  const params = opts.languageCode ? `?languageCode=${encodeURIComponent(opts.languageCode)}` : "";
  return call<GooglePlace>(
    `${BASE}/places/${encodeURIComponent(placeId)}${params}`,
    { method: "GET" },
    opts.apiKey,
    fieldList(opts.withReviews).join(","),
  );
}
