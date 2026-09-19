# Privacy Policy: Google Reviews for Wolt

_Last updated: 19 September 2026_

Google Reviews for Wolt is a browser extension that shows Google Maps ratings and reviews next to restaurants on wolt.com. It is built to collect as little as possible.

## What the extension sends

When you view a page on `wolt.com`, the extension reads the **venue identifiers** in that page's links (for example `mcdonalds-kamppi-1`). It sends each one, together with the **language code** from the Wolt URL (for example `en`), to the extension's server at `wolt-google-reviews.funkekaiser.workers.dev`.

That's all it sends. The extension does **not** read or send your Wolt account, address, orders, cart, cookies, browsing history or anything you type.

## What the server does with it

The server runs on Cloudflare Workers. For each venue identifier it:

1. Fetches the venue's public name and address from Wolt.
2. Looks up the venue with the Google Places API and returns its rating and reviews.
3. Stores the match between the Wolt venue identifier and the Google place ID, so later lookups are faster. This contains no information about you.

Like any web server, Cloudflare receives your IP address with each request. The server uses it only for short-term rate limiting and does not store it. Cloudflare may process request data as described in the [Cloudflare Privacy Policy](https://www.cloudflare.com/privacypolicy/).

Google receives the venue name and address, not your IP address or any information about you, because the requests to Google come from the server. Google's handling of Places API requests is covered by the [Google Privacy Policy](https://policies.google.com/privacy).

## Stored in your browser

- One setting (whether to show ratings on restaurant lists), saved with your browser's extension sync storage.
- Ratings may be kept in your browser's normal HTTP cache for up to one hour.

## What is not done

- No analytics, tracking or advertising.
- No selling or sharing of data.
- No accounts.

## Ratings and reviews

Ratings and reviews come from Google Maps. The extension shows them with attribution and links to the reviewers' Google profiles, and does not store them on the server.

## Changes and contact

Changes to this policy will be committed to this repository, where its history is public. For questions, open an issue at <https://github.com/funkekaiser/wolt-google-reviews/issues>.

This extension is not affiliated with, endorsed by or sponsored by Wolt or Google.
