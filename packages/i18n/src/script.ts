/**
 * Script detection. This tells Ge'ez (Amharic, Tigrinya) from Latin (Oromo, English) text.
 * It cannot tell Amharic from Tigrinya or Oromo from English; that needs a language-ID model,
 * chosen and tested in Phase 0.
 */

export type Script = 'ethiopic' | 'latin' | 'mixed' | 'none';

function isEthiopic(cp: number): boolean {
  return (
    (cp >= 0x1200 && cp <= 0x139f) || // Ethiopic, Ethiopic Supplement
    (cp >= 0x2d80 && cp <= 0x2ddf) || // Ethiopic Extended
    (cp >= 0xab00 && cp <= 0xab2f) || // Ethiopic Extended-A
    (cp >= 0x1e7e0 && cp <= 0x1e7ff) // Ethiopic Extended-B
  );
}

function isLatinLetter(cp: number): boolean {
  return (cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a) || (cp >= 0xc0 && cp <= 0x24f);
}

export function detectScript(text: string): { script: Script; ethiopicShare: number } {
  let ethiopic = 0;
  let latin = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (isEthiopic(cp)) ethiopic++;
    else if (isLatinLetter(cp)) latin++;
  }
  const letters = ethiopic + latin;
  if (letters === 0) return { script: 'none', ethiopicShare: 0 };
  const share = ethiopic / letters;
  const script: Script = share >= 0.8 ? 'ethiopic' : share <= 0.2 ? 'latin' : 'mixed';
  return { script, ethiopicShare: Math.round(share * 1000) / 1000 };
}
