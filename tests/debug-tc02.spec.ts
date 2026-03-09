import { test, expect } from '@playwright/test';
import path from 'path';

const BASE = 'http://localhost:3000';
const authDir = path.join(__dirname, '../.playwright/auth');
const AFP_SPACE_ID = 'space-afp-planvital';
// jorge.martinez@dentsu.com UUID (discovered via team page traversal)
const JORGE_USER_ID = '910b7ed7-bf75-43f6-ac00-c8a3bb346528';

/**
 * Step 1: As superadmin, set AFP PlanVital.areas and jorge's userAreas via API
 * so area permission can be properly enforced.
 */
test('setup: configure areas for TC-02 scenario', async ({ browser }) => {
    const context = await browser.newContext({
        storageState: path.join(authDir, 'superadmin.json'),
    });
    const page = await context.newPage();

    // 1a. Set AFP PlanVital.areas to Estrategia + Social Media + Creatividad
    const spacesRes = await context.request.patch(`${BASE}/api/spaces/${AFP_SPACE_ID}/areas`, {
        data: { areas: ['Estrategia', 'Social Media', 'Creatividad'] },
    });
    console.log('PATCH space areas status:', spacesRes.status(), await spacesRes.text());
    expect(spacesRes.status()).toBe(200);

    // 1b. Jorge's user ID is known (jorge.martinez@dentsu.com)
    const jorgeId = JORGE_USER_ID;
    console.log('Jorge user ID:', jorgeId);

    // 1c. Set jorge's userAreas to Diseño + Producción
    const userRes = await context.request.patch(`${BASE}/api/team/${jorgeId}`, {
        data: { userAreas: ['Diseño', 'Producción'] },
    });
    console.log('PATCH userAreas status:', userRes.status(), await userRes.text());
    expect(userRes.status()).toBe(200);

    await context.close();
});

/**
 * Step 2: As jorge (admin-area), navigate to AFP PlanVital → Estrategia list.
 * Jorge has Diseño+Producción areas; space requires Estrategia/Social/Creatividad → READ_ONLY.
 */
test('verify: AFP PlanVital Estrategia shows read-only banner for jorge', async ({ browser }) => {
    const context = await browser.newContext({
        storageState: path.join(authDir, 'admin-area.json'),
    });
    const page = await context.newPage();

    // Capture browser console for debugging
    const consoleLogs: string[] = [];
    page.on('console', msg => {
        if (msg.type() === 'error' || msg.type() === 'warn') {
            consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
        }
    });

    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Expand AFP PlanVital space
    await page.locator('button').filter({ hasText: 'AFP PlanVital' }).first().click();
    await page.waitForTimeout(700);

    // Expand Estrategia folder
    await page.locator('button').filter({ hasText: 'Estrategia' }).first().click();
    await page.waitForTimeout(700);

    const listLinks = await page.locator('a[href*="/lists/"]').evaluateAll(
        (els) => els.map((el) => (el as HTMLAnchorElement).href)
    );
    console.log('List links:', listLinks);

    if (listLinks.length === 0) {
        console.log('No list links found');
        await context.close();
        return;
    }

    // Intercept Supabase requests to inspect Space.areas and User.userAreas responses
    const supabaseResponses: Array<{ url: string; body: string }> = [];
    page.on('response', async (resp) => {
        const url = resp.url();
        if (url.includes('supabase') && (url.includes('Space') || url.includes('User'))) {
            try {
                const body = await resp.text();
                supabaseResponses.push({ url: url.split('?')[0], body: body.slice(0, 300) });
            } catch { /**/ }
        }
    });

    await page.goto(listLinks[0]);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    for (const r of supabaseResponses) {
        console.log('Supabase request:', r.url);
        console.log('Response body:', r.body);
        console.log('---');
    }

    const bannerVisible = await page.locator('text=Solo lectura').isVisible().catch(() => false);
    const nuevaTareaVisible = await page.locator('button:has-text("Nueva Tarea")').isVisible().catch(() => false);
    const h1 = await page.locator('h1').first().textContent().catch(() => '');

    // Take a screenshot for visual inspection
    await page.screenshot({ path: '/tmp/debug-tc02-result.png', fullPage: false });

    console.log('Page h1:', h1);
    console.log('Banner visible:', bannerVisible);
    console.log('Nueva Tarea visible:', nuevaTareaVisible);

    if (consoleLogs.length > 0) {
        console.log('Browser console errors/warnings:');
        consoleLogs.forEach(l => console.log(l));
    }

    // Check what HTML is in the area around the banner
    const topBarHTML = await page.locator('div.flex.items-center.justify-between').first().innerHTML().catch(() => 'NOT FOUND');
    console.log('Top bar HTML (first 500 chars):', topBarHTML.slice(0, 500));

    await context.close();

    expect(bannerVisible, 'Banner "Solo lectura" should be visible for jorge on Estrategia list').toBe(true);
    expect(nuevaTareaVisible, '"Nueva Tarea" button should be hidden').toBe(false);
});
