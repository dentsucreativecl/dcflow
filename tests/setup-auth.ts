/**
 * setup-auth.ts
 * Playwright global setup — logs in each test user and saves storageState.
 * Run once with: npx playwright test --project=setup
 * Sessions are saved to .playwright/auth/<name>.json and reused by all projects.
 */

import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authDir = path.join(__dirname, '../.playwright/auth');
const BASE = 'http://localhost:3000';

interface UserConfig {
    name: string;
    email: string;
    password: string;
    file: string;
}

const USERS: UserConfig[] = [
    {
        name: 'superadmin',
        email: 'esteban.ibarra@dentsu.com',
        password: 'dcflow2025',
        file: path.join(authDir, 'superadmin.json'),
    },
    {
        name: 'admin-area',
        email: 'jorge.martinez@dentsu.com',
        password: 'dcflow2025',
        file: path.join(authDir, 'admin-area.json'),
    },
    {
        name: 'director-proyecto',
        email: 'jose.rojas@dentsu.com',
        password: 'dcflow2025',
        file: path.join(authDir, 'director-proyecto.json'),
    },
    {
        name: 'miembro',
        email: 'oriana.goris@dentsu.com',
        password: 'dcflow2025',
        file: path.join(authDir, 'miembro.json'),
    },
];

for (const user of USERS) {
    setup(`authenticate: ${user.name}`, async ({ page }) => {
        await page.goto(`${BASE}/login`);

        // Fill login form
        await page.getByLabel('Email').fill(user.email);
        await page.getByLabel('Contraseña').fill(user.password);
        await page.getByRole('button', { name: 'Iniciar Sesión' }).click();

        // Wait for redirect to dashboard (auth complete)
        await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
        await expect(page).not.toHaveURL(/\/login/);

        // Persist session
        await page.context().storageState({ path: user.file });
        console.log(`✓ Auth saved: ${user.name} → ${user.file}`);
    });
}
