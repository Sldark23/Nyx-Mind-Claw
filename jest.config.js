/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
      // Skip native modules that don't transform well
      isolatedModules: true,
    }],
  },
  // Do NOT transform packages that have native add-ons or CJS deps
  transformIgnorePatterns: [
    '/node_modules/(?!(uuid|axios|cheerio|commander)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  moduleNameMapper: {
    '^@nyxmind/core$': '<rootDir>/src/index.ts',
  },
  testTimeout: 10000,
};
