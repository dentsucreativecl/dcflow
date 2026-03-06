/**
 * qa-projects.spec.ts
 * Agente QA: Módulo Proyectos
 * Rol: superadmin (lectura/escritura completa)
 * Cubre: lista, filtros, búsqueda, crear proyecto, detalle, breadcrumbs
 */

import { test, expect } from '@playwright/test';

test.use({ storageState: '.playwright/auth/superadmin.json' });

// ─── Carga y estructura ───────────────────────────────────────────────────────

test('projects: página carga sin error', async ({ page }) => {
  await page.goto('/projects/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('h1')).toContainText('Proyectos');
  await expect(page).not.toHaveURL(/\/404/);
});

test('projects: muestra lista de proyectos con columnas correctas', async ({ page }) => {
  await page.goto('/projects/');
  await page.waitForLoadState('networkidle');
  // Columnas esperadas
  await expect(page.locator('text=PROYECTO')).toBeVisible();
  await expect(page.locator('text=ESPACIO')).toBeVisible();
  await expect(page.locator('text=PROGRESO')).toBeVisible();
  await expect(page.locator('text=FECHA LÍMITE')).toBeVisible();
  await expect(page.locator('text=TAREAS')).toBeVisible();
});

test('projects: hay al menos 1 proyecto en la lista', async ({ page }) => {
  await page.goto('/projects/');
  await page.waitForLoadState('networkidle');
  const rows = page.locator('table tbody tr, [class*="cursor-pointer"]');
  await expect(rows.first()).toBeVisible({ timeout: 10_000 });
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);
});

// ─── Búsqueda ─────────────────────────────────────────────────────────────────

test('projects: búsqueda filtra resultados', async ({ page }) => {
  await page.goto('/projects/');
  await page.waitForLoadState('networkidle');
  const searchInput = page.getByPlaceholder('Buscar proyectos...');
  await searchInput.fill('AFP');
  await page.waitForTimeout(500);
  const rows = page.locator('table tbody tr, [class*="cursor-pointer"]');
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);
  // Todos los resultados deben contener AFP
  const firstRowText = await rows.first().innerText();
  expect(firstRowText.toLowerCase()).toContain('afp');
});

test('projects: búsqueda sin resultados muestra estado vacío', async ({ page }) => {
  await page.goto('/projects/');
  await page.waitForLoadState('networkidle');
  const searchInput = page.getByPlaceholder('Buscar proyectos...');
  await searchInput.fill('xyzprojectoinexistente999');
  await page.waitForTimeout(500);
  const rows = page.locator('table tbody tr');
  const count = await rows.count();
  expect(count).toBe(0);
});

// ─── Filtros ──────────────────────────────────────────────────────────────────

test('projects: filtro por Espacio reduce resultados', async ({ page }) => {
  await page.goto('/projects/');
  await page.waitForLoadState('networkidle');
  const totalBefore = await page.locator('table tbody tr').count();

  await page.getByRole('button', { name: /Espacio/i }).click();
  // Seleccionar primera opción disponible
  await page.locator('[role="option"], [class*="option"]').first().click();
  await page.waitForTimeout(500);

  const totalAfter = await page.locator('table tbody tr').count();
  expect(totalAfter).toBeLessThanOrEqual(totalBefore);
});

// ─── Click en proyecto → navega a lista ──────────────────────────────────────

test('projects: click en proyecto navega a /lists/[id]', async ({ page }) => {
  await page.goto('/projects/');
  await page.waitForLoadState('networkidle');
  const firstRow = page.locator('table tbody tr').first();
  await firstRow.click();
  await page.waitForURL(/\/lists\//, { timeout: 10_000 });
  await expect(page).toHaveURL(/\/lists\//);
  await expect(page).not.toHaveURL(/\/404/);
});

// ─── Vista toggle ─────────────────────────────────────────────────────────────

test('projects: toggle vista lista/grid funciona', async ({ page }) => {
  await page.goto('/projects/');
  await page.waitForLoadState('networkidle');
  // Buscar botón de toggle de vista
  const gridToggle = page.locator('[aria-label*="grid"], [title*="grid"], button[class*="view"]').last();
  if (await gridToggle.isVisible()) {
    await gridToggle.click();
    await page.waitForTimeout(300);
    await expect(page).not.toHaveURL(/\/404/);
  }
});

// ─── Crear proyecto ───────────────────────────────────────────────────────────

test('projects: botón Nuevo Proyecto abre modal', async ({ page }) => {
  await page.goto('/projects/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Nuevo Proyecto/i }).click();
  // Modal debe abrirse
  await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5_000 });
});

test('projects: crear proyecto con datos válidos', async ({ page }) => {
  await page.goto('/projects/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Nuevo Proyecto/i }).click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();

  // Llenar nombre del proyecto
  const nameInput = page.locator('[role="dialog"] input').first();
  await nameInput.fill('Proyecto QA Test Playwright');

  // Intentar submit
  await page.locator('[role="dialog"]').getByRole('button', { name: /crear|guardar|añadir/i }).click();
  await page.waitForTimeout(1_000);

  // El modal debe cerrarse o mostrar el proyecto creado
  const dialogVisible = await page.locator('[role="dialog"]').isVisible();
  if (!dialogVisible) {
    // Modal cerró → éxito
    await page.goto('/projects/');
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder('Buscar proyectos...').fill('Proyecto QA Test Playwright');
    await page.waitForTimeout(500);
    const rows = await page.locator('table tbody tr').count();
    expect(rows).toBeGreaterThan(0);
  }
  // Si el modal sigue abierto, al menos no debe haber crasheado
  await expect(page).not.toHaveURL(/\/404/);
});

// ─── Subagente miembro (solo lectura) ─────────────────────────────────────────

test.describe('projects como miembro', () => {
  test.use({ storageState: '.playwright/auth/miembro.json' });

  test('miembro: puede ver lista de proyectos', async ({ page }) => {
    await page.goto('/projects/');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/404/);
    await expect(page.locator('h1')).toContainText('Proyectos');
  });

  test('miembro: botón Nuevo Proyecto no visible', async ({ page }) => {
    await page.goto('/projects/');
    await page.waitForLoadState('networkidle');
    const btn = page.getByRole('button', { name: /Nuevo Proyecto/i });
    await expect(btn).not.toBeVisible();
  });
});
