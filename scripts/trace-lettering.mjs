// Vetoriza o lettering da segunda dobra (source/atelier/lettering.png, 1536 × 1024)
// e grava source/atelier/lettering.svg, que o build usa. Rodar só quando o PNG mudar:
//   node scripts/trace-lettering.mjs
//
// - O PNG veio do ChatGPT com ~200 mil pixels de névoa (alfa 1–10) que viram
//   halo sobre o vinho: alfa < 16 é zerado antes de traçar.
// - O monograma SB do PNG é um redesenho do SB oficial (IoU 0,88, bordas
//   deformadas). Ele é apagado e substituído pelo SB oficial em vetor
//   (source/sb_symbol_white.svg), na mesma altura e centro.
// - Cada linha é ampliada 4× (Lanczos) antes do potrace, para o contorno
//   seguir o antialias com precisão de subpixel, inclusive nos traços finos
//   da assinatura.
// - As três linhas em caixa-alta são centralizadas no eixo do SB (no PNG elas
//   variavam até 14 px entre si).

import sharp from 'sharp';
import potrace from 'potrace';
import { readFile, writeFile } from 'node:fs/promises';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = `${ROOT}source/atelier/lettering.png`;
const OUT = `${ROOT}source/atelier/lettering.svg`;
const SCALE = 4;
const MARGIN = 6;
const NOISE = 16;

const { data: alpha, info } = await sharp(SRC).extractChannel(3).raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;

// ------------------------------------------------ SB do PNG: localizar e apagar

function component(seedX, seedY) {
  let seed = -1;
  for (let r = 0; r < 80 && seed < 0; r++) {
    for (let dy = -r; dy <= r && seed < 0; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const p = (seedY + dy) * W + seedX + dx;
        if (alpha[p] > 128) { seed = p; break; }
      }
    }
  }
  const mask = new Uint8Array(W * H);
  const stack = [seed];
  mask[seed] = 1;
  const box = [W, H, 0, 0];
  while (stack.length) {
    const q = stack.pop();
    const x = q % W;
    const y = (q / W) | 0;
    box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y);
    box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const r = q + dy * W + dx;
        if (r >= 0 && r < W * H && !mask[r] && alpha[r] > 128) { mask[r] = 1; stack.push(r); }
      }
    }
  }
  return { mask, box };
}

const sb = component(775, 470);
const clean = Buffer.from(alpha);
const FRINGE = 4;
for (let y = sb.box[1] - FRINGE; y <= sb.box[3] + FRINGE; y++) {
  for (let x = sb.box[0] - FRINGE; x <= sb.box[2] + FRINGE; x++) {
    let near = false;
    for (let dy = -FRINGE; dy <= FRINGE && !near; dy++) {
      for (let dx = -FRINGE; dx <= FRINGE; dx++) {
        const yy = y + dy, xx = x + dx;
        if (yy >= 0 && yy < H && xx >= 0 && xx < W && sb.mask[yy * W + xx]) { near = true; break; }
      }
    }
    if (near) clean[y * W + x] = 0;
  }
}
for (let i = 0; i < clean.length; i++) if (clean[i] < NOISE) clean[i] = 0;

// ------------------------------------------------ linhas

function rowsWithInk(y0, y1) {
  const rows = [];
  for (let y = y0; y <= y1; y++) {
    let ink = false;
    for (let x = 0; x < W; x++) if (clean[y * W + x] > 128) { ink = true; break; }
    rows.push(ink);
  }
  return rows;
}

const inkRows = rowsWithInk(0, H - 1);
const bands = [];
for (let y = 0, start = -1; y <= H; y++) {
  const on = y < H && inkRows[y];
  if (on && start < 0) start = y;
  if (!on && start >= 0) { bands.push([start, y - 1]); start = -1; }
}
// til do "SÃO" é uma faixa própria de 5 px: junta com a linha de baixo
const merged = [];
for (const band of bands) {
  const last = merged.at(-1);
  if (last && band[0] - last[1] <= 4) last[1] = band[1];
  else merged.push([...band]);
}
const NAMES = ['handmade', 'studio', 'signature', 'values', 'origin'];
if (merged.length !== NAMES.length) throw new Error(`esperava ${NAMES.length} linhas, achei ${merged.length}: ${JSON.stringify(merged)}`);
const CAPS = new Set(['studio', 'values', 'origin']);

