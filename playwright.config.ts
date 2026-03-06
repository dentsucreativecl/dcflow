import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const authDir = path.join(__dirname, '.playwright/auth');

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',

    timeout: 90_000,

    use: {
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },

    projects: [
        // ── Auth setup (runs first, generates storageState files) ────────────
        {
            name: 'setup',
            testMatch: /setup-auth\.ts/,
        },

        // ── Named user contexts ──────────────────────────────────────────────
        {
            name: 'superadmin',
            use: {
                ...devices['Desktop Chrome'],
                storageState: path.join(authDir, 'superadmin.json'),
            },
            dependencies: ['setup'],
        },
        {
            name: 'admin-area',
            use: {
                ...devices['Desktop Chrome'],
                storageState: path.join(authDir, 'admin-area.json'),
            },
            dependencies: ['setup'],
        },
        {
            name: 'director-proyecto',
            use: {
                ...devices['Desktop Chrome'],
                storageState: path.join(authDir, 'director-proyecto.json'),
            },
            dependencies: ['setup'],
        },
        {
            name: 'miembro',
            use: {
                ...devices['Desktop Chrome'],
                storageState: path.join(authDir, 'miembro.json'),
            },
            dependencies: ['setup'],
        },
    ],
});
