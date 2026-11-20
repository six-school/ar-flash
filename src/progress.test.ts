import { describe, expect, it } from "vitest";
import { parseProgress, withRecord, withSuspended } from "./progress";

const reviewedAt = "2026-11-19T21:00:00.000Z";

describe("parseProgress", () => {
  it("loads valid data", () => {
    const data = { "1": { level: 3, reviewedAt }, "7": { level: -1, reviewedAt } };
    expect(parseProgress(JSON.stringify(data))).toEqual(data);
  });

  it("loads suspended cards, studied or not", () => {
    const data = { "1": { level: 3, reviewedAt, suspended: true }, "7": { suspended: true } };
    expect(parseProgress(JSON.stringify(data))).toEqual(data);
  });

  it.each([
    ["a level above 11", { "1": { level: 12, reviewedAt } }],
    ["a level below -1", { "1": { level: -2, reviewedAt } }],
    ["a fractional level", { "1": { level: 1.5, reviewedAt } }],
    ["a reviewedAt that isn't an ISO timestamp", { "1": { level: 1, reviewedAt: "yesterday" } }],
    ["a missing level", { "1": { reviewedAt } }],
    ["a suspended flag that isn't true", { "1": { level: 1, reviewedAt, suspended: false } }],
    ["an empty record", { "1": {} }],
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

describe("withRecord, as used by undo", () => {
  it("restores a card's previous record", () => {
    const before = { level: 2, reviewedAt };
    const after = { level: 3, reviewedAt: "2026-11-20T21:00:00.000Z" };
    const answered = withRecord({ "5": before }, 5, after);
    expect(withRecord(answered, 5, before)).toEqual({ "5": before });
  });

  it("restores the absence of a record for a card that was new", () => {
    const other = { level: 1, reviewedAt };
    const answered = withRecord({ "4": other }, 5, { level: 1, reviewedAt });
    const undone = withRecord(answered, 5, undefined);
    expect(undone).toEqual({ "4": other });
    expect("5" in undone).toBe(false);
  });
});

describe("withSuspended", () => {
  it("suspends a studied card, keeping its level and review time", () => {
    expect(withSuspended({ level: 2, reviewedAt }, true)).toEqual({
      level: 2,
      reviewedAt,
      suspended: true,
    });
  });

  it("suspends a new card with a record holding only the flag", () => {
    expect(withSuspended(undefined, true)).toEqual({ suspended: true });
  });

  it("unsuspends a studied card by removing the key", () => {
    const r = withSuspended({ level: 2, reviewedAt, suspended: true }, false);
    expect(r).toEqual({ level: 2, reviewedAt });
    expect(r && "suspended" in r).toBe(false);
  });

  it("unsuspends a card that was never studied by removing its record", () => {
    expect(withSuspended({ suspended: true }, false)).toBeUndefined();
  });
});
