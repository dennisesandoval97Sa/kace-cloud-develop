const dotenv = require('dotenv');

dotenv.config({ path: '../../../.env' });

module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/test'],
    testMatch: ['**/*.test.mjs'],
    transform: {},
    testTimeout: 30000,
    coverageThreshold: {
        './src/controller.mjs': { functions: 90, lines: 90, statements: 90 },
    },
};
