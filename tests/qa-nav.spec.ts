/**
 * qa-nav.spec.ts
 * Agente QA: Navegación global, breadcrumbs y links rotos
 * Rol: superadmin
 * Cubre: todos los links del sidebar, breadcrumbs en cada módulo, 404s
 *
 * Bugs conocidos que debe detectar:
 *   - BUG-09: breadcrumb "Proyectos" dentro de /lists/[id] apunta a /lists/ (404)
 */

import { test, expect } from '@playwright/test';

test.use({ storageState: '.playwright/auth/superadmin.json' });

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function assertNoPageError(page: any, url: string) {
  const status = page.url();
  await expect(page).not.toHaveURL(/\/404|not-found/, {
    timeout: 5_000,
  });
  const title = await page.title();
  expect(title).not.toContain('404');
}

// ─── Sidebar links ────────────────────────────────────────────────────────────

test('sidebar: Bandeja de entrada → /inbox/', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('link', { name: 'Bandeja de entrada' }).click();
  await expect(page).toHaveURL(/\/inbox/);
  await assertNoPageError(page, '/inbox/');
});

test('sidebar: Mis tareas → carga sin 404', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('link', { name: 'Mis tareas' }).click();
  await expect(page).not.toHaveURL(/\/404/);
  await assertNoPageError(page, '');
});

test('sidebar: Proyectos → /projects/', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('link', { name: 'Proyectos' }).click();
  await expect(page).toHaveURL(/\/projects/);
  await assertNoPageError(page, '/projects/');
});

test('sidebar: Clientes → /clients/', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('link', { name: 'Clientes' }).click();
  await expect(page).toHaveURL(/\/clients/);
  await assertNoPageError(page, '/clients/');
});

test('sidebar: Tareas → carga sin 404', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('link', { name: 'Tareas' }).click();
  await expect(page).not.toHaveURL(/\/404/);
});

test('sidebar: Equipo → /team/', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('link', { name: 'Equipo' }).click();
  await expect(page).toHaveURL(/\/team/);
  await assertNoPageError(page, '/team/');
});

test('sidebar: Settings → /settings/', async ({ page }) => {
  await page.goto('/dashboard');
  const settingsLink = page.locator('[href*="settings"]').first();
  await settingsLink.click();
  await expect(page).not.toHaveURL(/\/404/);
});

// ─── Breadcrumbs ──────────────────────────────────────────────────────────────

test('breadcrumb: Home en /projects/ → /dashboard', async ({ page }) => {
  await page.goto('/projects/');
  const homeLink = page.locator('nav a[href="/dashboard"], nav a[href="/"]').first();
  const href = await homeLink.getAttribute('href');
  expect(href).not.toBeNull();
  await homeLink.click();
  await expect(page).not.toHaveURL(/\/404/);
});

test('BUG-09: breadcrumb "Proyectos" dentro de una lista → /projects/ (no /lists/)', async ({ page }) => {
  // Entrar a una lista vía sidebar
  await page.goto('/projects/');
  await page.waitForLoadState('networkidle');
  // Click en el primer proyecto de la lista
  const firstProject = page.locator('table tbody tr, [data-testid*="project-row"]').first();
  await firstProject.click();
  await page.waitForURL(/\/lists\//);

  // Localizar el breadcrumb que dice "Proyectos"
  const breadcrumb = page.locator('nav a, [aria-label*="breadcrumb"] a').filter({ hasText: 'Proyectos' });
  const href = await breadcrumb.getAttribute('href');

  // ASSERT: debe apuntar a /projects/, NO a /lists/
  expect(href, 'breadcrumb Proyectos debe apuntar a /projects/').toMatch(/\/projects/);
  expect(href, 'breadcrumb Proyectos NO debe apuntar a /lists/').not.toMatch(/\/lists/);

  // Verificar que el click no lleva a 404
  await breadcrumb.click();
  await expect(page).not.toHaveURL(/\/404|not-found/);
  await expect(page).toHaveURL(/\/projects/);
});

test('breadcrumb: Home en /lists/[id] → dashboard sin 404', async ({ page }) => {
  await page.goto('/projects/');
  await page.waitForLoadState('networkidle');
  const firstProject = page.locator('table tbody tr, [class*="cursor-pointer"]').first();
  await firstProject.click();
  await page.waitForURL(/\/lists\//);

  const homeCrumb = page.locator('nav a[href="/dashboard"], nav a[href="/"]').first();
  await homeCrumb.click();
  await expect(page).not.toHaveURL(/\/404/);
});

test('breadcrumb: Home en /clients/[id] → dashboard sin 404', async ({ page }) => {
  await page.goto('/clients/');
  await page.waitForLoadState('networkidle');
  const firstClient = page.locator('[class*="cursor-pointer"]').first();
  await firstClient.click();
  await page.waitForURL(/\/clients\//);

  const homeCrumb = page.locator('nav a[href="/dashboard"], nav a[href="/"]').first();
  await homeCrumb.click();
  await expect(page).not.toHaveURL(/\/404/);
});

// ─── Rutas directas no deben dar 404 ─────────────────────────────────────────

const validRoutes = [
  '/dashboard',
  '/projects/',
  '/clients/',
  '/team/',
  '/inbox/',
];

for (const route of validRoutes) {
  test(`ruta directa ${route} → no 404`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/404|not-found/);
    const title = await page.title();
    expect(title).not.toContain('404');
  });
}

// ─── Rutas sin index esperan redirect, no 404 ─────────────────────────────────

test('/lists/ sin ID → redirect a /projects/ o /dashboard (no 404 desnudo)', async ({ page }) => {
  await page.goto('/lists/');
  await page.waitForLoadState('networkidle');
  // Debe redirigir, no quedarse en un 404 pelado sin shell de la app
  const bodyText = await page.locator('body').innerText();
  // Si hay 404 de Next.js raw (sin layout), es un problema
  const isRawNextjsError = bodyText.includes('This page could not be found') && !(await page.locator('[data-testid="sidebar"], nav').isVisible());
  expect(isRawNextjsError, '/lists/ no debería mostrar 404 sin layout de la app').toBe(false);
});
