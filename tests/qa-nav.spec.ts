/**
 * qa-nav.spec.ts
 * Agente QA: Navegación global, breadcrumbs y links rotos
 * Rol: superadmin
 * Cubre: todos los links del sidebar, breadcrumbs en cada módulo, 404s
 *
 * Bugs conocidos:
 *   - BUG-09: breadcrumb "Proyectos" dentro de /lists/[id] es solo texto (no link)
 *
 * NOTA: next.config.js tiene trailingSlash: true → todos los hrefs tienen "/"
 */

import { test, expect } from '@playwright/test';

test.use({ storageState: '.playwright/auth/superadmin.json' });

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function assertNoPageError(page: any) {
  await expect(page).not.toHaveURL(/\/404|not-found/, { timeout: 5_000 });
  expect(await page.title()).not.toContain('404');
}

/**
 * Navega a /projects/ y hace click en el primer proyecto de la lista.
 * Usa .divide-y > div para seleccionar filas reales (no botones del toolbar).
 */
async function goToFirstListViaProjects(page: any): Promise<void> {
  await page.goto('/projects/');
  await page.waitForSelector('.divide-y > div', { timeout: 20_000 });
  await page.locator('.divide-y > div').first().click();
  await page.waitForURL(/\/lists\//, { timeout: 20_000 });
}

/**
 * Navega a través de un link del sidebar.
 * IMPORTANTE: trailingSlash: true hace que todos los hrefs tengan "/" al final.
 */
async function clickSidebarLink(page: any, href: string): Promise<void> {
  await page.goto('/dashboard/');
  // href con trailing slash por next.config.js trailingSlash: true
  const link = page.locator(`[href="${href}"]`).first();
  await link.waitFor({ state: 'visible', timeout: 15_000 });
  await link.click();
}

// ─── Sidebar links ────────────────────────────────────────────────────────────

test('sidebar: Bandeja de entrada → /inbox/', async ({ page }) => {
  await clickSidebarLink(page, '/inbox/');
  await expect(page).toHaveURL(/\/inbox/);
  await assertNoPageError(page);
});

test('sidebar: Mis tareas → carga sin 404', async ({ page }) => {
  await clickSidebarLink(page, '/my-tasks/');
  await assertNoPageError(page);
});

test('sidebar: Proyectos → /projects/', async ({ page }) => {
  await clickSidebarLink(page, '/projects/');
  await expect(page).toHaveURL(/\/projects/);
  await assertNoPageError(page);
});

test('sidebar: Clientes → /clients/', async ({ page }) => {
  await clickSidebarLink(page, '/clients/');
  await expect(page).toHaveURL(/\/clients/);
  await assertNoPageError(page);
});

test('sidebar: Tareas → carga sin 404', async ({ page }) => {
  await clickSidebarLink(page, '/tasks/');
  await assertNoPageError(page);
});

test('sidebar: Equipo → /team/ (via icon bar)', async ({ page }) => {
  // La navegación al equipo es desde el icon bar (link en la barra de iconos)
  await page.goto('/dashboard/');
  const link = page.locator('[href="/team/"]').first();
  await link.waitFor({ state: 'visible', timeout: 15_000 });
  await link.click();
  await expect(page).toHaveURL(/\/team/);
  await assertNoPageError(page);
});

test('sidebar: Settings → carga sin 404', async ({ page }) => {
  await page.goto('/dashboard/');
  await page.locator('[href*="settings"]').first().waitFor({ state: 'visible', timeout: 10_000 });
  await page.locator('[href*="settings"]').first().click();
  await assertNoPageError(page);
});

// ─── Breadcrumbs ──────────────────────────────────────────────────────────────

test('BUG-09: breadcrumb "Proyectos" en /lists/[id] apunta a /projects/ (regresión)', async ({ page }) => {
  await goToFirstListViaProjects(page);
  // Breadcrumbs fix: "lists" segment → href="/projects/" not "/lists/"
  const breadcrumb = page.locator('nav a').filter({ hasText: /^Proyectos$/ }).first();
  await expect(breadcrumb).toBeVisible({ timeout: 5_000 });
  const href = await breadcrumb.getAttribute('href');
  expect(href, 'BUG-09: breadcrumb debe apuntar a /projects/ no a /lists/').toMatch(/\/projects/);
  expect(href).not.toMatch(/\/lists/);
});

test('breadcrumb: Breadcrumbs component muestra home icon', async ({ page }) => {
  await page.goto('/projects/');
  await page.waitForLoadState('load');
  // Breadcrumbs renderiza Home icon → /dashboard/
  const homeLink = page.locator('a[href="/dashboard/"]').first();
  await expect(homeLink).toBeVisible({ timeout: 5_000 });
});

test('breadcrumb: Home icon en /lists/[id] navega a /dashboard', async ({ page }) => {
  await goToFirstListViaProjects(page);
  const homeLink = page.locator('a[href="/dashboard/"]').first();
  await expect(homeLink).toBeVisible({ timeout: 5_000 });
  await homeLink.click();
  await expect(page).toHaveURL(/\/dashboard/);
  await assertNoPageError(page);
});

// ─── Rutas directas no deben dar 404 ─────────────────────────────────────────

const validRoutes = [
  '/dashboard/',
  '/projects/',
  '/clients/',
  '/team/',
  '/inbox/',
];

for (const route of validRoutes) {
  test(`ruta directa ${route} → no 404`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState('load');
    await expect(page).not.toHaveURL(/\/404|not-found/);
    expect(await page.title()).not.toContain('404');
  });
}

// ─── /lists/ sin ID ───────────────────────────────────────────────────────────

test('/lists/ sin ID → no muestra error Next.js desnudo', async ({ page }) => {
  await page.goto('/lists/');
  await page.waitForLoadState('load');
  const hasSidebar = await page.locator('[href="/inbox/"], [href="/projects/"]').isVisible();
  if (!hasSidebar) {
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('Application error: a client-side exception has occurred');
  }
  await expect(page).not.toHaveURL(/\/500/);
});

// ─── Navegación desde clients ─────────────────────────────────────────────────

test('clients: click en tarjeta navega a /clients/[id]', async ({ page }) => {
  await page.goto('/clients/');
  await page.waitForSelector('[class*="cursor-pointer"]', { timeout: 15_000 });
  await page.locator('[class*="cursor-pointer"]').first().click();
  await page.waitForURL(/\/clients\//, { timeout: 15_000 });
  await expect(page).not.toHaveURL(/\/404/);
});

test('lists: después de navegar a lista, sidebar links siguen visibles', async ({ page }) => {
  await goToFirstListViaProjects(page);
  const link = page.locator('[href="/inbox/"]').first();
  await expect(link).toBeVisible({ timeout: 10_000 });
});
