import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',
        'src/api/index.ts',
        'src/core/index.ts',
        'src/api/contracts/interfaces.ts',
        'src/api/contracts/types.ts',
      ],
    },
  },
});
