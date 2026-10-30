module.exports = {
    extends: ['@kace/eslint-config'],
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
    },
    env: {
        node: true,
        jest: true,
    },
    rules: {
        // Permitido para CLIs y reportes
        'no-console': 'off',
    },
    ignorePatterns: ['node_modules/', 'tmp/', 'dump/'],
};
