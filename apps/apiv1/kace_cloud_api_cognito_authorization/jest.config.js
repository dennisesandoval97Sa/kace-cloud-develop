const dotenv = require('dotenv');

dotenv.config({ path: '../../../.env' });

module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/test'],
    testMatch: ['**/*.test.mjs', '**/*.steps.mjs'],
    transform: {},
    testTimeout: 30000,
};
