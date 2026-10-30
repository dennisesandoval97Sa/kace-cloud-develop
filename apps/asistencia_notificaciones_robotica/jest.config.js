const dotenv = require('dotenv');

dotenv.config({ path: '../../.env' });

module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    testMatch: ['**/*.test.mjs'],
    transform: {},
    testTimeout: 30000,
};
