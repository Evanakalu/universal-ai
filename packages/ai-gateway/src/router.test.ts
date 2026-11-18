import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ModelRegistry, SEED_MODELS, checkBudget, estimateCostUsd, usageEvent, activePrice, type RouteRequest } from './index.ts';

const NOW = new Date('2026-11-18T12:00:00Z');

function registry(): ModelRegistry {
  const r = new ModelRegistry({ allowedStorageCountries: ['US'], maxTermsAgeDays: 90 });
  for (const m of SEED_MODELS) r.add(m);
  return r;
}

const docRequest: RouteRequest = {
  operations: ['text.generate', 'json_output'],
  language: 'am',
  task: 'document_generation',
  dataClass: 'customer',
  tokens: { inputTokens: 25_000, cachedInputTokens: 12_500, outputTokens: 12_000 },
  at: NOW,
};

test('nothing routes customer work before EthioEval has scored it', () => {
  const result = registry().route(docRequest);
  assert.equal(result.candidates.length, 0);
  assert.ok(result.rejected.some((r) => r.reason.startsWith('no EthioEval result')));
});

test('only models that passed EthioEval for this language and task are used, cheapest first', () => {
  const r = registry();
  r.recordEval('anthropic/claude-sonnet-5-5', 'am', 'document_generation', 4.4, true, 'run-1');
  r.recordEval('google/gemini-3.8-flash', 'am', 'document_generation', 4.3, true, 'run-1');
  r.recordEval('anthropic/claude-haiku-5-5', 'am', 'document_generation', 3.6, false, 'run-1');
  const ids = r.route(docRequest).candidates.map((c) => c.model.id);
  assert.deepEqual(ids, ['google/gemini-3.8-flash', 'anthropic/claude-sonnet-5-5']);
  // Passing in Amharic says nothing about Tigrinya.
  assert.equal(r.route({ ...docRequest, language: 'ti' }).candidates.length, 0);
});

test('free tiers and providers storing data outside approved countries never get customer content', () => {
  const r = registry();
  for (const id of ['google/gemini-3.8-flash-free', 'deepseek/deepseek-flash']) {
    r.recordEval(id, 'am', 'document_generation', 4.5, true, 'run-1');
  }
  const { candidates, rejected } = r.route(docRequest);
  assert.equal(candidates.length, 0);
  assert.match(rejected.find((x) => x.id === 'google/gemini-3.8-flash-free')?.reason ?? '', /free tiers|public data only/);
  assert.match(rejected.find((x) => x.id === 'deepseek/deepseek-flash')?.reason ?? '', /public data only|not approved|training/);
  // The same models may be used for public test data.
  const pub = r.route({ ...docRequest, dataClass: 'public' }).candidates.map((c) => c.model.id);
  assert.ok(pub.includes('deepseek/deepseek-flash'));
});

test('sensitive data requires a zero-retention option', () => {
  const r = registry();
  r.recordEval('anthropic/claude-sonnet-5-5', 'om', 'conversation', 4.1, true, 'run-1');
  r.recordEval('google/gemini-3.8-flash', 'om', 'conversation', 4.2, true, 'run-1');
  const ids = r
    .route({ ...docRequest, language: 'om', task: 'conversation', dataClass: 'sensitive' })
    .candidates.map((c) => c.model.id);
  assert.deepEqual(ids, ['anthropic/claude-sonnet-5-5']);
});

test('models lacking an operation are never chosen', () => {
  const r = registry();
  r.recordEval('google/gemini-3.8-flash-free', 'ti', 'file_understanding', 4.5, true, 'run-1');
  const result = r.route({ ...docRequest, language: 'ti', task: 'file_understanding', dataClass: 'public', operations: ['pdf_input'] });
  assert.match(result.rejected.find((x) => x.id === 'google/gemini-3.8-flash-free')?.reason ?? '', /cannot do: pdf_input/);
});

test('announced price changes take effect on their date', () => {
  const flash = SEED_MODELS.find((m) => m.id === 'google/gemini-3.8-flash');
  assert.ok(flash);
  assert.equal(activePrice(flash, new Date('2026-12-31T23:00:00Z'))?.inputPerMillion, 0.75);
  assert.equal(activePrice(flash, new Date('2027-01-01T00:00:00Z'))?.inputPerMillion, 1.5);
});

test('stale data terms block customer routing and fail the production check', () => {
  const r = registry();
  r.recordEval('anthropic/claude-sonnet-5-5', 'am', 'document_generation', 4.4, true, 'run-1');
  const later = new Date('2027-03-01T00:00:00Z');
  assert.equal(r.route({ ...docRequest, at: later }).candidates.length, 0);
  assert.throws(() => r.assertProductionSafe(later), /older than 90 days/);
  assert.doesNotThrow(() => r.assertProductionSafe(NOW));
});

test('cost matches the blueprint unit cost for a document (USD 0.146)', () => {
  const sonnet = SEED_MODELS.find((m) => m.id === 'anthropic/claude-sonnet-5-5');
  assert.ok(sonnet?.prices[0]);
  const cost = estimateCostUsd(sonnet.prices[0], docRequest.tokens);
  assert.equal(Math.round(cost * 1000) / 1000, 0.146);
});

test('usage events need a consent record for customer content and compute cost', () => {
  const price = SEED_MODELS[1]?.prices[0];
  assert.ok(price);
  const base = {
    orgId: 'org-1', userId: 'u-1', taskStepId: 's-1', provider: 'anthropic', modelId: 'anthropic/claude-sonnet-5-5',
    category: 'document_generation' as const, dataClass: 'customer' as const,
    inputTokens: 25_000, cachedInputTokens: 12_500, outputTokens: 12_000,
  };
  assert.throws(() => usageEvent(base, price, NOW), /consent record/);
  const event = usageEvent({ ...base, consentRecordId: 'c-1' }, price, NOW);
  assert.equal(event.costUsd, 0.14625);
});

test('budget guard: task overrun asks, user and organisation limits stop', () => {
  const limits = { taskUsd: 1, userMonthUsd: 10, orgMonthUsd: 1000 };
  assert.equal(checkBudget({ taskUsd: 0.2, userMonthUsd: 2, orgMonthUsd: 100 }, 0.3, limits).decision, 'ok');
  assert.equal(checkBudget({ taskUsd: 0.9, userMonthUsd: 2, orgMonthUsd: 100 }, 0.3, limits).decision, 'needs_approval');
  assert.equal(checkBudget({ taskUsd: 0.1, userMonthUsd: 9.9, orgMonthUsd: 100 }, 0.3, limits).decision, 'blocked');
  const warn = checkBudget({ taskUsd: 0, userMonthUsd: 8.5, orgMonthUsd: 100 }, 0.1, limits);
  assert.ok(warn.decision === 'ok' && warn.warnings.length === 1);
});
