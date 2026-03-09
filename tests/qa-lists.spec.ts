/**
 * qa-lists.spec.ts
 * Agente QA: Módulo Listas (/lists/[listId])
 * Rol: superadmin
 * Cubre: carga, skeleton, navegación entre listas, vistas, tareas
 *
 * Bugs conocidos:
 *   - BUG-04: skeleton infinito al navegar lista A → lista B vía sidebar
 */

import { test, expect, Page } from '@playwright/test';

test.use({ storageState: '.playwright/auth/superadmin.json' });

// ─── Helper ───────────────────────────────────────────────────────────────────

async function goToFirstList(page: Page): Promise<string> {
  await page.goto('/projects/');
  // Esperar filas reales (no botones del toolbar) antes de hacer click
  await page.waitForSelector('.divide-y > div', { timeout: 20_000 });
  await page.locator('.divide-y > div').first().click();
  await page.waitForURL(/\/lists\//, { timeout: 20_000 });
  return page.url();
}

// ─── Carga inicial ────────────────────────────────────────────────────────────

test('lists: página carga con contenido (no skeleton infinito)', async ({ page }) => {
  await goToFirstList(page);
  await page.waitForLoadState('load');
  await page.waitForTimeout(3_000);
  const skeletons = page.locator('[class*="skeleton"], [class*="animate-pulse"]');
  expect(await skeletons.count()).toBe(0);
  await expect(page.locator('h1, h2, [class*="title"]').first()).toBeVisible();
});

test('lists: muestra nombre del proyecto en header', async ({ page }) => {
  await goToFirstList(page);
  await page.waitForLoadState('load');
  const header = page.locator('h1, h2').first();
  await expect(header).toBeVisible();
  expect((await header.innerText()).length).toBeGreaterThan(2);
});

// ─── BUG-04: Navegación entre listas ─────────────────────────────────────────

test('BUG-04: navegar lista A → lista B vía sidebar no queda en skeleton', async ({ page }) => {
  await page.goto('/projects/');
  await page.waitForSelector('.divide-y > div', { timeout: 20_000 });
  await page.locator('.divide-y > div').first().click();
  await page.waitForURL(/\/lists\//);
  const urlA = page.url();
  await page.waitForLoadState('load');
  await page.waitForTimeout(1_000);

  const sidebarLinks = page.locator('aside [href*="/lists/"], nav [href*="/lists/"]');
  if (await sidebarLinks.count() < 2) { test.skip(); return; }

  const links = await sidebarLinks.all();
  let clicked = false;
  for (const link of links) {
    const href = await link.getAttribute('href');
    if (href && !urlA.includes(href)) {
      await link.click();
      clicked = true;
      break;
    }
  }
  if (!clicked) { test.skip(); return; }

  await page.waitForURL(/\/lists\//, { timeout: 10_000 });
  await page.waitForTimeout(3_000);

  const skeletons = page.locator('[class*="skeleton"], [class*="animate-pulse"]');
  expect(await skeletons.count()).toBe(0);
  await expect(page.locator('h1, h2').first()).toBeVisible();
});

// ─── Vistas ───────────────────────────────────────────────────────────────────

test('lists: vista lista por defecto muestra tareas agrupadas por estado', async ({ page }) => {
  await goToFirstList(page);
  await page.waitForLoadState('load');
  const stateGroups = page.locator('text=/Por Hacer|En Proceso|En Revisión|Completado/');
  await expect(stateGroups.first()).toBeVisible({ timeout: 8_000 });
});

test('lists: cambio a vista Kanban no da error', async ({ page }) => {
  await goToFirstList(page);
  await page.waitForLoadState('load');
  const btns = await page.locator('button[aria-label], button[title]').all();
  for (const btn of btns) {
    const label = (await btn.getAttribute('aria-label') || await btn.getAttribute('title') || '').toLowerCase();
    if (label.includes('kanban') || label.includes('tablero')) {
      await btn.click();
      await page.waitForTimeout(500);
      await expect(page).not.toHaveURL(/\/404/);
      break;
    }
  }
});

// ─── Búsqueda dentro de lista ─────────────────────────────────────────────────

test('lists: buscador de tareas filtra', async ({ page }) => {
  await goToFirstList(page);
  await page.waitForLoadState('load');
  const search = page.getByPlaceholder('Buscar tareas...');
  await expect(search).toBeVisible();
  await search.fill('zzz_inexistente_xyz');
  await page.waitForTimeout(500);
  const tasks = page.locator('[class*="task-row"], tbody tr');
  expect(await tasks.count()).toBe(0);
});

// ─── Nueva tarea ──────────────────────────────────────────────────────────────

test('lists: botón Nueva Tarea abre modal o inline', async ({ page }) => {
  await goToFirstList(page);
  await page.waitForLoadState('load');
  // Wait for area permissions to resolve — button shows only after canEditByArea=true
  const newTaskBtn = page.getByRole('button', { name: /Nueva Tarea/i });
  await expect(newTaskBtn).toBeVisible({ timeout: 15_000 });
  await newTaskBtn.click();
  // Wait for the open dialog (use data-state to avoid matching closed modals in DOM)
  await page.waitForSelector('[role="dialog"][data-state="open"]', { timeout: 10_000 }).catch(() => {});
  const dialog = page.locator('[role="dialog"][data-state="open"]').first();
  const inlineInput = page.locator('input[placeholder*="tarea"], input[placeholder*="título"]');
  expect((await dialog.isVisible()) || (await inlineInput.isVisible())).toBe(true);
});

// ─── Permisos ─────────────────────────────────────────────────────────────────

test.describe('lists como miembro', () => {
  test.use({ storageState: '.playwright/auth/miembro.json' });

  test('miembro: puede ver lista (puede o no crear tareas según permisos de área)', async ({ page }) => {
    await goToFirstList(page);
    await page.waitForLoadState('load');
    await expect(page).not.toHaveURL(/\/404/);
  });
});
