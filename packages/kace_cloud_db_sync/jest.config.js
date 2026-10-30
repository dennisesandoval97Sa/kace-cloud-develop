import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

export default {
    testEnvironment: 'node',
    moduleFileExtensions: ['js', 'json', 'node'],
    transform: {},
    coverageDirectory: 'coverage',
    coverageReporters: ['lcov', 'text'],
    coveragePathIgnorePatterns: ['/node_modules/', '/tests/'],
    coverageThreshold: {
        global: {
            functions: 90,
            lines: 90,
            statements: 90,
        },
    },
    testPathIgnorePatterns: ['/node_modules/'],
    testTimeout: 60000,
};
