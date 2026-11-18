import {
  LAUNCH_LANGUAGES,
  OPERATIONS,
  TASK_TYPES,
  isOneOf,
  type Language,
  type Operation,
  type TaskType,
} from '../../core-types/src/index.ts';

export const CATEGORIES = [
  'documents',
  'research',
  'data',
  'software',
  'business',
  'presentations',
  'images',
  'design',
  'audio',
  'video',
  'automation',
] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * automatic      run without asking
 * ask            ask the user every time
 * standing_rule  run if the user has approved this action for this target in advance, otherwise ask
 * never          the capability may not do this
 */
export const PERMISSION_MODES = ['automatic', 'ask', 'standing_rule', 'never'] as const;
export type PermissionMode = (typeof PERMISSION_MODES)[number];

/**
 * Tools whose effects leave the user's workspace. They may never be `automatic`
 * (blueprint section 6: nothing leaves the workspace without approval).
 */
export const EXTERNAL_TOOL_PREFIXES = ['site.publish', 'app.publish', 'connector.', 'email.', 'payment.'] as const;

export interface IoSpec {
  name: string;
  kind: string;
  required?: boolean;
}

export interface CapabilityManifest {
  id: string;
  version: string;
  category: Category;
  /** i18n key for the user-facing name, translated by reviewers, never hard-coded. */
  titleKey: string;
  /** Plain description of the result, used by the capability matcher. */
  outcome: string;
  inputs: IoSpec[];
  outputs: IoSpec[];
  needs: {
    modelOperations: Operation[];
    tools: string[];
    evalTask: TaskType;
    languages: Language[];
  };
  permissions: Record<string, PermissionMode>;
  cost: { typicalUsd: number; hardCapUsd: number };
  phase: 1 | 2 | 3 | 4;
}

export type ValidationResult =
  | { ok: true; manifest: CapabilityManifest }
  | { ok: false; errors: string[] };

const ID_PATTERN = /^[a-z]+(\.[a-z][a-z0-9-]*)+$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const TOOL_PATTERN = /^[a-z]+(\.[a-z][a-z0-9_]*)+$/;
const MAX_HARD_CAP_USD = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkIo(list: unknown, label: string, errors: string[], mustHaveOne: boolean): void {
  if (!Array.isArray(list)) {
    errors.push(`${label} must be a list`);
    return;
  }
  if (mustHaveOne && list.length === 0) errors.push(`${label} must have at least one entry`);
  list.forEach((item, i) => {
    if (!isRecord(item) || typeof item.name !== 'string' || typeof item.kind !== 'string') {
      errors.push(`${label}[${i}] needs a name and a kind`);
    }
  });
}

export function isExternalTool(tool: string): boolean {
  return EXTERNAL_TOOL_PREFIXES.some((prefix) => tool === prefix || tool.startsWith(prefix));
}

/** Validates an untrusted manifest. Returns every problem, not just the first. */
export function validateManifest(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(input)) return { ok: false, errors: ['manifest must be an object'] };
  const m = input;

  if (typeof m.id !== 'string' || !ID_PATTERN.test(m.id)) errors.push('id must look like "document.create"');
  if (typeof m.version !== 'string' || !SEMVER_PATTERN.test(m.version)) errors.push('version must be semver, e.g. 1.0.0');
  if (!isOneOf(CATEGORIES, m.category)) errors.push(`category must be one of: ${CATEGORIES.join(', ')}`);
  if (typeof m.titleKey !== 'string' || m.titleKey.length === 0) errors.push('titleKey is required');
  if (typeof m.outcome !== 'string' || m.outcome.trim().length < 10) errors.push('outcome must describe the result');
  checkIo(m.inputs, 'inputs', errors, false);
  checkIo(m.outputs, 'outputs', errors, true);

  const tools: string[] = [];
  if (!isRecord(m.needs)) {
    errors.push('needs is required');
  } else {
    const n = m.needs;
    if (!Array.isArray(n.modelOperations) || n.modelOperations.length === 0) {
      errors.push('needs.modelOperations must list at least one operation');
    } else {
      for (const op of n.modelOperations) if (!isOneOf(OPERATIONS, op)) errors.push(`unknown model operation: ${String(op)}`);
    }
    if (!Array.isArray(n.tools)) {
      errors.push('needs.tools must be a list');
    } else {
      for (const t of n.tools) {
        if (typeof t !== 'string' || !TOOL_PATTERN.test(t)) errors.push(`tool name invalid: ${String(t)}`);
        else tools.push(t);
      }
    }
    if (!isOneOf(TASK_TYPES, n.evalTask)) errors.push(`needs.evalTask must be one of: ${TASK_TYPES.join(', ')}`);
    if (!Array.isArray(n.languages)) {
      errors.push('needs.languages must be a list');
    } else {
      for (const lang of LAUNCH_LANGUAGES) {
        if (!n.languages.includes(lang)) errors.push(`needs.languages must include launch language "${lang}"`);
      }
    }
  }

  if (!isRecord(m.permissions)) {
    errors.push('permissions is required');
  } else {
    for (const [action, mode] of Object.entries(m.permissions)) {
      if (!isOneOf(PERMISSION_MODES, mode)) errors.push(`permission for ${action} must be one of: ${PERMISSION_MODES.join(', ')}`);
      if (!tools.includes(action)) errors.push(`permission declared for ${action}, which is not in needs.tools`);
      if (mode === 'automatic' && isExternalTool(action)) errors.push(`${action} leaves the workspace and may not be automatic`);
    }
    for (const tool of tools) {
      if (!(tool in m.permissions)) errors.push(`tool ${tool} has no permission mode`);
    }
  }

  if (!isRecord(m.cost) || typeof m.cost.typicalUsd !== 'number' || typeof m.cost.hardCapUsd !== 'number') {
    errors.push('cost.typicalUsd and cost.hardCapUsd are required numbers');
  } else {
    if (m.cost.typicalUsd <= 0) errors.push('cost.typicalUsd must be positive');
    if (m.cost.hardCapUsd < m.cost.typicalUsd) errors.push('cost.hardCapUsd must be at least cost.typicalUsd');
    if (m.cost.hardCapUsd > MAX_HARD_CAP_USD) errors.push(`cost.hardCapUsd above ${MAX_HARD_CAP_USD} needs product-owner approval`);
  }

  if (m.phase !== 1 && m.phase !== 2 && m.phase !== 3 && m.phase !== 4) errors.push('phase must be 1, 2, 3 or 4');

  return errors.length > 0 ? { ok: false, errors } : { ok: true, manifest: m as unknown as CapabilityManifest };
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
