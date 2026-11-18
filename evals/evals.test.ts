import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateItem } from './src/schema.ts';
import { checkConstraints, cohenKappa, scoreTask } from './src/scoring.ts';

const itemsDir = join(dirname(fileURLToPath(import.meta.url)), 'items');

function jsonlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? jsonlFiles(join(dir, e.name)) : e.name.endsWith('.jsonl') ? [join(dir, e.name)] : [],
  );
}

test('the item template follows the schema', () => {
  const lines = readFileSync(join(itemsDir, '_TEMPLATE.jsonl'), 'utf8').trim().split('\n');
  for (const line of lines) assert.deepEqual(validateItem(JSON.parse(line)), []);
});

test('every EthioEval item in the repository is valid and ids are unique', () => {
  const seen = new Set<string>();
  for (const file of jsonlFiles(itemsDir).filter((f) => !f.endsWith('_TEMPLATE.jsonl'))) {
    for (const line of readFileSync(file, 'utf8').split('\n').filter((l) => l.trim())) {
      const item = JSON.parse(line) as { id: string };
      assert.deepEqual(validateItem(item), [], file);
      assert.ok(!seen.has(item.id), `duplicate id ${item.id}`);
      seen.add(item.id);
    }
  }
});

test('items written by AI, machine-translated or self-reviewed are rejected', () => {
  const base = {
    id: 'am-conversation-001', language: 'am', locale: 'am-ET', taskType: 'conversation', prompt: 'x',
    scoring: 'rubric', author: { name: 'Hana', kind: 'human' }, source: 'native_written', status: 'draft', reviewers: [],
  };
  assert.deepEqual(validateItem(base), []);
  assert.ok(validateItem({ ...base, author: { name: 'model', kind: 'ai' } }).length > 0);
  assert.ok(validateItem({ ...base, source: 'machine_translated' }).length > 0);
  assert.ok(validateItem({ ...base, status: 'reviewed', reviewers: ['Hana'] }).some((e) => e.includes('own item')));
  assert.ok(validateItem({ ...base, locale: 'ti-ER' }).some((e) => e.includes('does not match')));
});

test('task scores apply the per-task pass bar and minimum sample size', () => {
  const docs = Array.from({ length: 30 }, (_, i) => ({ itemId: `d${i}`, rubric: [4, 5] }));
  assert.equal(scoreTask('document_generation', docs).pass, true); // mean 4.5 >= 4.2
  const weak = docs.map((r) => ({ ...r, rubric: [4, 4] }));
  assert.equal(scoreTask('document_generation', weak).pass, false); // 4.0 < 4.2
  assert.equal(scoreTask('conversation', weak).pass, true); // 4.0 >= 4.0
  assert.match(scoreTask('conversation', weak.slice(0, 10)).reasons.join(), /at least 30/);
  const research = docs.map((r, i) => ({ ...r, citationErrors: i === 3 ? 1 : 0 }));
  assert.match(scoreTask('research', research).reasons.join(), /wrong citations/);
});

test("Cohen's kappa", () => {
  assert.equal(cohenKappa([1, 1, 0, 0], [1, 0, 0, 0]), 0.5);
  assert.equal(cohenKappa([3, 4, 5], [3, 4, 5]), 1);
});

test('automatic constraint checks count Ethiopic word separators', () => {
  const out = checkConstraints('ሰላም፡ዓለም ደህና', [
    { type: 'max_words', value: 3 },
    { type: 'script', value: 'ethiopic' },
    { type: 'must_not_include', value: 'English' },
  ]);
  assert.deepEqual(out, { passed: 3, failed: [] });
  assert.equal(checkConstraints('Akkam jirta', [{ type: 'script', value: 'ethiopic' }]).failed.length, 1);
});
