const dotenv = require('dotenv');

dotenv.config({ path: '../../../.env' });

module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/test'],
    testMatch: ['**/*.test.mjs'],
    globalSetup: '<rootDir>/test/globalSetup.cjs',
    transform: {},
    testTimeout: 30000,
};
