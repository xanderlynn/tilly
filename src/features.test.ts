import { describe, expect, it } from "vitest";
import { DEFAULT_FEATURES, FEATURE_KEY, enabledFeatures, featuresValue } from "./features";
import { weekChanges } from "./components/ChangeCards";
import type { Totals } from "./api";

describe("features", () => {
  it("defaults to Essentials and ignores junk", () => {
    expect([...enabledFeatures(undefined)]).toEqual(DEFAULT_FEATURES);
    expect([...enabledFeatures({ [FEATURE_KEY]: "not json" })]).toEqual(DEFAULT_FEATURES);
    expect([...enabledFeatures({ [FEATURE_KEY]: '["teams","nope"]' })]).toEqual(["teams"]);
    expect([...enabledFeatures({ [FEATURE_KEY]: "[]" })]).toEqual([]);
  });

  it("stores features in a fixed order", () => {
    expect(featuresValue(["usage", "workstreams"])).toBe('["workstreams","usage"]');
  });
});

const totals = (o: Partial<Totals>): Totals => ({
  sessions: 100, activeHours: 0, userTurns: 0, toolCalls: 0, toolErrors: 0, interruptions: 0, costUsd: 100, costHasEstimates: false,
  premiumRequests: 0, tokens: 0, commits: 0, aiCommits: 0, rated: 50, shipped: 20, successRate: 0.7, avgWaitSeconds: 120, waitHours: 0, ...o,
});

describe("week changes", () => {
  it("says nothing when nothing really moved", () => {
    expect(weekChanges(totals({}), totals({ shipped: 21, avgWaitSeconds: 110, successRate: 0.72 }))).toEqual([]);
    expect(weekChanges(totals({}), null)).toEqual([]);
  });

  it("shows big moves, better or worse", () => {
    const c = weekChanges(totals({ shipped: 30, avgWaitSeconds: 60 }), totals({}));
    expect(c.map((x) => [x.id, x.better])).toEqual([
      ["shipped", true],
      ["reply", true],
      ["cost", true],
    ]);
    expect(c[0].says).toBe("50% more work shipped than last week.");
  });

  it("needs success to differ by more than chance", () => {
    const c = weekChanges(totals({ rated: 200, successRate: 0.85 }), totals({ rated: 200, successRate: 0.6 }));
    expect(c.find((x) => x.id === "success")?.better).toBe(true);
  });
});
