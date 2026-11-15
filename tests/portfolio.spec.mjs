import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:4173/Portifolio/';
const errors = new WeakMap();
const fixtures = [
  { name: '-PROJETO-LANDING-PAGE-PREMIUM-', language: 'TypeScript', stars: 0, date: '2026-10-28T03:40:28Z' },
  { name: 'Portifolio', language: 'HTML', stars: 1, date: '2026-10-30T23:15:01Z' },
  { name: 'Arquipelago-das-Feras', language: 'Luau', stars: 0, date: '2026-11-04T10:39:44Z' }
];
// Deliberately synthetic byte counts used only for the API success test, never portfolio data.
const languageFixtures = {
  '-PROJETO-LANDING-PAGE-PREMIUM-': { TypeScript: 80, CSS: 20 },
  Portifolio: { HTML: 50, CSS: 35, JavaScript: 15 },
  'Arquipelago-das-Feras': { Luau: 100 }
};
async function installGitHub(page, mode = 'live') {
  const observed = { requests: [] };
  await page.route('https://api.github.com/**', async (route) => {
    observed.requests.push(route.request().url());
    const u = new URL(route.request().url());
    let body;
    let status = 200;
    if (mode === 'failure') { status = 503; body = { message: 'Synthetic test outage' }; }
    else if (u.pathname === '/users/ZaionLuz/repos') {
      body = mode === 'empty' ? [] : fixtures.map((r) => ({
        name: r.name, full_name: 'ZaionLuz/' + r.name, private: false,
        description: 'Browser test metadata fixture', language: r.language,
        stargazers_count: r.stars, forks_count: 0, updated_at: r.date, pushed_at: r.date,
        html_url: 'https://github.com/ZaionLuz/' + r.name,
        languages_url: 'https://api.github.com/repos/ZaionLuz/' + r.name + '/languages',
        fork: false, archived: false
      }));
    } else if (/^\/repos\/ZaionLuz\/[^/]+\/languages$/.test(u.pathname)) {
      const name = decodeURIComponent(u.pathname.split('/')[3]); body = languageFixtures[name] || {};
    } else { status = 404; body = { message: 'Unexpected test endpoint' }; }
    await route.fulfill({
      status,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      body: JSON.stringify(body)
    });
  });
  return observed;
}
async function ready(page, suffix = '?lang=pt&focus=all') {
  await page.goto(BASE + suffix, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveClass(/app-ready/);
  await expect(page.locator('#home h1')).toBeVisible();
}
async function noOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: window.innerWidth
  }));
  if (dimensions.width > dimensions.viewport + 1) {
    const overflow = await page.evaluate(() => Array.from(document.querySelectorAll('body *'))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          tag: element.tagName.toLowerCase(), id: element.id,
          classes: typeof element.className === 'string' ? element.className : '',
          left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width),
          position: style.position, overflowX: style.overflowX,
          parentOverflowX: element.parentElement ? getComputedStyle(element.parentElement).overflowX : null
        };
      })
      .filter((entry) => entry.width > 0 && (entry.right > window.innerWidth + 1 || entry.left < -1))
      .sort((a, b) => b.right - a.right)
      .slice(0, 24));
    console.log('PORTFOLIO_OVERFLOW=' + JSON.stringify({ ...dimensions, elements: overflow }));
  }
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport + 1);
}
function logPreview(name, jpeg) {
  const encoded = jpeg.toString('base64');
  console.log('PORTFOLIO_PREVIEW_' + name + '_BEGIN=' + encoded.length);
  for (let offset = 0, index = 0; offset < encoded.length; offset += 12000, index += 1) {
    console.log('PORTFOLIO_PREVIEW_' + name + '_' + String(index).padStart(3, '0') + '=' + encoded.slice(offset, offset + 12000));
  }
  console.log('PORTFOLIO_PREVIEW_' + name + '_END');
}
async function settleImages(page) {
  await page.evaluate(async () => {
    for (const image of document.images) image.loading = 'eager';
    await Promise.all(Array.from(document.images, (image) => image.complete
      ? Promise.resolve()
      : new Promise((resolve) => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
        setTimeout(resolve, 7000);
      })));
    if (document.fonts) await document.fonts.ready;
  });
}

const colorSelectors = ['body', '#site-header', '#contact-form', '#contact-name', '#contact-service',
  '#contact-message', '[data-gh-query]', '[data-gh-run]', '#github-dashboard', '.site-footer'];
