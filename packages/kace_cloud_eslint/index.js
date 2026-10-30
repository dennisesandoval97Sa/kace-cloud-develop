module.exports = {
    ignorePatterns: [
        'node_modules/',
        'dist/',
        'build/',
        'cdk.out/',
        'bin/',
        '.husky/_/',
        'prettier.config.js',
        'migrations/',
        'seeds/',
    ],
    env: {
        node: true,
        es2021: true,
    },
    extends: ['standard'],
    plugins: ['import'],
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
    },
    rules: {
        // === INDENTATION & WHITESPACE ===
        indent: ['error', 4, { SwitchCase: 1, ignoredNodes: ['TemplateLiteral'] }],
        'no-multiple-empty-lines': ['error', { max: 1, maxBOF: 0, maxEOF: 0 }],
        // Enforce space before function parentheses
        'space-before-function-paren': [
            'error',
            {
                anonymous: 'always',
                named: 'never',
                asyncArrow: 'always',
            },
        ],
        // Enforce spaces around keywords (if, else, for, etc.)
        'keyword-spacing': ['error', { before: true, after: true }],
        // Enforce consistent spacing for unary operators
        'space-unary-ops': [
            'error',
            {
                words: true,
                nonwords: false,
                overrides: {
                    typeof: false,
                },
            },
        ],
        // Enforce spaces around infix operators (e.g., `a + b`)
        'space-infix-ops': 'error',

        // === QUOTES ===
        // Keep ESLint aligned with the shared Prettier configuration.
        quotes: ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],

        // === SEMICOLONS ===
        // Require semicolons at the end of statements.
        semi: ['error', 'always'],

        // === TRAILING COMMAS ===
        // Match Prettier's `trailingComma: 'es5'`: keep multiline ES5 commas, but not function commas.
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

        // === CONSOLE LOGS ===
        // Disallow all console.* statements (log, warn, error, etc.)
        'no-console': 'error',

        // === IMPORTS ===
        // Require a newline after import statements
        // This rule comes from 'eslint-plugin-import', which is often included with 'standard' or similar configs.
        'import/newline-after-import': ['error', { count: 1 }],

        // === COMMENTS ===
        // Warn about TODO and FIXME comments (does not fail the running command)
        'no-warning-comments': ['warn', { terms: ['todo', 'fixme'], location: 'anywhere' }],
        // Enforce a specific style for multiline comments (JSDoc-style blocks)
        'multiline-comment-style': ['error', 'starred-block'],
        // Enforce consistent spacing after // or /* in comments
        'spaced-comment': ['error', 'always'],

        camelcase: 'off',
        'multiline-ternary': 'off',
    },
    globals: {
        __APP_VERSION__: 'readonly',
    },
    overrides: [
        {
            files: ['**/*.test.*', '**/*.spec.*', '**/test/**', '**/tests/**'],
            env: {
                jest: true,
            },
        },
    ],
};
