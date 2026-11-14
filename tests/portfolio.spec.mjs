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
    await expect(page.locator('[data-project-card]')).toHaveCount(4);
    await expect(page.locator('[data-service-card]')).toHaveCount(8);
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
  await expect(page.locator('#project-grid [data-project-card]:visible')).toHaveCount(4);
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
  await expect(page.locator('#project-detail-content')).toContainText(/proposta|estudo/i);
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
  await expect(page.locator('[data-project-card]')).toHaveCount(4);
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
  await page.locator('#theme-toggle').click();
  await page.locator('#language-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.screenshot({ path: testInfo.outputPath('desktop-light-en-1440.png'), fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 1100, height: 780 });
  await page.locator('#home').scrollIntoViewIfNeeded();
  const jpeg = await page.screenshot({ path: testInfo.outputPath('desktop-review.jpg'), type: 'jpeg', quality: 35, animations: 'disabled' });
  logPreview('DESKTOP', jpeg);
});
test('mobile review screenshot is captured in a real browser', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await settleImages(page);
  await page.screenshot({ path: testInfo.outputPath('mobile-dark-390.png'), fullPage: true, animations: 'disabled' });
  const jpeg = await page.screenshot({ path: testInfo.outputPath('mobile-review.jpg'), type: 'jpeg', quality: 40, animations: 'disabled' });
  logPreview('MOBILE', jpeg);
});
