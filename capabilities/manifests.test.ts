import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateManifest, CapabilityRegistry } from '../packages/capability-sdk/src/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const dirs = readdirSync(here).filter((d) => statSync(join(here, d)).isDirectory());

test('every capability folder has a valid manifest whose id matches the folder', () => {
  assert.ok(dirs.length >= 5, 'expected the five Phase 1 capabilities');
  for (const dir of dirs) {
    const manifest: unknown = JSON.parse(readFileSync(join(here, dir, 'manifest.json'), 'utf8'));
    const result = validateManifest(manifest);
    assert.ok(result.ok, `${dir}: ${result.ok ? '' : result.errors.join('; ')}`);
    assert.equal(result.manifest.id, dir);
  }
});

test('the Phase 1 scope approved on 18 Nov 2026 is registered and plannable together', () => {
  const registry = new CapabilityRegistry(1);
  for (const dir of dirs) {
    registry.register(JSON.parse(readFileSync(join(here, dir, 'manifest.json'), 'utf8')));
    registry.setEnabled('beta', dir, true);
  }
  const ids = registry.available('beta').map((m) => m.id);
  for (const id of ['document.create', 'sheet.create', 'research.web', 'file.ask', 'webapp.build']) {
    assert.ok(ids.includes(id), `${id} missing from Phase 1`);
  }
  const app = registry.match('beta', { text: 'build an interactive quiz app' });
  assert.equal(app[0]?.id, 'webapp.build');
});
