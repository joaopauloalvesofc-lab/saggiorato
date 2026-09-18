// Quinta dobra: The Duffle Bag. Fundo de camurça verde-militar em toda a dobra
// e, por cima, a imagem sem fundo dos dois braços disputando a bolsa.
//
// O alfa da imagem encosta nas duas bordas laterais (x = 0 e x = 1671 de 1672),
// então o encaixe pedido — cada braço terminando exatamente no fim da tela — é
// a imagem ocupando 100% da largura, sem corte lateral. A altura da seção
// nunca deixa a imagem ser cortada (ver styles.css).
//
// A imagem nasce em 1672 × 941: acima disso as versões são ampliadas com
// Lanczos3 e sharpen proporcional (mesma receita do hero).

import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';

const OUT = 'assets/img/duffle/';
const ART = 'source/duffle/duelo/duelo_pelo_luxuoso_duffel_verde.png';
const ART_NATIVE = { width: 1672, height: 941 };
const ART_WIDTHS = [960, 1280, 1672, 2240, 2800, 3520];
const BACKGROUND_WIDTHS = [1280, 1920, 2560, 3840];

const ART_SIZES = '100vw';
const BACKGROUND_SIZES = '(max-width: 1023px) 1024px, (max-aspect-ratio: 2/1) 200vh, 100vw';

const ALT = 'Dois braços de camisa disputando a Duffle Bag de couro verde-oliva, cada um segurando uma alça.';

const round = (n, d = 2) => Number(n.toFixed(d));
const srcset = (base, widths, fmt) => widths.map((w) => `${base}-${w}.${fmt} ${w}w`).join(', ');
const escape = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

async function encode(pipeline, base, { avif, webp }) {
  const pixels = await pipeline.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = pixels.info;
  const raw = () => sharp(pixels.data, { raw: { width, height, channels } });
  await raw().avif(avif).toFile(`${base}.avif`);
  await raw().webp(webp).toFile(`${base}.webp`);
}

async function buildBackground(root, force) {
  const src = `${root}source/duffle/novo/fundo-camurca-8k.png`;
  for (const width of BACKGROUND_WIDTHS) {
    const base = `${root}${OUT}camurca-${width}`;
    if (!force && existsSync(`${base}.avif`) && existsSync(`${base}.webp`)) continue;
    const t = Date.now();
    await encode(
      sharp(src, { limitInputPixels: false }).resize(width, width / 2, { kernel: 'lanczos3' }).toColourspace('srgb'),
      base,
      // Camurça escura: 10 bits evita degraus nas sombras amplas.
      { avif: { quality: 88, effort: 6, chromaSubsampling: '4:4:4', bitdepth: 10 }, webp: { quality: 90, effort: 6, smartSubsample: true } },
    );
    console.log(`camurça ${width}px  ${((Date.now() - t) / 1000).toFixed(1)}s`);
  }
}

async function buildArt(root, force) {
  for (const width of ART_WIDTHS) {
    const base = `${root}${OUT}duelo-${width}`;
    if (!force && existsSync(`${base}.avif`) && existsSync(`${base}.webp`)) continue;
    const t = Date.now();
    const height = Math.round((width * ART_NATIVE.height) / ART_NATIVE.width);
    let pipeline = sharp(`${root}${ART}`, { limitInputPixels: false }).resize(width, height, { kernel: 'lanczos3' }).toColourspace('srgb');
    if (width > ART_NATIVE.width) pipeline = pipeline.sharpen({ sigma: round((0.4 * width) / ART_NATIVE.width), m1: 0.5, m2: 1.5 });
    await encode(pipeline, base, {
      avif: { quality: 82, effort: 6 },
      webp: { quality: 90, effort: 6, alphaQuality: 100, smartSubsample: true },
    });
    console.log(`duelo ${width}px  ${((Date.now() - t) / 1000).toFixed(1)}s`);
  }
}

export async function buildDuffle({ root, force }) {
  await mkdir(`${root}${OUT}`, { recursive: true });
  await buildBackground(root, force);
  await buildArt(root, force);

  const bgBase = `${OUT}camurca`;
  const background = `        <picture class="duffle__bg">
          <source type="image/avif" srcset="${srcset(bgBase, BACKGROUND_WIDTHS, 'avif')}" sizes="${BACKGROUND_SIZES}">
          <source type="image/webp" srcset="${srcset(bgBase, BACKGROUND_WIDTHS, 'webp')}" sizes="${BACKGROUND_SIZES}">
          <img src="${bgBase}-1920.webp" width="7680" height="3840" alt="" loading="lazy" decoding="async">
        </picture>`;

  const artBase = `${OUT}duelo`;
  const art = `        <picture class="duffle__art">
          <source type="image/avif" srcset="${srcset(artBase, ART_WIDTHS, 'avif')}" sizes="${ART_SIZES}">
          <source type="image/webp" srcset="${srcset(artBase, ART_WIDTHS, 'webp')}" sizes="${ART_SIZES}">
          <img src="${artBase}-1672.webp" width="${ART_NATIVE.width}" height="${ART_NATIVE.height}" alt="${escape(ALT)}" loading="lazy" decoding="async">
        </picture>`;

  return { background, art };
}
