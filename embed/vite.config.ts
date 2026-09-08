import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  define: { __SICSIC_VERSION__: JSON.stringify(version) },
  build: {
    manifest: true,
    rolldownOptions: {
      input: { frame: 'index.html', core: 'src/core.ts' },
      preserveEntrySignatures: 'exports-only',
    },
  },
});
