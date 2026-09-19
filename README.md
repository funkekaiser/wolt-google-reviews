# Rating Lens for Wolt

A Chrome extension that shows a restaurant's Google Maps rating while you order on [wolt.com](https://wolt.com).

On a restaurant page it adds a small Google map below the header, with Google's own place card: star rating, number of reviews and a link to the reviews on Google Maps.

It works on the Wolt website in a desktop browser, not in the Wolt mobile apps.

## How it works

The whole extension is one content script. There is no backend and no tracking.

1. On a `wolt.com` restaurant page, it reads the venue ID from the URL (`/restaurant/<slug>`).
2. It fetches that venue's name and address from the same public Wolt endpoint the website itself uses.
3. It embeds a Google map searched by that name and address, using the [Maps Embed API](https://developers.google.com/maps/documentation/embed/get-started), which Google provides free with no usage limits.

Because the map is an embed, the rating comes straight from Google, with Google's own attribution, and nothing is sent to any server of ours.

## Build it

```sh
npm install
GOOGLE_EMBED_KEY=AIza... npm run build --workspace extension
```

Or put the key in `extension/.env` (git-ignored) as `GOOGLE_EMBED_KEY=AIza...` and just run `npm run build`.

Get the key in [Google Cloud Console](https://console.cloud.google.com/): enable **Maps Embed API**, then create an API key and restrict it both ways:

- *API restrictions* → **Maps Embed API** only, so the key can't be used for anything Google charges for.
- *Application restrictions* → **Websites** → `https://wolt.com/*`. The map is embedded in a Wolt page, so Google sees wolt.com as the referring site and the key is useless anywhere else.

With those set, shipping the key inside the extension is fine, which is how the Embed API is meant to be used.

In Chrome, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick `extension/dist`.

## Publishing

- `npm run package --workspace extension` → `extension/rating-lens-for-wolt.zip`. It refuses to build without a valid embed key.
- Listing text and answers for the store's privacy questions: [`store/LISTING.md`](store/LISTING.md)
- Privacy policy: [`PRIVACY.md`](PRIVACY.md)
- Still to do: screenshots (1280×800) in `store/`, and a Firefox build.

## Development

```sh
npm run typecheck
npm run build --workspace extension
npm run watch --workspace extension
```

If the map stops appearing, Wolt has probably changed its page markup. The selectors are at the top of [`extension/src/content.ts`](extension/src/content.ts).

## History

Earlier versions used the Google Places API through a Cloudflare Worker, which gave star ratings on restaurant lists and review texts inside the page. Places charges per request for ratings, so that version cost money for every user's browsing. It was dropped in favour of the free embed. The Worker, and its venue-matching logic, is in the git history.

Not affiliated with Wolt or Google.
