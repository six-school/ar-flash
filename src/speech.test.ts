import { describe, expect, it } from "vitest";
import { pausal } from "./speech";

describe("pausal", () => {
  it("puts a sukun on a final consonant with no vowel", () => {
    expect(pausal("أَخْضَر")).toBe("أَخْضَرْ");
    expect(pausal("صَحيح")).toBe("صَحيحْ");
  });

  it("puts a sukun after a final shadda, which isn't a vowel", () => {
    expect(pausal("حُبّ")).toBe("حُبّْ");
  });

  it("puts a sukun on a final ta marbuta", () => {
    expect(pausal("وَرْدَة")).toBe("وَرْدَةْ");
  });

  it("leaves a final vowel, tanwin or sukun as it is", () => {
    for (const word of ["أَنتَ", "اِسمُكَ", "هٰذِهِ", "شُكراً", "أَخْضَرْ"]) {
      expect(pausal(word)).toBe(word);
    }
  });

  it("leaves a final long-vowel letter as it is", () => {
    for (const word of ["بابا", "عَلى", "تَفَضَّلوا", "عَرَبي"]) {
      expect(pausal(word)).toBe(word);
    }
  });

  it("pauses before punctuation as well as at the end", () => {
    expect(pausal("جَيِّد، جَيِّدة")).toBe("جَيِّدْ، جَيِّدةْ");
    expect(pausal("طَيِّب / طَيِّبة")).toBe("طَيِّبْ / طَيِّبةْ");
    expect(pausal("صَحيح؟")).toBe("صَحيحْ؟");
  });

  it("leaves words inside a phrase alone", () => {
    expect(pausal("صَباح النّور")).toBe("صَباح النّورْ");
  });
});
