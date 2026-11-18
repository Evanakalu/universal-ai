/**
 * Provider adapters behind the gateway (Phase 0, task 10).
 *
 * Nothing outside this package calls a provider. An adapter only sends a request the router
 * has already approved for this model, and only returns text and token counts. Adapters use
 * plain fetch so the package keeps zero runtime dependencies; the fetch function is injectable
 * so contract tests run offline.
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompletionRequest {
  /** The provider's model id, e.g. "claude-sonnet-5-5". Never our internal id. */
  model: string;
  system?: string;
  messages: ChatMessage[];
  maxOutputTokens: number;
}

export interface CompletionResult {
  provider: string;
  model: string;
  text: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

export interface ProviderAdapter {
  readonly provider: string;
  complete(req: CompletionRequest): Promise<CompletionResult>;
}

export class ProviderError extends Error {
  readonly provider: string;
  readonly status: number;
  constructor(provider: string, status: number, body: string) {
    // The body is kept short so provider error text cannot leak customer content into logs.
    super(`${provider} request failed with HTTP ${status}: ${body.slice(0, 200)}`);
    this.name = 'ProviderError';
    this.provider = provider;
    this.status = status;
  }
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function obj(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

export interface AnthropicAdapterOptions {
  apiKey: string;
  fetch?: FetchLike;
  baseUrl?: string;
  anthropicVersion?: string;
}

/** Anthropic Messages API: POST /v1/messages. */
export function anthropicAdapter(opts: AnthropicAdapterOptions): ProviderAdapter {
  const fetchFn: FetchLike = opts.fetch ?? (globalThis.fetch as unknown as FetchLike);
  const base = opts.baseUrl ?? 'https://api.anthropic.com';
  return {
    provider: 'anthropic',
    async complete(req) {
      const body: Record<string, unknown> = {
        model: req.model,
        max_tokens: req.maxOutputTokens,
        messages: req.messages,
      };
      if (req.system) body.system = req.system;
      const res = await fetchFn(`${base}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': opts.apiKey,
          'anthropic-version': opts.anthropicVersion ?? '2023-06-01',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new ProviderError('anthropic', res.status, await res.text());
      const data = obj(await res.json());
      const blocks = Array.isArray(data.content) ? data.content : [];
      const text = blocks
        .map((b) => obj(b))
        .filter((b) => b.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text as string)
        .join('');
      const usage = obj(data.usage);
      const cached = num(usage.cache_read_input_tokens);
      return {
        provider: 'anthropic',
        model: req.model,
        text,
        // Anthropic reports uncached input separately from cache reads, so add them back together.
        inputTokens: num(usage.input_tokens) + cached,
        cachedInputTokens: cached,
        outputTokens: num(usage.output_tokens),
      };
    },
  };
}

export interface GoogleAdapterOptions {
  apiKey: string;
  fetch?: FetchLike;
  baseUrl?: string;
}

/** Gemini API: POST /v1beta/models/{model}:generateContent. */
export function googleAdapter(opts: GoogleAdapterOptions): ProviderAdapter {
  const fetchFn: FetchLike = opts.fetch ?? (globalThis.fetch as unknown as FetchLike);
  const base = opts.baseUrl ?? 'https://generativelanguage.googleapis.com';
  return {
    provider: 'google',
    async complete(req) {
      const body: Record<string, unknown> = {
        contents: req.messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: req.maxOutputTokens },
      };
      if (req.system) body.systemInstruction = { parts: [{ text: req.system }] };
      const url = `${base}/v1beta/models/${encodeURIComponent(req.model)}:generateContent`;
      const res = await fetchFn(url, {
        method: 'POST',
        // Key goes in a header, not the URL, so it cannot end up in logged URLs.
        headers: { 'content-type': 'application/json', 'x-goog-api-key': opts.apiKey },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new ProviderError('google', res.status, await res.text());
      const data = obj(await res.json());
      const candidates = Array.isArray(data.candidates) ? data.candidates : [];
      const parts = Array.isArray(obj(obj(candidates[0]).content).parts) ? (obj(obj(candidates[0]).content).parts as unknown[]) : [];
      const text = parts
        .map((p) => obj(p))
        .filter((p) => typeof p.text === 'string')
        .map((p) => p.text as string)
        .join('');
      const usage = obj(data.usageMetadata);
      const cached = num(usage.cachedContentTokenCount);
      return {
        provider: 'google',
        model: req.model,
        text,
        // Gemini counts cached tokens inside promptTokenCount, so no adjustment is needed.
        inputTokens: num(usage.promptTokenCount),
        cachedInputTokens: cached,
        // Thinking tokens are billed as output, so count them with candidate tokens.
        outputTokens: num(usage.candidatesTokenCount) + num(usage.thoughtsTokenCount),
      };
    },
  };
}
