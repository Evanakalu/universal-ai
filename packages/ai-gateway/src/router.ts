import type { DataClass, Language, Operation, TaskType } from '../../core-types/src/index.ts';
import { activePrice, evalKey, termsAgeDays, validateModelEntry, type ModelEntry } from './models.ts';
import { estimateCostUsd, type TokenEstimate } from './metering.ts';

export interface RoutePolicy {
  /** Countries where customer content may be stored, decided after legal review. */
  allowedStorageCountries: string[];
  /** Data terms older than this are treated as unknown. */
  maxTermsAgeDays: number;
}

export interface RouteRequest {
  operations: Operation[];
  language: Language;
  task: TaskType;
  dataClass: DataClass;
  tokens: TokenEstimate;
  maxCostUsd?: number;
  at?: Date;
}

export interface RouteCandidate {
  model: ModelEntry;
  estimatedCostUsd: number;
}

export interface RouteResult {
  candidates: RouteCandidate[];
  rejected: { id: string; reason: string }[];
}

/**
 * The Model Capability Registry and router (blueprint section 4).
 * A model receives work only if it can do every operation, passed EthioEval for this
 * language and task, and its data terms allow this class of data.
 */
export class ModelRegistry {
  readonly #models = new Map<string, ModelEntry>();
  readonly #policy: RoutePolicy;

  constructor(policy: RoutePolicy) {
    this.#policy = policy;
  }

  add(entry: ModelEntry): void {
    const errors = validateModelEntry(entry);
    if (errors.length > 0) throw new Error(errors.join('\n'));
    this.#models.set(entry.id, structuredClone(entry));
  }

  get(id: string): ModelEntry | undefined {
    return this.#models.get(id);
  }

  all(): ModelEntry[] {
    return [...this.#models.values()];
  }

  /** Only EthioEval runs should call this. */
  recordEval(id: string, language: Language, task: TaskType, score: number, pass: boolean, evalRunId: string): void {
    const m = this.#models.get(id);
    if (!m) throw new Error(`Unknown model ${id}`);
    m.evals[evalKey(language, task)] = { score, pass, evalRunId };
  }

  setStatus(id: string, status: ModelEntry['status']): void {
    const m = this.#models.get(id);
    if (!m) throw new Error(`Unknown model ${id}`);
    m.status = status;
  }

  /** Why a model may not handle this data class, or undefined if it may. */
  dataClassBlock(m: ModelEntry, dataClass: DataClass, at: Date): string | undefined {
    if (dataClass === 'public') return undefined;
    if (m.tier === 'free') return 'free tiers may not receive customer content';
    if (m.status === 'public_only') return 'approved for public data only';
    if (termsAgeDays(m, at) > this.#policy.maxTermsAgeDays) return 'data terms not re-checked within the allowed period';
    if (m.dataTerms.trainsOnApiData !== false) return 'provider terms do not exclude training on API content';
    const outside = m.dataTerms.storageCountries.filter((c) => !this.#policy.allowedStorageCountries.includes(c));
    if (m.dataTerms.storageCountries.length === 0) return 'storage location unknown';
    if (outside.length > 0) return `stores data in a country not approved: ${outside.join(', ')}`;
    if (dataClass === 'sensitive' && m.dataTerms.zeroRetentionAvailable !== true) {
      return 'sensitive data needs a zero-retention option';
    }
    return undefined;
  }

  route(req: RouteRequest): RouteResult {
    const at = req.at ?? new Date();
    const candidates: RouteCandidate[] = [];
    const rejected: RouteResult['rejected'] = [];

    for (const m of this.#models.values()) {
      const reject = (reason: string) => rejected.push({ id: m.id, reason });

      if (m.status === 'blocked' || m.status === 'candidate') {
        reject(`status is ${m.status}`);
        continue;
      }
      const missing = req.operations.filter((op) => !m.operations.includes(op));
      if (missing.length > 0) {
        reject(`cannot do: ${missing.join(', ')}`);
        continue;
      }
      const block = this.dataClassBlock(m, req.dataClass, at);
      if (block) {
        reject(block);
        continue;
      }
      const evalResult = m.evals[evalKey(req.language, req.task)];
      if (!evalResult?.pass) {
        reject(evalResult ? `failed EthioEval for ${req.language} ${req.task}` : `no EthioEval result for ${req.language} ${req.task}`);
        continue;
      }
      const price = activePrice(m, at);
      if (!price) {
        reject('no price valid at this date');
        continue;
      }
      const tokensNeeded = req.tokens.inputTokens + req.tokens.outputTokens;
      if (tokensNeeded > m.contextTokens || req.tokens.outputTokens > m.maxOutputTokens) {
        reject('request too large for this model');
        continue;
      }
      const cost = estimateCostUsd(price, req.tokens);
      if (req.maxCostUsd !== undefined && cost > req.maxCostUsd) {
        reject(`estimated USD ${cost.toFixed(4)} exceeds budget`);
        continue;
      }
      candidates.push({ model: m, estimatedCostUsd: cost });
    }

    candidates.sort((a, b) => a.estimatedCostUsd - b.estimatedCostUsd || a.model.id.localeCompare(b.model.id));
    return { candidates, rejected };
  }

  /** Deploy-time check: nothing that could receive customer content may be on a free tier. */
  assertProductionSafe(at: Date = new Date()): void {
    const problems = this.all()
      .filter((m) => m.status === 'approved' && m.tier === 'free')
      .map((m) => `${m.id} is approved but on a free tier`);
    const stale = this.all()
      .filter((m) => m.status === 'approved' && termsAgeDays(m, at) > this.#policy.maxTermsAgeDays)
      .map((m) => `${m.id} data terms are older than ${this.#policy.maxTermsAgeDays} days`);
    const all = [...problems, ...stale];
    if (all.length > 0) throw new Error(`Production configuration unsafe:\n- ${all.join('\n- ')}`);
  }
}
