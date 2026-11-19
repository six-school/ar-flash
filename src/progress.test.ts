import { describe, expect, it } from "vitest";
import { parseProgress, withReview } from "./progress";

const reviewedAt = "2026-11-19T21:00:00.000Z";

describe("parseProgress", () => {
  it("loads valid data", () => {
    const data = { "1": { level: 3, reviewedAt }, "7": { level: -1, reviewedAt } };
    expect(parseProgress(JSON.stringify(data))).toEqual(data);
  });

  it.each([
    ["a level above 11", { "1": { level: 12, reviewedAt } }],
    ["a level below -1", { "1": { level: -2, reviewedAt } }],
    ["a fractional level", { "1": { level: 1.5, reviewedAt } }],
    ["a reviewedAt that isn't an ISO timestamp", { "1": { level: 1, reviewedAt: "yesterday" } }],
    ["a missing level", { "1": { reviewedAt } }],
    ["the old per-stack counts", { "ar-en": { "1": { remembered: 2, forgotten: 1 } } }],
    ["an array", [{ level: 1, reviewedAt }]],
  ])("gives empty progress for data with %s", (_, data) => {
    expect(parseProgress(JSON.stringify(data))).toEqual({});
  });

  it("gives empty progress for malformed JSON", () => {
    expect(parseProgress("{")).toEqual({});
  });

  it("gives empty progress when nothing is stored", () => {
    expect(parseProgress(null)).toEqual({});
  });
});

describe("withReview, as used by undo", () => {
  it("restores a card's previous record", () => {
    const before = { level: 2, reviewedAt };
    const after = { level: 3, reviewedAt: "2026-11-20T21:00:00.000Z" };
    const answered = withReview({ "5": before }, 5, after);
    expect(withReview(answered, 5, before)).toEqual({ "5": before });
  });

  it("restores the absence of a record for a card that was new", () => {
    const other = { level: 1, reviewedAt };
    const answered = withReview({ "4": other }, 5, { level: 1, reviewedAt });
    const undone = withReview(answered, 5, undefined);
    expect(undone).toEqual({ "4": other });
    expect("5" in undone).toBe(false);
  });
});
