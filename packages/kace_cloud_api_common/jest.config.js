import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

export default {
    testEnvironment: 'node',
    setupFilesAfterEnv: ['<rootDir>/tests/jest.warmup.js'],
    roots: ['<rootDir>/tests'],
    testMatch: ['**/*.test.js'],
    moduleFileExtensions: ['js', 'json', 'node'],
    transform: {},
    moduleNameMapper: {
        // Mock AWS SDK modules para evitar dependencias en tests
        '^@aws-sdk/lib-dynamodb$': '<rootDir>/tests/__mocks__/@aws-sdk/lib-dynamodb.js',
        '^@aws-sdk/client-dynamodb$': '<rootDir>/tests/__mocks__/@aws-sdk/client-dynamodb.js',
        '^aws-jwt-verify$': '<rootDir>/tests/__mocks__/aws-jwt-verify.js',
    },
};
