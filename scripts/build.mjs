// Gera os assets do hero a partir de source/ e injeta o markup no index.html.
//
// Fundo: sai do PNG 8K (Saggiorato_Benites_Fundo_8K.png), não do SVG vetorial.
// O SVG de 104 MB (372 mil caminhos) posteriza o couro e serrilha as bordas
// quando comparado 1:1 com o PNG; além disso seria pesado demais para o
// navegador. O PNG é uma ampliação Lanczos de uma geração de 1672 px, então
// cada tamanho recebe um sharpen proporcional ao quanto amplia o original.
//
// Marca: caminhos de hero_overlay_vector.svg (a composição validada na prévia),
// uma <svg> inline por peça, posicionadas pelas coordenadas de layout.json.
//
// Uso: npm run build            (pula imagens que já existem)
//      npm run build -- --force (regera tudo)

import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readdir, rm } from 'node:fs/promises';
import { buildAtelier } from './atelier.mjs';
import { buildLuxury } from './luxury.mjs';
import { buildHandmade } from './handmade.mjs';
import { buildDuffle } from './duffle.mjs';
import { buildHeranca } from './heranca.mjs';
import { buildRodape } from './rodape.mjs';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = `${ROOT}source/`;
const IMG = `${ROOT}assets/img/`;
const FORCE = process.argv.includes('--force');

const layout = JSON.parse(await readFile(`${SRC}layout.json`, 'utf8'));
const overlay = await readFile(`${SRC}hero_overlay_vector.svg`, 'utf8');

// ---------------------------------------------------------------- fundo

const BACKGROUND = `${SRC}Saggiorato_Benites_Fundo_8K.png`;
const NATIVE_WIDTH = layout.generated_background_native.width;
const WIDTHS = [960, 1440, 1920, 2560, 3840, 5120];
// Largura do palco em CSS: retrato usa a altura; paisagem até 16:9 usa a
// largura; mais estreito que 16:9 o palco transborda na horizontal.
const SIZES = '(max-aspect-ratio: 1/1) 100vh, (min-aspect-ratio: 16/9) 100vw, 177.78vh';

const round = (n, d) => Number(n.toFixed(d));

async function buildBackground() {
  await mkdir(IMG, { recursive: true });
  for (const width of WIDTHS) {
    const height = Math.round((width * 9) / 16);
    const files = { avif: `${IMG}fundo-${width}.avif`, webp: `${IMG}fundo-${width}.webp` };
    if (!FORCE && existsSync(files.avif) && existsSync(files.webp)) continue;

    const t = Date.now();
    let pipeline = sharp(BACKGROUND, { limitInputPixels: false })
      .resize(width, height, { kernel: 'lanczos3' })
      .toColourspace('srgb');
    if (width > NATIVE_WIDTH) {
      const sigma = round((0.4 * width) / NATIVE_WIDTH, 2);
      pipeline = pipeline.sharpen({ sigma, m1: 0.5, m2: 1.5 });
    }
    const pixels = await pipeline.raw().toBuffer({ resolveWithObject: true });
    const raw = () => sharp(pixels.data, { raw: pixels.info });

    // q88 + 10 bits preserva o grão dos pretos (q72-80 vira mancha com ganho de
    // brilho, o que aparece em telas OLED); 4:4:4 mantém a borda
    // do laranja e do azul contra o couro marrom.
    await raw().avif({ quality: 88, effort: 6, chromaSubsampling: '4:4:4', bitdepth: 10 }).toFile(files.avif);
    await raw().webp({ quality: 92, effort: 6, smartSubsample: true }).toFile(files.webp);
    console.log(`fundo ${width}px  ${((Date.now() - t) / 1000).toFixed(1)}s`);
  }

  const lqip = await sharp(BACKGROUND, { limitInputPixels: false })
    .resize(32, 18, { kernel: 'lanczos3' })
    .webp({ quality: 70 })
    .toBuffer();
  return `data:image/webp;base64,${lqip.toString('base64')}`;
}

// ---------------------------------------------------------------- marca

// Arredonda as coordenadas e remove comandos repetidos. Com 2 casas no espaço
// da referência (1 unidade = 2,77 px no quadro 8K) o erro máximo é 0,014 px.
function compactPath(d, decimals) {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g);
  let out = '';
  let command = '';
  let previousWasNumber = false;
  for (const token of tokens) {
    if (/[a-zA-Z]/.test(token)) {
      if (token === command && token !== 'M' && token !== 'Z') continue;
      out += token;
      command = token;
      previousWasNumber = false;
      continue;
    }
    let value = round(Number(token), decimals);
    if (Object.is(value, -0)) value = 0;
    const text = String(value);
    if (previousWasNumber && !text.startsWith('-')) out += ' ';
    out += text;
    previousWasNumber = true;
  }
  return out;
}

