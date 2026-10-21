#!/usr/bin/env node
/* serve.mjs —— 零依赖静态服务器（本地预览用）
   用法：node scripts/serve.mjs [端口]
   默认 8765。正确处理 HTTP/1.1 keep-alive 与 MIME，比 python -m http.server 稳。 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.PORT || 8765);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

const server = createServer(async (req, res) => {
  const started = Date.now();
  try {
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath.endsWith('/')) urlPath += 'index.html';
    const file = path.join(ROOT, path.normalize(urlPath).replace(/^([/\\])+/, ''));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
    if (!existsSync(file) || !(await stat(file)).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 ' + urlPath);
      console.log(`404 ${urlPath}`);
      return;
    }
    const body = await readFile(file);
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': body.length,
      'Cache-Control': 'no-store',
    });
    res.end(body);
    console.log(`200 ${urlPath}  ${body.length}B  ${Date.now() - started}ms`);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('500 ' + e.message);
    console.log(`500 ${req.url}  ${e.message}`);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[serve] ${ROOT}`);
  console.log(`[serve] → http://127.0.0.1:${PORT}/`);
});
