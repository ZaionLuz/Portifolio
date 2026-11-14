import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const url = 'https://consultorio-odontologico-marta-andrade.pages.dev/';
const target = path.resolve('assets/marta-andrade-site.webp');
const jpeg = path.resolve('capture-review/marta-andrade-source.jpg');
await mkdir('capture-review', { recursive: true });
await mkdir('assets', { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 960 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce'
  });
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (!response || !response.ok()) throw new Error('Public dentist site did not respond successfully: ' + response?.status());
  await page.waitForFunction(() => /sorriso|odontologia|odontológico|tratamentos/i.test(document.body.innerText), { timeout: 30000 });
  await page.evaluate(async () => {
    if (document.fonts) await document.fonts.ready;
    await Promise.all(Array.from(document.images, image => image.complete ? Promise.resolve() : new Promise(resolve => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', resolve, { once: true });
      setTimeout(resolve, 10000);
    })));
  });
  await page.waitForTimeout(1200);
  const title = await page.title();
  const body = await page.locator('body').innerText();
  if (!/marta|maria/i.test(title + ' ' + body)) throw new Error('The page could not be verified as the Maria Marta practice.');
  const heading = page.locator('h1').first();
  await heading.waitFor({ state: 'visible', timeout: 15000 });
  const headingText = await heading.innerText();
  if (!/sorriso|cuidar|odontol/i.test(headingText)) throw new Error('Unexpected dentist hero heading: ' + headingText);
  await page.screenshot({ path: jpeg, type: 'jpeg', quality: 92, fullPage: false, animations: 'disabled' });
  const python = [
    'from PIL import Image',
    'import sys,json',
    'im=Image.open(sys.argv[1]).convert("RGB")',
    'im.save(sys.argv[2],format="WEBP",quality=90,method=6)',
    'print("MARTA_CAPTURE_DIMENSIONS="+json.dumps({"width":im.width,"height":im.height}))',
    'logo=Image.open("assets/helly-viagens-sem-fundo.png").convert("RGBA")',
    'points=[(0,0),(logo.width-1,0),(0,logo.height-1),(logo.width-1,logo.height-1)]',
    'info={"width":logo.width,"height":logo.height,"corners":[list(logo.getpixel(p)) for p in points],"alphaExtrema":list(logo.getchannel("A").getextrema())}',
    'print("HELLY_ALPHA_INSPECTION="+json.dumps(info))'
  ].join('\n');
  const conversion = execFileSync('python', ['-c', python, jpeg, target], { encoding: 'utf8' });
  process.stdout.write(conversion);
  const image = await readFile(target);
  const metadata = { url: page.url(), title, heading: headingText, capturedAt: new Date().toISOString(), width: 1600, height: 960, bytes: image.length, source: 'Actual public page captured with Playwright Chromium; no page content altered' };
  await writeFile('capture-review/marta-capture-metadata.json', JSON.stringify(metadata, null, 2) + '\n');
  console.log('MARTA_CAPTURE_METADATA=' + JSON.stringify(metadata));
  const encoded = image.toString('base64');
  console.log('MARTA_ASSET_BEGIN=' + encoded.length);
  for (let offset=0,index=0;offset<encoded.length;offset+=12000,index++) console.log('MARTA_ASSET_' + String(index).padStart(3,'0') + '=' + encoded.slice(offset, offset+12000));
  console.log('MARTA_ASSET_END');
} finally {
  await browser.close();
}
