import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

export default {
    testEnvironment: 'node',
    globalSetup: '<rootDir>/tests/support/templateDatabase.js',
    globalTeardown: '<rootDir>/tests/support/globalTeardown.js',
    // Quita las rutas repetidas que los IDE mandan en `--runTestsByPath` (una
    // por test fallido, no por archivo) y que jest no deduplica. Ver
    // tests/support/dedupeSequencer.cjs.
    testSequencer: '<rootDir>/tests/support/dedupeSequencer.cjs',
    setupFilesAfterEnv: ['<rootDir>/tests/jest.warmup.js', '<rootDir>/tests/support/perFileDatabase.js'],
    moduleFileExtensions: ['js', 'json', 'node'],
    transform: {},
    coverageDirectory: 'coverage',
    coverageReporters: ['lcov', 'text'],
    coveragePathIgnorePatterns: ['/node_modules/', '/tests/'],
    // La cobertura es opt-in (`pnpm run test:coverage`) a proposito. Fijarla
    // aqui la cobra en TODA corrida -incluida la de un solo archivo desde el
    // IDE- y, de rebote, activa el `coverageThreshold` de abajo, que hasta
    // entonces era inerte: cualquier ejecucion parcial pasaria a fallar por
    // umbral aunque sus tests esten verdes.
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80,
        },
    },
    testPathIgnorePatterns: ['/node_modules/', '/dist/', '/test/src/', '/test/cases/'],
    testTimeout: 120000,
};
