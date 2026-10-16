// Rasterises the README hero and the GitHub social preview from design/brand/*.svg into assets/brand/.
// The hero's phone screens are <image href="docs/media/screens/..."> slots. This script inlines them,
// so run `node scripts/media.mjs` first when the screens change.
// Usage: node scripts/brand.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const inlineImages = (svg) =>
  svg.replace(/href="(docs\/[^"]+\.png)"/g, (_, path) => {
    const data = readFileSync(join(ROOT, path)).toString('base64');
    return `href="data:image/png;base64,${data}"`;
  });

const TARGETS = [
  { src: 'design/brand/readme-hero.svg', out: 'assets/brand/readme-hero.png' },
  { src: 'design/brand/social-preview.svg', out: 'assets/brand/social-preview.png' },
];

for (const { src, out } of TARGETS) {
  const svg = inlineImages(readFileSync(join(ROOT, src), 'utf8'));
  await sharp(Buffer.from(svg), { density: 144 })
    .resize({ width: src.includes('hero') ? 1600 : 1280 })
    .png({ palette: true, quality: 92, effort: 10 })
    .toFile(join(ROOT, out));
}
