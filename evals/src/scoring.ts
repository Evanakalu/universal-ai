import type { TaskType } from '../../packages/core-types/src/index.ts';
import { detectScript } from '../../packages/i18n/src/index.ts';
import type { Constraint } from './schema.ts';

type Metric = 'rubric_mean' | 'accuracy' | 'tests_pass_rate';

/** Launch pass bars per task type (blueprint section 3). */
export const PASS_BARS: Record<TaskType, { metric: Metric; min: number; alsoRubricMin?: number; noCitationErrors?: boolean }> = {
  conversation: { metric: 'rubric_mean', min: 4.0 },
  reasoning: { metric: 'accuracy', min: 0.8 },
  instruction_following: { metric: 'accuracy', min: 0.9 },
  document_generation: { metric: 'rubric_mean', min: 4.2 },
  research: { metric: 'rubric_mean', min: 4.0, noCitationErrors: true },
  technical: { metric: 'tests_pass_rate', min: 0.8, alsoRubricMin: 4.0 },
  file_understanding: { metric: 'accuracy', min: 0.85 },
  retrieval: { metric: 'accuracy', min: 0.85 },
  project_consistency: { metric: 'accuracy', min: 0.98 },
};

export interface ItemResult {
  itemId: string;
  /** One 1-5 rubric score per reviewer. */
  rubric?: number[];
  correct?: boolean;
  testsPassed?: boolean;
  citationErrors?: number;
}

export interface TaskScore {
  task: TaskType;
  items: number;
  score: number;
  pass: boolean;
  reasons: string[];
}

function mean(xs: number[]): number {
  return xs.length === 0 ? Number.NaN : xs.reduce((s, x) => s + x, 0) / xs.length;
}

/** Aggregates one model's results for one language and task type. */
export function scoreTask(task: TaskType, results: ItemResult[], minItems = 30): TaskScore {
  const bar = PASS_BARS[task];
  const reasons: string[] = [];
  const rubricMeans = results.filter((r) => r.rubric && r.rubric.length > 0).map((r) => mean(r.rubric ?? []));
  let score: number;
  if (bar.metric === 'rubric_mean') score = mean(rubricMeans);
  else if (bar.metric === 'accuracy') score = mean(results.filter((r) => r.correct !== undefined).map((r) => (r.correct ? 1 : 0)));
  else score = mean(results.filter((r) => r.testsPassed !== undefined).map((r) => (r.testsPassed ? 1 : 0)));

  if (results.length < minItems) reasons.push(`only ${results.length} items scored; at least ${minItems} needed`);
  if (!(score >= bar.min)) reasons.push(`${bar.metric} ${Number.isNaN(score) ? 'missing' : score.toFixed(3)} below ${bar.min}`);
  if (bar.alsoRubricMin !== undefined && !(mean(rubricMeans) >= bar.alsoRubricMin)) {
    reasons.push(`explanation rubric below ${bar.alsoRubricMin}`);
  }
  if (bar.noCitationErrors && results.some((r) => (r.citationErrors ?? 0) > 0)) reasons.push('wrong citations found');
  return { task, items: results.length, score: Math.round(score * 1000) / 1000, pass: reasons.length === 0, reasons };
}

/** Cohen's kappa for two reviewers rating the same items (blueprint target: 0.6 or higher). */
export function cohenKappa(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) throw new RangeError('ratings must be non-empty and the same length');
  const n = a.length;
  const categories = [...new Set([...a, ...b])];
  const observed = a.filter((x, i) => x === b[i]).length / n;
  const expected = categories.reduce(
    (s, c) => s + (a.filter((x) => x === c).length / n) * (b.filter((x) => x === c).length / n),
    0,
  );
  return expected === 1 ? 1 : (observed - expected) / (1 - expected);
}

/** Automatic constraint checks, run before any human review. */
export function checkConstraints(output: string, constraints: Constraint[]): { passed: number; failed: string[] } {
  const words = output.trim().split(/[\s፡]+/).filter(Boolean).length;
  const failed: string[] = [];
  for (const c of constraints) {
    const ok =
      c.type === 'max_words' ? words <= c.value
      : c.type === 'min_words' ? words >= c.value
      : c.type === 'must_include' ? output.includes(c.value)
      : c.type === 'must_not_include' ? !output.includes(c.value)
      : detectScript(output).script === c.value;
    if (!ok) failed.push(`${c.type}: ${String(c.value)}`);
  }
  return { passed: constraints.length - failed.length, failed };
}
