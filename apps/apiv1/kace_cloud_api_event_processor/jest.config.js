module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/test'],
    testMatch: ['**/*.test.mjs'],
    transform: {},
    testTimeout: 30000,
    moduleFileExtensions: ['js', 'mjs', 'cjs', 'json', 'node'],
    moduleNameMapper: {
        '\\.d\\.ts$': '<rootDir>/test/__mocks__/empty.mjs',
    },
};
