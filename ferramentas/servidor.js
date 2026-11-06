// Servidor local só para testar no computador (não é usado no telefone).
// Uso: node ferramentas/servidor.js  -> http://127.0.0.1:8850
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const PORTA = Number(process.env.PORT) || 8850;
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json'
};
const PERMITIDOS = new Set(['index.html', 'estilo.css', 'regras.js', 'app.js', 'sw.js', 'manifest.webmanifest',
  'icones/apple-touch-icon.png', 'icones/icone-192.png', 'icones/icone-512.png']);

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
  if (p === '') p = 'index.html';
  if (!PERMITIDOS.has(p)) { res.writeHead(404); res.end('não encontrado'); return; }
  fs.readFile(path.join(RAIZ, p), (err, dados) => {
    if (err) { res.writeHead(404); res.end('não encontrado'); return; }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(dados);
  });
}).listen(PORTA, '127.0.0.1', () => console.log('http://127.0.0.1:' + PORTA));
