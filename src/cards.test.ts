import { describe, expect, it } from "vitest";
import { parseCardFile } from "./cards";
import arEn from "../public/ar-en.json";

const valid = {
  title: "Arabic → English",
  cards: [
    { id: 1, arabic: "أَب", plain: "أب", english: "father" },
    { id: 7, arabic: "ثابِت", plain: "ثابت", english: "fixed, stable" },
  ],
};

describe("parseCardFile", () => {
  it("parses a valid file", () => {
    expect(parseCardFile(valid)).toEqual({ file: valid });
  });

  it("names the failing entry and the problem", () => {
    const { plain: _, ...missingPlain } = valid.cards[1];
    const result = parseCardFile({ ...valid, cards: [valid.cards[0], missingPlain] });
    expect(result).toEqual({ error: expect.stringContaining("cards[1] (id 7), plain: ") });
  });

  it("rejects a duplicate id, naming the duplicate", () => {
    const result = parseCardFile({ ...valid, cards: [...valid.cards, { ...valid.cards[0] }] });
    expect(result).toEqual({ error: expect.stringContaining("cards[2] (id 1), id: duplicate id") });
  });
});

describe("public/ar-en.json", () => {
  it("parses with the card schema", () => {
    const result = parseCardFile(arEn);
    if ("error" in result) throw new Error(result.error);
  });

  it("has unique ids", () => {
    const ids = arEn.cards.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
