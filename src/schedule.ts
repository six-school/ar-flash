/** A studied card's progress: its level and when it was last reviewed (an ISO timestamp). */
type Review = { level: number; reviewedAt: string };
type Reviews = Partial<Record<number, Review>>;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * The interval after which a card at each level from 1 up is due again. Intervals of a day or
 * more are 4 hours short of whole days, so a card answered in one evening's session is due by the
 * same time of an evening session a few days later, rather than slipping a day.
 */
const INTERVALS = [
  2 * HOUR,
  6 * HOUR,
  15 * HOUR,
  2 * DAY - 4 * HOUR,
  3 * DAY - 4 * HOUR,
  5 * DAY - 4 * HOUR,
  8 * DAY - 4 * HOUR,
  13 * DAY - 4 * HOUR,
  21 * DAY - 4 * HOUR,
  30 * DAY - 4 * HOUR,
  45 * DAY - 4 * HOUR,
];

/**
 * The level stops at the last interval: levels past it wouldn't lengthen the interval, so a miss
 * there wouldn't shorten it either.
 */
export const MIN_LEVEL = -1;
export const MAX_LEVEL = INTERVALS.length;

/** Levels below 1 have no interval: the card is due as soon as it is reviewed. */
export const interval = (level: number) => (level < 1 ? 0 : INTERVALS[level - 1]);

/** When a studied card is due, in milliseconds since the epoch. */
export const dueAt = (r: Review) => Date.parse(r.reviewedAt) + interval(r.level);

/**
 * The record after answering a card at `now` (ms). A new card (no record) starts from level 0.
 * A miss always counts, and drops the level by 2. A correct answer counts only once the card is
 * due, and raises the level by 1; before then it changes nothing, so the due time doesn't keep
 * moving later.
 */
export function review(prev: Review | undefined, remembered: boolean, now: number): Review {
  if (remembered && prev && now < dueAt(prev)) return prev;
  const level = prev?.level ?? 0;
  return {
    level: remembered ? Math.min(level + 1, MAX_LEVEL) : Math.max(level - 2, MIN_LEVEL),
    reviewedAt: new Date(now).toISOString(),
  };
}

/** Cards sort by this key: a studied card's due time, or `now` for a new card. */
const sortKey = (r: Review | undefined, now: number) => (r ? dueAt(r) : now);

/**
 * The order of a session starting at `now`: cards that are due, then new cards, both shuffled
 * with `random`, then cards not yet due (soonest first, ties shuffled). Due cards aren't sorted by
 * due time, because cards answered together would then come back in the order they were answered.
 */
export function sessionOrder<T extends { id: number }>(
  cards: T[],
  reviews: Reviews,
  now: number,
  random: () => number,
): T[] {
  const a = [...cards];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  const due: T[] = [];
  const fresh: T[] = [];
  const later: T[] = [];
  for (const c of a) {
    const r = reviews[c.id];
    if (!r) fresh.push(c);
    else if (dueAt(r) <= now) due.push(c);
    else later.push(c);
  }
  // The sort is stable, so the shuffle survives among equal due times.
  later.sort((x, y) => sortKey(reviews[x.id], now) - sortKey(reviews[y.id], now));
  return [...due, ...fresh, ...later];
}

/**
 * The order of the stack's card list: overdue cards (most overdue first), then new cards, then
 * cards not yet due (soonest first), with ties broken by id. Unlike a session's order, it doesn't
 * change between visits.
 */
export function listOrder<T extends { id: number }>(
  cards: T[],
  reviews: Reviews,
  now: number,
): T[] {
  return cards.toSorted(
    (x, y) => sortKey(reviews[x.id], now) - sortKey(reviews[y.id], now) || x.id - y.id,
  );
}
