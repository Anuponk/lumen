import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const start = '/docs/lumen-v2-prototype/';
const types = {
  html: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  json: 'application/json',
  svg: 'image/svg+xml',
  png: 'image/png',
  webp: 'image/webp',
};
const allowed = /^\/(?:docs\/(?:lumen-v2-prototype|validation)\/|src\/|content\/|icon\.svg$)/;

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const name =
      url.pathname === '/' || url.pathname === start ? start + 'index.html' : url.pathname;
    const extension = name.split('.').at(-1);
    const file = new URL('.' + name, root);
    if (
      !['GET', 'HEAD'].includes(request.method) ||
      !allowed.test(name) ||
      !types[extension] ||
      !file.href.startsWith(root.href) ||
      !(await stat(file)).isFile()
    ) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': types[extension],
      'X-Content-Type-Options': 'nosniff',
    });
    if (request.method === 'HEAD') response.end();
    else
      createReadStream(file)
        .on('error', () => response.destroy())
        .pipe(response);
  } catch {
    response.writeHead(404).end();
  }
});

const port = Number(process.argv[2] || 10887);
server.listen(port, '127.0.0.1', () => {
  console.log('LUMEN V2 · http://127.0.0.1:' + port + start);
});
