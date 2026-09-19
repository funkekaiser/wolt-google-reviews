# Chrome Web Store listing: Rating Lens for Wolt

Copy these into the [Developer Dashboard](https://chrome.google.com/webstore/devconsole). Upload `extension/rating-lens-for-wolt.zip`, built with `npm run package --workspace extension`.

## Store listing tab

**Name** (from the manifest): Rating Lens for Wolt

**Summary** (max 132 characters, from the manifest):
> See Google Maps ratings and reviews next to restaurants on wolt.com.

**Description:**
> Wolt shows its own restaurant score, but you might want a second opinion before you order. Rating Lens adds Google Maps ratings right into wolt.com.
>
> • Restaurant lists: every card shows its Google Maps star rating and number of reviews, next to Wolt's own score.
> • Restaurant pages: a panel under the header with the Google rating, up to 5 recent reviews and a link to the place on Google Maps.
> • Careful matching: a rating is shown only when the name and street address or postcode match, so chains and food courts don't get the wrong restaurant's rating. If there's no confident match, nothing is shown.
> • No account, no tracking, no ads. The only things sent are the Wolt venue IDs of restaurants on the page and the page language.
>
> Works on wolt.com in desktop Chrome. It doesn't change the Wolt mobile apps.
>
> Open source: https://github.com/funkekaiser/wolt-google-reviews
>
> Not affiliated with, endorsed by or sponsored by Wolt or Google. Ratings and reviews © Google Maps.

**Category:** Lifestyle › Shopping, or the closest food/shopping option in the current category list

**Language:** English

**Graphics:**
- Icon: included in the zip (128×128)
- Screenshots (1280×800): `store/screenshot-list.png`, `store/screenshot-venue.png`
- Small promo tile (440×280): optional

**Homepage URL:** https://github.com/funkekaiser/wolt-google-reviews
**Support URL:** https://github.com/funkekaiser/wolt-google-reviews/issues

## Privacy practices tab

**Single purpose:**
> Show Google Maps ratings and reviews for the restaurants listed on wolt.com.

**Permission justifications:**
- `storage`: saves one user setting, whether ratings are shown on restaurant lists.
- Host permission `https://wolt.com/*` (content script): reads venue links on Wolt pages and adds the rating badges and reviews panel.
- Host permission `https://wolt-google-reviews.funkekaiser.workers.dev/*`: the extension's own backend, which looks up the Google Maps rating for a Wolt venue ID. The Google API key stays on the backend and is never in the extension.

**Remote code:** No. All JavaScript is in the package; the backend returns JSON data only.

**Data usage:** tick **Website content** (Wolt venue IDs from the pages you view are sent to the backend to look up ratings). Nothing else is collected: no personally identifiable information, health, financial, authentication, personal communications, location, web history or user activity.

Then certify all three statements:
- Not sold or transferred to third parties, except as needed for the single purpose
- Not used or transferred for purposes unrelated to the single purpose
- Not used or transferred to determine creditworthiness or for lending

**Privacy policy URL:** https://github.com/funkekaiser/wolt-google-reviews/blob/main/PRIVACY.md

## Distribution tab

- Visibility: Public, or Unlisted to try it with friends first
- Regions: all, or only the countries Wolt operates in

## Before each new version

1. Bump `version` in `extension/static/manifest.json`.
2. Run `npm run package --workspace extension`.
3. Upload the zip under **Package → Upload new package**.
