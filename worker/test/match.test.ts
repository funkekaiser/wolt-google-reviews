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

  it("accepts a postcode match when the street is written differently", () => {
    const best = pickBestMatch({ ...mcd, address: "Fredrikinkatu 46 A" }, [
      { id: "ok", name: "McDonald's", formattedAddress: "Fredrikinkatu 46a, 00100 Helsinki, Finland" },
    ]);
    expect(best?.id).toBe("ok");
  });
});
