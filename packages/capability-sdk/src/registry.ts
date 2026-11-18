import {
  compareVersions,
  isExternalTool,
  validateManifest,
  type CapabilityManifest,
  type Category,
} from './manifest.ts';

export interface StandingRule {
  action: string;
  target: string;
  expiresAt?: Date;
}

export type PermissionDecision = 'run' | 'ask' | 'deny';

interface Enablement {
  enabled: boolean;
  pinnedVersion?: string;
}

export interface MatchQuery {
  category?: Category;
  outputKind?: string;
  /** Free-text outcome from the classifier, matched against manifest outcomes. */
  text?: string;
}

/**
 * The Universal Capability Registry (blueprint section 5).
 * Capabilities start disabled for every plan; an admin enables them after review.
 */
export class CapabilityRegistry {
  readonly #versions = new Map<string, Map<string, CapabilityManifest>>();
  readonly #enablement = new Map<string, Enablement>();
  readonly #currentPhase: number;

  constructor(currentPhase: 1 | 2 | 3 | 4) {
    this.#currentPhase = currentPhase;
  }

  register(input: unknown): CapabilityManifest {
    const result = validateManifest(input);
    if (!result.ok) throw new Error(`Invalid capability manifest:\n- ${result.errors.join('\n- ')}`);
    const m = result.manifest;
    const versions = this.#versions.get(m.id) ?? new Map<string, CapabilityManifest>();
    if (versions.has(m.version)) throw new Error(`${m.id}@${m.version} is already registered; publish a new version`);
    versions.set(m.version, deepFreeze(structuredClone(m)));
    this.#versions.set(m.id, versions);
    return m;
  }

  versionsOf(id: string): string[] {
    return [...(this.#versions.get(id)?.keys() ?? [])].sort(compareVersions);
  }

  get(id: string, version?: string): CapabilityManifest | undefined {
    const versions = this.#versions.get(id);
    if (!versions) return undefined;
    if (version) return versions.get(version);
    const latest = this.versionsOf(id).at(-1);
    return latest ? versions.get(latest) : undefined;
  }

  setEnabled(plan: string, id: string, enabled: boolean): void {
    if (!this.#versions.has(id)) throw new Error(`Unknown capability ${id}`);
    const key = `${plan}:${id}`;
    const current = this.#enablement.get(key);
    this.#enablement.set(key, { ...current, enabled });
  }

  /** Pins a plan to a version, for example to roll back a faulty release. */
  pin(plan: string, id: string, version: string): void {
    if (!this.get(id, version)) throw new Error(`Unknown version ${id}@${version}`);
    const key = `${plan}:${id}`;
    const current = this.#enablement.get(key) ?? { enabled: false };
    this.#enablement.set(key, { ...current, pinnedVersion: version });
  }

  /** The manifest a plan should run for this capability, or undefined if unavailable. */
  resolve(plan: string, id: string): CapabilityManifest | undefined {
    const e = this.#enablement.get(`${plan}:${id}`);
    if (!e?.enabled) return undefined;
    const m = this.get(id, e.pinnedVersion);
    if (!m || m.phase > this.#currentPhase) return undefined;
    return m;
  }

  available(plan: string): CapabilityManifest[] {
    const out: CapabilityManifest[] = [];
    for (const id of this.#versions.keys()) {
      const m = this.resolve(plan, id);
      if (m) out.push(m);
    }
    return out.sort((a, b) => a.id.localeCompare(b.id));
  }

  /** Ranks available capabilities for a request. Ties are left for the planner to ask about. */
  match(plan: string, query: MatchQuery): CapabilityManifest[] {
    const words = (query.text ?? '').toLowerCase().split(/\W+/).filter((w) => w.length > 2);
    const scored = this.available(plan)
      .filter((m) => !query.category || m.category === query.category)
      .filter((m) => !query.outputKind || m.outputs.some((o) => o.kind === query.outputKind))
      .map((m) => {
        const haystack = `${m.outcome} ${m.outputs.map((o) => o.kind).join(' ')}`.toLowerCase();
        const score = words.filter((w) => haystack.includes(w)).length;
        return { m, score };
      })
      .filter(({ score }) => words.length === 0 || score > 0);
    return scored.sort((a, b) => b.score - a.score || a.m.id.localeCompare(b.m.id)).map(({ m }) => m);
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Decides whether an action may run now (blueprint section 6, permissions). */
export function decidePermission(
  manifest: CapabilityManifest,
  action: string,
  target: string,
  standingRules: StandingRule[],
  now: Date = new Date(),
): PermissionDecision {
  const mode = manifest.permissions[action];
  if (mode === undefined || mode === 'never') return 'deny';
  if (mode === 'automatic') return isExternalTool(action) ? 'ask' : 'run';
  if (mode === 'ask') return 'ask';
  const rule = standingRules.find(
    (r) => r.action === action && r.target === target && (!r.expiresAt || r.expiresAt > now),
  );
  return rule ? 'run' : 'ask';
}
