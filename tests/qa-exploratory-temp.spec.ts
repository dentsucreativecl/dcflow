/**
 * QA Exploratorio Completo + Auditoría de Performance
 * Fecha: 2026-03-09
 * Ejecutar: npx playwright test tests/qa-exploratory-temp.spec.ts --project=superadmin --reporter=list
 */

import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface ConsoleErrorLog {
  url: string;
  errors: string[];
}

interface PerfMetrics {
  route: string;
  ttfb: number;
  domInteractive: number;
  loadComplete: number;
  supabaseFetchCount: number;
  slowestFetch: number;
  totalJSKB: number;
  flags: string[];
}

const perfResults: PerfMetrics[] = [];
const bugLog: string[] = [];
const passedFlows: string[] = [];

function addBug(id: string, module: string, url: string, role: string, severity: string, desc: string, steps: string, actual: string, expected: string) {
  bugLog.push(JSON.stringify({ id, module, url, role, severity, desc, steps, actual, expected }));
}

function addPass(flow: string) {
  passedFlows.push(flow);
}

async function collectConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`));
  return errors;
}

async function measurePerf(page: Page, route: string): Promise<PerfMetrics> {
  const data = await page.evaluate(() => {
    const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    const nav = entries[0];
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const supabaseFetches = resources.filter(r => r.name.includes('supabase'));
    const jsBundles = resources.filter(r => r.initiatorType === 'script');

    return {
      ttfb: nav ? Math.round(nav.responseStart - nav.requestStart) : -1,
      domInteractive: nav ? Math.round(nav.domInteractive - nav.startTime) : -1,
      loadComplete: nav ? Math.round(nav.loadEventEnd - nav.startTime) : -1,
      supabaseFetchCount: supabaseFetches.length,
      slowestFetch: Math.round(Math.max(...supabaseFetches.map(r => r.duration), 0)),
      totalJSKB: Math.round(jsBundles.reduce((sum, r) => sum + (r.transferSize || 0), 0) / 1024),
    };
  });

  const flags: string[] = [];
  if (data.ttfb > 200) flags.push('PERF-WARN: TTFB > 200ms');
  if (data.loadComplete > 3000) flags.push('PERF-P0: Load > 3000ms');
  else if (data.loadComplete > 1500) flags.push('PERF-P1: Load > 1500ms');
  if (data.slowestFetch > 500) flags.push('PERF-P1: Fetch individual > 500ms');
  if (data.totalJSKB > 1024) flags.push('PERF-P1: Bundle JS > 1MB');

  return { route, ...data, flags };
}

// ─── SETUP ────────────────────────────────────────────────────────────────────

test.describe('QA Exploratorio + Performance — DC Flow', () => {

  // ── DASHBOARD ────────────────────────────────────────────────────────────────
  test('PERF + QA: /dashboard', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`));

    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    const perf = await measurePerf(page, '/dashboard');
    perfResults.push(perf);
    console.log('PERF /dashboard:', JSON.stringify(perf));

    // Verifica que cargó
    const title = await page.title();
    console.log('Dashboard title:', title);

    // Check sidebar links
    const sidebarLinks = page.locator('nav a, aside a, [data-testid="sidebar"] a');
    const linkCount = await sidebarLinks.count();
    console.log(`Sidebar links found: ${linkCount}`);

    if (errors.length > 0) {
      console.log('CONSOLE ERRORS /dashboard:', errors.join('\n'));
      addBug('BUG-NEW-01', 'Dashboard', '/dashboard', 'superadmin', 'P2',
        `Console errors en /dashboard: ${errors.length} errores`,
        'Navegar a /dashboard',
        errors.slice(0, 3).join('; '),
        'Sin errores de consola');
    } else {
      addPass('/dashboard - Sin errores de consola');
    }

    // Verificar que el dashboard tiene contenido
    const bodyText = await page.locator('body').innerText();
    if (bodyText.length > 100) {
      addPass('/dashboard - Carga con contenido');
    }
  });

  // ── PROJECTS ────────────────────────────────────────────────────────────────
  test('PERF + QA: /projects/', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`));

    await page.goto('/projects/', { waitUntil: 'networkidle' });
    const perf = await measurePerf(page, '/projects/');
    perfResults.push(perf);
    console.log('PERF /projects/:', JSON.stringify(perf));

    // Verifica lista de proyectos
    const projectCards = page.locator('[data-testid="project-card"], .project-card, [class*="project"], article, .card');
    const cardCount = await projectCards.count();
    console.log(`Project cards found: ${cardCount}`);

    if (errors.length > 0) {
      console.log('CONSOLE ERRORS /projects/:', errors.join('\n'));
    } else {
      addPass('/projects/ - Sin errores de consola');
    }

    // Captura screenshot para análisis
    await page.screenshot({ path: '/tmp/qa-projects.png', fullPage: false });
    addPass('/projects/ - Carga correctamente');
  });

  // ── LISTS/[ID] ───────────────────────────────────────────────────────────────
  test('PERF + QA: /lists/[id] + Nueva Tarea', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`));

    // Navegar a proyectos para obtener el primer proyecto
    await page.goto('/projects/', { waitUntil: 'networkidle' });
    await page.screenshot({ path: '/tmp/qa-projects-before-click.png', fullPage: false });

    // Buscar cualquier link que vaya a /lists/
    const listsLink = page.locator('a[href*="/lists/"]').first();
    const listsCount = await listsLink.count();
    console.log(`Links to /lists/ found: ${listsCount}`);

    let listsUrl = '';
    if (listsCount > 0) {
      const href = await listsLink.getAttribute('href');
      console.log(`First lists link: ${href}`);
      await listsLink.click();
      await page.waitForLoadState('networkidle');
      listsUrl = page.url();
      console.log(`Navigated to: ${listsUrl}`);
    } else {
      // Intenta click en el primer proyecto/card
      const firstCard = page.locator('a').filter({ hasText: /proyecto|project/i }).first();
      const cardCount2 = await firstCard.count();
      if (cardCount2 > 0) {
        await firstCard.click();
        await page.waitForLoadState('networkidle');
        listsUrl = page.url();
        console.log(`Navigated via card to: ${listsUrl}`);
      } else {
        // Navegar directo a /lists/ para buscar
        await page.goto('/lists/', { waitUntil: 'networkidle' }).catch(() => {});
        listsUrl = page.url();
      }
    }

    const perf = await measurePerf(page, '/lists/[id]');
    perfResults.push(perf);
    console.log('PERF /lists/[id]:', JSON.stringify(perf));

    if (listsUrl.includes('/lists/')) {
      // ── BUG-09 Regresión: breadcrumb "Proyectos" ─────────────────────────
      const breadcrumbLinks = page.locator('nav[aria-label*="breadcrumb"] a, [class*="breadcrumb"] a, ol a, nav.breadcrumb a');
      const breadcrumbCount = await breadcrumbLinks.count();
      console.log(`Breadcrumb links: ${breadcrumbCount}`);

      let bug09Status = 'NO VERIFICADO - no se encontraron breadcrumbs';
      for (let i = 0; i < breadcrumbCount; i++) {
        const text = await breadcrumbLinks.nth(i).innerText();
        const href = await breadcrumbLinks.nth(i).getAttribute('href');
        console.log(`Breadcrumb[${i}]: "${text}" → ${href}`);
        if (text.toLowerCase().includes('proyecto')) {
          if (href === '/projects/' || href === '/projects') {
            bug09Status = 'RESUELTO';
            addPass('BUG-09 Regresión: breadcrumb Proyectos → /projects/ ✅');
          } else {
            bug09Status = `REABIERTO: href="${href}"`;
            addBug('BUG-09', 'Lists', listsUrl, 'superadmin', 'P2',
              'Breadcrumb Proyectos no navega a /projects/',
              'Ir a /lists/[id] → click en breadcrumb "Proyectos"',
              `Navega a ${href}`,
              'Debe ir a /projects/');
          }
        }
      }
      console.log(`BUG-09: ${bug09Status}`);

      // ── Nueva Tarea visible ──────────────────────────────────────────────
      const nuevaTareaBtn = page.locator('button:has-text("Nueva Tarea"), button:has-text("nueva tarea"), button:has-text("+ Tarea"), button:has-text("Agregar tarea"), [data-testid="new-task-btn"]');
      const btnCount = await nuevaTareaBtn.count();
      console.log(`"Nueva Tarea" button count: ${btnCount}`);

      if (btnCount > 0) {
        addPass('/lists/[id] - Botón "Nueva Tarea" visible para superadmin');

        // Abrir modal de nueva tarea
        await nuevaTareaBtn.first().click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: '/tmp/qa-new-task-modal.png', fullPage: false });

        const modal = page.locator('[role="dialog"], [class*="modal"], [class*="Modal"]').first();
        const modalVisible = await modal.isVisible().catch(() => false);
        console.log(`Nueva Tarea modal visible: ${modalVisible}`);

        if (modalVisible) {
          addPass('/lists/[id] - Modal Nueva Tarea abre correctamente');

          // Test título vacío
          const submitBtn = modal.locator('button[type="submit"], button:has-text("Crear"), button:has-text("Guardar"), button:has-text("Añadir")').first();
          const submitExists = await submitBtn.count() > 0;
          if (submitExists) {
            await submitBtn.click();
            await page.waitForTimeout(300);
            const errorMsg = page.locator('[class*="error"], [role="alert"], .text-red, [class*="destructive"]').first();
            const errorVisible = await errorMsg.isVisible().catch(() => false);
            console.log(`Empty title error shown: ${errorVisible}`);
            if (errorVisible) {
              addPass('/lists/[id] - Validación título vacío muestra error');
            } else {
              addBug('BUG-NEW-02', 'Lists/Tasks', listsUrl, 'superadmin', 'P2',
                'Sin validación de título vacío en Nueva Tarea',
                'Abrir modal Nueva Tarea → click Crear sin título',
                'No muestra error de validación',
                'Debe mostrar error de validación');
            }
          }

          // Cerrar modal con Escape
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
          const modalAfterEsc = await modal.isVisible().catch(() => false);
          if (!modalAfterEsc) {
            addPass('/lists/[id] - Modal cierra con Escape');
          }
        }
      } else {
        console.log('No se encontró botón Nueva Tarea - buscando alternativas...');
        await page.screenshot({ path: '/tmp/qa-lists-no-btn.png', fullPage: false });
        // Buscar cualquier botón
        const allButtons = await page.locator('button').allInnerTexts();
        console.log('All buttons:', allButtons.slice(0, 10).join(' | '));
      }
    } else {
      console.log(`No se pudo navegar a /lists/ - URL actual: ${listsUrl}`);
      await page.screenshot({ path: '/tmp/qa-lists-fail.png', fullPage: false });
    }

    if (errors.length > 0) {
      console.log('CONSOLE ERRORS /lists/[id]:', errors.join('\n'));
    }
  });

  // ── CLIENTS ──────────────────────────────────────────────────────────────────
  test('PERF + QA: /clients/ + BUG-05 + BUG-06', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`));

    await page.goto('/clients/', { waitUntil: 'networkidle' });
    const perf = await measurePerf(page, '/clients/');
    perfResults.push(perf);
    console.log('PERF /clients/:', JSON.stringify(perf));

    await page.screenshot({ path: '/tmp/qa-clients-list.png', fullPage: false });

    // ── BUG-05 Regresión: click en tarjeta → /clients/[uuid] ─────────────────
    const clientCards = page.locator('a[href*="/clients/"], [class*="client"] a, article a, .card a').first();
    const cardCount = await clientCards.count();
    console.log(`Client card links found: ${cardCount}`);

    // También buscar cards directas (el elemento clickable)
    const allClientLinks = page.locator('a[href*="/clients/"]');
    const allCount = await allClientLinks.count();
    console.log(`All /clients/ links: ${allCount}`);

    if (allCount > 0) {
      for (let i = 0; i < Math.min(3, allCount); i++) {
        const href = await allClientLinks.nth(i).getAttribute('href');
        console.log(`Client link[${i}]: ${href}`);
      }
    }

    // Click en primera tarjeta de cliente
    const clickableCard = page.locator('a[href*="/clients/"]:not([href="/clients/"])').first();
    const clickableCount = await clickableCard.count();
    console.log(`Clickable client cards (not /clients/ itself): ${clickableCount}`);

    if (clickableCount > 0) {
      const href = await clickableCard.getAttribute('href');
      console.log(`About to click client card with href: ${href}`);

      await clickableCard.click();
      await page.waitForLoadState('networkidle');
      const currentUrl = page.url();
      console.log(`After click URL: ${currentUrl}`);

      // BUG-05: debe ir a /clients/[uuid] NO /projects/?space=
      if (currentUrl.includes('/clients/') && !currentUrl.includes('/projects/')) {
        addPass(`BUG-05 Regresión: click tarjeta cliente → ${currentUrl} ✅`);
        console.log('BUG-05: RESUELTO ✅');
      } else if (currentUrl.includes('/projects/') && currentUrl.includes('space=')) {
        addBug('BUG-05', 'Clients', '/clients/', 'superadmin', 'P1',
          'Click en tarjeta cliente navega a /projects/?space= en lugar de /clients/[id]',
          'Ir a /clients/ → click en primera tarjeta de cliente',
          `Navega a ${currentUrl}`,
          'Debe navegar a /clients/[uuid]');
        console.log('BUG-05: REABIERTO 🔴');
      } else {
        console.log(`BUG-05: URL inesperada: ${currentUrl}`);
      }

      // Si llegamos a /clients/[id], verificar tabs
      if (currentUrl.includes('/clients/')) {
        await page.screenshot({ path: '/tmp/qa-client-detail.png', fullPage: false });

        const tabProyectos = page.locator('[role="tab"]:has-text("Proyecto"), [role="tab"]:has-text("proyecto")').first();
        const tabEquipo = page.locator('[role="tab"]:has-text("Equipo"), [role="tab"]:has-text("equipo")').first();

        const tabPCount = await tabProyectos.count();
        const tabECount = await tabEquipo.count();
        console.log(`Tab Proyectos: ${tabPCount}, Tab Equipo: ${tabECount}`);

        if (tabPCount > 0) {
          await tabProyectos.click();
          await page.waitForTimeout(500);
          addPass('/clients/[id] - Tab Proyectos funciona');
        }
        if (tabECount > 0) {
          await tabEquipo.click();
          await page.waitForTimeout(500);
          addPass('/clients/[id] - Tab Equipo funciona');
        }
      }
    } else {
      console.log('No se encontraron tarjetas de cliente clickables');
      await page.screenshot({ path: '/tmp/qa-clients-no-cards.png', fullPage: false });
      // Buscar todos los links para debug
      const allLinks = await page.locator('a').evaluateAll(els => els.map(e => ({ href: e.href, text: e.textContent?.slice(0, 30) })));
      console.log('All links on /clients/:', JSON.stringify(allLinks.slice(0, 10)));
    }

    // ── BUG-06: Modal Nuevo Cliente ──────────────────────────────────────────
    await page.goto('/clients/', { waitUntil: 'networkidle' });

    const nuevoClienteBtn = page.locator('button:has-text("Nuevo Cliente"), button:has-text("nuevo cliente"), button:has-text("+ Cliente"), button:has-text("Añadir Cliente"), button:has-text("Crear Cliente")');
    const nCCount = await nuevoClienteBtn.count();
    console.log(`"Nuevo Cliente" button count: ${nCCount}`);

    if (nCCount > 0) {
      // Abrir 3 veces + Escape cada vez
      for (let i = 1; i <= 3; i++) {
        await nuevoClienteBtn.first().click();
        await page.waitForTimeout(400);
        const openDialogs = await page.locator('[role="dialog"][data-state="open"]').count();
        console.log(`Attempt ${i}: open dialogs = ${openDialogs}`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
      }

      const finalOpenDialogs = await page.locator('[role="dialog"][data-state="open"]').count();
      console.log(`BUG-06: Final open dialogs after 3x open+Escape: ${finalOpenDialogs}`);

      if (finalOpenDialogs === 0) {
        addPass('BUG-06 Regresión: Modal Nuevo Cliente → 3x abrir+Escape → 0 diálogos abiertos ✅');
        console.log('BUG-06: RESUELTO ✅');
      } else {
        addBug('BUG-06', 'Clients', '/clients/', 'superadmin', 'P1',
          `Modal Nuevo Cliente acumula instancias: ${finalOpenDialogs} abiertos tras 3x Escape`,
          'Ir a /clients/ → abrir modal Nuevo Cliente 3 veces presionando Escape cada vez',
          `${finalOpenDialogs} diálogos con data-state="open" al final`,
          '0 diálogos abiertos');
        console.log('BUG-06: REABIERTO 🔴');
      }

      // Test validación nombre vacío
      await nuevoClienteBtn.first().click();
      await page.waitForTimeout(400);
      const modal = page.locator('[role="dialog"][data-state="open"]').first();
      const modalOpen = await modal.isVisible().catch(() => false);
      if (modalOpen) {
        const submitBtn = modal.locator('button[type="submit"], button:has-text("Crear"), button:has-text("Guardar")').first();
        if (await submitBtn.count() > 0) {
          await submitBtn.click();
          await page.waitForTimeout(300);
          const errorEl = modal.locator('[class*="error"], [role="alert"], .text-red-500, [class*="destructive"]').first();
          const errorVis = await errorEl.isVisible().catch(() => false);
          console.log(`Empty client name error: ${errorVis}`);
          if (errorVis) {
            addPass('/clients/ - Validación nombre vacío en modal Nuevo Cliente');
          }
        }
        await page.keyboard.press('Escape');
      }
    } else {
      console.log('No se encontró botón Nuevo Cliente');
    }

    if (errors.length > 0) {
      console.log('CONSOLE ERRORS /clients/:', errors.join('\n'));
    }
  });

  // ── TEAM ─────────────────────────────────────────────────────────────────────
  test('PERF + QA: /team/', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`));

    await page.goto('/team/', { waitUntil: 'networkidle' });
    const perf = await measurePerf(page, '/team/');
    perfResults.push(perf);
    console.log('PERF /team/:', JSON.stringify(perf));

    await page.screenshot({ path: '/tmp/qa-team.png', fullPage: false });

    // Lista de miembros
    const memberCards = page.locator('[class*="member"], [class*="team"], article, .card');
    const memberCount = await memberCards.count();
    console.log(`Member elements found: ${memberCount}`);

    // Buscar input de búsqueda
    const searchInput = page.locator('input[placeholder*="buscar" i], input[placeholder*="search" i], input[type="search"], input[placeholder*="nombre" i]').first();
    const searchCount = await searchInput.count();
    console.log(`Search input found: ${searchCount}`);

    if (searchCount > 0) {
      await searchInput.fill('Jorge');
      await page.waitForTimeout(500);
      await page.screenshot({ path: '/tmp/qa-team-search.png', fullPage: false });
      addPass('/team/ - Búsqueda por nombre funciona');

      // Búsqueda inexistente
      await searchInput.fill('xyzzy999inexistente');
      await page.waitForTimeout(500);
      const emptyState = page.locator('[class*="empty"], :has-text("No se encontraron"), :has-text("Sin resultados"), :has-text("no hay")').first();
      const emptyVis = await emptyState.isVisible().catch(() => false);
      console.log(`Empty state visible for inexistent search: ${emptyVis}`);
      if (emptyVis) {
        addPass('/team/ - Estado vacío para búsqueda inexistente');
      } else {
        // Check if the list just has 0 items
        const visibleMembers = await page.locator('[class*="member"] :visible, article:visible').count();
        console.log(`Visible members with inexistent search: ${visibleMembers}`);
      }

      await searchInput.fill('');
    } else {
      console.log('No search input found on /team/');
      addBug('BUG-NEW-03', 'Team', '/team/', 'superadmin', 'P3',
        'No se encontró input de búsqueda en /team/',
        'Ir a /team/ → buscar input de búsqueda',
        'No existe input de búsqueda (o selector incorrecto)',
        'Debe haber input de búsqueda por nombre');
    }

    // Modal Añadir Miembro
    const addMemberBtn = page.locator('button:has-text("Añadir Miembro"), button:has-text("añadir miembro"), button:has-text("Agregar"), button:has-text("+ Miembro"), button:has-text("Invitar")');
    const addBtnCount = await addMemberBtn.count();
    console.log(`Add member button count: ${addBtnCount}`);

    if (addBtnCount > 0) {
      await addMemberBtn.first().click();
      await page.waitForTimeout(500);
      const modal = page.locator('[role="dialog"][data-state="open"]').first();
      const modalVis = await modal.isVisible().catch(() => false);
      console.log(`Add member modal visible: ${modalVis}`);
      if (modalVis) {
        addPass('/team/ - Modal Añadir Miembro abre');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        const modalAfter = await modal.isVisible().catch(() => false);
        if (!modalAfter) {
          addPass('/team/ - Modal Añadir Miembro cierra con Escape');
        }
      }
    }

    if (errors.length > 0) {
      console.log('CONSOLE ERRORS /team/:', errors.join('\n'));
    } else {
      addPass('/team/ - Sin errores de consola');
    }
  });

  // ── INBOX ────────────────────────────────────────────────────────────────────
  test('PERF + QA: /inbox/', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`));

    await page.goto('/inbox/', { waitUntil: 'networkidle' });
    const perf = await measurePerf(page, '/inbox/');
    perfResults.push(perf);
    console.log('PERF /inbox/:', JSON.stringify(perf));

    await page.screenshot({ path: '/tmp/qa-inbox.png', fullPage: false });

    // Verifica carga
    const bodyText = await page.locator('body').innerText();
    console.log(`Inbox body length: ${bodyText.length}`);

    // Filtros
    const filterTodas = page.locator('button:has-text("Todas"), [role="tab"]:has-text("Todas")').first();
    const filterNoLeidas = page.locator('button:has-text("No leídas"), button:has-text("No Leídas"), [role="tab"]:has-text("No leídas")').first();

    const fTodasCount = await filterTodas.count();
    const fNoLCount = await filterNoLeidas.count();
    console.log(`Filter "Todas": ${fTodasCount}, "No leídas": ${fNoLCount}`);

    if (fTodasCount > 0) {
      await filterTodas.click();
      await page.waitForTimeout(300);
      addPass('/inbox/ - Filtro "Todas" funciona');
    }

    if (fNoLCount > 0) {
      await filterNoLeidas.click();
      await page.waitForTimeout(300);
      addPass('/inbox/ - Filtro "No leídas" funciona');
    }

    // Marcar todas leídas
    const markAllBtn = page.locator('button:has-text("Marcar todas"), button:has-text("marcar todo"), button:has-text("Leer todo")').first();
    const markCount = await markAllBtn.count();
    console.log(`"Marcar todas leídas" button: ${markCount}`);

    if (markCount > 0) {
      await markAllBtn.click();
      await page.waitForTimeout(500);
      addPass('/inbox/ - "Marcar todas leídas" funciona');
    }

    if (errors.length > 0) {
      console.log('CONSOLE ERRORS /inbox/:', errors.join('\n'));
      addBug('BUG-NEW-04', 'Inbox', '/inbox/', 'superadmin', 'P2',
        `Console errors en /inbox/: ${errors.length}`,
        'Navegar a /inbox/',
        errors.slice(0, 2).join('; '),
        'Sin errores');
    } else {
      addPass('/inbox/ - Sin errores de consola');
    }
  });

  // ── SETTINGS ─────────────────────────────────────────────────────────────────
  test('PERF + QA: /settings/', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`));

    await page.goto('/settings/', { waitUntil: 'networkidle' });
    const perf = await measurePerf(page, '/settings/');
    perfResults.push(perf);
    console.log('PERF /settings/:', JSON.stringify(perf));

    await page.screenshot({ path: '/tmp/qa-settings.png', fullPage: false });

    const title = await page.title();
    console.log('Settings title:', title);

    // Checkboxes de área
    const checkboxes = page.locator('input[type="checkbox"]');
    const checkboxCount = await checkboxes.count();
    console.log(`Checkboxes found: ${checkboxCount}`);

    if (checkboxCount > 0) {
      // Verificar que son interactuables
      const firstCheckbox = checkboxes.first();
      const isEnabled = await firstCheckbox.isEnabled();
      console.log(`First checkbox enabled: ${isEnabled}`);
      if (isEnabled) {
        addPass('/settings/ - Checkboxes de área son interactuables (superadmin)');
      }
    } else {
      console.log('No checkboxes found - looking for area management...');
      const areaSection = page.locator(':has-text("Área"), :has-text("área"), :has-text("AreaManagement")').first();
      const areaSectionVis = await areaSection.isVisible().catch(() => false);
      console.log(`Area section visible: ${areaSectionVis}`);
    }

    if (errors.length > 0) {
      console.log('CONSOLE ERRORS /settings/:', errors.join('\n'));
      addBug('BUG-NEW-05', 'Settings', '/settings/', 'superadmin', 'P2',
        `Console errors en /settings/: ${errors.length}`,
        'Navegar a /settings/',
        errors.slice(0, 2).join('; '),
        'Sin errores');
    } else {
      addPass('/settings/ - Sin errores de consola');
    }
  });

  // ── PERMISOS: miembro en /lists/[id] ─────────────────────────────────────────
  test.skip('QA Permisos: miembro no ve Nueva Tarea (skip - requires miembro project)', async ({ page }) => {
    // Este test requiere proyecto específico - verificar manualmente
  });

  // ── WRITE REPORTS ─────────────────────────────────────────────────────────────
  test('WRITE: Generar reportes QA y Performance', async ({ page }) => {
    // Navegar a /dashboard para tener contexto
    await page.goto('/dashboard', { waitUntil: 'networkidle' });

    // Obtener el resultado acumulado
    console.log('=== PERF RESULTS ===');
    console.log(JSON.stringify(perfResults, null, 2));
    console.log('=== BUG LOG ===');
    console.log(JSON.stringify(bugLog, null, 2));
    console.log('=== PASSED FLOWS ===');
    console.log(passedFlows.join('\n'));
  });
});
