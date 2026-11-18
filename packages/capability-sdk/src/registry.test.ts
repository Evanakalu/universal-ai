import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CapabilityRegistry, decidePermission, validateManifest, type CapabilityManifest } from './index.ts';

function manifest(overrides: Partial<CapabilityManifest> = {}): CapabilityManifest {
  return {
    id: 'test.thing',
    version: '1.0.0',
    category: 'documents',
    titleKey: 'capability.test.title',
    outcome: 'A test document for the registry tests',
    inputs: [{ name: 'brief', kind: 'text', required: true }],
    outputs: [{ name: 'doc', kind: 'document' }],
    needs: {
      modelOperations: ['text.generate'],
      tools: ['artifact.save', 'site.publish'],
      evalTask: 'document_generation',
      languages: ['am', 'ti', 'om'],
    },
    permissions: { 'artifact.save': 'automatic', 'site.publish': 'standing_rule' },
    cost: { typicalUsd: 0.1, hardCapUsd: 1 },
    phase: 1,
    ...overrides,
  };
}

test('a valid manifest passes', () => {
  assert.ok(validateManifest(manifest()).ok);
});

test('validation reports every problem at once', () => {
  const bad = manifest({
    id: 'Bad Id',
    version: '1',
    needs: { modelOperations: ['teleport' as never], tools: ['artifact.save'], evalTask: 'document_generation', languages: ['am'] },
    permissions: { 'artifact.save': 'automatic', 'email.send': 'automatic' },
    cost: { typicalUsd: 2, hardCapUsd: 1 },
  });
  const result = validateManifest(bad);
  assert.equal(result.ok, false);
  if (result.ok) return;
  const all = result.errors.join('\n');
  for (const expected of ['id must', 'version must', 'unknown model operation', '"ti"', '"om"', 'email.send', 'hardCapUsd']) {
    assert.ok(all.includes(expected), `missing error about ${expected}:\n${all}`);
  }
});

test('actions that leave the workspace cannot be automatic', () => {
  const result = validateManifest(manifest({ permissions: { 'artifact.save': 'automatic', 'site.publish': 'automatic' } }));
  assert.equal(result.ok, false);
});

test('capabilities are disabled until an admin enables them, and phase gates apply', () => {
  const registry = new CapabilityRegistry(1);
  registry.register(manifest());
  registry.register(manifest({ id: 'test.later', phase: 2 }));
  assert.equal(registry.available('free').length, 0);
  registry.setEnabled('free', 'test.thing', true);
  registry.setEnabled('free', 'test.later', true);
  assert.deepEqual(registry.available('free').map((m) => m.id), ['test.thing']);
});

test('a plan can be pinned to an earlier version to roll back', () => {
  const registry = new CapabilityRegistry(1);
  registry.register(manifest({ version: '1.0.0' }));
  registry.register(manifest({ version: '1.10.0' }));
  registry.register(manifest({ version: '1.2.0' }));
  registry.setEnabled('pro', 'test.thing', true);
  assert.equal(registry.resolve('pro', 'test.thing')?.version, '1.10.0');
  registry.pin('pro', 'test.thing', '1.2.0');
  assert.equal(registry.resolve('pro', 'test.thing')?.version, '1.2.0');
  assert.throws(() => registry.register(manifest({ version: '1.2.0' })), /already registered/);
});

test('registered manifests cannot be changed afterwards', () => {
  const registry = new CapabilityRegistry(1);
  registry.register(manifest());
  const stored = registry.get('test.thing');
  assert.ok(stored);
  assert.throws(() => {
    (stored as { phase: number }).phase = 4;
  });
  assert.throws(() => {
    (stored.permissions as Record<string, string>)['site.publish'] = 'automatic';
  });
});

test('permission decisions follow the declared mode and standing rules', () => {
  const m = manifest();
  const now = new Date('2026-11-18T00:00:00Z');
  assert.equal(decidePermission(m, 'artifact.save', 'project-1', [], now), 'run');
  assert.equal(decidePermission(m, 'site.publish', 'site-1', [], now), 'ask');
  assert.equal(decidePermission(m, 'site.publish', 'site-1', [{ action: 'site.publish', target: 'site-1' }], now), 'run');
  assert.equal(
    decidePermission(m, 'site.publish', 'site-1', [{ action: 'site.publish', target: 'site-1', expiresAt: new Date('2026-01-01') }], now),
    'ask',
  );
  assert.equal(decidePermission(m, 'email.send', 'x', [], now), 'deny');
});
