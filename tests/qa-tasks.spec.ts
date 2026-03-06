/**
 * qa-tasks.spec.ts
 * Agente QA: Tareas (dentro de lista) + Bandeja de Entrada
 * Rol: superadmin + miembro
 * Cubre: crear tarea, cambiar estado, asignar usuario, comentarios, inbox
 */

import { test, expect, Page } from '@playwright/test';

test.use({ storageState: '.playwright/auth/superadmin.json' });

// ─── Helper ───────────────────────────────────────────────────────────────────

async function goToListWithTasks(page: Page): Promise<void> {
  await page.goto('/projects/');
  await page.waitForLoadState('networkidle');
  await page.locator('table tbody tr').first().click();
  await page.waitForURL(/\/lists\//);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1_000);
}

// ─── Crear tarea ──────────────────────────────────────────────────────────────

test('tasks: crear tarea con título muestra tarea en lista', async ({ page }) => {
  await goToListWithTasks(page);
  const taskName = `Tarea PW ${Date.now()}`;

  await page.getByRole('button', { name: /Nueva Tarea/i }).click();
  await page.waitForTimeout(300);

  const dialog = page.locator('[role="dialog"]');
  const inlineInput = page.locator('input[placeholder*="título"], input[placeholder*="tarea"]');

  if (await dialog.isVisible()) {
    await dialog.locator('input').first().fill(taskName);
    await dialog.getByRole('button', { name: /crear|guardar/i }).click();
  } else if (await inlineInput.isVisible()) {
    await inlineInput.fill(taskName);
    await page.keyboard.press('Enter');
  }

  await page.waitForTimeout(1_000);
  await expect(page.locator(`text=${taskName}`)).toBeVisible({ timeout: 8_000 });
});

test('tasks: crear tarea sin título muestra error de validación', async ({ page }) => {
  await goToListWithTasks(page);
  await page.getByRole('button', { name: /Nueva Tarea/i }).click();
  await page.waitForTimeout(300);

  const dialog = page.locator('[role="dialog"]');
  if (await dialog.isVisible()) {
    await dialog.getByRole('button', { name: /crear|guardar/i }).click();
    await page.waitForTimeout(300);
    const error = dialog.locator('[class*="error"], text=/requerido|obligatorio|mínimo/i');
    await expect(error).toBeVisible();
    await expect(dialog).toBeVisible(); // modal no cierra
  }
});

// ─── Cambiar estado ───────────────────────────────────────────────────────────

test('tasks: cambiar estado de tarea actualiza UI', async ({ page }) => {
  await goToListWithTasks(page);

  // Buscar primera tarea "Por Hacer"
  const porhacerSection = page.locator('text=Por Hacer').first();
  await expect(porhacerSection).toBeVisible({ timeout: 8_000 });

  // Primer badge de estado clickeable
  const statusBadge = page.locator('[class*="status"], [class*="badge"]').filter({ hasText: /Por Hacer/i }).first();
  if (await statusBadge.isVisible()) {
    await statusBadge.click();
    await page.waitForTimeout(300);
    // Debe aparecer dropdown de estados
    const dropdown = page.locator('[role="menu"], [role="listbox"]');
    await expect(dropdown).toBeVisible({ timeout: 3_000 });
    // Seleccionar "En Proceso"
    await dropdown.locator('text=/En Proceso/i').click();
    await page.waitForTimeout(500);
    // El badge debe actualizarse
    await expect(page.locator('[class*="status"]').filter({ hasText: /En Proceso/i }).first()).toBeVisible();
  }
});

// ─── Abrir detalle de tarea ───────────────────────────────────────────────────

test('tasks: click en tarea abre panel de detalle', async ({ page }) => {
  await goToListWithTasks(page);

  // Click en título de primera tarea
  const firstTask = page.locator('table tbody tr, [class*="task-row"]').first();
  await firstTask.click();
  await page.waitForTimeout(500);

  // Debe abrirse panel lateral o modal
  const detail = page.locator('[class*="detail"], [class*="panel"], [role="dialog"]');
  await expect(detail).toBeVisible({ timeout: 5_000 });
});

// ─── Asignar usuario ──────────────────────────────────────────────────────────

test('tasks: panel de detalle permite asignar usuario', async ({ page }) => {
  await goToListWithTasks(page);
  const firstTask = page.locator('table tbody tr, [class*="task-row"]').first();
  await firstTask.click();
  await page.waitForTimeout(500);

  const assignBtn = page.locator('button').filter({ hasText: /Asignar|Assignee|Sin asignar/i }).first();
  if (await assignBtn.isVisible()) {
    await assignBtn.click();
    await page.waitForTimeout(300);
    const userOptions = page.locator('[role="option"], [class*="user-option"]');
    await expect(userOptions.first()).toBeVisible({ timeout: 5_000 });
    await userOptions.first().click();
    await page.waitForTimeout(500);
    await expect(page).not.toHaveURL(/\/404/);
  }
});

// ─── INBOX ────────────────────────────────────────────────────────────────────

test('inbox: carga con notificaciones', async ({ page }) => {
  await page.goto('/inbox/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('h1')).toContainText('Bandeja');
  await expect(page).not.toHaveURL(/\/404/);
});

test('inbox: filtro "Todas" muestra notificaciones', async ({ page }) => {
  await page.goto('/inbox/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Todas/i }).click();
  await page.waitForTimeout(300);
  const items = page.locator('[class*="notification"], [class*="inbox-item"], [class*="cursor-pointer"]');
  await expect(items.first()).toBeVisible({ timeout: 8_000 });
});

test('inbox: "Marcar todas leídas" vacía el filtro No leídas', async ({ page }) => {
  await page.goto('/inbox/');
  await page.waitForLoadState('networkidle');

  // Asegurar que hay no leídas
  await page.getByRole('button', { name: /Todas/i }).click();
  await page.waitForTimeout(300);

  // Marcar todas
  await page.getByRole('button', { name: /Marcar todas leídas/i }).click();
  await page.waitForTimeout(500);

  // Ir a No leídas
  await page.getByRole('button', { name: /No leídas/i }).click();
  await page.waitForTimeout(300);

  // Debe estar vacío
  const emptyState = page.locator('text=/no hay notificaciones|sin notificaciones/i');
  await expect(emptyState).toBeVisible({ timeout: 5_000 });
});

test('inbox: notificaciones tienen distintos tipos', async ({ page }) => {
  await page.goto('/inbox/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Todas/i }).click();
  await page.waitForTimeout(300);

  // Debe haber al menos "Cambio de estado"
  await expect(page.locator('text=Cambio de estado').first()).toBeVisible({ timeout: 5_000 });
});

test('inbox: badge "UNASSIGNED" debe estar en español', async ({ page }) => {
  await page.goto('/inbox/');
  await page.waitForLoadState('networkidle');

  // Buscar si existe el badge en inglés
  const englishBadge = page.locator('text=UNASSIGNED');
  const count = await englishBadge.count();
  expect(count, 'El badge "UNASSIGNED" debe estar en español ("Sin asignar")').toBe(0);
});

// ─── Permisos ─────────────────────────────────────────────────────────────────

test.describe('tasks como miembro', () => {
  test.use({ storageState: '.playwright/auth/miembro.json' });

  test('miembro: ve sus notificaciones en inbox', async ({ page }) => {
    await page.goto('/inbox/');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/404/);
    await expect(page.locator('h1')).toContainText('Bandeja');
  });

  test('miembro: puede ver tareas en lista', async ({ page }) => {
    await goToListWithTasks(page);
    await expect(page).not.toHaveURL(/\/404/);
    const tasks = page.locator('table tbody tr, [class*="task-row"]');
    await expect(tasks.first()).toBeVisible({ timeout: 8_000 });
  });
});
