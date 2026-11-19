import { describe, expect, it } from "vitest";
import { MAX_LEVEL, dueAt, interval, listOrder, review, sessionOrder } from "./schedule";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const t0 = Date.parse("2026-11-19T21:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();

describe("review", () => {
  it("takes a new card to level 1 on a correct answer", () => {
    expect(review(undefined, true, t0)).toEqual({ level: 1, reviewedAt: iso(t0) });
  });

  it("takes a new card to level -1 on a miss", () => {
    expect(review(undefined, false, t0)).toEqual({ level: -1, reviewedAt: iso(t0) });
  });

  it("raises an overdue card's level by 1 on a correct answer", () => {
    const prev = { level: 3, reviewedAt: iso(t0) };
    expect(review(prev, true, t0 + DAY)).toEqual({ level: 4, reviewedAt: iso(t0 + DAY) });
  });

  it("counts a correct answer exactly at the due time", () => {
    const prev = { level: 3, reviewedAt: iso(t0) };
    expect(review(prev, true, t0 + 15 * HOUR)).toEqual({
      level: 4,
      reviewedAt: iso(t0 + 15 * HOUR),
    });
  });

  it("keeps the level at 11 on a correct answer at level 11", () => {
    const prev = { level: 11, reviewedAt: iso(t0) };
    expect(review(prev, true, t0 + 60 * DAY)).toEqual({
      level: 11,
      reviewedAt: iso(t0 + 60 * DAY),
    });
  });

  it("changes nothing, including reviewedAt, on a correct answer before the due time", () => {
    const prev = { level: 3, reviewedAt: iso(t0) };
    expect(review(prev, true, t0 + 15 * HOUR - 1)).toEqual(prev);
  });

  it("drops the level by 2 on a miss and sets reviewedAt, even before the due time", () => {
    const prev = { level: 5, reviewedAt: iso(t0) };
    expect(review(prev, false, t0 + HOUR)).toEqual({ level: 3, reviewedAt: iso(t0 + HOUR) });
  });

  it("doesn't drop the level below -1", () => {
    expect(review({ level: 0, reviewedAt: iso(t0) }, false, t0).level).toBe(-1);
    expect(review({ level: -1, reviewedAt: iso(t0) }, false, t0).level).toBe(-1);
  });
});

describe("interval", () => {
  it("makes levels -1 and 0 due immediately", () => {
    expect(interval(-1)).toBe(0);
    expect(interval(0)).toBe(0);
    expect(dueAt({ level: -1, reviewedAt: iso(t0) })).toBe(t0);
    expect(dueAt({ level: 0, reviewedAt: iso(t0) })).toBe(t0);
  });

  it("maps level 1 to 2 hours and level 11 to 45 days less 4 hours", () => {
    expect(interval(1)).toBe(2 * HOUR);
    expect(MAX_LEVEL).toBe(11);
    expect(interval(11)).toBe(45 * DAY - 4 * HOUR);
  });
});

describe("sessionOrder", () => {
  const cards = [1, 2, 3, 4, 5, 6].map((id) => ({ id }));
  const reviews = {
    1: { level: 1, reviewedAt: iso(t0 - 3 * HOUR) }, // due 1 hour ago
    2: { level: 3, reviewedAt: iso(t0 - 30 * HOUR) }, // due 15 hours ago
    3: { level: 2, reviewedAt: iso(t0 - HOUR) }, // due in 5 hours
    4: { level: 1, reviewedAt: iso(t0) }, // due in 2 hours
    // 5 and 6 are new.
  };

  it("puts due cards first, then new cards, then cards not yet due (soonest first)", () => {
    const ids = sessionOrder(cards, reviews, t0, Math.random).map((c) => c.id);
    expect(ids.slice(0, 2).toSorted((a, b) => a - b)).toEqual([1, 2]);
    expect(ids.slice(2, 4).toSorted((a, b) => a - b)).toEqual([5, 6]);
    expect(ids.slice(4)).toEqual([4, 3]);
  });

  it("shuffles cards with the given random function", () => {
    // With random() always 0, each Fisher–Yates step swaps position i with position 0.
    const ids = sessionOrder(cards, {}, t0, () => 0).map((c) => c.id);
    expect(ids).toEqual([2, 3, 4, 5, 6, 1]);
  });

  it("leaves due cards in shuffled order instead of sorting them by due time", () => {
    // With random() near 1, the shuffle leaves the cards in place, so card 1 (due 1 hour ago)
    // stays before card 2 (due 15 hours ago).
    const kept = sessionOrder(cards, reviews, t0, () => 0.999).map((c) => c.id);
    expect(kept).toEqual([1, 2, 5, 6, 4, 3]);
    // With random() always 0, the shuffle gives 2, 3, 4, 5, 6, 1, so card 2 comes first.
    const swapped = sessionOrder(cards, reviews, t0, () => 0).map((c) => c.id);
    expect(swapped).toEqual([2, 1, 5, 6, 4, 3]);
  });

  it("counts a card due exactly now as due, ahead of new cards", () => {
    const pair = [{ id: 1 }, { id: 2 }];
    const dueNow = { 2: { level: 0, reviewedAt: iso(t0) } };
    // The shuffle leaves new card 1 first; card 2 still comes before it.
    const ids = sessionOrder(pair, dueNow, t0, () => 0.999).map((c) => c.id);
    expect(ids).toEqual([2, 1]);
  });
});

describe("listOrder", () => {
  it("puts overdue cards first, then new cards, then cards not yet due, and breaks ties by id", () => {
    const cards = [6, 3, 5, 1].map((id) => ({ id }));
    const reviews = {
      3: { level: 1, reviewedAt: iso(t0) }, // due in 2 hours
      1: { level: 0, reviewedAt: iso(t0 - HOUR) }, // due 1 hour ago
    };
    expect(listOrder(cards, reviews, t0).map((c) => c.id)).toEqual([1, 5, 6, 3]);
  });
});
