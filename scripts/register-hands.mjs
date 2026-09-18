// Registra as cinco mãos da quarta dobra num único quadro, para que trocar de
// modelo mude só o estojo, sem a mão "pular". Rodar só quando as imagens mudarem:
//   node scripts/register-hands.mjs
//
// As imagens foram geradas separadamente: a mão aparece deslocada até ~30 px
// (em 1254 px) e com pequenas diferenças de escala e rotação. A "8K" da
// carteira é uma ampliação exata da versão de 1254 px (reduzir e ampliar de
// volta dá erro 0), então todas têm o mesmo detalhe real e são tratadas em 1254.
//
// 1. Correlação cruzada normalizada (NCC) no dorso tatuado: busca exaustiva da
//    translação, depois busca em padrão de escala, rotação e translação até
//    precisão de subpixel.
// 2. Reamostragem Lanczos3 com alfa pré-multiplicado direto em 2× (2508 px),
//    aplicada a todas (a referência com transformação identidade), para a
//    nitidez ser idêntica entre os modelos.
// 3. Recorte comum no topo e à direita, para a manga continuar saindo pelas
//    bordas em todas as imagens depois de transformadas.

import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = `${ROOT}source/hands/`;
const OUT = `${ROOT}source/hands/registered/`;
const N = 1254;
const UP = 2;

export const MODELS = [
  { id: 'caramelo', file: 'mao-carteira-8k.png' },
  { id: 'bordo', file: 'mao-estojo-relogio.png' },
  { id: 'amarelo', file: 'mao-estojo-amarelo.png' },
  { id: 'verde', file: 'mao-estojo-verde.png' },
  { id: 'azul', file: 'mao-estojo-azul.png' },
];

