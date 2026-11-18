/**
 * Search normalisation (blueprint section 3). The user's original text is always stored;
 * these functions only build the search key.
 *
 * Amharic writes several sounds with more than one letter series (ሀ/ሐ/ኀ, ሰ/ሠ, አ/ዐ, ጸ/ፀ),
 * so the same word appears with different spellings. Tigrinya keeps some of these as
 * different sounds (ሐ and ዐ are distinct consonants in Tigrinya), so folding them would
 * merge different words. Tigrinya therefore folds only ሠ→ሰ and ፀ→ጸ.
 * REVIEWER CHECK REQUIRED: the Tigrinya and Amharic folding sets must be confirmed by the
 * language reviewers before Gate 1.
 */

export type EthiopicLocale = 'am' | 'ti';

/** [from series start, to series start]. Each series is 8 code points (7 orders + one extra). */
const AMHARIC_FOLDS: [number, number][] = [
  [0x1210, 0x1200], // ሐ → ሀ
  [0x1280, 0x1200], // ኀ → ሀ
  [0x1220, 0x1230], // ሠ → ሰ
  [0x12d0, 0x12a0], // ዐ → አ
  [0x1340, 0x1338], // ፀ → ጸ
];

const TIGRINYA_FOLDS: [number, number][] = [
  [0x1220, 0x1230], // ሠ → ሰ
  [0x1340, 0x1338], // ፀ → ጸ
];

function buildMap(folds: [number, number][]): Map<number, number> {
  const map = new Map<number, number>();
  for (const [from, to] of folds) for (let i = 0; i < 8; i++) map.set(from + i, to + i);
  return map;
}

const FOLD_MAPS: Record<EthiopicLocale, Map<number, number>> = {
  am: buildMap(AMHARIC_FOLDS),
  ti: buildMap(TIGRINYA_FOLDS),
};

const ETHIOPIC_PUNCTUATION = /[፠-፨]/g; // section mark, wordspace ፡, full stop ።, commas, colons, question mark

export function foldEthiopic(text: string, locale: EthiopicLocale): string {
  const map = FOLD_MAPS[locale];
  let out = '';
  for (const ch of text.normalize('NFC')) {
    const cp = ch.codePointAt(0) ?? 0;
    const folded = map.get(cp);
    out += folded === undefined ? ch : String.fromCodePoint(folded);
  }
  return out;
}

const APOSTROPHES = /[’‘ʼʻ`´′]/g;

/** Afaan Oromo: the glottal-stop mark (hudhaa) is typed many ways; treat all as "'". */
export function normalizeOromo(text: string): string {
  return text.normalize('NFC').replace(APOSTROPHES, "'").toLowerCase();
}

/** The key stored in the search index for a piece of text in a given language. */
export function searchKey(text: string, language: 'am' | 'ti' | 'om' | 'en'): string {
  let t = text.normalize('NFC');
  if (language === 'am' || language === 'ti') t = foldEthiopic(t, language);
  if (language === 'om' || language === 'en') t = normalizeOromo(t);
  return t.replace(ETHIOPIC_PUNCTUATION, ' ').replace(/\s+/g, ' ').trim();
}
