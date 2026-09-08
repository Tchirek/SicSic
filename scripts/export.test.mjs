import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

test('pinned export preserves deployment configuration and records exact source', t => {
  const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim();
  const destination = mkdtempSync(join(tmpdir(), 'sicsic-export-'));
  t.after(() => {
    assert.equal(dirname(resolve(destination)), resolve(tmpdir()));
    assert.ok(destination.includes('sicsic-export-'));
    rmSync(destination, { recursive: true });
  });
  writeFileSync(join(destination, 'wrangler.toml'), 'deployment sentinel');
  execFileSync(process.execPath, [join(repository, 'scripts/export.mjs'), destination, revision]);
  assert.equal(readFileSync(join(destination, 'wrangler.toml'), 'utf8'), 'deployment sentinel');
  assert.equal(readFileSync(join(destination, 'SICSIC_REVISION'), 'utf8').trim(), revision);
  assert.deepEqual(readFileSync(join(destination, 'src/core.ts')),
    execFileSync('git', ['show', revision + ':embed/src/core.ts'], { cwd: repository }));
});
