const dotenv = require('dotenv');
const path = require('node:path');

dotenv.config({ path: path.join(__dirname, '../../../../.env') });

module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/test'],
    testMatch: ['**/*.test.mjs'],
    transform: {},
    testTimeout: 30000,
};
