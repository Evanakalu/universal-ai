import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseReplyLanguage,
  detectScript,
  foldEthiopic,
  fromEthiopian,
  isValidEthiopianDate,
  normalizeOromo,
  searchKey,
  toEthiopian,
} from './index.ts';

/** ICU's own Ethiopic calendar, used as the reference (blueprint acceptance criterion: 100 dates). */
function icuEthiopian(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-u-ca-ethiopic', {
    year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

test('Ethiopian calendar matches ICU on 100 dates from 1990 to 2050, both directions', () => {
  let seed = 20261118;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  const start = Date.UTC(1990, 0, 1);
  const span = Date.UTC(2050, 0, 1) - start;
  for (let i = 0; i < 100; i++) {
    const d = new Date(start + Math.floor((rand() * span) / 86_400_000) * 86_400_000);
    const ours = toEthiopian(d);
    assert.deepEqual(ours, icuEthiopian(d), d.toISOString());
    assert.equal(fromEthiopian(ours).getTime(), d.getTime());
  }
});

test('Ethiopian calendar matches ICU on every day from 1990 to 2050', () => {
  for (let t = Date.UTC(1990, 0, 1); t < Date.UTC(2050, 0, 1); t += 86_400_000) {
    const d = new Date(t);
    const ours = toEthiopian(d);
    const ref = icuEthiopian(d);
    if (ours.year !== ref.year || ours.month !== ref.month || ours.day !== ref.day) {
      assert.fail(`${d.toISOString()}: ours ${JSON.stringify(ours)} vs ICU ${JSON.stringify(ref)}`);
    }
  }
});

test('known dates: Ethiopian new year and Pagume', () => {
  assert.deepEqual(toEthiopian(new Date('2026-09-11T00:00:00Z')), { year: 2019, month: 1, day: 1 });
  assert.deepEqual(toEthiopian(new Date('2026-09-10T00:00:00Z')), { year: 2018, month: 13, day: 5 });
  assert.deepEqual(toEthiopian(new Date('2026-11-18T00:00:00Z')), { year: 2019, month: 3, day: 9 });
  assert.equal(isValidEthiopianDate({ year: 2019, month: 13, day: 6 }), true); // 2019 + 1 divisible by 4
  assert.equal(isValidEthiopianDate({ year: 2018, month: 13, day: 6 }), false);
  assert.throws(() => fromEthiopian({ year: 2018, month: 13, day: 6 }), RangeError);
});

test('Amharic search folds the homophone letter series in every vowel order', () => {
  // ሐ/ኀ→ሀ, ሠ→ሰ, ዐ→አ, ጸ/ፀ
  assert.equal(foldEthiopic('ሐ ኀ ሠ ዐ ፀ', 'am'), 'ሀ ሀ ሰ አ ጸ');
  assert.equal(foldEthiopic('ሑ ኁ ሡ ዑ ፁ', 'am'), 'ሁ ሁ ሱ ኡ ጹ');
  // Same word, two common spellings, one search key
  assert.equal(searchKey('ፀሐይ', 'am'), searchKey('ጸሀይ', 'am'));
  assert.equal(searchKey('ዓመት', 'am'), searchKey('ኣመት', 'am'));
  // Folding keeps the vowel order: different vowels stay different words.
  assert.notEqual(searchKey('ዓለም', 'am'), searchKey('ዐለም', 'am'));
});

test('Tigrinya keeps ሐ and ዐ distinct but folds ሠ and ፀ', () => {
  assert.equal(foldEthiopic('ሐ ዐ', 'ti'), 'ሐ ዐ');
  assert.equal(foldEthiopic('ሠ ፀ', 'ti'), 'ሰ ጸ');
});

test('Ethiopic word spaces and full stops become plain spaces in the search key', () => {
  assert.equal(searchKey('ሰላም፡ዓለም።', 'am'), 'ሰላም ኣለም');
});

test('Oromo: every apostrophe form gives the same search key', () => {
  const forms = ["ba'aa", 'ba’aa', 'baʼaa', 'ba‘aa', 'ba`aa', 'BA´AA'];
  const keys = new Set(forms.map((f) => normalizeOromo(f)));
  assert.deepEqual([...keys], ["ba'aa"]);
  assert.equal(searchKey('Afaan Oromoo', 'om'), 'afaan oromoo');
});

test('script detection separates Ge\'ez and Latin text', () => {
  assert.equal(detectScript('ሰላም እንዴት ነህ?').script, 'ethiopic');
  assert.equal(detectScript('Akkam jirta?').script, 'latin');
  assert.equal(detectScript('ሰላም hello ሰላም hi').script, 'mixed');
  assert.equal(detectScript('123 !?').script, 'none');
});

test('reply language: pinned, then detected, then project, then interface', () => {
  assert.equal(chooseReplyLanguage({ ui: 'am' }), 'am');
  assert.equal(chooseReplyLanguage({ ui: 'am', project: 'ti' }), 'ti');
  assert.equal(chooseReplyLanguage({ ui: 'am', project: 'ti', detected: 'om' }), 'om');
  assert.equal(chooseReplyLanguage({ ui: 'am', project: 'ti', detected: 'om', pinned: 'am' }), 'am');
});
