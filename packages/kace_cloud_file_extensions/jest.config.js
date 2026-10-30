import { config } from 'dotenv';

config({ path: '../../.env' });

export const testEnvironment = 'node';
export const moduleFileExtensions = ['js', 'json', 'node'];
export const transform = {};
export const coverageDirectory = 'coverage';
export const coverageReporters = ['lcov', 'text'];
export const coveragePathIgnorePatterns = ['/node_modules/', '/tests/'];
export const testTimeout = 120000;
