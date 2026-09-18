// Terceira dobra: The Luxury Box. Gera o fundo de madeira, as fotos da galeria,
// o vídeo do iPhone e o pôster. O texto e o mockup ficam escritos à mão no
// index.html; o build só injeta o <picture> do fundo e a lista da galeria.
//
// Vídeo: o arquivo do Instagram (H.264 720 × 1280, 960 kb/s) não é recodificado:
// qualquer recodificação só perderia qualidade. O fluxo de vídeo é copiado bit a
// bit, sem o áudio, com o índice (moov) no início para começar a tocar na hora.

import sharp from 'sharp';
import ffmpeg from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';

const BACKGROUND_WIDTHS = [1280, 1920, 2560, 3840];
const PHOTO_WIDTHS = [360, 540, 720, 1080];

// Ordem pedida: vista geral → caixa aberta → bandeja fora → detalhe.
const PHOTOS = [
  { id: '5521', alt: 'The Luxury Box aberta vista de cima: tampa de madeira com dobradiças embutidas e forro em pied-de-poule, e bandeja de couro verde com nove relógios.' },
  { id: '5527', alt: 'The Luxury Box aberta em ângulo, mostrando a madeira listrada em alto brilho e a bandeja de couro verde com relógios.' },
  { id: '5528', alt: 'Bandeja de couro verde fora da caixa, com doze relógios e um compartimento com abotoaduras e pulseiras.' },
  { id: '5530', alt: 'Detalhe de um relógio com pulseira de couro caramelo apoiado na almofada de couro verde, com o forro em pied-de-poule ao fundo.' },
];

// Larguras em CSS (ver styles.css, seção luxury): 4 colunas no desktop, 2 no celular.
const PHOTO_SIZES = '(max-width: 599px) 44vw, (max-width: 1023px) 22vw, 15vw';
// Madeira: cobre a seção. No celular a imagem ocupa 200% da largura (ver CSS).
const BACKGROUND_SIZES = '(max-width: 1023px) 200vw, (min-aspect-ratio: 2/1) 100vw, 200vh';

const escape = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const srcset = (base, widths, fmt) => widths.map((w) => `${base}-${w}.${fmt} ${w}w`).join(', ');

async function encode(pipeline, base, { avif, webp }) {
  const pixels = await pipeline.raw().toBuffer({ resolveWithObject: true });
  const raw = () => sharp(pixels.data, { raw: pixels.info });
  await raw().avif(avif).toFile(`${base}.avif`);
  await raw().webp(webp).toFile(`${base}.webp`);
}

async function buildBackground(root, force) {
  const src = `${root}source/luxury/fundo-madeira-6000.png`;
  for (const width of BACKGROUND_WIDTHS) {
    const base = `${root}assets/img/luxury/madeira-${width}`;
    if (!force && existsSync(`${base}.avif`) && existsSync(`${base}.webp`)) continue;
    const t = Date.now();
    await encode(
      sharp(src, { limitInputPixels: false }).resize(width, width / 2, { kernel: 'lanczos3' }).toColourspace('srgb'),
      base,
      { avif: { quality: 84, effort: 6, chromaSubsampling: '4:4:4', bitdepth: 10 }, webp: { quality: 90, effort: 6, smartSubsample: true } },
    );
    console.log(`madeira ${width}px  ${((Date.now() - t) / 1000).toFixed(1)}s`);
  }
}

async function buildPhotos(root, force) {
  for (const photo of PHOTOS) {
    const src = `${root}source/luxury/img-${photo.id}.jpg`;
    const meta = await sharp(src).metadata();
    photo.width = meta.width;
    photo.height = meta.height;
    for (const width of PHOTO_WIDTHS) {
      const base = `${root}assets/img/luxury/img-${photo.id}-${width}`;
      if (!force && existsSync(`${base}.avif`) && existsSync(`${base}.webp`)) continue;
      await encode(
        sharp(src).rotate().resize(width, Math.round((width * meta.height) / meta.width), { kernel: 'lanczos3' }).toColourspace('srgb'),
        base,
        { avif: { quality: 82, effort: 6 }, webp: { quality: 88, effort: 6, smartSubsample: true } },
      );
    }
    console.log(`foto ${photo.id} ${meta.width}×${meta.height}`);
  }
}

function buildVideo(root, force) {
  const src = `${root}source/luxury/video-luxury-box.mp4`;
  const out = `${root}assets/video/luxury-box.mp4`;
  const poster = `${root}source/luxury/video-poster-frame.png`;
  if (force || !existsSync(out)) {
    execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-map', '0:v:0', '-c:v', 'copy', '-an', '-map_metadata', '-1', '-movflags', '+faststart', out]);
    console.log('vídeo: fluxo H.264 copiado, sem áudio, faststart');
  }
  if (force || !existsSync(poster)) {
    // Primeiro quadro exato, para o pôster não "pular" quando o vídeo começa.
    execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-frames:v', '1', '-update', '1', poster]);
  }
}

async function buildPoster(root, force) {
  const out = `${root}assets/video/luxury-box-poster.webp`;
  if (!force && existsSync(out)) return;
  await sharp(`${root}source/luxury/video-poster-frame.png`).webp({ quality: 92, effort: 6, smartSubsample: true }).toFile(out);
}

export async function buildLuxury({ root, force }) {
  await mkdir(`${root}assets/img/luxury`, { recursive: true });
  await mkdir(`${root}assets/video`, { recursive: true });
  await buildBackground(root, force);
  await buildPhotos(root, force);
  buildVideo(root, force);
  await buildPoster(root, force);

  const bgBase = 'assets/img/luxury/madeira';
  const background = `        <picture class="luxury__bg">
          <source type="image/avif" srcset="${srcset(bgBase, BACKGROUND_WIDTHS, 'avif')}" sizes="${BACKGROUND_SIZES}">
          <source type="image/webp" srcset="${srcset(bgBase, BACKGROUND_WIDTHS, 'webp')}" sizes="${BACKGROUND_SIZES}">
          <img src="${bgBase}-1920.webp" width="6000" height="3000" alt="" loading="lazy" decoding="async">
        </picture>`;

  const gallery = PHOTOS.map((photo, i) => {
    const base = `assets/img/luxury/img-${photo.id}`;
    return `            <li class="luxury__photo" style="--delay:${(1.05 + i * 0.12).toFixed(2)}s">
              <picture>
                <source type="image/avif" srcset="${srcset(base, PHOTO_WIDTHS, 'avif')}" sizes="${PHOTO_SIZES}">
                <source type="image/webp" srcset="${srcset(base, PHOTO_WIDTHS, 'webp')}" sizes="${PHOTO_SIZES}">
                <img src="${base}-540.webp" width="${photo.width}" height="${photo.height}" alt="${escape(photo.alt)}" loading="lazy" decoding="async">
              </picture>
            </li>`;
  }).join('\n');

  return { background, gallery };
}
