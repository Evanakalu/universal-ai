/**
 * Ethiopian calendar conversion (Amete Mihret era), via Julian Day Numbers.
 * 13 months: 12 of 30 days, then Pagume with 5 days (6 in Ethiopian leap years,
 * i.e. when (year + 1) % 4 === 0). Dates are stored in UTC and converted only for display.
 */

export interface CalendarDate {
  year: number;
  month: number; // 1-based
  day: number;
}

const ETHIOPIC_EPOCH_JDN = 1724221;

export function gregorianToJdn({ year, month, day }: CalendarDate): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

export function jdnToGregorian(jdn: number): CalendarDate {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    day: e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year: 100 * b + d - 4800 + Math.floor(m / 10),
  };
}

export function ethiopianToJdn({ year, month, day }: CalendarDate): number {
  return ETHIOPIC_EPOCH_JDN + 365 * (year - 1) + Math.floor(year / 4) + 30 * (month - 1) + day - 1;
}

/** Inverse of ethiopianToJdn (method from Dershowitz and Reingold, Calendrical Calculations). */
export function jdnToEthiopian(jdn: number): CalendarDate {
  const year = Math.floor((4 * (jdn - ETHIOPIC_EPOCH_JDN) + 1463) / 1461);
  const month = Math.floor((jdn - ethiopianToJdn({ year, month: 1, day: 1 })) / 30) + 1;
  const day = jdn + 1 - ethiopianToJdn({ year, month, day: 1 });
  return { year, month, day };
}

export function isEthiopianLeapYear(year: number): boolean {
  return (year + 1) % 4 === 0;
}

export function isValidEthiopianDate({ year, month, day }: CalendarDate): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 13 || day < 1) return false;
  if (month <= 12) return day <= 30;
  return day <= (isEthiopianLeapYear(year) ? 6 : 5);
}

export function toEthiopian(date: Date): CalendarDate {
  return jdnToEthiopian(
    gregorianToJdn({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }),
  );
}

export function fromEthiopian(date: CalendarDate): Date {
  if (!isValidEthiopianDate(date)) throw new RangeError(`Invalid Ethiopian date ${date.year}-${date.month}-${date.day}`);
  const g = jdnToGregorian(ethiopianToJdn(date));
  return new Date(Date.UTC(g.year, g.month - 1, g.day));
}

/** Month names for display. Reviewer-approved names will move to the translation files. */
export const ETHIOPIAN_MONTHS_AM = ['መስከረም', 'ጥቅምት', 'ኅዳር', 'ታኅሣሥ', 'ጥር', 'የካቲት', 'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜ'] as const;
