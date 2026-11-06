// Gera os ícones PNG do app (ondas de piscina), sem nenhuma biblioteca.
// Uso: node ferramentas/gerar-icones.js
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const TAB = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TAB[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function bloco(tipo, dados) {
  const t = Buffer.from(tipo, 'ascii');
  const tam = Buffer.alloc(4); tam.writeUInt32BE(dados.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, dados])));
  return Buffer.concat([tam, t, dados, crc]);
}
function png(lado, pixel) {
  const SS = 4; // suavização das bordas
  const linhas = Buffer.alloc((lado * 3 + 1) * lado);
  for (let y = 0; y < lado; y++) {
    linhas[y * (lado * 3 + 1)] = 0;
    for (let x = 0; x < lado; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const c = pixel((x + (sx + 0.5) / SS) / lado, (y + (sy + 0.5) / SS) / lado);
        r += c[0]; g += c[1]; b += c[2];
      }
      const o = y * (lado * 3 + 1) + 1 + x * 3;
      linhas[o] = Math.round(r / SS / SS); linhas[o + 1] = Math.round(g / SS / SS); linhas[o + 2] = Math.round(b / SS / SS);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lado, 0); ihdr.writeUInt32BE(lado, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    bloco('IHDR', ihdr), bloco('IDAT', zlib.deflateSync(linhas, { level: 9 })), bloco('IEND', Buffer.alloc(0))
  ]);
}
const mistura = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const AZUL_CEU = [18, 140, 214], AZUL_FUNDO = [6, 84, 150], BRANCO = [255, 255, 255], AMARELO = [255, 202, 64];

function desenho(u, v) {
  let cor = mistura(AZUL_CEU, AZUL_FUNDO, v);
  // sol / boia
  const dx = u - 0.5, dy = v - 0.33;
  if (dx * dx + dy * dy < 0.15 * 0.15) cor = AMARELO;
  // três ondas brancas
  for (let i = 0; i < 3; i++) {
    const centro = 0.58 + i * 0.12 + 0.03 * Math.sin((u * 2.2 + i * 0.35) * Math.PI * 2);
    if (Math.abs(v - centro) < 0.028) cor = BRANCO;
  }
  return cor;
}

const pasta = path.join(__dirname, '..', 'icones');
fs.mkdirSync(pasta, { recursive: true });
for (const [nome, lado] of [['apple-touch-icon.png', 180], ['icone-192.png', 192], ['icone-512.png', 512]]) {
  fs.writeFileSync(path.join(pasta, nome), png(lado, desenho));
  console.log('ok', nome, lado);
}
