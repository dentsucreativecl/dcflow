/**
 * qa-team.spec.ts
 * Agente QA: Módulo Equipo
 * Rol: superadmin
 * Cubre: grid/list, búsqueda, filtros, carga de trabajo, añadir miembro
 *
 * Bugs conocidos que debe detectar:
 *   - BUG-08: buscador no funciona standalone (sin filtro departamento activo)
 */

import { test, expect } from '@playwright/test';

test.use({ storageState: '.playwright/auth/superadmin.json' });

// ─── Carga ────────────────────────────────────────────────────────────────────

test('team: página /team/ carga correctamente', async ({ page }) => {
  await page.goto('/team/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('h1')).toContainText('Equipo');
  await expect(page).not.toHaveURL(/\/404/);
});

test('team: muestra miembros con datos completos', async ({ page }) => {
  await page.goto('/team/');
  await page.waitForLoadState('networkidle');
  // Debe haber miembros
  const members = page.locator('[class*="card"], [class*="member-row"], [class*="grid"] > div');
  await expect(members.first()).toBeVisible({ timeout: 8_000 });
  const count = await members.count();
  expect(count).toBeGreaterThan(5);
});

// ─── BUG-08: Búsqueda standalone ──────────────────────────────────────────────

test('BUG-08: búsqueda sin filtro departamento debe filtrar', async ({ page }) => {
  await page.goto('/team/');
  await page.waitForLoadState('networkidle');

  const totalBefore = await page.locator('[class*="card"], [class*="member"]').count();

  // Buscar por nombre específico SIN filtro de departamento
  await page.getByPlaceholder('Buscar miembros...').or(page.locator('input[type="search"], input[placeholder*="buscar"]').first()).fill('Sofia');
  await page.waitForTimeout(800);

  const totalAfter = await page.locator('[class*="card"], [class*="member"]').count();

  // ASSERT: debe filtrar — no puede mostrar todos ni cero
  expect(totalAfter, 'La búsqueda debe filtrar resultados').toBeLessThan(totalBefore);
  expect(totalAfter, 'La búsqueda no debe mostrar 0 resultados para "Sofia"').toBeGreaterThan(0);
});

test('team: búsqueda por nombre inexistente muestra estado vacío', async ({ page }) => {
  await page.goto('/team/');
  await page.waitForLoadState('networkidle');
  await page.locator('input[placeholder*="buscar"], input[placeholder*="Buscar"]').first().fill('UsuarioInexistentexyz999');
  await page.waitForTimeout(800);
  const emptyState = page.locator('text=/no se encontraron|no hay miembros|sin resultados/i');
  await expect(emptyState).toBeVisible({ timeout: 5_000 });
});

test('team: búsqueda es case-insensitive', async ({ page }) => {
  await page.goto('/team/');
  await page.waitForLoadState('networkidle');
  const searchInput = page.locator('input[placeholder*="buscar"], input[placeholder*="Buscar"]').first();

  await searchInput.fill('esteban');
  await page.waitForTimeout(500);
  const resultLower = await page.locator('[class*="card"], [class*="member"]').count();

  await searchInput.fill('ESTEBAN');
  await page.waitForTimeout(500);
  const resultUpper = await page.locator('[class*="card"], [class*="member"]').count();

  expect(resultLower).toBe(resultUpper);
  expect(resultLower).toBeGreaterThan(0);
});

// ─── Filtro Departamento ──────────────────────────────────────────────────────

test('team: filtro por departamento filtra correctamente', async ({ page }) => {
  await page.goto('/team/');
  await page.waitForLoadState('networkidle');
  const totalAll = await page.locator('[class*="card"], [class*="member"]').count();

  // Abrir dropdown de departamento
  await page.getByRole('button', { name: /Departamento|Área|Filtrar/i }).first().click();
  await page.locator('[role="option"]').first().click();
  await page.waitForTimeout(500);

  const totalFiltered = await page.locator('[class*="card"], [class*="member"]').count();
  expect(totalFiltered).toBeLessThan(totalAll);
});

test('team: limpiar filtros restaura lista completa', async ({ page }) => {
  await page.goto('/team/');
  await page.waitForLoadState('networkidle');
  const totalAll = await page.locator('[class*="card"], [class*="member"]').count();

  // Aplicar filtro
  await page.getByRole('button', { name: /Departamento|Filtrar/i }).first().click();
  await page.locator('[role="option"]').first().click();
  await page.waitForTimeout(500);

  // Limpiar
  await page.getByRole('button', { name: /Limpiar/i }).click();
  await page.waitForTimeout(500);

  const totalAfterClear = await page.locator('[class*="card"], [class*="member"]').count();
  expect(totalAfterClear).toBe(totalAll);
});

// ─── Búsqueda + Filtro combinados ─────────────────────────────────────────────

test('team: búsqueda y filtro departamento se combinan correctamente', async ({ page }) => {
  await page.goto('/team/');
  await page.waitForLoadState('networkidle');

  // Aplicar filtro Diseño
  await page.getByRole('button', { name: /Departamento|Filtrar/i }).first().click();
  await page.locator('[role="option"]').filter({ hasText: /Diseño/i }).click();
  await page.waitForTimeout(300);

  // Luego buscar nombre que no existe en Diseño
  await page.locator('input[placeholder*="buscar"], input[placeholder*="Buscar"]').first().fill('Zacha');
  await page.waitForTimeout(500);

  // Zacha es de Social Media, no Diseño → debe dar 0 resultados
  const count = await page.locator('[class*="card"]').count();
  expect(count).toBe(0);
});

// ─── Vista lista ──────────────────────────────────────────────────────────────

test('team: toggle vista lista muestra columnas', async ({ page }) => {
  await page.goto('/team/');
  await page.waitForLoadState('networkidle');
  // Buscar el segundo botón de toggle (lista)
  const toggleBtns = page.locator('button').filter({ has: page.locator('svg') }).filter({ hasNot: page.locator('span') });
  const count = await toggleBtns.count();
  if (count >= 2) {
    await toggleBtns.nth(1).click();
    await page.waitForTimeout(300);
    await expect(page.locator('text=MIEMBRO')).toBeVisible();
    await expect(page.locator('text=CARGO')).toBeVisible();
  }
});

// ─── Modal Añadir Miembro ─────────────────────────────────────────────────────

test('team: modal Añadir Miembro abre', async ({ page }) => {
  await page.goto('/team/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Añadir Miembro/i }).click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
});

test('team: modal Añadir Miembro tiene etiquetas en español', async ({ page }) => {
  await page.goto('/team/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Añadir Miembro/i }).click();
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();

  // ASSERT: etiquetas en español (no inglés)
  await expect(dialog.locator('text=Full Name')).not.toBeVisible();
  await expect(dialog.locator('text=Email')).not.toBeVisible();
  await expect(dialog.locator('text=Add Member')).not.toBeVisible();

  // Deben estar en español
  await expect(dialog.locator('text=/Nombre|nombre/').first()).toBeVisible();
});

test('team: modal Añadir Miembro cierra con Escape', async ({ page }) => {
  await page.goto('/team/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Añadir Miembro/i }).click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[role="dialog"]')).not.toBeVisible();
});

// ─── Carga de Trabajo ─────────────────────────────────────────────────────────

test('team: botón Carga de Trabajo abre vista o página', async ({ page }) => {
  await page.goto('/team/');
  await page.waitForLoadState('networkidle');
  const workloadBtn = page.getByRole('button', { name: /Carga de Trabajo/i });
  await expect(workloadBtn).toBeVisible();
  await workloadBtn.click();
  await page.waitForTimeout(500);
  await expect(page).not.toHaveURL(/\/404/);
});