function overlayPath(id) {
  const group = overlay.match(new RegExp(`<g id="${id}"[^>]*>\\s*<path d="([^"]+)"`));
  if (!group) throw new Error(`grupo ${id} não encontrado em hero_overlay_vector.svg`);
  return group[1];
}

const layer = (name) => layout.layers.find((l) => l.name === name).reference_bounds;
const symbolViewBox = (await readFile(`${SRC}sb_symbol_white.svg`, 'utf8'))
  .match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);

// Cada peça: caixa no espaço da referência (x, y, w, h) + viewBox da geometria.
const PIECES = [
  {
    id: 'est',
    tag: 'p',
    label: 'Est. São Paulo',
    box: layer('est_sao_paulo'),
    viewBox: layer('est_sao_paulo'),
    d: compactPath(overlayPath('est_sao_paulo'), 2),
    delay: '0.1s',
  },
  {
    id: 'wordmark',
    tag: 'h1',
    label: 'Saggiorato & Benites',
    box: layer('wordmark'),
    viewBox: layer('wordmark'),
    d: compactPath(overlayPath('wordmark'), 2),
    delay: '0.3s',
  },
  {
    id: 'tagline',
    tag: 'p',
    label: 'Time, purpose, craft',
    box: layer('time_purpose_craft'),
    viewBox: layer('time_purpose_craft'),
    d: compactPath(overlayPath('time_purpose_craft'), 2),
    delay: '1.2s',
  },
  {
    id: 'symbol',
    tag: 'span',
    label: null,
    box: [layout.symbol.reference_x, layout.symbol.reference_y, layout.symbol.reference_width, layout.symbol.reference_height],
    viewBox: symbolViewBox,
    // Viewbox 562 × 618 reduzido a ~63 × 70 unidades: 1 casa basta.
    d: compactPath(overlayPath('sb_symbol'), 1),
    delay: '1.45s',
  },
];

// Folga em volta de cada peça (unidades da referência) para o antialias e a
// máscara da animação não cortarem pontas de traço encostadas no viewBox.
const PAD = 2;

// O quadro de referência (1170 × 1557) fica centrado no palco 16:9.
const REF_H = layout.reference.height;
const STAGE_W = (REF_H * 16) / 9;
const REF_X = (STAGE_W - layout.reference.width) / 2;

const pct = (n) => `${round(n * 100, 4)}%`;

function buildLockup() {
  const padded = PIECES.map((piece) => {
    const [x, y, w, h] = piece.box;
    const [vx, vy, vw, vh] = piece.viewBox;
    const px = (PAD * vw) / w;
    const py = (PAD * vh) / h;
    return {
      ...piece,
      box: [x - PAD, y - PAD, w + 2 * PAD, h + 2 * PAD],
      viewBox: [vx - px, vy - py, vw + 2 * px, vh + 2 * py].map((n) => round(n, 3)),
    };
  });

  const x0 = Math.min(...padded.map((p) => p.box[0]));
  const y0 = Math.min(...padded.map((p) => p.box[1]));
  const x1 = Math.max(...padded.map((p) => p.box[0] + p.box[2]));
  const y1 = Math.max(...padded.map((p) => p.box[1] + p.box[3]));
  const lw = x1 - x0;
  const lh = y1 - y0;

  const lockupStyle = [
    `--cx:${pct((REF_X + x0 + lw / 2) / STAGE_W)}`,
    `--cy:${pct((y0 + lh / 2) / REF_H)}`,
    `--lockup-w:${pct(lw / STAGE_W)}`,
    `--lockup-ratio:${round(lw, 3)}/${round(lh, 3)}`,
  ].join(';');

  const pieces = padded.map((p) => {
    const [x, y, w, h] = p.box;
    const style = [
      `--x:${pct((x - x0) / lw)}`,
      `--y:${pct((y - y0) / lh)}`,
      `--w:${pct(w / lw)}`,
      `--h:${pct(h / lh)}`,
      `--delay:${p.delay}`,
    ].join(';');
    const label = p.label ? `<span class="sr-only">${p.label.replace('&', '&amp;')}</span>` : '';
    const svg = `<svg viewBox="${p.viewBox.join(' ')}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path fill-rule="evenodd" d="${p.d}"/></svg>`;
    const hidden = p.label ? '' : ' aria-hidden="true"';
    return `      <${p.tag} class="hero__piece hero__${p.id}" style="${style}"${hidden}>${label}${svg}</${p.tag}>`;
  });

  return { lockupStyle, pieces };
}

// ---------------------------------------------------------------- ícones

