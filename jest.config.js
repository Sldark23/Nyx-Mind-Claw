/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.base.json',
      isolatedModules: true,
    }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(uuid|axios|cheerio|commander)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  moduleNameMapper: {
    '^@nyxmind/core$': '<rootDir>/packages/core/src/index.ts',
    '^@nyxmind/channels$': '<rootDir>/packages/channels/src/index.ts',
    '^@nyxmind/cli$': '<rootDir>/packages/cli/src/index.ts',
  },
  testTimeout: 10000,
};
