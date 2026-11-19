import { useEffect, useState } from "react";
import { z } from "zod";
import { MAX_LEVEL, MIN_LEVEL, review } from "./schedule";

const KEY = "flashcards-progress-v2";
const OLD_KEY = "flashcards-progress-v1";

/** Card id → the card's level and last counted review. New cards have no entry. */
const progressSchema = z.partialRecord(
  z.string(),
  z.object({ level: z.int().min(MIN_LEVEL).max(MAX_LEVEL), reviewedAt: z.iso.datetime() }),
);
type Progress = z.infer<typeof progressSchema>;
type Review = NonNullable<Progress[string]>;

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
export function withReview(p: Progress, id: number, r: Review | undefined): Progress {
  const next = { ...p };
  if (r) next[id] = r;
  else delete next[id];
  return next;
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
   * Record an answer to card `id` and return a function that restores the card's previous record
   * (or its absence). Each card mounts afresh after every answer or undo, so `progress` here is
   * current for the card being answered.
   */
  const answer = (id: number, remembered: boolean) => {
    const before = progress[id];
    const after = review(before, remembered, Date.now());
    setProgress((p) => withReview(p, id, after));
    return () => setProgress((p) => withReview(p, id, before));
  };

  return { progress, answer };
}
