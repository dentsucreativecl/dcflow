/**
 * qa-team.spec.ts
 * Agente QA: Módulo Equipo
 * Rol: superadmin
 * Cubre: grid/list, búsqueda, filtros, carga de trabajo, añadir miembro
 *
 * Bugs conocidos:
 *   - BUG-08: buscador no funciona standalone (sin filtro departamento activo)
 */

import { test, expect } from '@playwright/test';

test.use({ storageState: '.playwright/auth/superadmin.json' });

// ─── Carga ────────────────────────────────────────────────────────────────────

test('team: página /team/ carga correctamente', async ({ page }) => {
  await page.goto('/team/');
  await page.waitForLoadState('load');
  await expect(page.locator('h1')).toContainText('Equipo');
  await expect(page).not.toHaveURL(/\/404/);
});

test('team: muestra miembros con datos completos', async ({ page }) => {
  await page.goto('/team/');
  // Wait for team data to load (grid with member cards)
  await page.waitForSelector('[class*="grid"] > *', { timeout: 15_000 });
  const members = page.locator('[class*="grid"] > *');
  expect(await members.count()).toBeGreaterThan(5);
});

// ─── BUG-08: Búsqueda standalone ──────────────────────────────────────────────

test('BUG-08: búsqueda sin filtro departamento debe filtrar', async ({ page }) => {
  await page.goto('/team/');
  // Wait for team data to load
  await page.waitForSelector('[class*="grid"] > *', { timeout: 15_000 });
  const totalBefore = await page.locator('[class*="grid"] > *').count();
  await page.locator('input[placeholder*="buscar"], input[placeholder*="Buscar"]').first().fill('Sofia');
  await page.waitForTimeout(800);
  const totalAfter = await page.locator('[class*="grid"] > *').count();
  expect(totalAfter).toBeLessThan(totalBefore);
  expect(totalAfter).toBeGreaterThan(0);
});

test('team: búsqueda por nombre inexistente muestra estado vacío', async ({ page }) => {
  await page.goto('/team/');
  await page.waitForLoadState('load');
  await page.locator('input[placeholder*="buscar"], input[placeholder*="Buscar"]').first().fill('UsuarioInexistentexyz999');
  await page.waitForTimeout(800);
  const emptyState = page.locator('text=/no se encontraron|no hay miembros|sin resultados/i');
  await expect(emptyState).toBeVisible({ timeout: 5_000 });
});

test('team: búsqueda es case-insensitive', async ({ page }) => {
  await page.goto('/team/');
  await page.waitForSelector('[class*="grid"] > *', { timeout: 15_000 });
  const searchInput = page.locator('input[placeholder*="buscar"], input[placeholder*="Buscar"]').first();
  await searchInput.fill('esteban');
  await page.waitForTimeout(500);
  const resultLower = await page.locator('[class*="grid"] > *').count();
  await searchInput.fill('ESTEBAN');
  await page.waitForTimeout(500);
  const resultUpper = await page.locator('[class*="grid"] > *').count();
  expect(resultLower).toBe(resultUpper);
  expect(resultLower).toBeGreaterThan(0);
});

// ─── Filtro Departamento ──────────────────────────────────────────────────────

test('team: filtro por departamento filtra correctamente', async ({ page }) => {
  await page.goto('/team/');
  // Wait for team data to load
  await page.waitForSelector('[class*="grid"] > *', { timeout: 15_000 });
  const totalAll = await page.locator('[class*="grid"] > *').count();
  // FilterDropdown usa Radix Popover: opciones son <button> dentro del portal
  await page.getByRole('button', { name: /Departamento/i }).first().click();
  await page.waitForTimeout(400);
  await page.locator('[data-radix-popper-content-wrapper] button').first().click();
  await page.waitForTimeout(500);
  const totalFiltered = await page.locator('[class*="grid"] > *').count();
  expect(totalFiltered).toBeLessThan(totalAll);
});

