import { describe, expect, it } from "vitest";
import { consume, parseLimits, type UsageState } from "../src/usage";

const limits = { daily: 2, monthly: 3 };
const at = (iso: string) => new Date(iso);

describe("consume", () => {
  it("counts up to the daily limit, then refuses until next UTC midnight", () => {
    let state: UsageState | undefined;
    for (let i = 0; i < 2; i++) {
      const r = consume(state, at("2026-09-19T12:00:00Z"), limits);
      expect(r.ok).toBe(true);
      state = r.state;
    }
    const denied = consume(state, at("2026-09-19T23:59:00Z"), limits);
    expect(denied).toMatchObject({ ok: false, period: "day", retryAfterSeconds: 60 });

    const nextDay = consume(state, at("2026-09-20T00:00:01Z"), limits);
    expect(nextDay.ok).toBe(true);
    expect(nextDay.state).toMatchObject({ dayCount: 1, monthCount: 3 });
  });

  it("enforces the monthly limit across days and resets next month", () => {
    const state: UsageState = { day: "2026-09-20", dayCount: 1, month: "2026-09", monthCount: 3 };
    expect(consume(state, at("2026-09-25T10:00:00Z"), limits)).toMatchObject({ ok: false, period: "month" });
    const october = consume(state, at("2026-10-01T00:00:00Z"), limits);
    expect(october.ok).toBe(true);
    expect(october.state).toMatchObject({ day: "2026-10-01", dayCount: 1, month: "2026-10", monthCount: 1 });
  });

  it("refuses everything when a limit is 0", () => {
    expect(consume(undefined, new Date(), { daily: 0, monthly: 10 }).ok).toBe(false);
  });
});

describe("parseLimits", () => {
  it("parses integer strings", () => {
    expect(parseLimits("100", "2000")).toEqual({ daily: 100, monthly: 2000 });
  });
  it.each([
    [undefined, "10"],
    ["", "10"],
    ["abc", "10"],
    ["1.5", "10"],
    ["-1", "10"],
  ])("fails closed on %j", (d, m) => {
    expect(() => parseLimits(d, m)).toThrow();
  });
});
