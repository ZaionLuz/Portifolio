import { createServer } from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const base = '/Portifolio/';
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid PORT');
const mime = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'], ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml'], ['.ico', 'image/x-icon'], ['.woff2', 'font/woff2'],
  ['.woff', 'font/woff'], ['.txt', 'text/plain; charset=utf-8'], ['.pdf', 'application/pdf']
]);
const withinRoot = (value) => value === root || value.startsWith(root + path.sep);
const send = (res, status, text) => {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
  res.end(text);
};
const server = createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) return send(res, 405, 'Method not allowed');
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); }
  catch { return send(res, 400, 'Invalid path'); }
  if (pathname === '/' || pathname === '/Portifolio') {
    res.writeHead(302, { Location: base }); res.end(); return;
  }
  if (!pathname.startsWith(base)) return send(res, 404, 'Not found');
  const relative = pathname.slice(base.length) || 'index.html';
  if (relative.includes('\0') || relative.includes('\\') ||
      relative.split('/').some((part) => part === '..' || part.startsWith('.')) ||
      relative.split('/').includes('node_modules')) return send(res, 400, 'Invalid path');
  const candidate = path.resolve(root, relative);
  if (!withinRoot(candidate)) return send(res, 403, 'Forbidden');
  try {
    const resolved = await realpath(candidate);
    if (!withinRoot(resolved)) return send(res, 403, 'Forbidden');
    const info = await stat(resolved);
    if (!info.isFile()) return send(res, 404, 'Not found');
    const body = await readFile(resolved);
    res.writeHead(200, {
      'Content-Type': mime.get(path.extname(resolved).toLowerCase()) || 'application/octet-stream',
      'Content-Length': body.length,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store'
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (error) {
    send(res, error && error.code === 'ENOENT' ? 404 : 500, 'Not found');
  }
});
server.listen(port, '127.0.0.1', () => {
  console.log('Portfolio ready at http://127.0.0.1:' + port + base);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
