// Segunda dobra: "The Handmade Design" sobre o fundo vinho, com as cinco fotos
// girando numa roda cujo centro fica abaixo da dobra (só o arco de cima aparece).
//
// Geometria medida na referência (Design sem nome (1).png, 18750 × 7813),
// em unidades de um palco 1920 × 800:
// - centro da roda (960, 985), raio 781 (ajuste por mínimos quadrados dos
//   centros dos cards; resíduo 6,9 u). Cada card gira junto com o arco.
// - cards com a proporção da foto (3:4 ou 4:5) e área ~74 800 u²; cantos 14,5 u.
// - lettering com escala uniforme de 0,334 u por pixel do PNG; o eixo do SB
//   foi alinhado ao eixo da roda (x = 960).
//
// A referência espaça os cards ~29°. A roda usa 10 posições a 36° com as cinco
// fotos repetidas em lados opostos: quando uma foto sai da vista à direita, a
// gêmea dela está entrando pela esquerda.

import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const STAGE = { width: 1920, height: 800 };
const ORBIT = { cx: 960, cy: 985, radius: 781, slots: 10 };
const CARD_AREA = 74800;
const CARD_RADIUS = 14.5;

// Ordem no sentido horário a partir do topo (posição 0 = card central da referência).
const PHOTOS = [
  { id: '5524', alt: 'Estojo de couro azul-petróleo com base laranja, aberto, com oito relógios de luxo nas almofadas de camurça.' },
  { id: '5521', alt: 'Caixa de relógios verde com forro xadrez e nove relógios, ao lado de uma caixa de madeira com dobradiças cromadas.' },
  { id: '5522', alt: 'Bandeja organizadora de couro verde com divisórias forradas em tecido xadrez, sobre couro verde.' },
  { id: '5525', alt: 'Dois estojos cilíndricos de couro azul-marinho com tampas em xadrez, sobre um tapete estampado.' },
  { id: '5523', alt: 'Bolsa de viagem de couro verde-oliva com faixa central em xadrez, num ambiente com estante iluminada.' },
];
const PHOTO_WIDTHS = [360, 540, 720];

const BACKGROUND_WIDTHS = [960, 1440, 1920, 2560, 3840, 5120];

// Lettering: pixel do PNG → unidade do palco.
const LETTERING = {
  scale: 0.33401, // média de 0,33367 (horizontal) e 0,33435 (vertical)
  axisPx: 775, // centro do SB no PNG
  axisU: ORBIT.cx,
  topPx: 83,
  topU: 438.37,
  pad: 3,
};
const PIECES = [
  { id: 'handmade', tag: 'h2', label: 'The Handmade Design', motion: 'ink', delay: 0.35 },
  { id: 'sb', tag: 'span', label: null, motion: 'rise', delay: 0.8 },
  { id: 'studio', tag: 'p', label: 'Studio • Atelier', motion: 'rise', delay: 1.1 },
  { id: 'signature', tag: 'p', label: 'Saggiorato & Benites', motion: 'ink', delay: 1.3 },
  { id: 'values', tag: 'p', label: 'Purpose © Time © Exclusivity', motion: 'rise', delay: 1.95 },
  { id: 'origin', tag: 'p', label: 'São Paulo • Veneto', motion: 'rise', delay: 2.1 },
];
const INK = '#FEFDFA';

const round = (n, d) => Number(n.toFixed(d));
const pct = (n) => `${round(n * 100, 4)}%`;
const escape = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

async function encode(pipeline, base, { avif, webp }) {
  const pixels = await pipeline.raw().toBuffer({ resolveWithObject: true });
  const raw = () => sharp(pixels.data, { raw: pixels.info });
  await raw().avif(avif).toFile(`${base}.avif`);
  await raw().webp(webp).toFile(`${base}.webp`);
}

// ---------------------------------------------------------------- fundo

async function buildBackground(root, force) {
  const src = `${root}source/atelier/fundo-vinho-8k.png`;
  for (const width of BACKGROUND_WIDTHS) {
    const base = `${root}assets/img/atelier/vinho-${width}`;
    if (!force && existsSync(`${base}.avif`) && existsSync(`${base}.webp`)) continue;
    const t = Date.now();
    const height = Math.round(width / 2.4);
    await encode(
      sharp(src, { limitInputPixels: false }).resize(width, height, { kernel: 'lanczos3' }).toColourspace('srgb'),
      base,
      // O grão fino da textura some abaixo de q92 (medido com contraste 6×);
      // 10 bits evita degraus na vinheta.
      { avif: { quality: 92, effort: 6, chromaSubsampling: '4:4:4', bitdepth: 10 }, webp: { quality: 92, effort: 6, smartSubsample: true } },
    );
    console.log(`vinho ${width}px  ${((Date.now() - t) / 1000).toFixed(1)}s`);
  }
}

