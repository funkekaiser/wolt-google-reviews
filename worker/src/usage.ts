// Hard cap on billable Google Places requests. Google Cloud has no spending
// cap (budgets only alert, quotas are per-minute), so the Worker enforces one.
// The count lives in the UsageCap Durable Object (usage-cap.ts).

export interface Limits {
  daily: number;
  monthly: number;
}

export interface UsageState {
  day: string; // YYYY-MM-DD (UTC)
  dayCount: number;
  month: string; // YYYY-MM (UTC)
  monthCount: number;
}

export type ConsumeResult =
  | { ok: true; state: UsageState }
  | { ok: false; state: UsageState; period: "day" | "month"; retryAfterSeconds: number };

// Pure so it can be unit tested; the Durable Object just persists `state`.
export function consume(prev: UsageState | undefined, now: Date, limits: Limits): ConsumeResult {
  const day = now.toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  const state: UsageState = {
    day,
    dayCount: prev?.day === day ? prev.dayCount : 0,
    month,
    monthCount: prev?.month === month ? prev.monthCount : 0,
  };
  if (state.monthCount >= limits.monthly) {
    const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
    return { ok: false, state, period: "month", retryAfterSeconds: Math.ceil((next - now.getTime()) / 1000) };
  }
  if (state.dayCount >= limits.daily) {
    const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    return { ok: false, state, period: "day", retryAfterSeconds: Math.ceil((next - now.getTime()) / 1000) };
  }
  state.dayCount++;
  state.monthCount++;
  return { ok: true, state };
}

export class UsageCapExceeded extends Error {
  constructor(
    readonly period: "day" | "month",
    readonly retryAfterSeconds: number,
  ) {
    super(`Google request cap reached for this ${period}`);
  }
}

export function parseLimits(daily: string | undefined, monthly: string | undefined): Limits {
  // Fail closed: a missing or malformed limit must not mean "unlimited".
  if (!/^\d+$/.test(daily ?? "") || !/^\d+$/.test(monthly ?? "")) {
    throw new Error("GOOGLE_DAILY_LIMIT and GOOGLE_MONTHLY_LIMIT must be non-negative integers");
  }
  return { daily: Number(daily), monthly: Number(monthly) };
}