async function buildIcons() {
  const [vx, vy, vw, vh] = symbolViewBox;
  const d = compactPath(overlayPath('sb_symbol'), 0);
  const side = Math.max(vw, vh) * 1.1;
  const box = [vx - (side - vw) / 2, vy - (side - vh) / 2, side, side].map((n) => round(n, 1));
  const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.join(' ')}"><style>path{fill:#0b0b0b}@media (prefers-color-scheme:dark){path{fill:#fff}}</style><path fill-rule="evenodd" d="${d}"/></svg>\n`;
  await writeFile(`${ROOT}assets/favicon.svg`, favicon);

  // Ícones raster: monograma branco sobre o preto do hero.
  const tile = (size, scale) => {
    const inner = Math.round(size * scale);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${inner}" height="${inner}" viewBox="${box.join(' ')}"><path fill="#fff" fill-rule="evenodd" d="${d}"/></svg>`;
    const offset = Math.round((size - inner) / 2);
    return sharp({ create: { width: size, height: size, channels: 4, background: '#050505' } })
      .composite([{ input: Buffer.from(svg), left: offset, top: offset }])
      .png();
  };
  await tile(180, 0.62).toFile(`${ROOT}assets/apple-touch-icon.png`);
  await tile(32, 0.9).toFile(`${ROOT}assets/favicon-32.png`);
}

// ---------------------------------------------------------------- html

function srcset(format) {
  return WIDTHS.map((w) => `assets/img/fundo-${w}.${format} ${w}w`).join(', ');
}

function replaceBetween(html, marker, content) {
  const pattern = new RegExp(`(<!-- ${marker}:start -->)[\\s\\S]*?(<!-- ${marker}:end -->)`);
  if (!pattern.test(html)) throw new Error(`marcadores ${marker} não encontrados no index.html`);
  return html.replace(pattern, `$1\n${content}\n    $2`);
}

const lqip = await buildBackground();
await buildIcons();
const { lockupStyle, pieces } = buildLockup();

const preload = `    <link rel="preload" as="image" type="image/avif" fetchpriority="high" imagesrcset="${srcset('avif')}" imagesizes="${SIZES}">`;

const hero = `    <div class="hero__stage">
      <div class="hero__lqip" style="background-image:url(${lqip})"></div>
      <picture class="hero__photo">
        <source type="image/avif" srcset="${srcset('avif')}" sizes="${SIZES}">
        <source type="image/webp" srcset="${srcset('webp')}" sizes="${SIZES}">
        <img src="assets/img/fundo-1920.webp" width="1920" height="1080" fetchpriority="high"
          alt="Quatro estojos de couro para relógios, dois laranja e dois azul-petróleo com laterais xadrez, sobre uma maleta antiga de couro marrom, no interior escuro de uma cabine de viagem.">
      </picture>
      <div class="hero__lockup" style="${lockupStyle}">
${pieces.join('\n')}
      </div>
    </div>`;

const atelier = await buildAtelier({ root: ROOT, force: FORCE });
const luxury = await buildLuxury({ root: ROOT, force: FORCE });
const handmade = await buildHandmade({ root: ROOT, force: FORCE });
const heranca = await buildHeranca({ root: ROOT, force: FORCE });
const rodape = await buildRodape({ root: ROOT, force: FORCE });
const duffle = await buildDuffle({ root: ROOT, force: FORCE });

let html = await readFile(`${ROOT}index.html`, 'utf8');
html = replaceBetween(html, 'preload', preload);
html = replaceBetween(html, 'hero', hero);
html = replaceBetween(html, 'atelier', atelier);
html = replaceBetween(html, 'luxury-bg', luxury.background);
html = replaceBetween(html, 'luxury-gallery', luxury.gallery);
html = replaceBetween(html, 'handmade-bg', handmade.background);
html = replaceBetween(html, 'handmade-hands', handmade.hands);
html = replaceBetween(html, 'handmade-swatches', handmade.swatches);
html = replaceBetween(html, 'rodape-bg', rodape.background);
html = replaceBetween(html, 'heranca-bg', heranca.background);
html = replaceBetween(html, 'heranca-signature', heranca.signature);
html = replaceBetween(html, 'heranca-items', heranca.items);
html = replaceBetween(html, 'duffle-bg', duffle.background);
html = replaceBetween(html, 'duffle-art', duffle.art);
// Carimbo de versão no CSS: os assets são cacheados por um ano, e sem o
// carimbo o navegador continuaria servindo a folha de estilo antiga.
const css = await readFile(`${ROOT}assets/css/styles.css`);
const carimbo = createHash('sha256').update(css).digest('hex').slice(0, 8);
for (const arquivo of await readdir(`${ROOT}assets/css`)) {
  if (/^styles\.[0-9a-f]{8}\.css$/.test(arquivo) && arquivo !== `styles.${carimbo}.css`) {
    await rm(`${ROOT}assets/css/${arquivo}`);
  }
}
await writeFile(`${ROOT}assets/css/styles.${carimbo}.css`, css);
html = html.replace(/href="assets\/css\/styles(?:\.[0-9a-f]{8})?\.css"/, `href="assets/css/styles.${carimbo}.css"`);
console.log(`css: styles.${carimbo}.css`);

await writeFile(`${ROOT}index.html`, html);
console.log(`index.html atualizado (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
