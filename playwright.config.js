const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './test/ui',
    testMatch: '**/*.spec.js',
    fullyParallel: false,
    workers: 1,
    timeout: 60000,
    use: {
        browserName: 'chromium',
        headless: true,
    },
});
