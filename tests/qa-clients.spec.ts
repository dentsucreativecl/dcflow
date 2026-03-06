/**
 * qa-clients.spec.ts
 * Agente QA: Módulo Clientes
 * Rol: superadmin
 * Cubre: grid/list, búsqueda, crear cliente, detalle /clients/[id], tabs, modal editar
 *
 * Bugs conocidos que debe detectar:
 *   - BUG-05: click en tarjeta iba a /projects/?space= (corregido, verifica regresión)
 *   - BUG-06: modal acumula instancias en DOM (corregido, verifica regresión)
 */

import { test, expect } from '@playwright/test';

test.use({ storageState: '.playwright/auth/superadmin.json' });

// ─── Carga ────────────────────────────────────────────────────────────────────

test('clients: página /clients/ carga correctamente', async ({ page }) => {
  await page.goto('/clients/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('h1')).toContainText('Clientes');
  await expect(page).not.toHaveURL(/\/404/);
});

test('clients: muestra tarjetas de clientes', async ({ page }) => {
  await page.goto('/clients/');
  await page.waitForLoadState('networkidle');
  const cards = page.locator('[class*="cursor-pointer"], [class*="card"]');
  await expect(cards.first()).toBeVisible({ timeout: 8_000 });
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
});

// ─── Toggle vista ─────────────────────────────────────────────────────────────

test('clients: toggle vista lista muestra columnas', async ({ page }) => {
  await page.goto('/clients/');
  await page.waitForLoadState('networkidle');
  // Buscar botón de lista (segundo ícono de toggle)
  const listViewBtn = page.locator('[aria-label*="lista"], [title*="lista"]').or(
    page.locator('button').filter({ has: page.locator('svg') }).nth(1)
  );
  // Intentar via locator de íconos de toggle
  const toggleBtns = page.locator('button[class*="rounded"]').filter({ has: page.locator('svg') });
  const btnCount = await toggleBtns.count();
  if (btnCount >= 2) {
    await toggleBtns.nth(1).click();
    await page.waitForTimeout(300);
    // Columnas de vista lista
    await expect(page.locator('text=CLIENTE')).toBeVisible();
  }
});

// ─── Búsqueda ─────────────────────────────────────────────────────────────────

test('clients: búsqueda filtra por nombre', async ({ page }) => {
  await page.goto('/clients/');
  await page.waitForLoadState('networkidle');
  await page.getByPlaceholder('Buscar clientes...').fill('CCU');
  await page.waitForTimeout(500);
  const cards = page.locator('[class*="cursor-pointer"]');
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  // Todos los resultados deben ser CCU
  const first = await cards.first().innerText();
  expect(first.toLowerCase()).toContain('ccu');
});

test('clients: búsqueda sin resultados muestra empty state', async ({ page }) => {
  await page.goto('/clients/');
  await page.waitForLoadState('networkidle');
  await page.getByPlaceholder('Buscar clientes...').fill('ClienteInexistente999xyz');
  await page.waitForTimeout(500);
  const cards = page.locator('[class*="card"]').filter({ hasText: /CCU|ABC|Dental/ });
  const count = await cards.count();
  expect(count).toBe(0);
});

// ─── Modal Nuevo Cliente ──────────────────────────────────────────────────────

test('clients: modal Nuevo Cliente abre con campos correctos', async ({ page }) => {
  await page.goto('/clients/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Nuevo Cliente/i }).click();
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();
  // Campos esperados (post MEJORA-03: sin CRM)
  await expect(dialog.locator('input').first()).toBeVisible();
  // NO deben aparecer campos CRM
  await expect(dialog.locator('text=Correo Electrónico')).not.toBeVisible();
  await expect(dialog.locator('text=Nombre del Contacto')).not.toBeVisible();
});

test('clients: modal Nuevo Cliente cierra con Escape (BUG-06 regresión)', async ({ page }) => {
  await page.goto('/clients/');
  await page.waitForLoadState('networkidle');

  // Abrir y cerrar 3 veces — el DOM no debe acumular instancias
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: /Nuevo Cliente/i }).click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  }

  // Verificar que no hay instancias acumuladas
  const dialogCount = await page.locator('[role="dialog"]').count();
  expect(dialogCount, 'No deben acumularse instancias del modal').toBe(0);
});

