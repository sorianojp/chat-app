import { defineConfig, devices } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:8010';
const e2eEnv = { APP_ENV: 'e2e' };

/**
 * End-to-end tests run against a real `php artisan serve` + Reverb pair using
 * `.env.e2e` (SQLite database, own asset build, own Reverb port), so they never
 * touch the development database or dev servers.
 */
export default defineConfig({
    testDir: 'tests/e2e',
    fullyParallel: false,
    workers: 1,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? 'github' : 'list',
    use: {
        baseURL: APP_URL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: [
        {
            command: 'php artisan reverb:start --host=127.0.0.1 --port=8090',
            port: 8090,
            env: e2eEnv,
            reuseExistingServer: false,
            stdout: 'ignore',
        },
        {
            command: [
                'npm run build:e2e',
                'touch database/e2e.sqlite',
                'php artisan migrate:fresh --force',
                'php artisan serve --host=127.0.0.1 --port=8010 --no-reload',
            ].join(' && '),
            url: `${APP_URL}/up`,
            env: { ...e2eEnv, PHP_CLI_SERVER_WORKERS: '4' },
            reuseExistingServer: false,
            timeout: 180_000,
        },
    ],
});
