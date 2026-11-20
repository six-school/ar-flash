const SUKUN = "\u0652";
// Arabic letters, without tatweel (U+0640), and the marks that can follow a letter.
const LETTER = "\u0621-\u063F\u0641-\u064A";
const MARK = "\u064B-\u065F\u0670";
// Tanwin, short vowels, sukun and dagger alif: marks that say how a letter ends. Shadda doesn't.
const VOWEL = /[\u064B-\u0650\u0652\u0670]/;
// Alif, alif madda, alif maqsura, waw and yeh usually end a word as long vowels, which take no
// sukun.
const LONG_VOWEL = "\u0627\u0622\u0649\u0648\u064A";
const FATHA = "\u064E";
const TA_MARBUTA = "\u0629";
// Alif and alif madda: a ta marbuta after them needs no fatha.
const ALIF = "\u0627\u0622";
// Where speech pauses: before punctuation or at the end of the text.
const AT_PAUSE = `(?=\\s*(?:[^\\s${LETTER}${MARK}]|$))`;
// The last letter of a word at a pause, with its marks.
const PAUSE = new RegExp(`([${LETTER}])([${MARK}]*)${AT_PAUSE}`, "g");
// A bare ta marbuta at a pause, with the letter and marks before it.
const PAUSED_TA_MARBUTA = new RegExp(`([${LETTER}])([${MARK}]*)${TA_MARBUTA}${AT_PAUSE}`, "g");

/**
 * `text` as said with a pause, before punctuation and at the end. Speech engines otherwise fill in
 * a case ending, e.g. "akhḍaru" or "ṣaḥīḥan" for the single words "akhḍar" and "ṣaḥīḥ".
 *
 * - A bare ta marbuta is dropped, and the letter before it gets a fatha if it has no vowel, so
 *   "as-salāma" ends in "-a". Engines say a ta marbuta with a sukun as a hard "t".
 * - Any other last letter gets a sukun, unless it already has a vowel or is a long-vowel letter.
 */
export function pausal(text: string): string {
  return text
    .replace(PAUSED_TA_MARBUTA, (_, letter: string, marks: string) =>
      ALIF.includes(letter) || VOWEL.test(marks) ? letter + marks : letter + marks + FATHA,
    )
    .replace(PAUSE, (word, letter: string, marks: string) =>
      LONG_VOWEL.includes(letter) || VOWEL.test(marks) ? word : letter + marks + SUKUN,
    );
}

/**
 * Speak `text` in Arabic, in pausal form, cutting off anything still being spoken. Calls `onEnd`
 * when the speech ends, fails or is cut off. Returns the utterance.
 */
export function speak(text: string, onEnd: () => void) {
  const utterance = new SpeechSynthesisUtterance(pausal(text));
  utterance.lang = "ar";
  utterance.addEventListener("end", onEnd);
  utterance.addEventListener("error", onEnd);
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
  return utterance;
}
