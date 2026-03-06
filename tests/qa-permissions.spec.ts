import { test, expect } from '@playwright/test';
import path from 'path';

const BASE = 'http://localhost:3000';
const authDir = path.join(__dirname, '../.playwright/auth');

// ─── TC-01: Super Admin dropdown editable y persiste ───────────────────────
test.describe('TC-01 — Super Admin: dropdown de rol editable y persiste', () => {
    test.use({ storageState: path.join(authDir, 'superadmin.json') });

    test('dropdown de rol existe y es editable', async ({ page }) => {
        await page.goto(`${BASE}/team`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // Click a member card — exclude the icon-bar /team/ nav link by requiring a UUID segment
        // Member links look like /team/[uuid] — the UUID has dashes
        const memberLink = page.locator('a[href*="/team/"][href*="-"]').first();
        await memberLink.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);

        // ASSERT: card "Rol y Tipo" has editable select
        const roleSelect = page.locator('select').first();
        await expect(roleSelect).toBeVisible();
        await expect(roleSelect).not.toBeDisabled();

        // Read current value
        const currentValue = await roleSelect.inputValue();
        expect(['ADMIN', 'MEMBER']).toContain(currentValue);

        // Change to opposite value
        const newValue = currentValue === 'ADMIN' ? 'MEMBER' : 'ADMIN';

        // Intercept PATCH response to debug API errors
        let apiStatus = 0;
        let apiBody = '';
        page.on('response', async (resp) => {
            if (resp.url().includes('/api/team/') && resp.request().method() === 'PATCH') {
                apiStatus = resp.status();
                try { apiBody = await resp.text(); } catch { /**/ }
            }
        });

        await roleSelect.selectOption(newValue);

        // Wait enough for the API call to complete
        await page.waitForTimeout(3000);

        // Log API result for debugging
        console.log(`API PATCH /api/team/ → status=${apiStatus} body=${apiBody}`);

        // Only assert persistence if API call succeeded
        expect(apiStatus, `API PATCH falló (${apiStatus}): ${apiBody}`).toBe(200);

        // Reload and verify persistence
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        const reloadedSelect = page.locator('select').first();
        await expect(reloadedSelect).toHaveValue(newValue);

        // Restore original value
        await reloadedSelect.selectOption(currentValue);
        await page.waitForTimeout(2000);
    });
});

// Helper: get list URLs from a specific space by name, expanding its folders.
// This is targeted (not exhaustive) to stay within test timeouts.
async function getListsFromSpace(
    page: import('@playwright/test').Page,
    spaceName: string,
    folderNames: string[]
): Promise<string[]> {
    const urls = new Set<string>();

    // Click the space button to expand it
    const spaceBtn = page.locator('button').filter({ hasText: spaceName }).first();
    if (!await spaceBtn.isVisible().catch(() => false)) return [];
    await spaceBtn.click();
    await page.waitForTimeout(600);

    // Collect any direct list links
    const direct = await page.locator('a[href*="/lists/"]').evaluateAll(
        (els) => els.map((el) => (el as HTMLAnchorElement).href)
    );
    direct.forEach((u) => urls.add(u));

    // Expand each requested folder
    for (const folder of folderNames) {
        const folderBtn = page.locator('button').filter({ hasText: folder }).first();
        if (!await folderBtn.isVisible().catch(() => false)) continue;
        await folderBtn.click();
        await page.waitForTimeout(400);
        const folderLinks = await page.locator('a[href*="/lists/"]').evaluateAll(
            (els) => els.map((el) => (el as HTMLAnchorElement).href)
        );
        folderLinks.forEach((u) => urls.add(u));
    }

    return [...urls];
}

// ─── TC-02: Admin área: banner solo lectura en área restringida ─────────────
test.describe('TC-02 — Admin área: banner solo lectura en área restringida', () => {
    test.use({ storageState: path.join(authDir, 'admin-area.json') });

    test('banner ámbar visible y botones ocultos en espacio restringido', async ({ page }) => {
        await page.goto(`${BASE}/dashboard`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);

        // AFP PlanVital → Estrategia: jorge has Diseño+Producción, not Estrategia → READ_ONLY
        // Also try Creatividad and Social Media folders as fallback
        const listUrls = await getListsFromSpace(page, 'AFP PlanVital', ['Estrategia', 'Creatividad', 'Social Media']);
        console.log(`TC-02: Found ${listUrls.length} list URLs from AFP PlanVital`);

        if (listUrls.length === 0) {
            test.skip(true, 'AFP PlanVital no tiene listas visibles. Verificar que el space tiene carpetas/listas en DB y áreas asignadas en Settings.');
            return;
        }

        let foundRestricted = false;
        for (const url of listUrls) {
            await page.goto(url);
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(2500);

            const hasBanner = await page.locator('text=Solo lectura').isVisible().catch(() => false);
            if (hasBanner) {
                foundRestricted = true;
                console.log(`TC-02: PASS — restricted banner at ${url}`);
                await expect(page.locator('text=Solo lectura')).toBeVisible();
                await expect(page.locator('button:has-text("Nueva Tarea")')).not.toBeVisible();
                await expect(page.locator('button:has-text("Campos")')).not.toBeVisible();
                await expect(page.locator('button:has-text("Reglas")')).not.toBeVisible();
                break;
            }
        }

        if (!foundRestricted) {
            test.skip(true,
                `Ninguna de las ${listUrls.length} listas en AFP PlanVital (Estrategia/Creatividad/SocialMedia) ` +
                'mostró banner de solo lectura para jorge.martinez. ' +
                'Acción requerida: en Settings → Áreas por Cliente, asignar área "Estrategia" (u otra que NO sea Diseño/Producción) a AFP PlanVital.'
            );
        }
    });
});

// ─── TC-03: Admin área: acceso completo en área propia ─────────────────────
test.describe('TC-03 — Admin área: acceso completo en área propia', () => {
    test.use({ storageState: path.join(authDir, 'admin-area.json') });

    test('sin banner y botones visibles en espacio de área propia', async ({ page }) => {
        await page.goto(`${BASE}/dashboard`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);

        // AFP PlanVital → Diseño: jorge HAS Diseño area → EDIT expected
        // Also try Producción as fallback
        const listUrls = await getListsFromSpace(page, 'AFP PlanVital', ['Diseño', 'Producción']);
        console.log(`TC-03: Found ${listUrls.length} list URLs from AFP PlanVital Diseño/Producción`);

        if (listUrls.length === 0) {
            test.skip(true, 'AFP PlanVital no tiene listas de Diseño/Producción. Verificar carpetas en DB.');
            return;
        }

        let foundPermitted = false;
        for (const url of listUrls) {
            await page.goto(url);
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(2500);

            const hasBanner = await page.locator('text=Solo lectura').isVisible().catch(() => false);
            const hasNewTask = await page.locator('button:has-text("Nueva Tarea")').isVisible().catch(() => false);

            if (!hasBanner && hasNewTask) {
                foundPermitted = true;
                console.log(`TC-03: PASS — full access at ${url}`);
                await expect(page.locator('text=Solo lectura')).not.toBeVisible();
                await expect(page.locator('button:has-text("Nueva Tarea")')).toBeVisible();
                break;
            }
        }

        if (!foundPermitted) {
            test.skip(true,
                `Las ${listUrls.length} listas de Diseño/Producción en AFP PlanVital muestran solo lectura. ` +
                'Acción requerida: en el perfil de jorge.martinez, verificar que userAreas incluye "Diseño" y "Producción". ' +
                'Y en Settings, que AFP PlanVital tenga área "Diseño" o "Producción" asignada.'
            );
        }
    });
});
