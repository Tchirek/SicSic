import assert from 'node:assert/strict';
import test from 'node:test';

test('comment presets use separate anonymous viewer keys', async () => {
  globalThis.window = { location: { search: '?preset=normalpics' } };
  const { readConfig } = await import('../src/config.ts?viewer-storage');
  const normalpics = readConfig();

  window.location.search = '?preset=normaldocs';
  const normaldocs = readConfig();
  window.location.search = '?preset=iamtchirek';
  const blog = readConfig();

  assert.equal(normalpics.viewerStorageKey, 'normalpics_comment_viewer');
  assert.equal(normaldocs.viewerStorageKey, 'normaldocs_comment_ui_viewer');
  assert.equal(blog.viewerStorageKey, 'iamtchirek_comment_ui_viewer');
  assert.equal(new Set([
    normalpics.viewerStorageKey,
    normaldocs.viewerStorageKey,
    blog.viewerStorageKey,
  ]).size, 3);
});
