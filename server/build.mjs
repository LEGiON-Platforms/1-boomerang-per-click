// Bundles the server (and the TypeScript sources of @game/shared) into dist/index.js.
// npm packages stay external and are loaded from node_modules at runtime.
import { build } from 'esbuild'

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: true,
  packages: 'external',
  // @game/shared is a workspace package shipped as .ts source: bundle it in.
  alias: { '@game/shared': '../shared/src/index.ts' },
  logLevel: 'info',
})
