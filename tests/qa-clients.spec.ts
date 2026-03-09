/**
 * qa-clients.spec.ts
 * Agente QA: Módulo Clientes
 * Rol: superadmin
 * Cubre: grid/list, búsqueda, crear cliente, detalle /clients/[id], tabs, editar
 *
 * Bugs conocidos:
 *   - BUG-05: click en tarjeta iba a /projects/?space= (regresión)
 *   - BUG-06: modal acumula instancias en DOM (regresión)
 */

import { test, expect, Page } from '@playwright/test';

test.use({ storageState: '.playwright/auth/superadmin.json' });

// ─── Helper ───────────────────────────────────────────────────────────────────

async function goToFirstClient(page: Page): Promise<void> {
  await page.goto('/clients/');
  await page.waitForLoadState('load');
  // Wait for loading spinner to disappear (Supabase data loaded)
  await page.waitForFunction(
    () => !document.querySelector('.animate-spin'),
    { timeout: 15_000 }
  ).catch(() => {});
  // Click first client card — uses hover:border-primary class unique to grid cards
  await page.locator('[class*="hover\\:border-primary"]').first().click();
  // Require UUID-like segment after /clients/ to confirm navigation to detail page
  await page.waitForURL(/\/clients\/[a-z0-9-]{8,}/, { timeout: 15_000 });
  // Wait for client detail content to fully render (h1 shows after data loads)
  await page.waitForSelector('h1', { timeout: 10_000 });
}

// ─── Carga ────────────────────────────────────────────────────────────────────

test('clients: página /clients/ carga correctamente', async ({ page }) => {
  await page.goto('/clients/');
  await page.waitForLoadState('load');
  await expect(page.locator('h1')).toContainText('Clientes');
  await expect(page).not.toHaveURL(/\/404/);
});

test('clients: muestra tarjetas de clientes', async ({ page }) => {
  await page.goto('/clients/');
  await page.waitForLoadState('load');
  const cards = page.locator('[class*="cursor-pointer"], [class*="card"]');
  await expect(cards.first()).toBeVisible({ timeout: 8_000 });
  expect(await cards.count()).toBeGreaterThan(0);
});

// ─── Toggle vista ─────────────────────────────────────────────────────────────

test('clients: toggle vista lista muestra filas', async ({ page }) => {
  await page.goto('/clients/');
  await page.waitForLoadState('load');
  const toggleBtns = page.locator('button[class*="rounded"]').filter({ has: page.locator('svg') });
  if (await toggleBtns.count() >= 2) {
    await toggleBtns.nth(1).click();
    await page.waitForTimeout(300);
    await expect(page.locator('[class*="cursor-pointer"]').first()).toBeVisible({ timeout: 5_000 });
  }
});

// ─── Búsqueda ─────────────────────────────────────────────────────────────────

test('clients: búsqueda filtra por nombre', async ({ page }) => {
  await page.goto('/clients/');
  await page.waitForLoadState('load');
  await page.getByPlaceholder('Buscar clientes...').fill('CCU');
  await page.waitForTimeout(500);
  const cards = page.locator('[class*="cursor-pointer"]');
  expect(await cards.count()).toBeGreaterThan(0);
  const texts = await cards.allInnerTexts();
  expect(texts.some(t => t.toLowerCase().includes('ccu'))).toBe(true);
});

test('clients: búsqueda sin resultados muestra estado vacío', async ({ page }) => {
  await page.goto('/clients/');
  await page.waitForLoadState('load');
  await page.getByPlaceholder('Buscar clientes...').fill('ClienteInexistente999xyz');
  await page.waitForTimeout(500);
  // Cuando no hay resultados, se muestra texto de estado vacío
  await expect(page.getByText('No se encontraron clientes')).toBeVisible({ timeout: 5_000 });
});

// ─── Modal Nuevo Cliente ──────────────────────────────────────────────────────

test('clients: modal Nuevo Cliente abre con campos correctos', async ({ page }) => {
  await page.goto('/clients/');
  await page.waitForLoadState('load');
  await page.getByRole('button', { name: /Nuevo Cliente/i }).click();
  await page.waitForSelector('[role="dialog"][data-state="open"]', { timeout: 10_000 });
  const dialog = page.locator('[role="dialog"][data-state="open"]').first();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('input').first()).toBeVisible();
  await expect(dialog.locator('text=Correo Electrónico')).not.toBeVisible();
  await expect(dialog.locator('text=Nombre del Contacto')).not.toBeVisible();
});

test('clients: modal Nuevo Cliente cierra con Escape (BUG-06 regresión)', async ({ page }) => {
  await page.goto('/clients/');
  await page.waitForLoadState('load');

  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: /Nuevo Cliente/i }).click();
    await expect(page.locator('[role="dialog"][data-state="open"]').first()).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    await expect(page.locator('[role="dialog"][data-state="open"]').first()).not.toBeVisible();
  }

  const openDialogs = page.locator('[role="dialog"][data-state="open"]');
  expect(await openDialogs.count()).toBe(0);
});

