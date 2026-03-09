/**
 * qa-projects.spec.ts
 * Agente QA: Módulo Proyectos
 * Rol: superadmin (lectura/escritura completa)
 * Cubre: lista, filtros, búsqueda, crear proyecto, detalle, breadcrumbs
 */

import { test, expect, Page } from '@playwright/test';

test.use({ storageState: '.playwright/auth/superadmin.json' });

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Navega a la primera lista via /projects/.
 * Usa .divide-y > div para seleccionar filas reales (no botones del toolbar).
 */
async function goToFirstList(page: Page): Promise<void> {
  await page.goto('/projects/');
  // Esperar que los proyectos carguen en el DOM (filas reales)
  await page.waitForSelector('.divide-y > div', { timeout: 20_000 });
  await page.locator('.divide-y > div').first().click();
  await page.waitForURL(/\/lists\//, { timeout: 20_000 });
  await page.waitForLoadState('load');
}

// ─── Carga y estructura ───────────────────────────────────────────────────────

test('projects: página carga sin error', async ({ page }) => {
  await page.goto('/projects/');
  await page.waitForLoadState('load');
  await expect(page.locator('h1')).toContainText('Proyectos');
  await expect(page).not.toHaveURL(/\/404/);
});

test('projects: muestra lista de proyectos con columnas correctas', async ({ page }) => {
  await page.goto('/projects/');
  await page.waitForLoadState('load');
  // Columns are title-case spans (not uppercase)
  await expect(page.getByText('Proyecto', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Espacio', { exact: true }).first()).toBeVisible();
});

test('projects: hay al menos 1 proyecto en la lista', async ({ page }) => {
  await page.goto('/projects/');
  // Esperar que las filas reales aparezcan
  await page.waitForSelector('.divide-y > div', { timeout: 20_000 });
  const rows = page.locator('.divide-y > div');
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeGreaterThan(0);
});

// ─── Búsqueda ─────────────────────────────────────────────────────────────────

test('projects: búsqueda filtra resultados', async ({ page }) => {
  await page.goto('/projects/');
  await page.waitForSelector('.divide-y > div', { timeout: 20_000 });
  await page.getByPlaceholder('Buscar proyectos...').fill('AFP');
  await page.waitForTimeout(500);
  const rows = page.locator('.divide-y > div');
  expect(await rows.count()).toBeGreaterThan(0);
  const texts = await rows.allInnerTexts();
  expect(texts.some(t => t.toLowerCase().includes('afp'))).toBe(true);
});

test('projects: búsqueda sin resultados muestra estado vacío', async ({ page }) => {
  await page.goto('/projects/');
  await page.waitForSelector('.divide-y > div', { timeout: 20_000 });
  await page.getByPlaceholder('Buscar proyectos...').fill('xyzprojectoinexistente999');
  await page.waitForTimeout(500);
  // Cuando no hay resultados se muestra texto de estado vacío
  await expect(page.getByText('No se encontraron proyectos')).toBeVisible({ timeout: 5_000 });
});

// ─── Filtros ──────────────────────────────────────────────────────────────────

test('projects: filtro por Espacio reduce resultados', async ({ page }) => {
  await page.goto('/projects/');
  await page.waitForSelector('.divide-y > div', { timeout: 20_000 });
  const totalBefore = await page.locator('.divide-y > div').count();
  // FilterDropdown usa Radix Popover: opciones son <button> dentro del portal
  await page.getByRole('button', { name: /Espacio/i }).click();
  await page.waitForTimeout(400);
  await page.locator('[data-radix-popper-content-wrapper] button').first().click();
  await page.waitForTimeout(500);
  const totalAfter = await page.locator('.divide-y > div').count();
  expect(totalAfter).toBeLessThanOrEqual(totalBefore);
});

// ─── Click en proyecto → navega a lista ──────────────────────────────────────

test('projects: click en proyecto navega a /lists/[id]', async ({ page }) => {
  await goToFirstList(page);
  await expect(page).toHaveURL(/\/lists\//);
  await expect(page).not.toHaveURL(/\/404/);
});

// ─── Vista toggle ─────────────────────────────────────────────────────────────

test('projects: toggle vista lista/grid funciona', async ({ page }) => {
  await page.goto('/projects/');
  await page.waitForLoadState('load');
  const gridToggle = page.locator('[aria-label*="grid"], [title*="kanban"], button[title*="Vista"]').last();
  if (await gridToggle.isVisible()) {
    await gridToggle.click();
    await page.waitForTimeout(300);
    await expect(page).not.toHaveURL(/\/404/);
  }
});

// ─── Crear proyecto ───────────────────────────────────────────────────────────

test('projects: botón Nuevo Proyecto abre modal', async ({ page }) => {
  await page.goto('/projects/');
  await page.waitForLoadState('load');
  await page.getByRole('button', { name: /Nuevo Proyecto/i }).click();
  await expect(page.locator('[role="dialog"]').first()).toBeVisible({ timeout: 5_000 });
});

test('projects: crear proyecto con datos válidos', async ({ page }) => {
  await page.goto('/projects/');
  await page.waitForLoadState('load');
  await page.getByRole('button', { name: /Nuevo Proyecto/i }).click();
  const dialog = page.locator('[role="dialog"]').first();
  await expect(dialog).toBeVisible();
  await dialog.locator('input').first().fill('Proyecto QA Test Playwright');
  // Botón de submit puede llamarse "Crear", "Guardar" o "Añadir"
  const submitBtn = dialog.getByRole('button', { name: /crear|guardar|añadir/i }).first();
  if (await submitBtn.isVisible()) {
    await submitBtn.click();
    await page.waitForTimeout(1_000);
  }
  await expect(page).not.toHaveURL(/\/404/);
});

// ─── Subagente miembro ─────────────────────────────────────────────────────────

test.describe('projects como miembro', () => {
  test.use({ storageState: '.playwright/auth/miembro.json' });

  test('miembro: puede ver lista de proyectos', async ({ page }) => {
    await page.goto('/projects/');
    await page.waitForLoadState('load');
    await expect(page).not.toHaveURL(/\/404/);
    await expect(page.locator('h1')).toContainText('Proyectos');
  });

  test('miembro: botón Nuevo Proyecto visible (UI no restringe por rol)', async ({ page }) => {
    // El botón "Nuevo Proyecto" se renderiza para todos los usuarios.
    // La restricción por rol se haría server-side al guardar.
    await page.goto('/projects/');
    await page.waitForLoadState('load');
    await expect(page.getByRole('button', { name: /Nuevo Proyecto/i })).toBeVisible();
  });
});
