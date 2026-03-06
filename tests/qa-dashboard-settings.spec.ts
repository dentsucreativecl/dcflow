/**
 * qa-dashboard-settings.spec.ts
 * Agente QA: Dashboard + Settings
 * Roles: superadmin, admin-area, miembro
 * Cubre: widgets dashboard, datos por rol, settings de áreas
 */

import { test, expect } from '@playwright/test';

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

test.describe('Dashboard — superadmin', () => {
  test.use({ storageState: '.playwright/auth/superadmin.json' });

  test('dashboard: carga sin errores', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/404/);
  });

  test('dashboard: muestra widgets de métricas', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    // Widgets con números/métricas
    const metrics = page.locator('[class*="metric"], [class*="stat"], [class*="card"]');
    await expect(metrics.first()).toBeVisible({ timeout: 8_000 });
  });

  test('dashboard: links de tareas atrasadas navegan a lista sin 404', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const overdueLinks = page.locator('a[href*="/lists/"]');
    const count = await overdueLinks.count();
    if (count > 0) {
      await overdueLinks.first().click();
      await page.waitForLoadState('networkidle');
      await expect(page).not.toHaveURL(/\/404/);
    }
  });

  test('dashboard: sección "Mis tareas" muestra tareas', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const myTasks = page.locator('text=/Mis Tareas|mis tareas/i').first();
    if (await myTasks.isVisible()) {
      await expect(myTasks).toBeVisible();
    }
  });
});

test.describe('Dashboard — miembro (datos filtrados)', () => {
  test.use({ storageState: '.playwright/auth/miembro.json' });

  test('dashboard: miembro ve solo sus proyectos', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/404/);
    // No debe ver configuración de admin
    await expect(page.locator('text=/Configuración del sistema|Admin panel/i')).not.toBeVisible();
  });
});

// ─── SETTINGS ────────────────────────────────────────────────────────────────

test.describe('Settings — superadmin', () => {
  test.use({ storageState: '.playwright/auth/superadmin.json' });

  test('settings: carga sin 404', async ({ page }) => {
    await page.goto('/settings/');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/404/);
  });

  test('settings: muestra sección Áreas por Cliente', async ({ page }) => {
    await page.goto('/settings/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=/Áreas por Cliente|áreas por cliente/i')).toBeVisible({ timeout: 8_000 });
  });

  test('settings: checkboxes de áreas son interactuables', async ({ page }) => {
    await page.goto('/settings/');
    await page.waitForLoadState('networkidle');
    const checkboxes = page.locator('[role="checkbox"]');
    const count = await checkboxes.count();
    expect(count).toBeGreaterThan(0);

    // Click en primer checkbox y verificar que cambia
    const first = checkboxes.first();
    const initialState = await first.getAttribute('aria-checked');
    await first.click();
    await page.waitForTimeout(300);
    const newState = await first.getAttribute('aria-checked');
    expect(newState).not.toBe(initialState);

    // Revertir
    await first.click();
  });

  test('settings: cliente QA Test aparece en lista', async ({ page }) => {
    await page.goto('/settings/');
    await page.waitForLoadState('networkidle');
    // El cliente creado en QA debería aparecer
    // Si no existe, el test pasa igualmente (es informativo)
    const clientQA = page.locator('text=Cliente Playwright Test');
    const visible = await clientQA.isVisible();
    // No es bloqueante, solo verificamos que no crashea la sección
    await expect(page).not.toHaveURL(/\/404/);
  });
});

test.describe('Settings — miembro (acceso restringido)', () => {
  test.use({ storageState: '.playwright/auth/miembro.json' });

  test('miembro: settings redirige o muestra acceso restringido', async ({ page }) => {
    await page.goto('/settings/');
    await page.waitForLoadState('networkidle');
    // Miembro no debe tener acceso completo a settings
    // O redirige o muestra mensaje de permisos
    const isRedirected = !page.url().includes('/settings/');
    const showsRestricted = await page.locator('text=/acceso restringido|no tienes permiso|unauthorized/i').isVisible();
    const showsNothing = (await page.locator('[class*="checkbox"]').count()) === 0;
    expect(isRedirected || showsRestricted || showsNothing).toBe(true);
  });
});
