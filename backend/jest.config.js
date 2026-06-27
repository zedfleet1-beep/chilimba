/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEach: [],
  testTimeout: 20000,
  collectCoverageFrom: [
    'src/modules/**/*.service.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  clearMocks: true,
  verbose: true,
};