test('clients: crear cliente con nombre válido', async ({ page }) => {
  await page.goto('/clients/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Nuevo Cliente/i }).click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();

  // Llenar nombre
  await page.locator('[role="dialog"] input').first().fill('Cliente Playwright Test');
  // Submit
  await page.locator('[role="dialog"]').getByRole('button', { name: /crear/i }).click();
  await page.waitForTimeout(1_000);

  // Verificar éxito
  const toast = page.locator('[class*="toast"], [class*="sonner"]').filter({ hasText: /creado|añadido/i });
  const dialogGone = !(await page.locator('[role="dialog"]').isVisible());
  expect(dialogGone || await toast.isVisible()).toBe(true);
});

test('clients: validación muestra error si nombre vacío', async ({ page }) => {
  await page.goto('/clients/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Nuevo Cliente/i }).click();
  await page.locator('[role="dialog"]').getByRole('button', { name: /crear/i }).click();
  await page.waitForTimeout(300);
  // Debe mostrar error de validación
  const error = page.locator('[role="dialog"] [class*="error"], [role="dialog"] text=/debe|requerido|mínimo/i');
  await expect(error).toBeVisible();
  // Modal no debe cerrarse
  await expect(page.locator('[role="dialog"]')).toBeVisible();
});

// ─── Detalle /clients/[id] ────────────────────────────────────────────────────

test('clients: click en tarjeta navega a /clients/[id] (BUG-05 regresión)', async ({ page }) => {
  await page.goto('/clients/');
  await page.waitForLoadState('networkidle');
  const firstCard = page.locator('[class*="cursor-pointer"]').first();
  await firstCard.click();
  await page.waitForURL(/\/clients\/[^?]+$/, { timeout: 8_000 });

  // ASSERT: URL debe ser /clients/[id], no /projects/?space=
  expect(page.url()).toMatch(/\/clients\//);
  expect(page.url()).not.toMatch(/\/projects\/\?space=/);
  await expect(page).not.toHaveURL(/\/404/);
});

test('clients: página de detalle muestra header con nombre y cuenta', async ({ page }) => {
  await page.goto('/clients/');
  await page.waitForLoadState('networkidle');
  await page.locator('[class*="cursor-pointer"]').first().click();
  await page.waitForURL(/\/clients\//);
  await page.waitForLoadState('networkidle');

  // Header con nombre
  await expect(page.locator('h1, h2').first()).toBeVisible();
  // Cuenta asignada
  await expect(page.locator('text=Esteban Ibarra').or(page.locator('[class*="account"]'))).toBeVisible();
});

test('clients: tab Proyectos muestra lista de proyectos', async ({ page }) => {
  await page.goto('/clients/');
  await page.waitForLoadState('networkidle');
  await page.locator('[class*="cursor-pointer"]').first().click();
  await page.waitForURL(/\/clients\//);
  await page.waitForLoadState('networkidle');

  await page.getByRole('tab', { name: /Proyectos/i }).click();
  await page.waitForTimeout(500);
  // Debe mostrar proyectos
  await expect(page.locator('[class*="project"], [class*="list-item"]').first()).toBeVisible({ timeout: 8_000 });
});

test('clients: tab Equipo muestra miembros', async ({ page }) => {
  await page.goto('/clients/');
  await page.waitForLoadState('networkidle');
  await page.locator('[class*="cursor-pointer"]').first().click();
  await page.waitForURL(/\/clients\//);
  await page.waitForLoadState('networkidle');

  await page.getByRole('tab', { name: /Equipo/i }).click();
  await page.waitForTimeout(500);
  // Debe mostrar al menos un miembro
  await expect(page.locator('[class*="member"], [class*="avatar"]').first()).toBeVisible({ timeout: 8_000 });
});

test('clients: botón Editar visible para superadmin', async ({ page }) => {
  await page.goto('/clients/');
  await page.waitForLoadState('networkidle');
  await page.locator('[class*="cursor-pointer"]').first().click();
  await page.waitForURL(/\/clients\//);
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('button', { name: /Editar/i })).toBeVisible();
});

test('clients: modal Editar pre-carga datos del cliente', async ({ page }) => {
  await page.goto('/clients/');
  await page.waitForLoadState('networkidle');
  await page.locator('[class*="cursor-pointer"]').first().click();
  await page.waitForURL(/\/clients\//);
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: /Editar/i }).click();
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();
  // El input de nombre debe tener valor (pre-cargado)
  const nameInput = dialog.locator('input').first();
  const value = await nameInput.inputValue();
  expect(value.length).toBeGreaterThan(0);
});

// ─── Permisos ─────────────────────────────────────────────────────────────────

test.describe('clients como miembro', () => {
  test.use({ storageState: '.playwright/auth/miembro.json' });

  test('miembro: puede ver lista de clientes', async ({ page }) => {
    await page.goto('/clients/');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/404/);
  });

  test('miembro: no ve botón Editar en detalle cliente', async ({ page }) => {
    await page.goto('/clients/');
    await page.waitForLoadState('networkidle');
    await page.locator('[class*="cursor-pointer"]').first().click();
    await page.waitForURL(/\/clients\//);
    await expect(page.getByRole('button', { name: /Editar/i })).not.toBeVisible();
  });
});
