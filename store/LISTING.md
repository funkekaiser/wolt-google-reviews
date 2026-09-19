# Chrome Web Store listing: Rating Lens for Wolt

Copy these into the [Developer Dashboard](https://chrome.google.com/webstore/devconsole). Upload `extension/rating-lens-for-wolt.zip`, built with `GOOGLE_EMBED_KEY=AIza... npm run package --workspace extension`.

## Store listing tab

**Name** (from the manifest): Rating Lens for Wolt

**Summary** (max 132 characters, from the manifest):
> See the Google Maps rating of a restaurant while you order on wolt.com.

**Description:**
> Wolt shows its own restaurant score, but you might want a second opinion before you order. Rating Lens adds the restaurant's Google Maps rating to its page on wolt.com.
>
> • On a restaurant page, a small Google map appears below the header, showing Google's place card: the star rating, the number of reviews, and a link to read them on Google Maps.
> • Nothing to set up and no account needed.
> • No tracking, no ads, no data collection. The extension has no server of its own: it reads the restaurant's address from Wolt and embeds a Google map, and that's all.
>
> Works on wolt.com in desktop Chrome. It doesn't change the Wolt mobile apps.
>
> Open source: https://github.com/funkekaiser/wolt-google-reviews
>
> Not affiliated with, endorsed by or sponsored by Wolt or Google. Ratings and map © Google.

**Category:** Lifestyle › Shopping, or the closest food/shopping option in the current category list

**Language:** English

**Graphics:**
- Icon: included in the zip (128×128)
- Screenshots (1280×800): `store/screenshot-venue.png`
- Small promo tile (440×280): optional

**Homepage URL:** https://github.com/funkekaiser/wolt-google-reviews
**Support URL:** https://github.com/funkekaiser/wolt-google-reviews/issues

## Privacy practices tab

**Single purpose:**
> Show the Google Maps rating of the restaurant whose page you are viewing on wolt.com.

**Permission justifications:**
- Host permission `https://wolt.com/*` (content script): the only permission the extension requests. It reads the restaurant ID on the page and inserts the Google map. The extension has no background script, no storage and no other host permissions.

**Remote code:** No. All JavaScript is in the package. The Google map is an iframe embed, the same as an embedded map on any website.

**Data usage:** the extension collects no user data, so tick nothing. Then certify all three statements:
- Not sold or transferred to third parties, except as needed for the single purpose
- Not used or transferred for purposes unrelated to the single purpose
- Not used or transferred to determine creditworthiness or for lending

**Privacy policy URL:** https://github.com/funkekaiser/wolt-google-reviews/blob/main/PRIVACY.md

## Distribution tab

- Visibility: Public, or Unlisted to try it with friends first
- Regions: all, or only the countries Wolt operates in

## Before each new version

1. Bump `version` in `extension/static/manifest.json`.
2. Run `GOOGLE_EMBED_KEY=AIza... npm run package --workspace extension`.
3. Upload the zip under **Package → Upload new package**.