async function themeColors(page) {
  return page.evaluate((selectors) => Object.fromEntries(selectors.map((selector) => {
    const element = document.querySelector(selector);
    if (!element) throw new Error('Missing theme probe: ' + selector);
    const style = getComputedStyle(element);
    return [selector, [style.color, style.backgroundColor, style.borderTopColor]];
  })), colorSelectors);
}
// A MutationObserver starts the measurement in the same render cycle as the theme commit,
// rather than letting Playwright polling conceal a slow offscreen color transition.
async function toggleAndSample(page, scrollToFooter = false) {
  return page.evaluate(({ selectors, scrollToFooter }) => new Promise((resolve, reject) => {
    const root = document.documentElement;
    const before = root.dataset.theme;
    const deadline = setTimeout(() => { observer.disconnect(); reject(new Error('Theme did not commit')); }, 2000);
    const observer = new MutationObserver(() => {
      if (root.dataset.theme === before) return;
      observer.disconnect();
      if (scrollToFooter) document.querySelector('.site-footer').scrollIntoView({ behavior:'instant', block:'end' });
      requestAnimationFrame(() => requestAnimationFrame(() => {
        clearTimeout(deadline);
        const colors = Object.fromEntries(selectors.map((selector) => {
          const style = getComputedStyle(document.querySelector(selector));
          return [selector, [style.color, style.backgroundColor, style.borderTopColor]];
        }));
        resolve({ theme:root.dataset.theme, colors, scrollY:window.scrollY });
      }));
    });
    observer.observe(root, { attributes:true, attributeFilter:['data-theme'] });
    document.querySelector('#theme-toggle').click();
  }), { selectors:colorSelectors, scrollToFooter });
}
async function assertAtomicTheme(page, expected, scrollToFooter = false) {
  const early = await toggleAndSample(page, scrollToFooter);
  expect(early.theme).toBe(expected);
  await page.waitForTimeout(700);
  expect(await themeColors(page)).toEqual(early.colors);
  await expect(page.locator('html')).not.toHaveClass(/theme-switching/);
  await expect(page.locator('html')).not.toHaveAttribute('data-theme-transition');
  return early;
}

test.beforeEach(async ({ page }) => {
  const found = []; errors.set(page, found);
  page.on('pageerror', (error) => found.push(error.message));
  await installGitHub(page);
});
test.afterEach(async ({ page }) => { expect(errors.get(page) || []).toEqual([]); });

