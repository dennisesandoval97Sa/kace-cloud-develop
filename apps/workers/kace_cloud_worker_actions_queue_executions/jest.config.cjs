const dotenv = require('dotenv');

dotenv.config({ path: '../../../.env' });

// Exclude integration tests from default `pnpm test` runs.
// The dedicated `pnpm run test:integration` script passes
// `--testPathPattern=tests/integration`, in which case we must NOT ignore the
// integration directory (Jest's `testPathIgnorePatterns` is applied before
// `--testPathPattern`, so leaving it set would filter the integration files
// out and yield "No tests found").
const isIntegrationRun = process.argv.some((arg) => arg.includes('tests/integration'));

module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    testMatch: ['**/*.test.mjs'],
    testPathIgnorePatterns: isIntegrationRun ? [] : ['<rootDir>/tests/integration/'],
    transform: {},
    testTimeout: 1000000,
    collectCoverage: true,
    collectCoverageFrom: ['src/**/*.mjs'],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    coverageThreshold: {
        global: {
            branches: 90,
            functions: 90,
            lines: 90,
            statements: 90,
        },
    },
    coveragePathIgnorePatterns: ['/node_modules/', '/tests/', '/cdk.out/', '/dist/', '/bin/', '/lib/'],
};
