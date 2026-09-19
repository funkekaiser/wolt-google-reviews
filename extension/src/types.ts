export interface Review {
  rating: number | null;
  text: string;
  relativeTime: string;
  publishTime: string | null;
  url: string | null;
  author: { name: string; url: string | null; photoUrl: string | null };
}

export interface PlaceMatch {
  placeId: string;
  name: string;
  address: string;
  rating: number | null;
  userRatingCount: number;
  mapsUrl: string;
  reviews?: Review[];
}

export type LookupRequest = { type: "lookup"; slug: string; withReviews: boolean; lang?: string };

export type LookupResponse = { ok: true; match: PlaceMatch | null } | { ok: false; error: string };

export interface Settings {
  showOnLists: boolean;
}

export const DEFAULT_SETTINGS: Settings = { showOnLists: true };

export async function loadSettings(): Promise<Settings> {
  return (await chrome.storage.sync.get(DEFAULT_SETTINGS as unknown as Record<string, unknown>)) as unknown as Settings;
}