for (const viewport of [
  { width: 1440, height: 960 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 780 }
]) {
  test('layout remains usable at ' + viewport.width + 'px', async ({ page }) => {
    await page.setViewportSize(viewport);
    await ready(page);
    await expect(page.locator('[data-project-card]')).toHaveCount(3);
    await expect(page.locator('[data-service-card]')).toHaveCount(8);
    await expect(page.locator('#header-github')).toBeVisible();
    await expect(page.locator('#language-toggle')).toBeVisible();
    await expect(page.locator('#theme-toggle')).toBeVisible();
    const controls = await page.locator('.header-actions > :visible').evaluateAll((nodes) => nodes.map((node) => {
      const r = node.getBoundingClientRect();
      return { x:r.x, right:r.right, y:r.y, bottom:r.bottom, width:r.width, height:r.height };
    }));
    for (let i = 0; i < controls.length; i += 1) {
      expect(controls[i].x).toBeGreaterThanOrEqual(0);
      expect(controls[i].right).toBeLessThanOrEqual(viewport.width + 1);
      expect(controls[i].width).toBeGreaterThanOrEqual(32);
      expect(controls[i].height).toBeGreaterThanOrEqual(32);
      for (let j = i + 1; j < controls.length; j += 1) {
        const a = controls[i], b = controls[j];
        const overlaps = Math.min(a.right,b.right)-Math.max(a.x,b.x)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1;
        expect(overlaps).toBe(false);
      }
    }
    await noOverflow(page);
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await expect(page.locator('#contact-name')).toBeVisible();
    await noOverflow(page);
  });
}
test('theme and language persist through reload and keep the nested base path', async ({ page }) => {
  await ready(page);
  const previous = await page.locator('html').getAttribute('data-theme');
  await page.locator('#theme-toggle').click();
  await expect.poll(() => page.locator('html').getAttribute('data-theme')).not.toBe(previous);
  const next = await page.locator('html').getAttribute('data-theme');
  await page.locator('#language-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect.poll(() => new URL(page.url()).searchParams.get('lang')).toBe('en');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveClass(/app-ready/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', next);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(new URL(page.url()).pathname).toBe('/Portifolio/');
  await expect(page.locator('#contact-form')).toContainText(/name|service/i);
  await expect(page.locator('.footer-wordmark')).toHaveText('Zaion');
  await expect(page.locator('.site-footer')).not.toContainText(/Soluções Digitais|Digital Solutions/);
});
test('focus selection changes actual section and project reading order', async ({ page }) => {
  await ready(page);
  const firstSection = () => page.locator('#page-sections > section').first().getAttribute('id');
  expect(await firstSection()).toBe('about');
  await page.locator('#focus-tabs [data-focus="dev"]').click();
  await expect.poll(firstSection).toBe('projects');
  await expect(page.locator('#focus-tabs [data-focus="dev"]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.locator('#project-grid [data-project-card]').first().getAttribute('data-kind')).toBe('web');
  await page.locator('#focus-tabs [data-focus="design"]').click();
  await expect.poll(firstSection).toBe('projects');
  await expect(page.locator('#page-sections > section').nth(1)).toHaveAttribute('id', 'services');
  await expect.poll(() => page.locator('#project-grid [data-project-card]').first().getAttribute('data-kind')).toBe('design');
  await page.locator('#focus-tabs [data-focus="all"]').click();
  await expect.poll(firstSection).toBe('about');
  await expect(page.locator('#project-grid [data-project-card]:visible')).toHaveCount(3);
});
test('mobile menu has Escape dismissal, restored focus and working navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await page.locator('#menu-open').click();
  await expect(page.locator('#mobile-menu')).toBeVisible();
  await expect(page.locator('#menu-open')).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('#mobile-menu')).not.toBeVisible();
  await expect(page.locator('#menu-open')).toBeFocused();
  await page.locator('#menu-open').click();
  await page.locator('#mobile-menu [data-nav][href="#projects"]').click();
  await expect(page.locator('#mobile-menu')).not.toBeVisible();
  await expect.poll(() => new URL(page.url()).hash).toBe('#projects');
  await noOverflow(page);
});
test('identity card flips by keyboard without breaking the reduced-motion layout', async ({ page }) => {
  await ready(page);
  const card = page.locator('#identity-card');
  await card.focus();
  await page.keyboard.press('Enter');
  await expect(card).toHaveClass(/is-flipped/);
  await page.keyboard.press('Space');
  await expect(card).not.toHaveClass(/is-flipped/);
  await noOverflow(page);
});
test('project dialog preserves project status and returns focus on close', async ({ page }) => {
  await ready(page);
  const trigger = page.locator('[data-project-open="marta"]').first();
  await trigger.click();
  await expect(page.locator('#project-dialog')).toBeVisible();
  await expect(page.locator('#project-dialog-title')).toContainText('Maria Marta');
  await expect(page.locator('#project-detail-content .status-badge')).toHaveText('Site publicado');
  await expect(page.locator('#project-detail-content img')).toHaveAttribute('src', /marta-andrade-site\.webp$/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#project-dialog')).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
test('command palette supports shortcuts, selection and ignores slash in an editor', async ({ page }) => {
  await ready(page);
  await page.locator('#command-open').focus();
  await page.keyboard.press('Control+k');
  await expect(page.locator('#command-dialog')).toBeVisible();
  const search = page.locator('#command-search');
  await expect(search).toBeFocused();
  const before = await search.getAttribute('aria-activedescendant');
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => search.getAttribute('aria-activedescendant')).not.toBe(before);
  await search.fill('Helly');
  await page.keyboard.press('Enter');
  await expect(page.locator('#command-dialog')).not.toBeVisible();
  await expect(page.locator('#project-dialog')).toBeVisible();
  await expect(page.locator('#project-dialog-title')).toContainText('Helly');
  await page.keyboard.press('Escape');
  await expect(page.locator('#command-open')).toBeFocused();
  await page.keyboard.press('/');
  await expect(page.locator('#command-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  const editor = page.locator('[data-gh-query]');
  await editor.focus();
  await editor.fill('SELECT name FROM repos');
  await page.keyboard.press('/');
  await expect(page.locator('#command-dialog')).not.toBeVisible();
  await expect(editor).toHaveValue('SELECT name FROM repos/');
});
test('service call to action selects the actual service before contact', async ({ page }) => {
  await ready(page);
  await page.locator('[data-service-select="brand"]').first().click();
  await expect(page.locator('#contact-service')).toHaveValue('brand');
  await expect.poll(() => new URL(page.url()).hash).toBe('#contact');
  await expect(page.locator('#contact-name')).toBeFocused();
});
test('invalid form does not navigate; valid form creates one intercepted WhatsApp draft', async ({ page }) => {
  const urls = [];
  await page.route('https://wa.me/**', async (route) => {
    urls.push(route.request().url());
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Intercepted QA draft</title><p>No external message was sent.</p>' });
  });
  await ready(page);
  await page.locator('#contact-form button[type="submit"]').click();
  await page.waitForTimeout(250);
  expect(urls).toHaveLength(0);
  await page.locator('#contact-name').fill('Teste de interface');
  await page.locator('#contact-service').selectOption('web');
  await page.locator('#contact-message').fill('Quero organizar uma página de teste, sem envio real.');
  await page.locator('#contact-form button[type="submit"]').click();
  await expect.poll(() => urls.length).toBe(1);
  await page.waitForTimeout(350);
  expect(urls).toHaveLength(1);
  const u = new URL(urls[0]);
  expect(u.pathname).toBe('/5588997173005');
  expect(u.searchParams.get('text')).toContain('Teste de interface');
  expect(u.searchParams.get('text')).toContain('sem envio real');
});
test('GitHub queries filter real-shaped metadata, reject unsafe input and cache honestly', async ({ page }) => {
  const observed = await installGitHub(page);
  await ready(page);
  await expect(page.locator('.gh-source')).toHaveAttribute('data-source', 'live');
  await expect(page.locator('.gh-table [data-gh-repo]')).toHaveCount(3);
  await expect(page.locator('.gh-chart')).toContainText(/bytes/i);
  await page.locator('[data-gh-query]').fill("SELECT name, language, stars FROM repos WHERE language = 'Luau'");
  await page.locator('[data-gh-run]').click();
  await expect(page.locator('.gh-table [data-gh-repo]')).toHaveCount(1);
  await expect(page.locator('.gh-table')).toContainText('Arquipelago-das-Feras');
  await page.locator('[data-gh-query]').fill('DROP TABLE repos');
  await page.locator('[data-gh-run]').click();
  await expect(page.locator('#gh-query-error')).toBeVisible();
  await expect(page.locator('.gh-table [data-gh-repo]')).toHaveCount(1);
  observed.requests.length = 0;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.gh-source')).toHaveAttribute('data-source', 'cache');
  expect(observed.requests).toHaveLength(0);
});
test('GitHub outage keeps a marked verified snapshot instead of fake live data', async ({ page }) => {
  await installGitHub(page, 'failure');
  await ready(page);
  await expect(page.locator('#github-dashboard')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.gh-source')).toHaveAttribute('data-source', 'snapshot');
  await expect(page.locator('.gh-status')).toContainText(/indisponível|limite/i);
  await expect(page.locator('.gh-table [data-gh-repo]')).toHaveCount(3);
  await expect(page.locator('.gh-chart')).toContainText(/linguagem principal/i);
});
test('a genuinely empty GitHub account is shown as empty, with no invented projects', async ({ page }) => {
  await installGitHub(page, 'empty');
  await ready(page);
  await expect(page.locator('.gh-source')).toHaveAttribute('data-source', 'live');
  await expect(page.locator('.gh-table [data-gh-repo]')).toHaveCount(0);
  await expect(page.locator('.gh-metric').first().locator('strong')).toHaveText('0');
  await expect(page.locator('.gh-table .gh-empty')).toBeVisible();
  await expect(page.locator('.gh-chart .gh-empty')).toBeVisible();
});
test('no-JavaScript HTML remains readable and keeps projects, services and contact links', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(BASE);
  await expect(page.locator('#home h1')).toBeVisible();
  await expect(page.locator('[data-project-card]')).toHaveCount(3);
  await expect(page.locator('[data-service-card]')).toHaveCount(8);
  await expect(page.locator('a[href*="wa.me/5588997173005"]:visible').first()).toBeVisible();
  await expect(page.locator('#intro')).not.toBeVisible();
  await expect(page.locator('[data-project-open="helly"]')).toHaveAttribute('href', /assets\/helly/);
  await noOverflow(page);
  await context.close();
});
test('reduced motion keeps content visible and suppresses intro and tilt', async ({ page }) => {
  await ready(page);
  await expect(page.locator('html')).toHaveClass(/motion-reduced/);
  await expect(page.locator('#intro')).not.toBeVisible();
  const target = page.locator('[data-tilt-inner]').first();
  const before = await target.evaluate((el) => [el.style.getPropertyValue('--tilt-x'), el.style.getPropertyValue('--tilt-y')]);
  await target.hover({ position: { x: 12, y: 12 } });
  await page.waitForTimeout(250);
  const after = await target.evaluate((el) => [el.style.getPropertyValue('--tilt-x'), el.style.getPropertyValue('--tilt-y')]);
  expect(after).toEqual(before);
  await expect(page.locator('[data-project-card]').first()).toBeVisible();
});
test('normal motion finishes intro, bounds tilt and returns the identity card to rest', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await ready(page);
  await expect(page.locator('html')).not.toHaveClass(/motion-reduced/);
  await expect(page.locator('#intro')).not.toBeVisible();
  const stage = page.locator('[data-tilt]').first();
  const inner = page.locator('[data-tilt-inner]').first();
  await stage.scrollIntoViewIfNeeded();
  const bounds = await stage.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds.x + bounds.width * 0.15, bounds.y + bounds.height * 0.2);
  const angles = () => inner.evaluate((element) => [
    parseFloat(element.style.getPropertyValue('--tilt-x')) || 0,
    parseFloat(element.style.getPropertyValue('--tilt-y')) || 0
  ]);
  await expect.poll(async () => (await angles()).some((value) => Math.abs(value) > 0.1)).toBe(true);
  await page.waitForTimeout(250);
  for (const value of await angles()) expect(Math.abs(value)).toBeLessThanOrEqual(8.05);
  await page.mouse.move(2, 2);
  await expect.poll(async () => (await angles()).every((value) => Math.abs(value) < 0.08)).toBe(true);
});
test('all local images load and print mode contains the factual résumé', async ({ page }, testInfo) => {
  await ready(page);
  await settleImages(page);
  const broken = await page.locator('img').evaluateAll((nodes) => nodes.filter((img) => !img.complete || !img.naturalWidth).map((img) => img.getAttribute('src')));
  expect(broken).toEqual([]);
  await expect(page.locator('#identity-card img')).toHaveAttribute('src', 'assets/zaion-portrait.png');
  await expect(page.locator('[data-project-card="helly"] picture source')).toHaveCount(0);
  await expect(page.locator('[data-project-card="marta"] img')).toHaveAttribute('src', 'assets/marta-andrade-site.webp');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#print-cv')).toBeVisible();
  await expect(page.locator('#print-cv')).toContainText('Zaion Araújo');
  await expect(page.locator('#print-cv')).toContainText('Zaion0301@gmail.com');
  await expect(page.locator('#print-cv')).toContainText(/Ciência da Computação/);
  await page.pdf({ path: testInfo.outputPath('curriculo-zaion.pdf'), format: 'A4', printBackground: true });
});
test('desktop review screenshots are captured in a real browser', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await ready(page);
  await settleImages(page);
  await page.screenshot({ path: testInfo.outputPath('desktop-dark-1440.png'), fullPage: true, animations: 'disabled' });
  logPreview('DARKCRIMSON', await page.screenshot({type:'jpeg',quality:45,animations:'disabled'}));
  await page.locator('#theme-toggle').click();
  await page.locator('#language-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  logPreview('LIGHTCRIMSONPINK', await page.screenshot({type:'jpeg',quality:45,animations:'disabled'}));
  await page.screenshot({ path: testInfo.outputPath('desktop-light-en-1440.png'), fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 1100, height: 780 });
  await page.locator('#home').scrollIntoViewIfNeeded();
  const jpeg = await page.screenshot({ path: testInfo.outputPath('desktop-review.jpg'), type: 'jpeg', quality: 35, animations: 'disabled' });
  logPreview('DESKTOP', jpeg);
  await page.setViewportSize({ width: 1200, height: 1000 });
  await page.locator('#stack').scrollIntoViewIfNeeded();
  logPreview('STACKLIGHT', await page.screenshot({type:'jpeg',quality:55,animations:'disabled'}));
  await page.locator('#projects').scrollIntoViewIfNeeded();
  logPreview('PROJECTS', await page.screenshot({ type:'jpeg', quality:45, animations:'disabled' }));
  await page.locator('.site-footer').scrollIntoViewIfNeeded();
  logPreview('FOOTER', await page.screenshot({ type:'jpeg', quality:45, animations:'disabled' }));
  logPreview('LIGHTFOOTER', await page.screenshot({type:'jpeg',quality:45,animations:'disabled'}));
  await page.locator('#github-dashboard').scrollIntoViewIfNeeded();
  logPreview('GITHUBLIGHT', await page.screenshot({type:'jpeg',quality:45,animations:'disabled'}));
});
test('mobile review screenshot is captured in a real browser', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await settleImages(page);
  await page.screenshot({ path: testInfo.outputPath('mobile-dark-390.png'), fullPage: true, animations: 'disabled' });
  const jpeg = await page.screenshot({ path: testInfo.outputPath('mobile-review.jpg'), type: 'jpeg', quality: 40, animations: 'disabled' });
  logPreview('MOBILE', jpeg);
});

test('English destination button translates the page and returns to Portuguese', async ({ page }) => {
  await ready(page);
  const button = page.locator('#language-toggle');
  const label = button.locator('[data-language-label]');
  await expect(label).toHaveText('EN');
  await expect(button).toHaveAccessibleName(/inglês/i);
  await button.click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(label).toHaveText('PT');
  await expect(button).toHaveAccessibleName(/portuguese/i);
  await expect(page.locator('#contact-form label[for="contact-name"]')).toHaveText('Your name');
  await expect(page.locator('#contact-form button[type="submit"]')).toContainText(/WhatsApp/i);
  await expect.poll(() => new URL(page.url()).searchParams.get('lang')).toBe('en');
  await page.locator('#command-open').click();
  await expect(page.locator('#command-dialog')).toContainText(/where|search|navigate/i);
  await page.keyboard.press('Escape');
  await button.click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await expect(label).toHaveText('EN');
  await expect(page.locator('#contact-form label[for="contact-name"]')).toHaveText('Seu nome');
  await expect.poll(() => new URL(page.url()).searchParams.get('lang')).toBe('pt');
});
test('brand is only Z, profile button points to the account and footer omits portfolio source', async ({ page }) => {
  await ready(page);
  const visibleBrand = await page.locator('.header-wordmark').evaluate((node) => {
    const clone = node.cloneNode(true);
    clone.querySelectorAll('.sr-only').forEach((element) => element.remove());
    return clone.textContent.trim();
  });
  expect(visibleBrand).toBe('Z');
  await expect(page.locator('.header-wordmark .accent-text')).toHaveCount(0);
  await expect(page.locator('.stack-core')).toHaveText('Z');
  await expect(page.locator('.stack-core span')).toHaveCount(0);
  const github = page.locator('#header-github');
  await expect(github).toBeVisible();
  await expect(github).toHaveAttribute('href', 'https://github.com/ZaionLuz');
  await expect(github).toHaveAttribute('target', '_blank');
  await expect(github).toHaveAttribute('rel', /noopener/);
  await expect(github).toHaveAccessibleName(/github/i);
  await expect(page.locator('.site-footer a[href*="github.com/ZaionLuz/Portifolio"]')).toHaveCount(0);
  await expect(page.locator('.site-footer')).not.toContainText(/ver.*código|view.*(code|source)/i);
});
test('favicon is a loadable transparent Z without a square background', async ({ page }) => {
  await ready(page);
  const iconURL = await page.locator('link[rel="icon"]').getAttribute('href');
  expect(iconURL).toMatch(/favicon\.svg$/);
  const response = await page.request.get(new URL(iconURL, BASE).href);
  expect(response.ok()).toBe(true);
  const markup = await response.text();
  expect(markup).toContain('<svg');
  expect(markup).not.toMatch(/<(rect|circle)\b/i);
  const pixels = await page.evaluate(async (url) => {
    const image = new Image(); image.src = url; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image,0,0,64,64);
    const sample = (x,y) => Array.from(ctx.getImageData(x,y,1,1).data);
    let opaque = 0;
    const rgba = ctx.getImageData(0,0,64,64).data;
    for (let i=3;i<rgba.length;i+=4) if (rgba[i]>127) opaque++;
    return {corners:[sample(0,0),sample(63,0),sample(0,63),sample(63,63)],opaque};
  }, new URL(iconURL,BASE).href);
  expect(pixels.corners.map((rgba) => rgba[3])).toEqual([0,0,0,0]);
  expect(pixels.opaque).toBeGreaterThan(100);
  expect(pixels.opaque).toBeLessThan(2500);
});
for (const location of ['footer', 'top then footer']) {
  test('native theme reveal has no delayed lower-page colors from ' + location, async ({ page }) => {
    await page.emulateMedia({ reducedMotion:'no-preference' });
    await ready(page);
    await expect(page.locator('#intro')).not.toBeVisible();
    const supported = await page.evaluate(() => typeof document.startViewTransition === 'function');
    expect(supported).toBe(true);
    await page.evaluate(() => {
      window.__themeNativeCalls = 0;
      const native = document.startViewTransition.bind(document);
      document.startViewTransition = (...args) => { window.__themeNativeCalls++; return native(...args); };
    });
    for (const target of ['light','dark']) {
      await page.evaluate((position) => {
        if (position === 'footer') document.querySelector('.site-footer').scrollIntoView({behavior:'instant',block:'end'});
        else window.scrollTo({top:0,behavior:'instant'});
      }, location);
      await page.waitForTimeout(100);
      const before = await themeColors(page);
      const sample = await assertAtomicTheme(page, target, location === 'top then footer');
      expect(sample.scrollY).toBeGreaterThan(1000);
      expect(sample.colors.body).not.toEqual(before.body);
    }
    expect(await page.evaluate(() => window.__themeNativeCalls)).toBe(2);
  });
}
for (const scenario of ['unsupported', 'reduced motion']) {
  test('theme change remains atomic with ' + scenario, async ({ page }) => {
    await page.emulateMedia({ reducedMotion:scenario === 'unsupported' ? 'no-preference' : 'reduce' });
    await ready(page);
    await expect(page.locator('#intro')).not.toBeVisible();
    await page.evaluate((mode) => {
      window.__themeNativeCalls = 0;
      const native = document.startViewTransition && document.startViewTransition.bind(document);
      if (mode === 'unsupported') document.startViewTransition = undefined;
      else if (native) document.startViewTransition = (...args) => { window.__themeNativeCalls++; return native(...args); };
      document.querySelector('.site-footer').scrollIntoView({behavior:'instant',block:'end'});
    }, scenario);
    await page.waitForTimeout(100);
    for (const target of ['light','dark']) await assertAtomicTheme(page,target);
    expect(await page.evaluate(() => window.__themeNativeCalls)).toBe(0);
  });
}
test('three rapid native theme toggles finish at the requested theme and clean up', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.emulateMedia({ reducedMotion:'no-preference' });
  await ready(page);
  await expect(page.locator('#intro')).not.toBeVisible();
  await page.evaluate(() => {
    const button = document.querySelector('#theme-toggle');
    button.click(); setTimeout(() => button.click(),30); setTimeout(() => button.click(),60);
  });
  await expect(page.locator('html')).toHaveAttribute('data-theme','light',{timeout:1800});
  await expect(page.locator('html')).not.toHaveClass(/theme-switching/,{timeout:1800});
  await expect(page.locator('html')).not.toHaveAttribute('data-theme-transition');
  expect(await page.evaluate(() => localStorage.getItem('zaion.theme'))).toBe('light');
  const before = await themeColors(page);
  await page.waitForTimeout(700);
  expect(await themeColors(page)).toEqual(before);
  expect(consoleErrors).toEqual([]);
});

test('SeuDente demo is available with a working project link in both languages', async ({ page }) => {
  await ready(page);
  const card=page.locator('[data-project-card="seudente"]');
  await expect(card).toBeVisible();
  await card.locator('[data-project-open]').click();
  await expect(page.locator('#project-dialog-title')).toHaveText('SeuDente');
  await expect(page.locator('[data-project-visit]')).toHaveAttribute('href','https://zaionluz.github.io/Landing_Demo/');
  await expect(page.locator('[data-project-visit]')).toHaveText(/Explorar demo/);
  await page.keyboard.press('Escape');
  await page.locator('#language-toggle').click();
  await card.locator('[data-project-open]').click();
  await expect(page.locator('[data-project-visit]')).toHaveText(/Explore demo/);
});