import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anthropicAdapter, googleAdapter, ProviderError, type FetchLike, type CompletionRequest } from './adapters.ts';

const req: CompletionRequest = {
  model: 'test-model',
  system: 'Be brief.',
  messages: [{ role: 'user', content: 'ሰላም' }],
  maxOutputTokens: 100,
};

/** Records the call and returns a canned response. */
function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: { method: string; headers: Record<string, string>; body: string } }[] = [];
  const fn: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    };
  };
  const first = () => {
    const c = calls[0];
    assert.ok(c, "expected one request");
    return c;
  };
  return { fn, calls, first };
}

test('anthropic: sends the Messages API request shape with the key in a header', async () => {
  const { fn, first } = fakeFetch(200, { content: [{ type: 'text', text: 'hi' }], usage: { input_tokens: 5, output_tokens: 2 } });
  await anthropicAdapter({ apiKey: 'k-anth', fetch: fn }).complete(req);
  assert.equal(first().url, 'https://api.anthropic.com/v1/messages');
  assert.equal(first().init.method, 'POST');
  assert.equal(first().init.headers['x-api-key'], 'k-anth');
  assert.equal(first().init.headers['anthropic-version'], '2023-06-01');
  const sent = JSON.parse(first().init.body);
  assert.equal(sent.model, 'test-model');
  assert.equal(sent.max_tokens, 100);
  assert.equal(sent.system, 'Be brief.');
  assert.deepEqual(sent.messages, [{ role: 'user', content: 'ሰላም' }]);
});

test('anthropic: parses text blocks and adds cache reads back into input tokens', async () => {
  const { fn } = fakeFetch(200, {
    content: [
      { type: 'text', text: 'ሰላም ' },
      { type: 'tool_use', id: 'x', name: 'n', input: {} },
      { type: 'text', text: 'ዓለም' },
    ],
    usage: { input_tokens: 10, cache_read_input_tokens: 40, output_tokens: 7 },
  });
  const r = await anthropicAdapter({ apiKey: 'k', fetch: fn }).complete(req);
  assert.equal(r.text, 'ሰላም ዓለም');
  assert.equal(r.inputTokens, 50);
  assert.equal(r.cachedInputTokens, 40);
  assert.equal(r.outputTokens, 7);
  assert.equal(r.provider, 'anthropic');
});

test('anthropic: a non-2xx response throws a ProviderError with a short body', async () => {
  const { fn } = fakeFetch(429, 'x'.repeat(500));
  await assert.rejects(anthropicAdapter({ apiKey: 'k', fetch: fn }).complete(req), (e: unknown) => {
    assert.ok(e instanceof ProviderError);
    assert.equal(e.status, 429);
    assert.ok(e.message.length < 260);
    return true;
  });
});

test('google: sends generateContent with the key in a header, not the URL', async () => {
  const { fn, first } = fakeFetch(200, { candidates: [{ content: { parts: [{ text: 'hi' }] } }], usageMetadata: {} });
  await googleAdapter({ apiKey: 'k-goog', fetch: fn }).complete(req);
  assert.equal(first().url, 'https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent');
  assert.ok(!first().url.includes('k-goog'));
  assert.equal(first().init.headers['x-goog-api-key'], 'k-goog');
  const sent = JSON.parse(first().init.body);
  assert.deepEqual(sent.systemInstruction, { parts: [{ text: 'Be brief.' }] });
  assert.equal(sent.generationConfig.maxOutputTokens, 100);
});

test('google: maps assistant to model role and counts thinking tokens as output', async () => {
  const { fn, first } = fakeFetch(200, {
    candidates: [{ content: { parts: [{ text: 'a' }, { text: 'b' }] } }],
    usageMetadata: { promptTokenCount: 30, cachedContentTokenCount: 20, candidatesTokenCount: 4, thoughtsTokenCount: 6 },
  });
  const r = await googleAdapter({ apiKey: 'k', fetch: fn }).complete({
    ...req,
    messages: [
      { role: 'user', content: 'q' },
      { role: 'assistant', content: 'a' },
      { role: 'user', content: 'q2' },
    ],
  });
  const sent = JSON.parse(first().init.body);
  assert.deepEqual(
    sent.contents.map((c: { role: string }) => c.role),
    ['user', 'model', 'user'],
  );
  assert.equal(r.text, 'ab');
  assert.equal(r.inputTokens, 30);
  assert.equal(r.cachedInputTokens, 20);
  assert.equal(r.outputTokens, 10);
});

test('google: a blocked response with no candidates returns empty text, not a crash', async () => {
  const { fn } = fakeFetch(200, { promptFeedback: { blockReason: 'SAFETY' } });
  const r = await googleAdapter({ apiKey: 'k', fetch: fn }).complete(req);
  assert.equal(r.text, '');
  assert.equal(r.outputTokens, 0);
});

// Live contract tests: run only when a key is set, so CI without keys skips them.
// They make one small request each to confirm the real response shape still matches.
const liveAnthropic = process.env.ANTHROPIC_API_KEY ? test : test.skip;
liveAnthropic('live anthropic: response parses from the real API', async () => {
  const r = await anthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' }).complete({
    model: process.env.ANTHROPIC_TEST_MODEL ?? 'claude-haiku-5-5',
    messages: [{ role: 'user', content: 'Reply with the word ok.' }],
    maxOutputTokens: 20,
  });
  assert.ok(r.text.length > 0);
  assert.ok(r.inputTokens > 0 && r.outputTokens > 0);
});

const liveGoogle = process.env.GOOGLE_API_KEY ? test : test.skip;
liveGoogle('live google: response parses from the real API', async () => {
  const r = await googleAdapter({ apiKey: process.env.GOOGLE_API_KEY ?? '' }).complete({
    model: process.env.GOOGLE_TEST_MODEL ?? 'gemini-3.8-flash',
    messages: [{ role: 'user', content: 'Reply with the word ok.' }],
    maxOutputTokens: 20,
  });
  assert.ok(r.text.length > 0);
  assert.ok(r.inputTokens > 0 && r.outputTokens > 0);
});
