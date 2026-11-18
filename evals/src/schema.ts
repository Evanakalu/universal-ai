import { LAUNCH_LANGUAGES, TASK_TYPES, isOneOf, type TaskType } from '../../packages/core-types/src/index.ts';

export const EVAL_LOCALES = ['am-ET', 'ti-ET', 'ti-ER', 'om-ET'] as const;
export const SCORING_METHODS = ['rubric', 'exact', 'constraints', 'tests', 'citations', 'retrieval'] as const;

export type Constraint =
  | { type: 'max_words'; value: number }
  | { type: 'min_words'; value: number }
  | { type: 'must_include'; value: string }
  | { type: 'must_not_include'; value: string }
  | { type: 'script'; value: 'ethiopic' | 'latin' };

export interface EvalItem {
  id: string; // e.g. "am-document_generation-001"
  language: (typeof LAUNCH_LANGUAGES)[number];
  locale: (typeof EVAL_LOCALES)[number];
  taskType: TaskType;
  prompt: string;
  files?: string[];
  constraints?: Constraint[];
  reference?: string;
  scoring: (typeof SCORING_METHODS)[number];
  /** Items are written by native speakers. AI-written or machine-translated items are rejected. */
  author: { name: string; kind: 'human' };
  source: 'native_written' | 'public_dataset';
  sourceRef?: string;
  status: 'draft' | 'reviewed' | 'retired';
  reviewers: string[];
}

export function validateItem(input: unknown): string[] {
  const errors: string[] = [];
  if (typeof input !== 'object' || input === null) return ['item must be an object'];
  const i = input as Record<string, unknown>;
  const id = String(i.id ?? '');
  if (!isOneOf(LAUNCH_LANGUAGES, i.language)) errors.push(`${id}: language must be am, ti or om`);
  if (!isOneOf(EVAL_LOCALES, i.locale)) errors.push(`${id}: locale must be one of ${EVAL_LOCALES.join(', ')}`);
  if (typeof i.locale === 'string' && typeof i.language === 'string' && !i.locale.startsWith(`${i.language}-`)) {
    errors.push(`${id}: locale does not match language`);
  }
  if (!isOneOf(TASK_TYPES, i.taskType)) errors.push(`${id}: unknown task type`);
  if (!new RegExp(`^${String(i.language)}-${String(i.taskType)}-\\d{3}$`).test(id)) {
    errors.push(`${id}: id must be "<language>-<taskType>-<3 digits>"`);
  }
  if (typeof i.prompt !== 'string' || i.prompt.trim().length === 0) errors.push(`${id}: prompt is required`);
  if (!isOneOf(SCORING_METHODS, i.scoring)) errors.push(`${id}: unknown scoring method`);
  if (i.scoring === 'exact' && typeof i.reference !== 'string') errors.push(`${id}: exact scoring needs a reference answer`);
  if (i.scoring === 'constraints' && (!Array.isArray(i.constraints) || i.constraints.length === 0)) {
    errors.push(`${id}: constraint scoring needs constraints`);
  }
  const author = i.author as Record<string, unknown> | undefined;
  if (!author || author.kind !== 'human' || typeof author.name !== 'string' || author.name.length === 0) {
    errors.push(`${id}: author must be a named human (native speaker)`);
  }
  if (i.source !== 'native_written' && i.source !== 'public_dataset') {
    errors.push(`${id}: source must be native_written or public_dataset (machine translation is not allowed)`);
  }
  if (i.source === 'public_dataset' && typeof i.sourceRef !== 'string') errors.push(`${id}: public dataset items need sourceRef`);
  if (!Array.isArray(i.reviewers)) errors.push(`${id}: reviewers must be a list`);
  if (i.status === 'reviewed') {
    const reviewers = Array.isArray(i.reviewers) ? i.reviewers : [];
    if (reviewers.length === 0) errors.push(`${id}: a reviewed item needs at least one reviewer`);
    if (author && reviewers.includes(author.name)) errors.push(`${id}: the author cannot review their own item`);
  } else if (i.status !== 'draft' && i.status !== 'retired') {
    errors.push(`${id}: status must be draft, reviewed or retired`);
  }
  return errors;
}
