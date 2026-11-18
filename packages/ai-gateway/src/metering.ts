import type { CostCategory, DataClass } from '../../core-types/src/index.ts';
import type { PriceWindow } from './models.ts';

export interface TokenEstimate {
  inputTokens: number;
  cachedInputTokens?: number; // part of inputTokens served from cache
  outputTokens: number;
}

export function estimateCostUsd(price: PriceWindow, t: TokenEstimate): number {
  const cached = Math.min(t.cachedInputTokens ?? 0, t.inputTokens);
  const uncached = t.inputTokens - cached;
  return (
    (uncached * price.inputPerMillion + cached * price.cachedInputPerMillion + t.outputTokens * price.outputPerMillion) /
    1_000_000
  );
}

/** One row of `usage_events` (blueprint section 11). Append-only. */
export interface UsageEvent {
  orgId: string;
  userId: string;
  taskStepId: string;
  provider: string;
  modelId: string;
  category: CostCategory;
  dataClass: DataClass;
  consentRecordId?: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  toolUnits: number;
  toolCostUsd: number;
  costUsd: number;
  createdAt: string;
}

export function usageEvent(
  base: Omit<UsageEvent, 'costUsd' | 'createdAt' | 'cachedInputTokens' | 'toolUnits' | 'toolCostUsd'> &
    Partial<Pick<UsageEvent, 'cachedInputTokens' | 'toolUnits' | 'toolCostUsd'>>,
  price: PriceWindow,
  now: Date = new Date(),
): UsageEvent {
  const cachedInputTokens = base.cachedInputTokens ?? 0;
  const toolUnits = base.toolUnits ?? 0;
  const toolCostUsd = base.toolCostUsd ?? 0;
  if (base.dataClass !== 'public' && !base.consentRecordId) {
    throw new Error('Customer and sensitive content must reference a consent record');
  }
  const tokenCost = estimateCostUsd(price, {
    inputTokens: base.inputTokens,
    cachedInputTokens,
    outputTokens: base.outputTokens,
  });
  return {
    ...base,
    cachedInputTokens,
    toolUnits,
    toolCostUsd,
    costUsd: Math.round((tokenCost + toolCostUsd) * 1e6) / 1e6,
    createdAt: now.toISOString(),
  };
}

export interface Limits {
  taskUsd: number;
  userMonthUsd: number;
  orgMonthUsd: number;
}

export interface Spent {
  taskUsd: number;
  userMonthUsd: number;
  orgMonthUsd: number;
}

export type BudgetDecision =
  | { decision: 'ok'; warnings: string[] }
  | { decision: 'needs_approval'; reason: string }
  | { decision: 'blocked'; reason: string };

/**
 * Budget guard, checked before every step (blueprint section 13).
 * Task overruns pause for the user's approval; user and organisation limits are hard stops.
 */
export function checkBudget(spent: Spent, nextStepUsd: number, limits: Limits): BudgetDecision {
  const after = {
    taskUsd: spent.taskUsd + nextStepUsd,
    userMonthUsd: spent.userMonthUsd + nextStepUsd,
    orgMonthUsd: spent.orgMonthUsd + nextStepUsd,
  };
  if (after.orgMonthUsd > limits.orgMonthUsd) return { decision: 'blocked', reason: 'organisation monthly limit reached' };
  if (after.userMonthUsd > limits.userMonthUsd) return { decision: 'blocked', reason: 'your monthly limit is reached' };
  if (after.taskUsd > limits.taskUsd) return { decision: 'needs_approval', reason: 'this task would exceed its budget' };
  const warnings: string[] = [];
  if (after.userMonthUsd > 0.8 * limits.userMonthUsd) warnings.push('over 80% of the monthly limit used');
  if (after.orgMonthUsd > 0.9 * limits.orgMonthUsd) warnings.push('organisation above 90%: fast models only');
  return { decision: 'ok', warnings };
}
