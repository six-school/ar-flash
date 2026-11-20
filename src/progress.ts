import { useEffect, useState } from "react";
import { z } from "zod";
import { MAX_LEVEL, MIN_LEVEL, review, studied } from "./schedule";

const KEY = "flashcards-progress-v2";
const OLD_KEY = "flashcards-progress-v1";

/**
 * Card id → the card's level and last counted review, with `suspended: true` while the card is
 * suspended. A new card has no entry, or only the flag if it's suspended.
 */
const recordSchema = z.union([
  z.object({
    level: z.int().min(MIN_LEVEL).max(MAX_LEVEL),
    reviewedAt: z.iso.datetime(),
    suspended: z.literal(true).optional(),
  }),
  z.object({ suspended: z.literal(true) }),
]);
const progressSchema = z.partialRecord(z.string(), recordSchema);
type Progress = z.infer<typeof progressSchema>;
type CardRecord = z.infer<typeof recordSchema>;

/** Stored progress from its JSON text. Missing, malformed or invalid data gives empty progress. */
export function parseProgress(text: string | null): Progress {
  if (text === null) return {};
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return {};
  }
  const result = progressSchema.safeParse(data);
  return result.success ? result.data : {};
}

/** A copy of `p` with card `id`'s record set to `r`, or removed when `r` is undefined. */
export function withRecord(p: Progress, id: number, r: CardRecord | undefined): Progress {
  const next = { ...p };
  if (r) next[id] = r;
  else delete next[id];
  return next;
}

/**
 * Record `r` suspended, or not. Unsuspending removes the `suspended` key, and gives no record at all
 * for a card that was never studied, so it's new again.
 */
export function withSuspended(r: CardRecord | undefined, suspended: boolean) {
  if (suspended) return { ...r, suspended: true as const };
  const progress = studied(r);
  if (!progress) return undefined;
  const { suspended: _, ...rest } = progress;
  return rest;
}

function load(): Progress {
  try {
    localStorage.removeItem(OLD_KEY);
    return parseProgress(localStorage.getItem(KEY));
  } catch {
    // Unavailable storage: start fresh.
    return {};
  }
}

function save(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Private mode or quota: progress just won't persist.
  }
}

/** Download the study results (not the cards) as a dated JSON file. */
export function exportProgress(p: Progress) {
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `flashcards-results-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Progress state, written to localStorage on every change. */
export function useProgress() {
  const [progress, setProgress] = useState(load);

  useEffect(() => save(progress), [progress]);

  /**
   * Record an answer to card `id`, keeping its suspension, and return the card's previous record
   * (undefined if it had none), for `restore`. Each card mounts afresh after every answer or undo,
   * so `progress` here is current for the card being answered.
   */
  const answer = (id: number, remembered: boolean) => {
    const before = progress[id];
    const after = review(studied(before), remembered, Date.now());
    const record = before?.suspended ? { ...after, suspended: true as const } : after;
    setProgress((p) => withRecord(p, id, record));
    return before;
  };

  /** Suspend card `id`, or unsuspend it, and return its previous record, for `restore`. */
  const setSuspended = (id: number, suspended: boolean) => {
    const before = progress[id];
    setProgress((p) => withRecord(p, id, withSuspended(p[id], suspended)));
    return before;
  };

  /**
   * Put back card `id`'s previous record, as `answer` or `setSuspended` returned it, or remove the
   * card's record if `before` is undefined. A `before` that isn't a valid record, as from a damaged
   * saved session, changes nothing.
   */
  const restore = (id: number, before: unknown) => {
    const result = recordSchema.optional().safeParse(before);
    if (result.success) setProgress((p) => withRecord(p, id, result.data));
  };

  return { progress, answer, setSuspended, restore };
}
