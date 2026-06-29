/**
 * Elimina el fondo de cuadrícula (checkerboard blanco/gris) de los logos.
 * Hace transparente cualquier píxel que sea blanco o gris claro.
 */
const sharp = require('sharp');
const path = require('path');

const LOGOS = [
  'logo_easymarket_con_texto.png',
  'logo_easymarket_sin_texto.png',
];

// Umbral: píxeles con R, G, B todos > 200 se consideran fondo (blanco/gris claro)
const THRESHOLD = 200;

async function removeBg(filename) {
  const inputPath = path.join(__dirname, filename);

  const image = sharp(inputPath);
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info; // channels = 4 (RGBA)
  const buf = Buffer.from(data);

  for (let i = 0; i < buf.length; i += channels) {
    const r = buf[i];
    const g = buf[i + 1];
    const b = buf[i + 2];
    // Píxel es blanco o gris claro → hacerlo transparente
    if (r > THRESHOLD && g > THRESHOLD && b > THRESHOLD) {
      buf[i + 3] = 0; // alpha = 0 (transparente)
    }
  }

  const outPath = inputPath; // sobreescribir el mismo archivo
  await sharp(buf, { raw: { width, height, channels } })
    .png()
    .toFile(outPath);

  console.log(`✓ ${filename} procesado`);
}

(async () => {
  for (const logo of LOGOS) {
    await removeBg(logo);
  }
  console.log('\nListo. Ahora copia los archivos a assets/images/ nuevamente.');
})();
