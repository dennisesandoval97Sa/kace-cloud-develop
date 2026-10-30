import { config } from 'dotenv';

config({ path: '../../.env' });

export const testEnvironment = 'node';
export const moduleFileExtensions = ['js', 'json', 'node'];
export const transform = {};
export const coverageDirectory = 'coverage';
export const coverageReporters = ['lcov', 'text'];
export const coveragePathIgnorePatterns = ['/node_modules/', '/tests/'];
export const coverageThreshold = {
    global: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
    },
};
export const testPathIgnorePatterns = ['/node_modules/', '/dist/', '/test/src/', '/test/cases/'];
export const testTimeout = 120000;
