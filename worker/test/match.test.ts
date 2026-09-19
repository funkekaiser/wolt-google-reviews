import { describe, expect, it } from "vitest";
import { nameOverlap, normalize, pickBestMatch, type WoltVenue } from "../src/match";

const mcd: WoltVenue = {
  slug: "mcdonalds-kamppi-1",
  name: "McDonald's Helsinki Kamppi",
  address: "Fredrikinkatu 46",
  postCode: "00100",
  city: "Helsinki",
};

describe("normalize", () => {
  it("strips diacritics, apostrophes and punctuation", () => {
    expect(normalize("Café Ängel's — Töölö")).toBe("cafe angels toolo");
  });
});

describe("nameOverlap", () => {
  it("treats a short Google name contained in the Wolt name as a full match", () => {
    expect(nameOverlap("McDonald's Helsinki Kamppi", "McDonald's")).toBe(1);
  });
  it("is zero for unrelated names", () => {
    expect(nameOverlap("Bastard Burgers", "Annapurna")).toBe(0);
  });
});

describe("pickBestMatch", () => {
  it("picks the branch at the right address among chain results", () => {
    const best = pickBestMatch(mcd, [
      { id: "other", name: "McDonald's", formattedAddress: "Mannerheimintie 5, 00100 Helsinki, Finland" },
      { id: "right", name: "McDonald's", formattedAddress: "Fredrikinkatu 46, 00100 Helsinki, Finland" },
    ]);
    expect(best?.id).toBe("right");
  });

  it("rejects a different restaurant at the same address", () => {
    const best = pickBestMatch(mcd, [
      { id: "x", name: "Sushi Bar Kamppi Center", formattedAddress: "Fredrikinkatu 46, 00100 Helsinki, Finland" },
    ]);
    expect(best).toBeNull();
  });

  it("rejects a same-name place in another city", () => {
    const best = pickBestMatch(mcd, [
      { id: "x", name: "McDonald's", formattedAddress: "Hämeenkatu 10, 33100 Tampere, Finland" },
    ]);
    expect(best).toBeNull();
  });

  it("does not match another shop in the same mall via the mall name", () => {
    const eatPoke: WoltVenue = {
      slug: "eat-poke-tripla",
      name: "Eat Poke Tripla",
      brandName: "Eat Poke",
      address: "Fredikanterassi 1",
      postCode: "00520",
      city: "Helsinki",
    };
    expect(
      pickBestMatch(eatPoke, [
        { id: "capperi", name: "Capperi Tripla", formattedAddress: "Fredikanterassi 1 3 Krs, 00520 Helsinki, Finland" },
      ]),
    ).toBeNull();
    expect(
      pickBestMatch(eatPoke, [
        { id: "capperi", name: "Capperi Tripla", formattedAddress: "Fredikanterassi 1 3 Krs, 00520 Helsinki, Finland" },
        { id: "eatpoke", name: "Eat Poke Tripla", formattedAddress: "Fredikanterassi 1, 00520 Helsinki, Finland" },
      ])?.id,
    ).toBe("eatpoke");
  });

  it("does not match on generic words or the city alone", () => {
    const venue: WoltVenue = { ...mcd, name: "Ravintola Helsinki Kebab", brandName: undefined };
    expect(
      pickBestMatch(venue, [
        { id: "x", name: "Ravintola Helsinki", formattedAddress: "Fredrikinkatu 46, 00100 Helsinki, Finland" },
      ]),
    ).toBeNull();
  });

  it("accepts a postcode match when the street is written differently", () => {
    const best = pickBestMatch({ ...mcd, address: "Fredrikinkatu 46 A" }, [
      { id: "ok", name: "McDonald's", formattedAddress: "Fredrikinkatu 46a, 00100 Helsinki, Finland" },
    ]);
    expect(best?.id).toBe("ok");
  });
});