function inkBox(y0, y1) {
  let x0 = W, x1 = -1;
  for (let y = y0; y <= y1; y++) {
    for (let x = 0; x < W; x++) {
      if (clean[y * W + x] > 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
    }
  }
  return [x0, y0, x1, y1];
}

function trace(buffer) {
  return new Promise((resolve, reject) => {
    potrace.trace(buffer, { turdSize: 16, alphaMax: 1, optCurve: true, optTolerance: 0.2, threshold: 128, blackOnWhite: true }, (err, svg) => {
      if (err) reject(err);
      else resolve(svg.match(/ d="([^"]+)"/)[1]);
    });
  });
}

// Só há M, L e C absolutos: todos os números são pares (x, y).
function mapPath(d, fn, decimals = 2) {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+/g);
  let out = '';
  let pair = [];
  let command = '';
  for (const t of tokens) {
    if (/[A-Za-z]/.test(t)) {
      if (!/^[MLCZ]$/.test(t)) throw new Error(`comando inesperado ${t}`);
      if (t !== command || t === 'M' || t === 'Z') out += t;
      command = t;
      continue;
    }
    pair.push(Number(t));
    if (pair.length === 2) {
      const [x, y] = fn(pair[0], pair[1]);
      out += `${out && !/[A-Z]$/.test(out) ? ' ' : ''}${Number(x.toFixed(decimals))} ${Number(y.toFixed(decimals))}`;
      pair = [];
    }
  }
  return out;
}

const sbCenterX = (sb.box[0] + sb.box[2] + 1) / 2;
const groups = [];
for (const [i, [y0, y1]] of merged.entries()) {
  const name = NAMES[i];
  const [bx0, , bx1] = inkBox(y0, y1);
  const left = Math.max(0, bx0 - MARGIN);
  const top = Math.max(0, y0 - MARGIN);
  const width = Math.min(W, bx1 + MARGIN + 1) - left;
  const height = Math.min(H, y1 + MARGIN + 1) - top;

  const crop = await sharp(clean, { raw: { width: W, height: H, channels: 1 } })
    .extract({ left, top, width, height })
    .resize(width * SCALE, height * SCALE, { kernel: 'lanczos3' })
    .negate()
    .png()
    .toBuffer();
  const raw = await trace(crop);
  const shift = CAPS.has(name) ? sbCenterX - (bx0 + bx1 + 1) / 2 : 0;
  const d = mapPath(raw, (x, y) => [left + x / SCALE + shift, top + y / SCALE]);
  groups.push({ name, d, shift });
  console.log(`${name.padEnd(9)} y ${y0}–${y1}  x ${bx0}–${bx1}  deslocamento ${shift.toFixed(1)} px`);
}

// ------------------------------------------------ SB oficial no lugar do SB do PNG

const official = await readFile(`${ROOT}source/sb_symbol_white.svg`, 'utf8');
const officialD = official.match(/<path d="([^"]+)"/)[1];
// Limites geométricos do path oficial (medidos rasterizando a 8×).
const OFFICIAL_BOUNDS = [5.8, 5.5, 557.3, 614.0];
const sbHeight = sb.box[3] - sb.box[1] + 1;
const s = sbHeight / (OFFICIAL_BOUNDS[3] - OFFICIAL_BOUNDS[1]);
const tx = sbCenterX - ((OFFICIAL_BOUNDS[0] + OFFICIAL_BOUNDS[2]) / 2) * s;
const ty = sb.box[1] - OFFICIAL_BOUNDS[1] * s;
groups.splice(1, 0, { name: 'sb', d: mapPath(officialD.replace(/,/g, ' '), (x, y) => [tx + x * s, ty + y * s]), shift: 0 });
console.log(`sb        caixa do PNG ${sb.box.join(',')}  escala oficial ${s.toFixed(5)}`);

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <title>Saggiorato &amp; Benites — The Handmade Design, Studio • Atelier</title>
${groups.map((g) => `  <path id="${g.name}" fill="#FEFDFA" fill-rule="evenodd" d="${g.d}"/>`).join('\n')}
</svg>
`;
await writeFile(OUT, svg);
console.log(`gravado ${OUT} (${(svg.length / 1024).toFixed(0)} KB)`);

// Máscara limpa sem o SB, para conferência do traçado.
await sharp(clean, { raw: { width: W, height: H, channels: 1 } }).png().toFile(`${ROOT}source/atelier/lettering-alpha-clean.png`);
