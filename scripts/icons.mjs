// Builds Sen's app icon: the "Sen." wordmark, with Sen the coin as the full stop.
// Writes the SVG sources to design/icon/ and rasterises them into assets/images/.
// Usage: npm run icons
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Path, parse } from 'opentype.js';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FONT = join(ROOT, 'assets/fonts/BricolageGrotesque-ExtraBold.ttf');

const INK = '#17181A';
const PAPER = '#FFFDF8';
const LEMON = '#F2DC72';
const DEEP = '#236B47';
const DARK = '#121315';

// The brand wordmark and MAL2's last frame: Bricolage 800 at width 100, tracking -0.04 em, and the
// coin's rim resting on the baseline (0.026 em overshoot) 0.045 em after the n's advance.
const TRACKING_EM = -0.04;
const DOT_GAP_EM = 0.045;
const DOT_SINK_EM = 0.026;
// The brand lockup's rim is 0.426 em across. The icon draws it 1.2x so the lemon still reads as a
// coin at 48 px, while its top stays under the x-height so it still reads as a full stop.
const DOT_EM = 0.426 * 1.2;
// Android adaptive icon: 108 dp layers, and a 66 dp circle no launcher mask ever clips.
const CANVAS_DP = 108;
const SAFE_R_DP = 33;

// Sen's coin in kit.py rig units: face r 222 at (0, 0), rim r 262 at (10, 16). Icon cut of the
// idle pose: eyes 1.5x and a 24-unit mouth so the features survive the downscale.
const RIM = { cx: 10, cy: 16, r: 262 };
const FACE_R = 222;
const EYES = [-74, 74].map((cx) => ({ cx, cy: -38, rx: 22, ry: 31 }));
const MOUTH = { d: 'M-22 24 Q0 44 22 24', width: 24 };

const PALETTES = {
  colour: { word: PAPER, rim: DEEP, face: LEMON, feature: DEEP },
  // iOS tinted: greyscale on black. The system multiplies it by the user's tint.
  grey: { word: '#FFFFFF', rim: '#5C5C5C', face: '#DCDCDC', feature: '#5C5C5C' },
  // Android themed icons: one silhouette, the face's features knocked out.
  mask: { word: '#FFFFFF', rim: '#FFFFFF', face: '#FFFFFF', feature: '#000000' },
};

const view = (dp) => `${(CANVAS_DP - dp) / 2} ${(CANVAS_DP - dp) / 2} ${dp} ${dp}`;
const LAYER = view(CANVAS_DP);
// Square icons (iOS, Android before 8) have no 66 dp crop to fill. Framing 80 dp instead of the
// launcher's 72 keeps the word at 82% of the width, clear of the squircle's corners.
const SQUARE = view(80);

// One row per file.
const OUTPUTS = [
  { name: 'icon', viewBox: SQUARE, background: INK, palette: 'colour', png: 'icon.png' },
  {
    name: 'ios-dark',
    viewBox: SQUARE,
    background: DARK,
    palette: 'colour',
    png: 'ios-icon-dark.png',
  },
  {
    name: 'ios-tinted',
    viewBox: SQUARE,
    background: '#000000',
    palette: 'grey',
    png: 'ios-icon-tinted.png',
  },
  { name: 'foreground', viewBox: LAYER, palette: 'colour', png: 'android-icon-foreground.png' },
  {
    name: 'monochrome',
    viewBox: LAYER,
    palette: 'mask',
    knockout: true,
    png: 'android-icon-monochrome.png',
  },
];

function outlineWord(font, text) {
  const glyphs = font.stringToGlyphs(text);
  const scale = 1000 / font.unitsPerEm;
  const path = new Path();
  let x = 0;
  glyphs.forEach((glyph, i) => {
    path.extend(glyph.getPath(x, 0, 1000));
    x += glyph.advanceWidth * scale + TRACKING_EM * 1000;
    if (i < glyphs.length - 1) x += font.getKerningValue(glyph, glyphs[i + 1]) * scale;
  });
  return { path, advance: x - TRACKING_EM * 1000 };
}

function outlinePoints(path, steps = 12) {
  const points = [];
  let from = { x: 0, y: 0 };
  for (const c of path.commands) {
    if (c.type === 'Z') continue;
    if (c.type === 'Q' || c.type === 'C') {
      for (let k = 1; k <= steps; k++) {
        const t = k / steps;
        const u = 1 - t;
        const [px, py] =
          c.type === 'Q'
            ? [
                u * u * from.x + 2 * u * t * c.x1 + t * t * c.x,
                u * u * from.y + 2 * u * t * c.y1 + t * t * c.y,
              ]
            : [
                u ** 3 * from.x + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t ** 3 * c.x,
                u ** 3 * from.y + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t ** 3 * c.y,
              ];
        points.push({ x: px, y: py });
      }
    } else {
      points.push({ x: c.x, y: c.y });
    }
    from = { x: c.x, y: c.y };
  }
  return points;
}

