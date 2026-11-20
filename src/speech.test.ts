import { describe, expect, it } from "vitest";
import { pausal, tanwinBeforeAlif } from "./speech";

describe("tanwinBeforeAlif", () => {
  it("moves a tanwin fath from after an alif onto the letter before it", () => {
    expect(tanwinBeforeAlif("دائِماً")).toBe("دائِمًا");
    expect(tanwinBeforeAlif("أَهلاً بكَ")).toBe("أَهلًا بكَ");
  });

  it("leaves a tanwin fath that isn't after an alif", () => {
    for (const word of ["شُكرًا", "ساعَةً"]) {
      expect(tanwinBeforeAlif(word)).toBe(word);
    }
  });
});

describe("pausal", () => {
  it("puts a sukun on a final consonant with no vowel", () => {
    expect(pausal("أَخْضَر")).toBe("أَخْضَرْ");
    expect(pausal("صَحيح")).toBe("صَحيحْ");
  });

  it("puts a sukun after a final shadda, which isn't a vowel", () => {
    expect(pausal("حُبّ")).toBe("حُبّْ");
  });

  it("drops a final ta marbuta, leaving a fatha on the letter before it", () => {
    expect(pausal("وَرْدَة")).toBe("وَرْدَ");
    expect(pausal("ثَمانِية")).toBe("ثَمانِيَ");
    expect(pausal("مَعَ السَّلامة")).toBe("مَعَ السَّلامَ");
  });

  it("adds no fatha when a dropped ta marbuta follows an alif", () => {
    expect(pausal("صَلاة")).toBe("صَلا");
  });

  it("keeps a ta marbuta that has a vowel", () => {
    expect(pausal("ساعَةً")).toBe("ساعَةً");
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
    expect(pausal("جَيِّد، جَيِّدة")).toBe("جَيِّدْ، جَيِّدَ");
    expect(pausal("طَيِّب / طَيِّبة")).toBe("طَيِّبْ / طَيِّبَ");
    expect(pausal("صَحيح؟")).toBe("صَحيحْ؟");
  });

  it("leaves words inside a phrase alone", () => {
    expect(pausal("صَباح النّور")).toBe("صَباح النّورْ");
  });
});
