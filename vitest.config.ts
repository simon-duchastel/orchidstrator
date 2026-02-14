export default {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html'],
    exclude: [
      'node_modules/**',
      'dist/**',
      '**/*.d.ts',
    ],
  },
  clearMocks: true,
  restoreMocks: true,
  deps: {
    inline: [/vitest/],
  },
};