async function load(file) {
  const { data } = await sharp(`${SRC}${file}`, { limitInputPixels: false })
    .resize(N, N, { kernel: 'lanczos3' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const gray = new Float32Array(N * N);
  const alpha = new Float32Array(N * N);
  for (let p = 0; p < N * N; p++) {
    const a = data[p * 4 + 3];
    alpha[p] = a;
    // Luminância sobre fundo preto: o contorno dos dedos também conta.
    gray[p] = ((0.299 * data[p * 4] + 0.587 * data[p * 4 + 1] + 0.114 * data[p * 4 + 2]) * a) / 255;
  }
  return { data, gray, alpha };
}

function bilinear(arr, x, y) {
  if (x < 0 || y < 0 || x > N - 1.001 || y > N - 1.001) return 0;
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const i = y0 * N + x0;
  return (arr[i] * (1 - fx) + arr[i + 1] * fx) * (1 - fy) + (arr[i + N] * (1 - fx) + arr[i + N + 1] * fx) * fy;
}

// Região de referência: dorso e juntas dos dedos, onde só há mão (sem estojo).
const REGION = { x0: 0.36 * N, x1: 0.78 * N, y0: 0.14 * N, y1: 0.58 * N, step: 3 };
const CENTER = { x: (REGION.x0 + REGION.x1) / 2, y: (REGION.y0 + REGION.y1) / 2 };

function samples(ref) {
  const pts = [];
  for (let y = REGION.y0; y < REGION.y1; y += REGION.step) {
    for (let x = REGION.x0; x < REGION.x1; x += REGION.step) {
      const xi = Math.round(x), yi = Math.round(y);
      pts.push([xi, yi, ref.gray[yi * N + xi]]);
    }
  }
  return pts;
}

// p (referência) → q (imagem): q = c + s·R(θ)·(p − c) + t
function mapPoint(T, x, y) {
  const cos = Math.cos(T.theta) * T.s, sin = Math.sin(T.theta) * T.s;
  const dx = x - CENTER.x, dy = y - CENTER.y;
  return [CENTER.x + cos * dx - sin * dy + T.tx, CENTER.y + sin * dx + cos * dy + T.ty];
}

function ncc(pts, img, T) {
  let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  for (const [x, y, va] of pts) {
    const [qx, qy] = mapPoint(T, x, y);
    const vb = bilinear(img.gray, qx, qy);
    sa += va; sb += vb; saa += va * va; sbb += vb * vb; sab += va * vb;
  }
  const n = pts.length;
  const cov = sab / n - (sa / n) * (sb / n);
  return cov / Math.sqrt((saa / n - (sa / n) ** 2) * (sbb / n - (sb / n) ** 2));
}

function register(pts, img) {
  let best = { s: 1, theta: 0, tx: 0, ty: 0 };
  let score = -2;
  for (let ty = -48; ty <= 48; ty += 2) {
    for (let tx = -48; tx <= 48; tx += 2) {
      const T = { s: 1, theta: 0, tx, ty };
      const c = ncc(pts, img, T);
      if (c > score) { score = c; best = T; }
    }
  }
  const coarse = score;
  const steps = { s: 0.02, theta: (1 * Math.PI) / 180, tx: 2, ty: 2 };
  const min = { s: 0.0003, theta: (0.01 * Math.PI) / 180, tx: 0.05, ty: 0.05 };
  while (Object.keys(steps).some((k) => steps[k] > min[k])) {
    let improved = false;
    for (const k of Object.keys(steps)) {
      if (steps[k] <= min[k]) continue;
      for (const dir of [1, -1]) {
        const T = { ...best, [k]: best[k] + dir * steps[k] };
        const c = ncc(pts, img, T);
        if (c > score + 1e-7) { score = c; best = T; improved = true; }
      }
    }
    if (!improved) for (const k of Object.keys(steps)) steps[k] /= 2;
  }
  return { T: best, score, coarse };
}

// ---------------------------------------------------------------- reamostragem

function lanczos(x) {
  if (x === 0) return 1;
  if (x <= -3 || x >= 3) return 0;
  const px = Math.PI * x;
  return (3 * Math.sin(px) * Math.sin(px / 3)) / (px * px);
}

function warp(img, T) {
  const W = N * UP;
  const pre = new Float32Array(N * N * 4);
  for (let p = 0; p < N * N; p++) {
    const a = img.data[p * 4 + 3] / 255;
    pre[p * 4] = img.data[p * 4] * a;
    pre[p * 4 + 1] = img.data[p * 4 + 1] * a;
    pre[p * 4 + 2] = img.data[p * 4 + 2] * a;
    pre[p * 4 + 3] = img.data[p * 4 + 3];
  }
  const out = Buffer.alloc(W * W * 4);
  const wx = new Float32Array(6), wy = new Float32Array(6);
  for (let Y = 0; Y < W; Y++) {
    for (let X = 0; X < W; X++) {
      const [qx, qy] = mapPoint(T, (X + 0.5) / UP - 0.5, (Y + 0.5) / UP - 0.5);
      const ix = Math.floor(qx), iy = Math.floor(qy);
      if (ix < -3 || iy < -3 || ix > N + 2 || iy > N + 2) continue;
      let sw = 0, swy = 0;
      for (let k = 0; k < 6; k++) { wx[k] = lanczos(qx - (ix - 2 + k)); sw += wx[k]; }
      for (let k = 0; k < 6; k++) { wy[k] = lanczos(qy - (iy - 2 + k)); swy += wy[k]; }
      let r = 0, g = 0, b = 0, a = 0;
      for (let j = 0; j < 6; j++) {
        const yy = iy - 2 + j;
        if (yy < 0 || yy >= N) continue;
        const w0 = wy[j] / swy;
        for (let i = 0; i < 6; i++) {
          const xx = ix - 2 + i;
          if (xx < 0 || xx >= N) continue;
          const w = (w0 * wx[i]) / sw;
          const p = (yy * N + xx) * 4;
          r += pre[p] * w; g += pre[p + 1] * w; b += pre[p + 2] * w; a += pre[p + 3] * w;
        }
      }
      const o = (Y * W + X) * 4;
      const alpha = Math.min(255, Math.max(0, a));
      out[o + 3] = Math.round(alpha);
      if (alpha > 0.5) {
        const k = 255 / alpha;
        out[o] = Math.min(255, Math.max(0, Math.round(r * k)));
        out[o + 1] = Math.min(255, Math.max(0, Math.round(g * k)));
        out[o + 2] = Math.min(255, Math.max(0, Math.round(b * k)));
      }
    }
  }
  return out;
}

// Quanto a borda de cima e a da direita da imagem original "entram" no quadro
// da referência depois da transformação (onde a manga ficaria cortada).
function edgeInset(T) {
  const cos = Math.cos(T.theta) * T.s, sin = Math.sin(T.theta) * T.s;
  const det = cos * cos + sin * sin;
  const inverse = (qx, qy) => {
    const dx = qx - T.tx - CENTER.x, dy = qy - T.ty - CENTER.y;
    return [CENTER.x + (cos * dx + sin * dy) / det, CENTER.y + (-sin * dx + cos * dy) / det];
  };
  let top = 0, right = 0;
  for (let t = 0; t <= N - 1; t += 8) {
    top = Math.max(top, inverse(t, 0)[1]);
    right = Math.max(right, N - 1 - inverse(N - 1, t)[0]);
  }
  return { top, right };
}

// ---------------------------------------------------------------- execução

if (import.meta.url === `file://${process.argv[1]}`) {
  await mkdir(OUT, { recursive: true });
  const images = [];
  for (const m of MODELS) images.push({ ...m, img: await load(m.file) });
  const ref = images[0];
  const pts = samples(ref.img);

  const transforms = {};
  for (const item of images) {
    if (item === ref) {
      transforms[item.id] = { s: 1, theta: 0, tx: 0, ty: 0 };
      console.log(`${item.id.padEnd(9)} referência`);
      continue;
    }
    const before = ncc(pts, item.img, { s: 1, theta: 0, tx: 0, ty: 0 });
    const { T, score, coarse } = register(pts, item.img);
    transforms[item.id] = T;
    console.log(`${item.id.padEnd(9)} NCC ${before.toFixed(4)} → ${coarse.toFixed(4)} (translação) → ${score.toFixed(4)} | escala ${T.s.toFixed(4)} rotação ${((T.theta * 180) / Math.PI).toFixed(2)}° dx ${T.tx.toFixed(2)} dy ${T.ty.toFixed(2)}`);
  }

  let top = 0, right = 0;
  for (const T of Object.values(transforms)) {
    const e = edgeInset(T);
    top = Math.max(top, e.top);
    right = Math.max(right, e.right);
  }
  const crop = { top: Math.ceil((top + 1) * UP), right: Math.ceil((right + 1) * UP) };
  const W = N * UP;
  const frame = { left: 0, top: crop.top, width: W - crop.right, height: W - crop.top };
  console.log(`recorte comum (em ${W} px): topo ${crop.top}, direita ${crop.right} → quadro ${frame.width}×${frame.height}`);

  for (const item of images) {
    const t = Date.now();
    const pixels = warp(item.img, transforms[item.id]);
    await sharp(pixels, { raw: { width: W, height: W, channels: 4 } })
      .extract(frame)
      .png({ compressionLevel: 6 })
      .toFile(`${OUT}${item.id}.png`);
    console.log(`${item.id.padEnd(9)} reamostrada em ${((Date.now() - t) / 1000).toFixed(1)}s`);
  }
  await writeFile(`${OUT}registro.json`, JSON.stringify({ size: N, upscale: UP, frame, transforms }, null, 2) + '\n');
}
