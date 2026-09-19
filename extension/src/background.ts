// Calls the API on behalf of content scripts. Running the fetch here (with a
// host permission) avoids CORS, and responses are kept in the HTTP cache for
// the max-age the API sends.
import type { LookupRequest, LookupResponse } from "./types";

declare const __API_BASE__: string;

const MAX_CONCURRENT = 4;
let active = 0;
const queue: (() => void)[] = [];

async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) await new Promise<void>((r) => queue.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    queue.shift()?.();
  }
}

async function lookup(req: LookupRequest): Promise<LookupResponse> {
  const url = new URL(`${__API_BASE__}/v1/venues/${encodeURIComponent(req.slug)}${req.withReviews ? "/reviews" : ""}`);
  if (req.lang) url.searchParams.set("lang", req.lang);
  try {
    const res = await limited(() => fetch(url));
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const body = await res.json();
    return { ok: true, match: body.match ?? null };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

chrome.runtime.onMessage.addListener((msg: LookupRequest, _sender, sendResponse) => {
  if (msg?.type !== "lookup") return false;
  lookup(msg).then(sendResponse);
  return true; // async response
});