test('team: limpiar filtros restaura lista completa', async ({ page }) => {
  await page.goto('/team/');
  // Wait for team data to load
  await page.waitForSelector('[class*="grid"] > *', { timeout: 15_000 });
  const totalAll = await page.locator('[class*="grid"] > *').count();
  // Seleccionar primer departamento
  await page.getByRole('button', { name: /Departamento/i }).first().click();
  await page.waitForTimeout(400);
  await page.locator('[data-radix-popper-content-wrapper] button').first().click();
  await page.waitForTimeout(500);
  // Limpiar desde dentro del popover (aún abierto)
  await page.locator('[data-radix-popper-content-wrapper]').getByRole('button', { name: /Limpiar/i }).click();
  await page.waitForTimeout(500);
  const totalAfterClear = await page.locator('[class*="grid"] > *').count();
  expect(totalAfterClear).toBe(totalAll);
});

// ─── Búsqueda + Filtro combinados ─────────────────────────────────────────────

test('team: búsqueda y filtro departamento se combinan correctamente', async ({ page }) => {
  await page.goto('/team/');
  // Wait for team data to load (member cards appear in grid)
  await page.waitForSelector('[class*="grid"] > *', { timeout: 15_000 });
  await page.getByRole('button', { name: /Departamento/i }).first().click();
  await page.waitForTimeout(400);
  // Filtrar por Diseño
  await page.locator('[data-radix-popper-content-wrapper] button').filter({ hasText: /Diseño/i }).click();
  await page.waitForTimeout(300);
  // Cerrar el popover haciendo click en "Aplicar"
  await page.locator('[data-radix-popper-content-wrapper]').getByRole('button', { name: /Aplicar/i }).click();
  await page.waitForTimeout(300);
  await page.locator('input[placeholder*="buscar"], input[placeholder*="Buscar"]').first().fill('Zacha');
  await page.waitForTimeout(500);
  // Zacha es de Social Media, no Diseño → empty state message appears
  await expect(page.getByText('No se encontraron miembros')).toBeVisible({ timeout: 5_000 });
});

// ─── Vista lista ──────────────────────────────────────────────────────────────

test('team: toggle vista lista muestra columnas', async ({ page }) => {
  await page.goto('/team/');
  await page.waitForLoadState('load');
  // Buscar el segundo botón de toggle (LayoutList icon)
  const listToggle = page.locator('button[class*="h-8"][class*="w-8"]').nth(1);
  if (await listToggle.isVisible()) {
    await listToggle.click();
    await page.waitForTimeout(500);
    // Columnas son "Miembro", "Cargo", "Area" (title case, not uppercase)
    await expect(page.getByText('Miembro', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Cargo', { exact: true }).first()).toBeVisible();
  }
});

// ─── Modal Añadir Miembro ─────────────────────────────────────────────────────

test('team: modal Añadir Miembro abre', async ({ page }) => {
  await page.goto('/team/');
  await page.waitForLoadState('load');
  await page.getByRole('button', { name: /Añadir Miembro/i }).click();
  await expect(page.locator('[role="dialog"]').first()).toBeVisible();
});

test('team: modal Añadir Miembro tiene etiquetas en español', async ({ page }) => {
  await page.goto('/team/');
  await page.waitForLoadState('load');
  await page.getByRole('button', { name: /Añadir Miembro/i }).click();
  const dialog = page.locator('[role="dialog"]').first();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('text=Full Name')).not.toBeVisible();
  await expect(dialog.locator('text=Add Member')).not.toBeVisible();
  await expect(dialog.locator('text=/Nombre|nombre/').first()).toBeVisible();
});

test('team: modal Añadir Miembro cierra con Escape', async ({ page }) => {
  await page.goto('/team/');
  await page.waitForLoadState('load');
  await page.getByRole('button', { name: /Añadir Miembro/i }).click();
  await expect(page.locator('[role="dialog"]').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[role="dialog"]').first()).not.toBeVisible();
});

// ─── Carga de Trabajo ─────────────────────────────────────────────────────────

test('team: link Carga de Trabajo navega sin 404', async ({ page }) => {
  await page.goto('/team/');
  await page.waitForLoadState('load');
  // Carga de Trabajo es un Link (asChild), se renderiza como <a> no <button>
  const workloadLink = page.getByRole('link', { name: /Carga de Trabajo/i });
  if (await workloadLink.isVisible()) {
    await workloadLink.click();
    await page.waitForLoadState('load');
    await expect(page).not.toHaveURL(/\/404/);
  }
});
