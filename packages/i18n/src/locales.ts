import type { Language } from '../../core-types/src/index.ts';

export interface LocaleInfo {
  tag: string;
  language: Language;
  script: 'Ethi' | 'Latn';
  /** Name shown in the language switcher, in the language itself. */
  nativeName: string;
  userFacing: boolean;
}

export const LOCALES: LocaleInfo[] = [
  { tag: 'am-ET', language: 'am', script: 'Ethi', nativeName: 'አማርኛ', userFacing: true },
  { tag: 'ti-ET', language: 'ti', script: 'Ethi', nativeName: 'ትግርኛ (ኢትዮጵያ)', userFacing: true },
  { tag: 'ti-ER', language: 'ti', script: 'Ethi', nativeName: 'ትግርኛ (ኤርትራ)', userFacing: true },
  { tag: 'om-ET', language: 'om', script: 'Latn', nativeName: 'Afaan Oromoo', userFacing: true },
  { tag: 'en', language: 'en', script: 'Latn', nativeName: 'English (staff)', userFacing: false },
];

export function localeInfo(tag: string): LocaleInfo {
  const found = LOCALES.find((l) => l.tag === tag);
  if (!found) throw new RangeError(`Unsupported locale ${tag}`);
  return found;
}

/**
 * Which language the AI should answer in (blueprint section 3):
 * a pinned reply language wins; otherwise the language the user just wrote in;
 * otherwise the project language; otherwise the interface language.
 */
export function chooseReplyLanguage(opts: {
  pinned?: Language;
  detected?: Language;
  project?: Language;
  ui: Language;
}): Language {
  return opts.pinned ?? opts.detected ?? opts.project ?? opts.ui;
}
