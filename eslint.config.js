const js = require('@eslint/js');

const commonGlobals = {
    Buffer: 'readonly',
    __dirname: 'readonly',
    clearTimeout: 'readonly',
    console: 'readonly',
    module: 'readonly',
    process: 'readonly',
    require: 'readonly',
    setTimeout: 'readonly',
};

module.exports = [
    {
        ignores: [
            'coverage/**',
            'node_modules/**',
        ],
    },
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: commonGlobals,
        },
        rules: {
            'no-console': 'off',
        },
    },
    {
        files: ['test/**/*.js'],
        languageOptions: {
            globals: {
                ...commonGlobals,
                afterEach: 'readonly',
                beforeEach: 'readonly',
                describe: 'readonly',
                it: 'readonly',
            },
        },
    },
];