test('clients: crear cliente con nombre válido', async ({ page }) => {
  await page.goto('/clients/');
  await page.waitForLoadState('load');
  await page.getByRole('button', { name: /Nuevo Cliente/i }).click();
  await page.waitForSelector('[role="dialog"][data-state="open"]', { timeout: 10_000 });
  const dialog = page.locator('[role="dialog"][data-state="open"]').first();
  await expect(dialog).toBeVisible();
  await dialog.locator('input').first().fill('Cliente Playwright Test');
  await dialog.locator('[type="submit"]').click({ force: true });
  await page.waitForTimeout(1_000);
  const dialogGone = !(await dialog.isVisible());
  const toast = page.locator('[class*="toast"], [class*="sonner"]').filter({ hasText: /creado|añadido/i });
  expect(dialogGone || await toast.isVisible()).toBe(true);
});

test('clients: validación muestra error si nombre vacío', async ({ page }) => {
  await page.goto('/clients/');
  await page.waitForLoadState('load');
  await page.getByRole('button', { name: /Nuevo Cliente/i }).click();
  await page.waitForSelector('[role="dialog"][data-state="open"]', { timeout: 10_000 });
  const dialog = page.locator('[role="dialog"][data-state="open"]').first();
  await dialog.locator('[type="submit"]').click({ force: true });
  await page.waitForTimeout(500);
  // Validation error text from react-hook-form (min 2 chars rule)
  await expect(page.getByText(/al menos 2 caracteres/i)).toBeVisible({ timeout: 5_000 });
  await expect(dialog).toBeVisible();
});

// ─── Detalle /clients/[id] ────────────────────────────────────────────────────

test('clients: click en tarjeta navega a /clients/[id] (BUG-05 regresión)', async ({ page }) => {
  await page.goto('/clients/');
  await page.waitForLoadState('load');
  await page.waitForFunction(
    () => !document.querySelector('.animate-spin'),
    { timeout: 15_000 }
  ).catch(() => {});
  await page.locator('[class*="hover\\:border-primary"]').first().click();
  await page.waitForURL(/\/clients\/[a-z0-9-]{8,}/, { timeout: 15_000 });
  expect(page.url()).toMatch(/\/clients\/[a-z0-9-]{8,}/);
  expect(page.url()).not.toMatch(/\/projects\/\?space=/);
  await expect(page).not.toHaveURL(/\/404/);
});

test('clients: página de detalle muestra header con nombre', async ({ page }) => {
  await goToFirstClient(page);
  await expect(page.locator('h1, h2').first()).toBeVisible();
  const text = await page.locator('h1, h2').first().innerText();
  expect(text.length).toBeGreaterThan(0);
});

test('clients: tab Proyectos muestra lista de proyectos', async ({ page }) => {
  await goToFirstClient(page);
  // Tab button has badge count appended: "Proyectos 3" — use hasText instead of exact name match
  await page.locator('button').filter({ hasText: /^Proyectos/ }).click();
  await page.waitForTimeout(500);
  const items = page.locator('a[href*="/lists/"], [class*="project"]');
  await expect(items.first()).toBeVisible({ timeout: 8_000 });
});

test('clients: tab Equipo muestra miembros', async ({ page }) => {
  await goToFirstClient(page);
  // Tab button has badge count appended: "Equipo 26" — use hasText instead of exact name match
  await page.locator('button').filter({ hasText: /^Equipo/ }).click();
  await page.waitForTimeout(500);
  // Member rows use rounded-full initials divs — no "avatar" or "member" class
  const members = page.locator('[class*="rounded-full"]');
  await expect(members.first()).toBeVisible({ timeout: 8_000 });
});

test('clients: botón Editar visible para superadmin', async ({ page }) => {
  await goToFirstClient(page);
  await expect(page.getByRole('button', { name: /^Editar$/i })).toBeVisible();
});

test('clients: editar cliente pre-carga datos del cliente', async ({ page }) => {
  await goToFirstClient(page);
  await page.getByRole('button', { name: /^Editar$/i }).click();
  await page.waitForTimeout(300);
  await expect(page.locator('text=Editar Cliente')).toBeVisible();
  const nameInput = page.locator('input').first();
  const value = await nameInput.inputValue();
  expect(value.length).toBeGreaterThan(0);
});

// ─── Permisos ─────────────────────────────────────────────────────────────────

test.describe('clients como miembro', () => {
  test.use({ storageState: '.playwright/auth/miembro.json' });

  test('miembro: puede ver lista de clientes', async ({ page }) => {
    await page.goto('/clients/');
    await page.waitForLoadState('load');
    await expect(page).not.toHaveURL(/\/404/);
  });

  test('miembro: no ve botón Editar en detalle cliente', async ({ page }) => {
    await page.goto('/clients/');
    await page.waitForLoadState('load');
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 15_000 }
    ).catch(() => {});
    await page.locator('[class*="hover\\:border-primary"]').first().click();
    await page.waitForURL(/\/clients\/[a-z0-9-]{8,}/, { timeout: 15_000 });
    await page.waitForSelector('h1', { timeout: 10_000 });
    await expect(page.getByRole('button', { name: /^Editar$/i })).not.toBeVisible();
  });
});
