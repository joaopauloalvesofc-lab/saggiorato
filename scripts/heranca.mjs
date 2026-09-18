// Sexta dobra (entre a mão tatuada e a Duffle Bag): Herança automobilística.
// Fundo de couro amarelo Senna, título em caixa-alta fina, "By" + a assinatura
// da marca e, embaixo, os quatro elementos recortados, sem moldura e sem fundo.
//
// Os quatro PNGs são 1254 × 1254 com o objeto em posições e tamanhos diferentes.
// O build recorta cada um pelo contorno real (alfa) e calcula a escala para que
// todos tenham a MESMA ÁREA VISUAL — equilibra peso entre proporções de 1,15 a
// 1,77 melhor do que igualar a altura. A linha de base é comum (ver styles.css).

import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const SRC = 'source/heranca/';
const OUT = 'assets/img/heranca/';
const PAD = 6;

const ELEMENTS = [
  { id: 'capacete', alt: 'Capacete de corrida amarelo e verde ao lado de um estojo de couro branco e vermelho com três relógios.' },
  { id: 'estojo-aberto', alt: 'Estojo de relógio em couro branco e vermelho, aberto, com forro de camurça amarela.' },
  { id: 'estojo-vermelho', alt: 'Estojo de relógio em couro vermelho fechado, com costura branca.' },
  { id: 'estojos-bicolores', alt: 'Dois estojos de relógio em couro, um branco e um vermelho, com tampas bicolores.' },
];

const ELEMENT_WIDTHS = [360, 540, 720, 1080];
const BACKGROUND_WIDTHS = [1280, 1920, 2560, 3840];

// Ver styles.css (.heranca): a fileira vai até 1640 px e cada peça fica entre
// 22% e 28% dela; empilhado em 2 colunas, cerca de metade da largura.
const ELEMENT_SIZES = '(max-width: 1023px) 46vw, (max-width: 1199px) 24vw, 420px';
const BACKGROUND_SIZES = '(max-width: 1023px) 1024px, (max-aspect-ratio: 2.4/1) 240vh, 100vw';

const INK = '#17110a';

const round = (n, d = 4) => Number(n.toFixed(d));
const escape = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const srcset = (base, widths, fmt) => widths.map((w) => `${base}-${w}.${fmt} ${w}w`).join(', ');

async function encode(pipeline, base, { avif, webp }) {
  const pixels = await pipeline.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = pixels.info;
  const raw = () => sharp(pixels.data, { raw: { width, height, channels } });
  await raw().avif(avif).toFile(`${base}.avif`);
  await raw().webp(webp).toFile(`${base}.webp`);
}

async function buildBackground(root, force) {
  const src = `${root}${SRC}fundo-amarelo-8k.png`;
  for (const width of BACKGROUND_WIDTHS) {
    const base = `${root}${OUT}amarelo-${width}`;
    if (!force && existsSync(`${base}.avif`) && existsSync(`${base}.webp`)) continue;
    const t = Date.now();
    await encode(
      sharp(src, { limitInputPixels: false }).resize(width, Math.round((width * 3200) / 7680), { kernel: 'lanczos3' }).toColourspace('srgb'),
      base,
      // Amarelo saturado e liso: 10 bits evita degraus na luz difusa.
      { avif: { quality: 88, effort: 6, chromaSubsampling: '4:4:4', bitdepth: 10 }, webp: { quality: 92, effort: 6, smartSubsample: true } },
    );
    console.log(`amarelo ${width}px  ${((Date.now() - t) / 1000).toFixed(1)}s`);
  }
}

async function measure(root, element) {
  const src = `${root}${SRC}elemento-${element.id}.png`;
  const { data, info } = await sharp(src, { limitInputPixels: false }).extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[y * W + x] > 8) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  const crop = {
    left: Math.max(0, x0 - PAD),
    top: Math.max(0, y0 - PAD),
    width: Math.min(W, x1 + PAD + 1) - Math.max(0, x0 - PAD),
    height: Math.min(H, y1 + PAD + 1) - Math.max(0, y0 - PAD),
  };
  return { ...element, crop, ratio: crop.width / crop.height };
}

