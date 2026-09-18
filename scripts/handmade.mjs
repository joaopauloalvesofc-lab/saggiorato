// Quarta dobra: The Handmade Design. Mão tatuada à direita trocando de modelo
// de estojo; título e quadrados de escolha à esquerda; fundo de couro verde.
//
// As mãos saem de source/hands/registered/ (ver scripts/register-hands.mjs):
// já estão alinhadas num único quadro de 2470 × 2499, em 2× da resolução real.
// Os quadrados de escolha usam as amostras de couro enviadas pela marca
// (source/hands/amostras, 3000 × 3000, sem borda), reduzidas com Lanczos3.

import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';

export const FRAME = { width: 2470, height: 2499 };

// Nomes das cores como nos arquivos de amostra da marca.
const MODELS = [
  { id: 'caramelo', swatch: '01_couro_cognac_costura_creme.png', label: 'Cognac', alt: 'Mão tatuada segurando um estojo de couro cognac com costura creme.' },
  { id: 'bordo', swatch: '02_couro_borgonha_costura_vermelha.png', label: 'Borgonha', alt: 'Mão tatuada segurando um estojo de couro borgonha com costura vermelha.' },
  { id: 'amarelo', swatch: '03_couro_amarelo_costura_preta.png', label: 'Amarelo', alt: 'Mão tatuada segurando um estojo de couro amarelo com costura preta.' },
  { id: 'verde', swatch: '04_couro_verde_oliva_costura_clara.png', label: 'Verde-oliva', alt: 'Mão tatuada segurando um estojo de couro verde-oliva com costura clara e laterais em pied-de-poule.' },
  { id: 'azul', swatch: '05_couro_azul_marinho_costura_laranja.png', label: 'Azul-marinho', alt: 'Mão tatuada segurando um estojo de couro azul-marinho com costura laranja e laterais em pied-de-poule.' },
];

const HAND_WIDTHS = [720, 1080, 1440, 1920, 2470];
// Quadrado de 54–104 px em CSS; 320 cobre DPR 3.
const SWATCH_WIDTHS = [96, 160, 240, 320];
const BACKGROUND_WIDTHS = [1280, 1920, 2560, 3840];

// Ver styles.css (.handmade): o quadro da mão tem no máximo 58vw; empilhado, 100vw.
const HAND_SIZES = '(max-width: 900px) 100vw, (max-aspect-ratio: 1/1) 100vw, 55vw';
// clamp(56px, 9vw, 84px) empilhado; clamp(54px, 4.2vw, 104px) lado a lado.
const SWATCH_SIZES = '(max-width: 620px) 56px, (max-width: 900px) 84px, 104px';
// Empilhado no celular a seção é alta: 1280px já dá 3840 em DPR 3 para um couro escuro.
const BACKGROUND_SIZES = '(max-width: 900px) 1280px, (max-aspect-ratio: 2/1) 200vh, 100vw';

const escape = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const srcset = (base, widths, fmt) => widths.map((w) => `${base}-${w}.${fmt} ${w}w`).join(', ');

async function encode(pipeline, base, { avif, webp }) {
  const pixels = await pipeline.raw().toBuffer({ resolveWithObject: true });
  // Só as dimensões: depois de removeAlpha() o sharp marca os pixels como
  // "pré-multiplicados" e, ao reler, dividiria por um alfa que não existe
  // (as amostras saíam com cores estouradas).
  const { width, height, channels } = pixels.info;
  const raw = () => sharp(pixels.data, { raw: { width, height, channels } });
  await raw().avif(avif).toFile(`${base}.avif`);
  await raw().webp(webp).toFile(`${base}.webp`);
}

async function buildBackground(root, force) {
  const src = `${root}source/hands/fundo-couro-verde-6000.png`;
  for (const width of BACKGROUND_WIDTHS) {
    const base = `${root}assets/img/handmade/couro-${width}`;
    if (!force && existsSync(`${base}.avif`) && existsSync(`${base}.webp`)) continue;
    const t = Date.now();
    await encode(
      sharp(src, { limitInputPixels: false }).resize(width, width / 2, { kernel: 'lanczos3' }).toColourspace('srgb'),
      base,
      // Couro escuro com gradiente de luz: 10 bits evita degraus nas sombras.
      { avif: { quality: 86, effort: 6, chromaSubsampling: '4:4:4', bitdepth: 10 }, webp: { quality: 90, effort: 6, smartSubsample: true } },
    );
    console.log(`couro ${width}px  ${((Date.now() - t) / 1000).toFixed(1)}s`);
  }
}

