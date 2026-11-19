const SUKUN = "\u0652";
// Arabic letters, without tatweel (U+0640), and the marks that can follow a letter.
const LETTER = "\u0621-\u063F\u0641-\u064A";
const MARK = "\u064B-\u065F\u0670";
// Tanwin, short vowels, sukun and dagger alif: marks that say how a letter ends. Shadda doesn't.
const VOWEL = /[\u064B-\u0650\u0652\u0670]/;
// Alif, alif madda, alif maqsura, waw and yeh usually end a word as long vowels, which take no
// sukun.
const LONG_VOWEL = "\u0627\u0622\u0649\u0648\u064A";
// The last letter of a word where speech pauses (before punctuation or at the end), with its marks.
const PAUSE = new RegExp(`([${LETTER}])([${MARK}]*)(?=\\s*(?:[^\\s${LETTER}${MARK}]|$))`, "g");

/**
 * `text` as said with a pause: a sukun on the last letter before punctuation and at the end,
 * unless that letter already has a vowel or is a long-vowel letter. Speech engines otherwise fill
 * in a case ending, e.g. "akhḍaru" or "ṣaḥīḥan" for the single words "akhḍar" and "ṣaḥīḥ".
 */
export function pausal(text: string): string {
  return text.replace(PAUSE, (word, letter: string, marks: string) =>
    LONG_VOWEL.includes(letter) || VOWEL.test(marks) ? word : letter + marks + SUKUN,
  );
}

/** Speak `text` in Arabic, in pausal form, cutting off anything still being spoken. */
export function speak(text: string) {
  const utterance = new SpeechSynthesisUtterance(pausal(text));
  utterance.lang = "ar";
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}
