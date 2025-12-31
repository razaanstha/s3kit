import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'core/index': 'src/core/index.ts',
    'http/index': 'src/http/index.ts',
    'client/index': 'src/client/index.ts',
    'adapters/express': 'src/adapters/express.ts',
    'adapters/next': 'src/adapters/next.ts',
    'adapters/fetch': 'src/adapters/fetch.ts',
    'react/index': 'src/react/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  splitting: false,
  clean: true,
  target: 'es2022',
  external: ['react', '@phosphor-icons/react'],
  esbuildOptions(options) {
    options.loader = {
      ...options.loader,
      '.css': 'local-css',
    }
  },
})