// ---------------------------------------------------------------- fotos

async function buildPhotos(root, force) {
  for (const photo of PHOTOS) {
    const src = `${root}source/atelier/img-${photo.id}.jpg`;
    const meta = await sharp(src).metadata();
    photo.nativeWidth = meta.width;
    photo.nativeHeight = meta.height;
    photo.widths = [...PHOTO_WIDTHS.filter((w) => w < meta.width), meta.width];
    for (const width of photo.widths) {
      const base = `${root}assets/img/atelier/img-${photo.id}-${width}`;
      if (!force && existsSync(`${base}.avif`) && existsSync(`${base}.webp`)) continue;
      await encode(
        sharp(src).rotate().resize(width, Math.round((width * meta.height) / meta.width), { kernel: 'lanczos3' }).toColourspace('srgb'),
        base,
        { avif: { quality: 80, effort: 6 }, webp: { quality: 88, effort: 6, smartSubsample: true } },
      );
    }
    console.log(`foto ${photo.id} ${meta.width}×${meta.height} → ${photo.widths.join(', ')}`);
  }
}

// ---------------------------------------------------------------- lettering

function pathBounds(d) {
  const nums = d.match(/-?\d*\.?\d+/g).map(Number);
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i < nums.length; i += 2) {
    box[0] = Math.min(box[0], nums[i]); box[2] = Math.max(box[2], nums[i]);
    box[1] = Math.min(box[1], nums[i + 1]); box[3] = Math.max(box[3], nums[i + 1]);
  }
  return box;
}

// Reduz para 1 casa (0,05 px do PNG = 0,017 u de erro máximo).
function roundPath(d) {
  return d.replace(/-?\d*\.\d+/g, (n) => String(round(Number(n), 1)));
}

async function buildLettering(root) {
  const svg = await readFile(`${root}source/atelier/lettering.svg`, 'utf8');
  const { pad, scale } = LETTERING;
  const pieces = PIECES.map((piece) => {
    const match = svg.match(new RegExp(`<path id="${piece.id}"[^>]* d="([^"]+)"`));
    if (!match) throw new Error(`peça ${piece.id} não encontrada em lettering.svg`);
    const d = roundPath(match[1]);
    const [x0, y0, x1, y1] = pathBounds(d);
    const box = [Math.floor(x0 - pad), Math.floor(y0 - pad), Math.ceil(x1 + pad), Math.ceil(y1 + pad)];
    return { ...piece, d, box };
  });

  await mkdir(`${root}assets/svg`, { recursive: true });
  for (const p of pieces) {
    const [x0, y0, x1, y1] = p.box;
    const file = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" width="${x1 - x0}" height="${y1 - y0}"><path fill="${INK}" fill-rule="evenodd" d="${p.d}"/></svg>\n`;
    await writeFile(`${root}assets/svg/atelier-${p.id}.svg`, file);
  }

  const lx0 = Math.min(...pieces.map((p) => p.box[0]));
  const ly0 = Math.min(...pieces.map((p) => p.box[1]));
  const lx1 = Math.max(...pieces.map((p) => p.box[2]));
  const ly1 = Math.max(...pieces.map((p) => p.box[3]));
  const lw = lx1 - lx0;
  const lh = ly1 - ly0;
  const toU = {
    x: (px) => LETTERING.axisU + (px - LETTERING.axisPx) * scale,
    y: (py) => LETTERING.topU + (py - LETTERING.topPx) * scale,
  };
  const lockupStyle = [
    `--x:${round(toU.x(lx0), 3)}`,
    `--y:${round(toU.y(ly0), 3)}`,
    `--w:${round(lw * scale, 3)}`,
    `--ratio:${lw}/${lh}`,
  ].join(';');

  const markup = pieces.map((p) => {
    const [x0, y0, x1, y1] = p.box;
    const style = [
      `--px:${pct((x0 - lx0) / lw)}`,
      `--py:${pct((y0 - ly0) / lh)}`,
      `--pw:${pct((x1 - x0) / lw)}`,
      `--ph:${pct((y1 - y0) / lh)}`,
      `--delay:${p.delay}s`,
    ].join(';');
    const id = p.id === 'handmade' ? ' id="atelier-title"' : '';
    const hidden = p.label ? '' : ' aria-hidden="true"';
    const alt = p.label ? escape(p.label) : '';
    return `          <${p.tag}${id} class="atelier__piece atelier__piece--${p.motion}" style="${style}"${hidden}><img src="assets/svg/atelier-${p.id}.svg" alt="${alt}" width="${x1 - x0}" height="${y1 - y0}" loading="lazy" decoding="async"></${p.tag}>`;
  });

  return { lockupStyle, markup };
}

