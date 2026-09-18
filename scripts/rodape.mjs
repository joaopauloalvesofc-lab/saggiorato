// Rodapé: fundo de couro preto premium.
//
// A textura nasce em 1942 × 809. Acima disso as versões são ampliadas com
// Lanczos3 e sharpen proporcional (mesma receita do hero), porque o rodapé
// ocupa a largura inteira da tela.

import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';

const SRC = 'source/rodape/couro-preto.png';
const OUT = 'assets/img/rodape/';
const NATIVE = { width: 1942, height: 809 };
const WIDTHS = [1280, 1920, 2560, 3840];
const SIZES = '100vw';

const round = (n, d = 2) => Number(n.toFixed(d));
const srcset = (base, widths, fmt) => widths.map((w) => `${base}-${w}.${fmt} ${w}w`).join(', ');

async function encode(pipeline, base, { avif, webp }) {
  const pixels = await pipeline.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = pixels.info;
  const raw = () => sharp(pixels.data, { raw: { width, height, channels } });
  await raw().avif(avif).toFile(`${base}.avif`);
  await raw().webp(webp).toFile(`${base}.webp`);
}

export async function buildRodape({ root, force }) {
  await mkdir(`${root}${OUT}`, { recursive: true });
  for (const width of WIDTHS) {
    const base = `${root}${OUT}couro-preto-${width}`;
    if (!force && existsSync(`${base}.avif`) && existsSync(`${base}.webp`)) continue;
    const t = Date.now();
    const height = Math.round((width * NATIVE.height) / NATIVE.width);
    let pipeline = sharp(`${root}${SRC}`, { limitInputPixels: false }).resize(width, height, { kernel: 'lanczos3' }).toColourspace('srgb');
    if (width > NATIVE.width) pipeline = pipeline.sharpen({ sigma: round((0.4 * width) / NATIVE.width), m1: 0.5, m2: 1.5 });
    await encode(pipeline, base, {
      // Preto com gradiente largo: 10 bits evita degraus nas sombras.
      avif: { quality: 90, effort: 6, chromaSubsampling: '4:4:4', bitdepth: 10 },
      webp: { quality: 92, effort: 6, smartSubsample: true },
    });
    console.log(`couro preto ${width}px  ${((Date.now() - t) / 1000).toFixed(1)}s`);
  }

  const base = `${OUT}couro-preto`;
  return {
    background: `      <picture class="rodape__bg">
        <source type="image/avif" srcset="${srcset(base, WIDTHS, 'avif')}" sizes="${SIZES}">
        <source type="image/webp" srcset="${srcset(base, WIDTHS, 'webp')}" sizes="${SIZES}">
        <img src="${base}-1920.webp" width="${NATIVE.width}" height="${NATIVE.height}" alt="" loading="lazy" decoding="async">
      </picture>`,
  };
}