async function buildElements(root, force) {
  const measured = [];
  for (const element of ELEMENTS) measured.push(await measure(root, element));

  // Mesma área visual: largura ∝ √proporção, altura ∝ 1/√proporção.
  const weights = measured.map((e) => Math.sqrt(e.ratio));
  const total = weights.reduce((a, b) => a + b, 0);
  // Empilhado em 2 colunas: o par mais largo define a escala, então as quatro
  // peças mantêm a mesma área e as duas linhas ficam centradas.
  const pairTotals = [weights[0] + weights[1], weights[2] + weights[3]];
  const widestPair = Math.max(...pairTotals);
  for (const [i, element] of measured.entries()) {
    element.share = round(weights[i] / total); // fração da largura da fileira
    element.pairShare = round(weights[i] / widestPair);
    const src = `${root}${SRC}elemento-${element.id}.png`;
    let built = false;
    for (const width of ELEMENT_WIDTHS) {
      const base = `${root}${OUT}${element.id}-${width}`;
      if (!force && existsSync(`${base}.avif`) && existsSync(`${base}.webp`)) continue;
      const height = Math.round((width * element.crop.height) / element.crop.width);
      await encode(
        sharp(src, { limitInputPixels: false }).extract(element.crop).resize(width, height, { kernel: 'lanczos3' }).toColourspace('srgb'),
        base,
        { avif: { quality: 84, effort: 6 }, webp: { quality: 90, effort: 6, alphaQuality: 100, smartSubsample: true } },
      );
      built = true;
    }
    console.log(`${element.id.padEnd(18)} recorte ${element.crop.width}×${element.crop.height} (proporção ${element.ratio.toFixed(2)}) → ${(element.share * 100).toFixed(1)}% da fileira${built ? '' : ' (já existia)'}`);
  }
  return measured;
}

// A assinatura da marca (mesma arte da 2ª dobra) em tinta escura, para o
// amarelo: em creme ela sumiria.
async function buildSignature(root) {
  const svg = await readFile(`${root}assets/svg/atelier-signature.svg`, 'utf8');
  // Além de recolorir, engrossa o traço: a assinatura original é de pena fina e,
  // no amarelo, sumia. O contorno some metade para fora, então 5,5 unidades do
  // viewBox (160 de altura) valem ~0,9 px a cada lado no tamanho exibido.
  const dark = svg
    .replace(/fill="#FEFDFA"/g, `fill="${INK}"`)
    .replace(/<path /g, `<path stroke="${INK}" stroke-width="5.5" stroke-linejoin="round" stroke-linecap="round" paint-order="stroke" `);
  if (dark === svg) throw new Error('não achei o fill da assinatura');
  await writeFile(`${root}assets/svg/heranca-assinatura.svg`, dark);
  const [, , w, h] = svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/).slice(1).map(Number);
  return { width: w, height: h };
}

export async function buildHeranca({ root, force }) {
  await mkdir(`${root}${OUT}`, { recursive: true });
  await buildBackground(root, force);
  const elements = await buildElements(root, force);
  const signature = await buildSignature(root);

  const bgBase = `${OUT}amarelo`;
  const background = `        <picture class="heranca__bg">
          <source type="image/avif" srcset="${srcset(bgBase, BACKGROUND_WIDTHS, 'avif')}" sizes="${BACKGROUND_SIZES}">
          <source type="image/webp" srcset="${srcset(bgBase, BACKGROUND_WIDTHS, 'webp')}" sizes="${BACKGROUND_SIZES}">
          <img src="${bgBase}-1920.webp" width="7680" height="3200" alt="" loading="lazy" decoding="async">
        </picture>`;

  const signatureMarkup = `            <img class="heranca__signature" src="assets/svg/heranca-assinatura.svg" width="${signature.width}" height="${signature.height}" alt="Saggiorato &amp; Benites" loading="lazy" decoding="async">`;

  const items = elements.map((element, i) => {
    const base = `${OUT}${element.id}`;
    return `            <li class="heranca__item" style="--share:${element.share};--share-2col:${element.pairShare};--ratio:${element.crop.width}/${element.crop.height};--delay:${(0.95 + i * 0.12).toFixed(2)}s">
              <picture>
                <source type="image/avif" srcset="${srcset(base, ELEMENT_WIDTHS, 'avif')}" sizes="${ELEMENT_SIZES}">
                <source type="image/webp" srcset="${srcset(base, ELEMENT_WIDTHS, 'webp')}" sizes="${ELEMENT_SIZES}">
                <img src="${base}-540.webp" width="${element.crop.width}" height="${element.crop.height}" alt="${escape(element.alt)}" loading="lazy" decoding="async">
              </picture>
            </li>`;
  }).join('\n');

  return { background, signature: signatureMarkup, items };
}
