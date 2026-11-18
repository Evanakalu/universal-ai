/**
 * Shared vocabulary for Universal AI. Every package imports these lists,
 * so a new language, operation or task type is added in one place.
 */

/** Launch languages. `en` is an internal fallback for staff, not a user language. */
export const LAUNCH_LANGUAGES = ['am', 'ti', 'om'] as const;
export const LANGUAGES = [...LAUNCH_LANGUAGES, 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

/** What a model can do. A model is only routed work whose operations it declares. */
export const OPERATIONS = [
  'text.generate',
  'text.stream',
  'tool_calling',
  'json_output',
  'image_input',
  'pdf_input',
  'audio_input',
  'speech_output',
  'image_generation',
  'video_generation',
  'embeddings',
  'web_search',
  'prompt_caching',
  'batch',
] as const;
export type Operation = (typeof OPERATIONS)[number];

/** EthioEval task types (blueprint section 3). Quality is scored per language and task type. */
export const TASK_TYPES = [
  'conversation',
  'reasoning',
  'instruction_following',
  'document_generation',
  'research',
  'technical',
  'file_understanding',
  'retrieval',
  'project_consistency',
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

/** Data classes decide which providers may see content (blueprint section 4). */
export const DATA_CLASSES = ['public', 'customer', 'sensitive'] as const;
export type DataClass = (typeof DATA_CLASSES)[number];

/** Cost categories used by metering and the cost model (blueprint section 13). */
export const COST_CATEGORIES = [
  'text_conversation',
  'research',
  'document_generation',
  'coding_and_websites',
  'sandbox_execution',
  'image_generation',
  'video_generation',
] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];

export function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value);
}
