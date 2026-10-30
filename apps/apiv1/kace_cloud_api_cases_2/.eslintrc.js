module.exports = {
    extends: ['@kace'],
    rules: {
        'comma-dangle': [
            'error',
            {
                arrays: 'always-multiline',
                objects: 'always-multiline',
                imports: 'always-multiline',
                exports: 'always-multiline',
                functions: 'never',
            },
        ],
        quotes: ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
        'space-before-function-paren': [
            'error',
            {
                anonymous: 'always',
                named: 'never',
                asyncArrow: 'always',
            },
        ],
    },
    overrides: [
        {
            files: ['test/**/*.mjs'],
            env: { jest: true },
        },
    ],
};