async function buildHands(root, force) {
  for (const model of MODELS) {
    const src = `${root}source/hands/registered/${model.id}.png`;
    const t = Date.now();
    let built = false;
    for (const width of HAND_WIDTHS) {
      const base = `${root}assets/img/handmade/mao-${model.id}-${width}`;
      if (!force && existsSync(`${base}.avif`) && existsSync(`${base}.webp`)) continue;
      const height = Math.round((width * FRAME.height) / FRAME.width);
      await encode(
        sharp(src).resize(width, height, { kernel: 'lanczos3' }).toColourspace('srgb'),
        base,
        { avif: { quality: 82, effort: 6 }, webp: { quality: 90, effort: 6, alphaQuality: 100, smartSubsample: true } },
      );
      built = true;
    }
    for (const width of SWATCH_WIDTHS) {
      const base = `${root}assets/img/handmade/amostra-${model.id}-${width}`;
      if (!force && existsSync(`${base}.avif`) && existsSync(`${base}.webp`)) continue;
      await encode(
        sharp(`${root}source/hands/amostras/${model.swatch}`).resize(width, width, { kernel: 'lanczos3' }).toColourspace('srgb'),
        base,
        { avif: { quality: 84, effort: 6 }, webp: { quality: 90, effort: 6, smartSubsample: true } },
      );
      built = true;
    }
    if (built) console.log(`mão ${model.id}  ${((Date.now() - t) / 1000).toFixed(1)}s`);
  }
}

export async function buildHandmade({ root, force }) {
  await mkdir(`${root}assets/img/handmade`, { recursive: true });
  await buildBackground(root, force);
  await buildHands(root, force);

  const bgBase = 'assets/img/handmade/couro';
  const background = `        <picture class="handmade__bg">
          <source type="image/avif" srcset="${srcset(bgBase, BACKGROUND_WIDTHS, 'avif')}" sizes="${BACKGROUND_SIZES}">
          <source type="image/webp" srcset="${srcset(bgBase, BACKGROUND_WIDTHS, 'webp')}" sizes="${BACKGROUND_SIZES}">
          <img src="${bgBase}-1920.webp" width="6000" height="3000" alt="" loading="lazy" decoding="async">
        </picture>`;

  const hands = MODELS.map((model, i) => {
    const base = `assets/img/handmade/mao-${model.id}`;
    return `          <picture class="handmade__image${i === 0 ? ' is-active' : ''}" data-model="${model.id}">
            <source type="image/avif" srcset="${srcset(base, HAND_WIDTHS, 'avif')}" sizes="${HAND_SIZES}">
            <source type="image/webp" srcset="${srcset(base, HAND_WIDTHS, 'webp')}" sizes="${HAND_SIZES}">
            <img src="${base}-1080.webp" width="${FRAME.width}" height="${FRAME.height}" alt="${escape(model.alt)}" loading="lazy" decoding="async">
          </picture>`;
  }).join('\n');

  const swatches = MODELS.map((model, i) => {
    const base = `assets/img/handmade/amostra-${model.id}`;
    return `            <button class="handmade__swatch" type="button" role="radio" aria-checked="${i === 0}" tabindex="${i === 0 ? 0 : -1}" aria-label="${escape(model.label)}" data-model="${model.id}" data-label="${escape(model.label)}">
              <picture>
                <source type="image/avif" srcset="${srcset(base, SWATCH_WIDTHS, 'avif')}" sizes="${SWATCH_SIZES}">
                <source type="image/webp" srcset="${srcset(base, SWATCH_WIDTHS, 'webp')}" sizes="${SWATCH_SIZES}">
                <img src="${base}-160.webp" width="160" height="160" alt="" loading="lazy" decoding="async">
              </picture>
            </button>`;
  }).join('\n');

  return { background, hands, swatches, firstLabel: MODELS[0].label };
}