// ---------------------------------------------------------------- html

const srcset = (files) => files.map(([url, w]) => `${url} ${w}w`).join(', ');

// Largura do palco em CSS (ver styles.css): 409vw em celulares, 1600px até
// 1600 de largura, 100vw acima disso.
const CARD_SIZES = '(max-width: 391px) 53vw, (max-width: 1600px) 208px, 12.8vw';
// No celular o palco tem 409vw, mas só ~1/4 aparece: 853px (→ 2560 em DPR 3)
// mantém o grão nítido sem baixar 900 KB–1,2 MB de uma textura lisa.
const BACKGROUND_SIZES = '(max-width: 391px) 853px, (max-width: 1600px) 1600px, 100vw';

function cardMarkup(slot) {
  const photo = PHOTOS[slot % PHOTOS.length];
  const ratio = photo.nativeWidth / photo.nativeHeight;
  const w = round(Math.sqrt(CARD_AREA * ratio), 2);
  const h = round(CARD_AREA / w, 2);
  const twin = slot >= PHOTOS.length;
  const files = (fmt) => srcset(photo.widths.map((width) => [`assets/img/atelier/img-${photo.id}-${width}.${fmt}`, width]));
  const fallbackWidth = photo.widths.find((width) => width >= 540) ?? photo.widths.at(-1);
  return `          <li class="orbit__item orbit__card" style="--k:${slot};--w:${w};--h:${h}"${twin ? ' aria-hidden="true"' : ''}>
            <picture>
              <source type="image/avif" srcset="${files('avif')}" sizes="${CARD_SIZES}">
              <source type="image/webp" srcset="${files('webp')}" sizes="${CARD_SIZES}">
              <img src="assets/img/atelier/img-${photo.id}-${fallbackWidth}.webp" width="${photo.nativeWidth}" height="${photo.nativeHeight}" alt="${twin ? '' : escape(photo.alt)}" loading="lazy" decoding="async">
            </picture>
          </li>`;
}

function shadowMarkup(slot) {
  const photo = PHOTOS[slot % PHOTOS.length];
  const ratio = photo.nativeWidth / photo.nativeHeight;
  const w = round(Math.sqrt(CARD_AREA * ratio), 2);
  const h = round(CARD_AREA / w, 2);
  return `          <span class="orbit__item" style="--k:${slot};--w:${w};--h:${h}"><span class="orbit__shadow"></span></span>`;
}

export async function buildAtelier({ root, force }) {
  await mkdir(`${root}assets/img/atelier`, { recursive: true });
  await buildBackground(root, force);
  await buildPhotos(root, force);
  const { lockupStyle, markup } = await buildLettering(root);

  const slots = Array.from({ length: ORBIT.slots }, (_, k) => k);
  const bg = (fmt) => srcset(BACKGROUND_WIDTHS.map((w) => [`assets/img/atelier/vinho-${w}.${fmt}`, w]));
  const geometry = [
    `--orbit-cx:${ORBIT.cx}`,
    `--orbit-cy:${ORBIT.cy}`,
    `--orbit-r:${ORBIT.radius}`,
    `--orbit-step:${360 / ORBIT.slots}deg`,
    `--orbit-slots:${ORBIT.slots}`,
    `--card-radius:${CARD_RADIUS}`,
  ].join(';');

  return `      <picture class="atelier__bg">
        <source type="image/avif" srcset="${bg('avif')}" sizes="${BACKGROUND_SIZES}">
        <source type="image/webp" srcset="${bg('webp')}" sizes="${BACKGROUND_SIZES}">
        <img src="assets/img/atelier/vinho-1920.webp" width="${STAGE.width}" height="${STAGE.height}" alt="" loading="lazy" decoding="async">
      </picture>
      <div class="atelier__stage" style="${geometry}">
        <div class="atelier__orbit atelier__orbit--shadow-far" aria-hidden="true">
${slots.map(shadowMarkup).join('\n')}
        </div>
        <div class="atelier__orbit atelier__orbit--shadow-near" aria-hidden="true">
${slots.map(shadowMarkup).join('\n')}
        </div>
        <ul class="atelier__orbit atelier__orbit--cards" role="list">
${slots.map(cardMarkup).join('\n')}
        </ul>
        <div class="atelier__lockup" style="${lockupStyle}">
${markup.join('\n')}
        </div>
      </div>`;
}
