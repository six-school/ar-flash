import { useCallback, useEffect, useState } from "react";

export type Entry = { id: number; arabic: string; english: string; romanization: string | null };

export type StackId = "en-ar" | "ar-en";
export const STACKS: { id: StackId; title: string }[] = [
  { id: "en-ar", title: "English → Arabic" },
  { id: "ar-en", title: "Arabic → English" },
];

export type Outcome = "remembered" | "forgotten";
export type Result = { remembered: number; forgotten: number };
export type Progress = Record<StackId, Record<number, Result>>;

const KEY = "flashcards-progress-v1";
const EMPTY: Result = { remembered: 0, forgotten: 0 };

function load(): Progress {
  const fresh: Progress = { "en-ar": {}, "ar-en": {} };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    for (const s of STACKS) if (saved[s.id]) fresh[s.id] = saved[s.id];
  } catch {
    // Unavailable or corrupt storage: start fresh.
  }
  return fresh;
}

function save(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Private mode or quota: progress just won't persist.
  }
}

/** Download the study results (not the vocabulary) as a dated JSON file. */
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

export const resultOf = (p: Progress, stack: StackId, id: number) => p[stack][id] ?? EMPTY;

/** One forgotten counts as two remembered; unstudied cards score 0. */
export const score = (r: Result) => r.remembered - 2 * r.forgotten;

/** The prompt shown on the question side of a card in this stack. */
export const questionOf = (stack: StackId, e: Entry) => (stack === "en-ar" ? e.english : e.arabic);

/** Lowest score first; cards with equal scores are shuffled. */
export function sessionOrder(entries: Entry[], p: Progress, stack: StackId): Entry[] {
  const a = [...entries];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  // The sort is stable, so the shuffle survives within each score.
  return a.toSorted((x, y) => score(resultOf(p, stack, x.id)) - score(resultOf(p, stack, y.id)));
}

/** Progress state, written to localStorage on every change. */
export function useProgress() {
  const [progress, setProgress] = useState(load);

  useEffect(() => save(progress), [progress]);

  /** Add (delta 1) or remove (delta -1, for undo) one outcome for a card. */
  const record = useCallback((stack: StackId, id: number, outcome: Outcome, delta: 1 | -1) => {
    setProgress((p) => {
      const r = { ...resultOf(p, stack, id) };
      r[outcome] = Math.max(0, r[outcome] + delta);
      return { ...p, [stack]: { ...p[stack], [id]: r } };
    });
  }, []);

  return { progress, record };
}

export function useVocabulary() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch("vocabulary.json")
      .then((r) => r.json())
      .then(setEntries)
      .catch(() => setError(true));
  }, []);
  return { entries, error };
}
