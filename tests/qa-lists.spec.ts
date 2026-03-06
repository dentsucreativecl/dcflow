/**
 * qa-lists.spec.ts
 * Agente QA: Módulo Listas (/lists/[listId])
 * Rol: superadmin
 * Cubre: carga, skeleton, navegación entre listas, vistas, tareas
 *
 * Bugs conocidos que debe detectar:
 *   - BUG-04: skeleton infinito al navegar lista A → lista B vía sidebar
 */

import { test, expect, Page } from '@playwright/test';

test.use({ storageState: '.playwright/auth/superadmin.json' });

// ─── Helper: navegar a primera lista disponible ───────────────────────────────

async function goToFirstList(page: Page): Promise<string> {
  await page.goto('/projects/');
  await page.waitForLoadState('networkidle');
  const firstRow = page.locator('table tbody tr').first();
  await firstRow.click();
  await page.waitForURL(/\/lists\//, { timeout: 10_000 });
  return page.url();
}

// ─── Carga inicial ────────────────────────────────────────────────────────────

test('lists: página carga con contenido (no skeleton infinito)', async ({ page }) => {
  const url = await goToFirstList(page);
  await page.waitForLoadState('networkidle');

  // El skeleton no debe seguir visible después de 5 segundos
  await page.waitForTimeout(3_000);
  const skeletons = page.locator('[class*="skeleton"], [class*="animate-pulse"]');
  const skeletonCount = await skeletons.count();
  expect(skeletonCount, 'No deben quedar skeletons visibles tras cargar').toBe(0);

  // Debe mostrar contenido real
  await expect(page.locator('h1, h2, [class*="title"]').first()).toBeVisible();
});

test('lists: muestra nombre del proyecto en header', async ({ page }) => {
  await goToFirstList(page);
  await page.waitForLoadState('networkidle');
  const header = page.locator('h1, h2').first();
  await expect(header).toBeVisible();
  const text = await header.innerText();
  expect(text.length).toBeGreaterThan(2);
});

// ─── BUG-04: Navegación entre listas ─────────────────────────────────────────

test('BUG-04: navegar lista A → lista B vía sidebar no queda en skeleton', async ({ page }) => {
  // Ir a primera lista
  await page.goto('/projects/');
  await page.waitForLoadState('networkidle');
  const rows = page.locator('table tbody tr');
  await rows.first().click();
  await page.waitForURL(/\/lists\//);
  const urlA = page.url();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1_000);

  // Expandir sidebar: buscar un cliente con listas
  const sidebarLinks = page.locator('aside [href*="/lists/"], nav [href*="/lists/"]');
  const count = await sidebarLinks.count();

  if (count < 2) {
    test.skip();
    return;
  }

  // Clic en segunda lista diferente
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
  await page.waitForTimeout(3_000); // dar tiempo suficiente para que resuelva

  // ASSERT: no skeleton infinito
  const skeletons = page.locator('[class*="skeleton"], [class*="animate-pulse"]');
  const skeletonCount = await skeletons.count();
  expect(skeletonCount, 'Navegar lista A→B no debe dejar skeleton infinito').toBe(0);

  // Debe haber contenido real
  await expect(page.locator('h1, h2').first()).toBeVisible();
});

// ─── Vistas ───────────────────────────────────────────────────────────────────

test('lists: vista lista por defecto muestra tareas agrupadas por estado', async ({ page }) => {
  await goToFirstList(page);
  await page.waitForLoadState('networkidle');
  // Deben aparecer agrupadores de estado
  const stateGroups = page.locator('[class*="group"], text=/Por Hacer|En Proceso|En Revisión|Completado/');
  await expect(stateGroups.first()).toBeVisible({ timeout: 8_000 });
});

test('lists: cambio a vista Kanban no da error', async ({ page }) => {
  await goToFirstList(page);
  await page.waitForLoadState('networkidle');
  // Buscar botones de toggle de vista
  const kanbanBtn = page.locator('[aria-label*="kanban"], [title*="kanban"], button').filter({ hasText: /kanban/i });
  const viewBtns = page.locator('[class*="view-toggle"] button, [class*="toolbar"] button').all();

  // Intentar click en segundo botón de vista si existe
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
  await page.waitForLoadState('networkidle');
  const search = page.getByPlaceholder('Buscar tareas...');
  await expect(search).toBeVisible();
  await search.fill('zzz_inexistente_xyz');
  await page.waitForTimeout(500);
  // No debe haber filas de tarea visibles
  const tasks = page.locator('[class*="task-row"], tbody tr');
  const count = await tasks.count();
  expect(count).toBe(0);
});

// ─── Nueva tarea ──────────────────────────────────────────────────────────────

test('lists: botón Nueva Tarea abre modal o inline', async ({ page }) => {
  await goToFirstList(page);
  await page.waitForLoadState('networkidle');
  const newTaskBtn = page.getByRole('button', { name: /Nueva Tarea/i });
  await expect(newTaskBtn).toBeVisible();
  await newTaskBtn.click();
  await page.waitForTimeout(500);
  // Debe aparecer modal o row de edición inline
  const dialog = page.locator('[role="dialog"]');
  const inlineInput = page.locator('input[placeholder*="tarea"], input[placeholder*="título"]');
  const appeared = (await dialog.isVisible()) || (await inlineInput.isVisible());
  expect(appeared).toBe(true);
});

// ─── Permisos ─────────────────────────────────────────────────────────────────

test.describe('lists como miembro', () => {
  test.use({ storageState: '.playwright/auth/miembro.json' });

  test('miembro: puede ver lista pero no crear tareas', async ({ page }) => {
    await goToFirstList(page);
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/404/);
    const newTaskBtn = page.getByRole('button', { name: /Nueva Tarea/i });
    await expect(newTaskBtn).not.toBeVisible();
  });
});
