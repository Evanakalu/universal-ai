import {
  OPERATIONS,
  TASK_TYPES,
  LANGUAGES,
  isOneOf,
  type DataClass,
  type Language,
  type Operation,
  type TaskType,
} from '../../core-types/src/index.ts';

/** A dated price. Announced future changes are separate entries with their own validFrom. */
export interface PriceWindow {
  inputPerMillion: number;
  cachedInputPerMillion: number;
  outputPerMillion: number;
  validFrom: string; // ISO date, inclusive
  validTo?: string; // ISO date, exclusive
  sourceUrl: string;
}

export interface DataTerms {
  /** false only when the provider's paid API terms exclude training on our content. */
  trainsOnApiData: boolean | 'unknown';
  retentionDays: number | 'unknown';
  zeroRetentionAvailable: boolean | 'unknown';
  /** ISO country codes where the provider says content is stored. */
  storageCountries: string[];
  termsUrl: string;
  checkedAt: string; // ISO date
}

export type ModelStatus = 'candidate' | 'approved' | 'public_only' | 'blocked';

export interface EvalResult {
  score: number;
  pass: boolean;
  evalRunId: string;
}

export interface ModelEntry {
  id: string; // our id, e.g. "anthropic/claude-sonnet-5-5"
  provider: string;
  model: string; // provider's model id
  tier: 'paid' | 'free';
  status: ModelStatus;
  operations: Operation[];
  contextTokens: number;
  maxOutputTokens: number;
  prices: PriceWindow[];
  dataTerms: DataTerms;
  /** Keyed "language:taskType", e.g. "am:document_generation". Written by EthioEval runs only. */
  evals: Partial<Record<`${Language}:${TaskType}`, EvalResult>>;
}

export function evalKey(language: Language, task: TaskType): `${Language}:${TaskType}` {
  return `${language}:${task}`;
}

export function validateModelEntry(e: ModelEntry): string[] {
  const errors: string[] = [];
  if (!/^[a-z0-9-]+\/[a-z0-9.\-]+$/.test(e.id)) errors.push(`${e.id}: id must look like "provider/model"`);
  for (const op of e.operations) if (!isOneOf(OPERATIONS, op)) errors.push(`${e.id}: unknown operation ${op}`);
  if (e.prices.length === 0) errors.push(`${e.id}: at least one price window is required`);
  for (const p of e.prices) {
    if (!p.sourceUrl.startsWith('https://')) errors.push(`${e.id}: every price needs a source URL`);
    if ([p.inputPerMillion, p.cachedInputPerMillion, p.outputPerMillion].some((n) => !(n >= 0))) {
      errors.push(`${e.id}: prices must be non-negative numbers`);
    }
  }
  for (const key of Object.keys(e.evals)) {
    const [lang, task] = key.split(':');
    if (!isOneOf(LANGUAGES, lang) || !isOneOf(TASK_TYPES, task)) errors.push(`${e.id}: bad eval key ${key}`);
  }
  return errors;
}

/** Days since the data terms were last checked; the blueprint requires 90 or fewer. */
export function termsAgeDays(e: ModelEntry, now: Date): number {
  return Math.floor((now.getTime() - new Date(e.dataTerms.checkedAt).getTime()) / 86_400_000);
}

export function activePrice(e: ModelEntry, at: Date): PriceWindow | undefined {
  const t = at.getTime();
  return e.prices.find(
    (p) => new Date(p.validFrom).getTime() <= t && (p.validTo === undefined || t < new Date(p.validTo).getTime()),
  );
}

export type { DataClass };