// Smallest circle around the points (Welzl). Centring on it uses the safe circle as fully as the
// word allows, which a bounding-box fit cannot: the box's corners are empty.
function enclosingCircle(points) {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const inside = (c, p) => dist(c, p) <= c.r + 1e-6;
  const two = (a, b) => {
    const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    return { ...c, r: dist(a, c) };
  };
  const three = (a, b, c) => {
    const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    const sq = (p) => p.x * p.x + p.y * p.y;
    const x = (sq(a) * (b.y - c.y) + sq(b) * (c.y - a.y) + sq(c) * (a.y - b.y)) / d;
    const y = (sq(a) * (c.x - b.x) + sq(b) * (a.x - c.x) + sq(c) * (b.x - a.x)) / d;
    return { x, y, r: dist({ x, y }, a) };
  };
  let circle = { ...points[0], r: 0 };
  for (let i = 1; i < points.length; i++) {
    if (inside(circle, points[i])) continue;
    circle = { ...points[i], r: 0 };
    for (let j = 0; j < i; j++) {
      if (inside(circle, points[j])) continue;
      circle = two(points[i], points[j]);
      for (let k = 0; k < j; k++) {
        if (!inside(circle, points[k])) circle = three(points[i], points[j], points[k]);
      }
    }
  }
  return circle;
}

function layout(font) {
  const word = outlineWord(font, 'Sen');
  const unit = (DOT_EM * 1000) / (2 * RIM.r);
  const coin = {
    x: word.advance + DOT_GAP_EM * 1000 + (RIM.r - RIM.cx) * unit,
    y: DOT_SINK_EM * 1000 - (RIM.cy + RIM.r) * unit,
  };
  const rimPoints = Array.from({ length: 180 }, (_, i) => {
    const a = (i / 180) * 2 * Math.PI;
    return {
      x: coin.x + (RIM.cx + RIM.r * Math.cos(a)) * unit,
      y: coin.y + (RIM.cy + RIM.r * Math.sin(a)) * unit,
    };
  });
  const circle = enclosingCircle([...outlinePoints(word.path), ...rimPoints]);
  const scale = SAFE_R_DP / circle.r;
  const origin = { x: CANVAS_DP / 2 - circle.x * scale, y: CANVAS_DP / 2 - circle.y * scale };
  return { word: word.path.toPathData(1), coin, unit, scale, origin };
}

const n = (v) => +v.toFixed(4);

function art(l, p) {
  const word = `<path transform="translate(${n(l.origin.x)} ${n(l.origin.y)}) scale(${n(l.scale)})" d="${l.word}" fill="${p.word}"/>`;
  const eyes = EYES.map(
    (e) => `<ellipse cx="${e.cx}" cy="${e.cy}" rx="${e.rx}" ry="${e.ry}" fill="${p.feature}"/>`,
  ).join('');
  const coin =
    `<g transform="translate(${n(l.origin.x + l.coin.x * l.scale)} ${n(l.origin.y + l.coin.y * l.scale)}) scale(${n(l.unit * l.scale)})">` +
    `<circle cx="${RIM.cx}" cy="${RIM.cy}" r="${RIM.r}" fill="${p.rim}"/><circle r="${FACE_R}" fill="${p.face}"/>${eyes}` +
    `<path d="${MOUTH.d}" fill="none" stroke="${p.feature}" stroke-width="${MOUTH.width}" stroke-linecap="round"/></g>`;
  return `<g data-layer="art">${word}${coin}</g>`;
}

function svg(l, out) {
  const body = art(l, PALETTES[out.palette]);
  const inner = out.knockout
    ? `<defs><mask id="knockout" maskUnits="userSpaceOnUse" x="0" y="0" width="${CANVAS_DP}" height="${CANVAS_DP}">${body}</mask></defs>` +
      `<rect width="${CANVAS_DP}" height="${CANVAS_DP}" fill="#FFFFFF" mask="url(#knockout)"/>`
    : (out.background
        ? `<rect width="${CANVAS_DP}" height="${CANVAS_DP}" fill="${out.background}"/>`
        : '') + body;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="${out.viewBox}" role="img" aria-label="Sen app icon, ${out.name}">${inner}</svg>\n`;
}

const fontFile = readFileSync(FONT);
const l = layout(
  parse(fontFile.buffer.slice(fontFile.byteOffset, fontFile.byteOffset + fontFile.byteLength)),
);
await mkdir(join(ROOT, 'design/icon'), { recursive: true });
for (const out of OUTPUTS) {
  const source = svg(l, out);
  await writeFile(join(ROOT, 'design/icon', `${out.name}.svg`), source);
  let png = sharp(Buffer.from(source));
  // App Store icons must be opaque.
  if (out.background) png = png.flatten({ background: out.background }).removeAlpha();
  await png.png({ compressionLevel: 9 }).toFile(join(ROOT, 'assets/images', out.png));
  console.log(`design/icon/${out.name}.svg -> assets/images/${out.png}`);
}
