import type { ModelEntry } from './models.ts';

/**
 * Starting entries for the Model Capability Registry, from provider pages checked 18 Nov 2026
 * (blueprint section 4). Every model starts with no EthioEval results, so nothing routes
 * customer work until Phase 0 scores are recorded. Operations lists are conservative and
 * must be confirmed against each provider's model page in Phase 0.
 *
 * Data terms checked 18 Nov 2026 from provider help and privacy pages (search snippets; the
 * pages themselves were not fetched). Anthropic: API inputs and outputs deleted within 30 days;
 * zero data retention is available on request, not by default. Google paid Gemini API: logs
 * kept up to 55 days for abuse monitoring, and the paid terms say prompts are not used to
 * improve products, but Google's logs page says logs may be used for training when logs
 * sharing is on, so training use is marked 'unknown' until resolved.
 *
 * STILL UNVERIFIED: storageCountries for Anthropic and Google ('US') are working assumptions.
 * Phase 0 replaces them with values from each provider's data processing addendum.
 */
const CHECKED = '2026-11-18';
const ANTHROPIC_PRICING = 'https://platform.claude.com/docs/en/about-claude/pricing';
const ANTHROPIC_TERMS = 'https://privacy.claude.com/en/articles/7996868-how-long-do-you-store-my-organization-s-data';
const GEMINI_PRICING = 'https://ai.google.dev/gemini-api/docs/pricing';
const GEMINI_TERMS = 'https://ai.google.dev/gemini-api/terms';

// Zero data retention is by arrangement with Anthropic sales, not a default. Claude Fable 5 and
// Mythos 5 ("Covered Models") need 30-day retention even under ZDR; they are not seeded here.
const anthropicTerms = {
  trainsOnApiData: false,
  retentionDays: 30,
  zeroRetentionAvailable: true,
  storageCountries: ['US'],
  termsUrl: ANTHROPIC_TERMS,
  checkedAt: CHECKED,
} as const;

export const SEED_MODELS: ModelEntry[] = [
  {
    id: 'anthropic/claude-haiku-5-5',
    provider: 'anthropic',
    model: 'claude-haiku-5-5',
    tier: 'paid',
    status: 'approved',
    operations: ['text.generate', 'text.stream', 'tool_calling', 'json_output', 'image_input', 'pdf_input', 'prompt_caching', 'batch', 'web_search'],
    contextTokens: 1_000_000,
    maxOutputTokens: 64_000,
    prices: [
      // Prompts up to 100K tokens; above that the price is 0.50 / 2.50. The gateway must pick the window by prompt size.
      { inputPerMillion: 0.1, cachedInputPerMillion: 0.01, outputPerMillion: 0.5, validFrom: '2026-10-07', sourceUrl: ANTHROPIC_PRICING },
    ],
    dataTerms: { ...anthropicTerms, storageCountries: [...anthropicTerms.storageCountries] },
    evals: {},
  },
  {
    id: 'anthropic/claude-sonnet-5-5',
    provider: 'anthropic',
    model: 'claude-sonnet-5-5',
    tier: 'paid',
    status: 'approved',
    operations: ['text.generate', 'text.stream', 'tool_calling', 'json_output', 'image_input', 'pdf_input', 'prompt_caching', 'batch', 'web_search'],
    contextTokens: 1_000_000,
    maxOutputTokens: 64_000,
    prices: [{ inputPerMillion: 2, cachedInputPerMillion: 0.1, outputPerMillion: 10, validFrom: '2026-09-28', sourceUrl: ANTHROPIC_PRICING }],
    dataTerms: { ...anthropicTerms, storageCountries: [...anthropicTerms.storageCountries] },
    evals: {},
  },
  {
    id: 'google/gemini-3.8-flash',
    provider: 'google',
    model: 'gemini-3.8-flash',
    tier: 'paid',
    status: 'approved',
    operations: ['text.generate', 'text.stream', 'tool_calling', 'json_output', 'image_input', 'pdf_input', 'audio_input', 'prompt_caching', 'batch', 'web_search'],
    contextTokens: 1_048_576,
    maxOutputTokens: 65_536,
    prices: [
      { inputPerMillion: 0.75, cachedInputPerMillion: 0.075, outputPerMillion: 3.75, validFrom: '2026-09-02', validTo: '2027-01-01', sourceUrl: GEMINI_PRICING },
      { inputPerMillion: 1.5, cachedInputPerMillion: 0.15, outputPerMillion: 7.5, validFrom: '2027-01-01', sourceUrl: GEMINI_PRICING },
    ],
    dataTerms: {
      trainsOnApiData: 'unknown',
      retentionDays: 55,
      zeroRetentionAvailable: 'unknown',
      storageCountries: ['US'],
      termsUrl: GEMINI_TERMS,
      checkedAt: CHECKED,
    },
    evals: {},
  },
  {
    id: 'google/gemini-3.8-flash-free',
    provider: 'google',
    model: 'gemini-3.8-flash',
    tier: 'free',
    status: 'public_only',
    operations: ['text.generate', 'text.stream', 'json_output'],
    contextTokens: 1_048_576,
    maxOutputTokens: 65_536,
    prices: [{ inputPerMillion: 0, cachedInputPerMillion: 0, outputPerMillion: 0, validFrom: '2026-09-02', sourceUrl: GEMINI_PRICING }],
    dataTerms: {
      trainsOnApiData: true,
      retentionDays: 'unknown',
      zeroRetentionAvailable: false,
      storageCountries: ['US'],
      termsUrl: GEMINI_TERMS,
      checkedAt: CHECKED,
    },
    evals: {},
  },
  {
    id: 'deepseek/deepseek-flash',
    provider: 'deepseek',
    model: 'deepseek-flash',
    tier: 'paid',
    status: 'public_only',
    operations: ['text.generate', 'text.stream', 'tool_calling', 'json_output', 'image_input'],
    contextTokens: 1_000_000,
    maxOutputTokens: 384_000,
    // Peak price; off-peak is half. Phase 0 adds time-of-day windows if DeepSeek is used for public data.
    prices: [{ inputPerMillion: 0.3, cachedInputPerMillion: 0.006, outputPerMillion: 1.2, validFrom: '2026-11-18', sourceUrl: 'https://api-docs.deepseek.com/quick%5Fstart/pricing/' }],
    dataTerms: {
      trainsOnApiData: 'unknown',
      retentionDays: 'unknown',
      zeroRetentionAvailable: 'unknown',
      storageCountries: ['CN'],
      termsUrl: 'https://chat.deepseek.com/downloads/DeepSeek%20Privacy%20Policy.html',
      checkedAt: CHECKED,
    },
    evals: {},
  },
];
