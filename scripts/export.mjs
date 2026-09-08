import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, realpathSync, existsSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [destination, revision] = process.argv.slice(2);
if (!destination || !/^[0-9a-f]{40}$/.test(revision || '')) {
  throw new Error('Usage: node scripts/export.mjs TARGET_DIRECTORY FULL_COMMIT_ID');
}
const git = (...args) => execFileSync('git', ['-C', repository, ...args]);
if (git('rev-parse', revision + '^{commit}').toString().trim() !== revision) throw new Error('Expected a commit');
const target = resolve(destination);
mkdirSync(target, { recursive: true });
const root = realpathSync(target);
const allowed = new Set(['src', 'test', 'index.html', 'package.json', 'package-lock.json', 'tsconfig.json',
  'vite.config.ts', 'playwright.config.ts', 'LICENSE', 'NOTICE', 'INTEGRATION.md', 'MODIFICATIONS.md',
  'THREAT_MODEL.md', '.env.example', 'wrangler.example.toml']);
const entries = git('ls-tree', '-r', '--name-only', revision, '--', 'embed').toString().trim().split('\n');
const files = entries.filter(file => allowed.has(file.slice('embed/'.length).split('/')[0]))
  .map(file => [file.slice('embed/'.length), git('show', revision + ':' + file)]);
if (!files.some(([name]) => name === 'src/core.ts')) throw new Error('Missing component source');
for (const [name, contents] of files) {
  const file = resolve(root, name);
  if (relative(root, file).startsWith('..' + sep)) throw new Error('Invalid export path');
  let parent = dirname(file);
  while (!existsSync(parent)) parent = dirname(parent);
  const resolvedParent = relative(root, realpathSync(parent));
  if (resolvedParent === '..' || resolvedParent.startsWith('..' + sep)) throw new Error('Export symlink leaves destination');
  if (existsSync(file) && realpathSync(file) !== file) throw new Error('Refusing to overwrite an export symlink');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, contents);
}
writeFileSync(resolve(root, 'SICSIC_REVISION'), revision + '\n');
console.log('Exported ' + files.length + ' source files at ' + revision + ' to ' + root + '; deployment configuration preserved.');
