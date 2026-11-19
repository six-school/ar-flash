import { describe, expect, it } from "vitest";
import { stackStatus } from "./screens";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const now = Date.parse("2026-11-19T21:00:00.000Z");

describe("stackStatus", () => {
  it("counts the cards due now and the unstudied cards", () => {
    const dueTimes = [now - DAY, now - HOUR, now + HOUR];
    expect(stackStatus(dueTimes, 32, now)).toBe("2 cards due now · 32 unstudied");
  });

  it("counts a card due exactly now, in the singular, and leaves out a zero unstudied count", () => {
    expect(stackStatus([now, now + HOUR], 0, now)).toBe("1 card due now");
  });

  it("shows only the unstudied count before any card is studied", () => {
    expect(stackStatus([], 130, now)).toBe("130 unstudied");
  });

  it("says how soon the next card is due when none is due now", () => {
    const dueTimes = [now + 3 * DAY, now + 3 * HOUR];
    expect(stackStatus(dueTimes, 5, now)).toBe("Next due in 3 hours · 5 unstudied");
  });

  it.each([
    ["10 s", "in 1 minute", 10 * 1000],
    ["45 min", "in 45 minutes", 45 * MINUTE],
    ["59 min 40 s", "in 1 hour", 59 * MINUTE + 40 * 1000],
    ["2 h 40 min", "in 3 hours", 2 * HOUR + 40 * MINUTE],
    ["23 h 40 min", "in 1 day", 23 * HOUR + 40 * MINUTE],
    ["2 days less 4 h", "in 2 days", 2 * DAY - 4 * HOUR],
    ["13 days", "in 13 days", 13 * DAY],
    ["14 days", "in 2 weeks", 14 * DAY],
    ["45 days less 4 h", "in 6 weeks", 45 * DAY - 4 * HOUR],
  ])("rounds a card due %s ahead to %j", (_, words, ahead) => {
    expect(stackStatus([now + ahead], 0, now)).toBe(`Next due ${words}`);
  });

  it("says there are no cards for an empty stack", () => {
    expect(stackStatus([], 0, now)).toBe("No cards");
  });
});
