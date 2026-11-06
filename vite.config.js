import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    sourcemap: true
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.js', 'tests/real/**/*.test.js'],
    passWithNoTests: false
  }
});
