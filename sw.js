/* Guarda os arquivos do app no telefone para funcionar sem internet.
   Ao mudar qualquer arquivo do app, suba o número da VERSAO. */
var VERSAO = 'natacao-v1';
var ARQUIVOS = [
  './',
  'index.html',
  'estilo.css',
  'regras.js',
  'app.js',
  'manifest.webmanifest',
  'icones/apple-touch-icon.png',
  'icones/icone-192.png',
  'icones/icone-512.png'
];

self.addEventListener('install', function (ev) {
  ev.waitUntil(caches.open(VERSAO).then(function (c) {
    return c.addAll(ARQUIVOS.map(function (u) { return new Request(u, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (ev) {
  ev.waitUntil(caches.keys().then(function (nomes) {
    return Promise.all(nomes.filter(function (n) { return n !== VERSAO; }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (ev) {
  var req = ev.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  ev.respondWith(caches.match(req, { ignoreSearch: true }).then(function (r) {
    if (r) return r;
    return fetch(req).catch(function () {
      if (req.mode === 'navigate') return caches.match('./');
      return Response.error();
    });
  }));
});
