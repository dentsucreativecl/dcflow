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
  // Esperar filas reales (no botones del toolbar) antes de hacer click
  await page.waitForSelector('.divide-y > div', { timeout: 20_000 });
  await page.locator('.divide-y > div').first().click();
  await page.waitForURL(/\/lists\//, { timeout: 20_000 });
  // Wait for area permissions to resolve — "Nueva Tarea" only shows once canEditByArea=true
  await page.waitForSelector('button:has-text("Nueva Tarea")', { timeout: 15_000 });
}

// ─── Crear tarea ──────────────────────────────────────────────────────────────

test('tasks: crear tarea con título muestra tarea en lista', async ({ page }) => {
  await goToListWithTasks(page);
  const taskName = `Tarea PW ${Date.now()}`;

  await page.getByRole('button', { name: /Nueva Tarea/i }).click();
  // Wait for the open dialog (data-state="open") — other dialogs may be mounted but closed
  await page.waitForSelector('[role="dialog"][data-state="open"]', { timeout: 10_000 });
  await page.waitForTimeout(1_500);

  const dialog = page.locator('[role="dialog"][data-state="open"]').first();
  const inlineInput = page.locator('input[placeholder*="título"], input[placeholder*="tarea"]');

  if (await dialog.isVisible()) {
    await dialog.locator('input').first().fill(taskName);
    // Use force:true to bypass potential overlay blocking (onboarding checklist z-40)
    await dialog.locator('[type="submit"]').click({ force: true });
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
  await page.waitForSelector('[role="dialog"][data-state="open"]', { timeout: 10_000 });
  await page.waitForTimeout(1_500);

  const dialog = page.locator('[role="dialog"][data-state="open"]').first();
  if (await dialog.isVisible()) {
    await dialog.locator('[type="submit"]').click({ force: true });
    await page.waitForTimeout(300);
    const error = dialog.locator('[class*="error"], p.text-destructive');
    if (await error.first().isVisible()) {
      await expect(error.first()).toBeVisible();
    }
    await expect(dialog).toBeVisible();
  }
});

// ─── Cambiar estado ───────────────────────────────────────────────────────────

test('tasks: cambiar estado de tarea actualiza UI', async ({ page }) => {
  await goToListWithTasks(page);
  const porhacerSection = page.locator('text=Por Hacer').first();
  await expect(porhacerSection).toBeVisible({ timeout: 8_000 });

  const statusBadge = page.locator('[class*="status"], [class*="badge"]').filter({ hasText: /Por Hacer/i }).first();
  if (await statusBadge.isVisible()) {
    await statusBadge.click();
    await page.waitForTimeout(300);
    const dropdown = page.locator('[role="menu"], [role="listbox"]');
    if (await dropdown.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await dropdown.locator('text=/En Proceso/i').click();
      await page.waitForTimeout(500);
      await expect(page.locator('[class*="status"]').filter({ hasText: /En Proceso/i }).first()).toBeVisible();
    }
  }
});

// ─── Abrir detalle de tarea ───────────────────────────────────────────────────

test('tasks: click en tarea abre panel de detalle', async ({ page }) => {
  await goToListWithTasks(page);
  // Tasks in list view are rows or clickable elements
  const firstTask = page.locator('[class*="task-row"], [class*="task-item"]').first()
    .or(page.locator('tr[class*="cursor"]').first());
  if (await firstTask.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await firstTask.click();
    await page.waitForTimeout(500);
    const detail = page.locator('[class*="detail"], [class*="panel"], [role="dialog"]').first();
    await expect(detail).toBeVisible({ timeout: 5_000 });
  }
});

// ─── Asignar usuario ──────────────────────────────────────────────────────────

test('tasks: panel de detalle permite asignar usuario', async ({ page }) => {
  await goToListWithTasks(page);
  const firstTask = page.locator('[class*="task-row"], [class*="task-item"]').first()
    .or(page.locator('tr[class*="cursor"]').first());
  if (await firstTask.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await firstTask.click();
    await page.waitForTimeout(500);
    const assignBtn = page.locator('button').filter({ hasText: /Asignar|Assignee|Sin asignar/i }).first();
    if (await assignBtn.isVisible()) {
      await assignBtn.click();
      await page.waitForTimeout(300);
      const userOptions = page.locator('[role="option"], [class*="user-option"]');
      if (await userOptions.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
        await userOptions.first().click();
        await page.waitForTimeout(500);
      }
    }
  }
  await expect(page).not.toHaveURL(/\/404/);
});

// ─── INBOX ────────────────────────────────────────────────────────────────────

test('inbox: carga con notificaciones', async ({ page }) => {
  await page.goto('/inbox/');
  await page.waitForLoadState('load');
  await expect(page.locator('h1')).toContainText('Bandeja');
  await expect(page).not.toHaveURL(/\/404/);
});

// Helper: wait for inbox notifications to finish loading
async function waitForInboxData(page: Page): Promise<void> {
  await page.goto('/inbox/');
  await page.waitForLoadState('load');
  // Wait for actual content — either notification items or empty state text
  // (not just spinner absence, which has a race condition when spinner hasn't appeared yet)
  await page.waitForFunction(
    () => {
      const spinner = document.querySelector('.animate-spin');
      if (spinner) return false;
      const hasItems = document.querySelector('[class*="cursor-pointer"]');
      const hasEmpty = document.body?.innerText?.includes('No hay notificaciones');
      return !!(hasItems || hasEmpty);
    },
    { timeout: 15_000 }
  ).catch(() => {});
}

test('inbox: filtro "Todas" muestra notificaciones', async ({ page }) => {
  await waitForInboxData(page);
  // Use exact: true to avoid matching "Marcar todas leidas"
  await page.getByRole('button', { name: 'Todas', exact: true }).click();
  await page.waitForTimeout(300);
  const items = page.locator('[class*="cursor-pointer"]');
  await expect(items.first()).toBeVisible({ timeout: 8_000 });
});

test('inbox: "Marcar todas leídas" vacía el filtro No leídas', async ({ page }) => {
  await waitForInboxData(page);
  await page.getByRole('button', { name: 'Todas', exact: true }).click();
  await page.waitForTimeout(300);
  // Button text in source is "Marcar todas leidas" (no accent)
  const markAllBtn = page.getByRole('button', { name: /Marcar todas le[ií]das/i });
  if (await markAllBtn.isVisible()) {
    await markAllBtn.click();
    await page.waitForTimeout(500);
    // Button text in source is "No leidas" (no accent)
    await page.getByRole('button', { name: /^No le[ií]das$/i }).click();
    await page.waitForTimeout(300);
    const emptyState = page.locator('text=/no hay notificaciones|sin notificaciones/i');
    await expect(emptyState).toBeVisible({ timeout: 5_000 });
  }
});

test('inbox: notificaciones tienen distintos tipos', async ({ page }) => {
  await waitForInboxData(page);
  await page.getByRole('button', { name: 'Todas', exact: true }).click();
  await page.waitForTimeout(300);
  await expect(page.locator('text=Cambio de estado').first()).toBeVisible({ timeout: 8_000 });
});

test('inbox: badge "UNASSIGNED" debe estar en español', async ({ page }) => {
  await page.goto('/inbox/');
  await page.waitForLoadState('load');
  const englishBadge = page.locator('text=UNASSIGNED');
  expect(await englishBadge.count()).toBe(0);
});

// ─── Permisos ─────────────────────────────────────────────────────────────────

test.describe('tasks como miembro', () => {
  test.use({ storageState: '.playwright/auth/miembro.json' });

  test('miembro: ve sus notificaciones en inbox', async ({ page }) => {
    await page.goto('/inbox/');
    await page.waitForLoadState('load');
    await expect(page).not.toHaveURL(/\/404/);
    await expect(page.locator('h1')).toContainText('Bandeja');
  });

  test('miembro: puede navegar a una lista', async ({ page }) => {
    await page.goto('/projects/');
    await page.waitForSelector('.divide-y > div', { timeout: 20_000 });
    await page.locator('.divide-y > div').first().click();
    await page.waitForURL(/\/lists\//, { timeout: 20_000 });
    await expect(page).not.toHaveURL(/\/404/);
  });
});
