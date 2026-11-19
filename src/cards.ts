import { useEffect, useState } from "react";
import { z } from "zod";

const FILE = "ar-en.json";

const cardFileSchema = z.object({
  /** The stack's name, shown on the home and stack screens. */
  title: z.string().min(1),
  cards: z
    .array(
      z.object({
        id: z.int(),
        /** Vowelled. */
        arabic: z.string().min(1),
        /** As normally printed, mostly without vowels. */
        plain: z.string().min(1),
        english: z.string().min(1),
      }),
    )
    // Progress is stored by card id, so ids must be unique.
    .superRefine((cards, ctx) => {
      const seen = new Set<number>();
      cards.forEach((c, i) => {
        if (seen.has(c.id))
          ctx.addIssue({ code: "custom", message: "duplicate id", path: [i, "id"] });
        seen.add(c.id);
      });
    }),
});
type CardFile = z.infer<typeof cardFileSchema>;

/** Where an issue is: the card's index and id when it's in a card, else the field path. */
function where(path: PropertyKey[], data: unknown): string {
  const [field, index, ...rest] = path;
  const inCard = field === "cards" && typeof index === "number";
  if (!inCard) return path.map(String).join(".") || "file";
  let card = `cards[${index}]`;
  if (typeof data === "object" && data && "cards" in data && Array.isArray(data.cards)) {
    const id: unknown = data.cards[index]?.id;
    if (typeof id === "number") card += ` (id ${id})`;
  }
  return rest.length ? `${card}, ${rest.map(String).join(".")}` : card;
}

/** The card file, or an error message naming the first failing entry and the problem. */
export function parseCardFile(data: unknown): { file: CardFile } | { error: string } {
  const result = cardFileSchema.safeParse(data);
  if (result.success) return { file: result.data };
  const [first, ...others] = result.error.issues;
  const more = others.length ? ` (and ${others.length} more problems)` : "";
  return { error: `${FILE}: ${where(first.path, data)}: ${first.message}${more}` };
}

export function useCards() {
  const [state, setState] = useState<{ file: CardFile } | { error: string } | null>(null);
  useEffect(() => {
    fetch(FILE)
      .then((r) => r.json())
      .then((data) => setState(parseCardFile(data)))
      .catch(() => setState({ error: `Couldn’t load ${FILE}.` }));
  }, []);
  return state;
}
