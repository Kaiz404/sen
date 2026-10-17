// Builds the README media: status-bar-cropped screenshots and small GIFs from phone captures.
// Usage: node scripts/media.mjs
// Env: SEN_SHOTS (gallery run folder, `npm run device:shots` output), SEN_SHOTS_DARK (dark gallery run), SEN_CLIPS (folder of 720 px mp4 screen recordings),
// FFMPEG (path to ffmpeg, default `ffmpeg` on PATH, or run `npx ffmpeg-static` to fetch one).
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS =
  process.env.SEN_SHOTS ?? join(homedir(), 'projects/sen/shots/runs/20261017-174353/png');
// The dark gallery run has the History states. Other dark shots come from SHOTS.
const SHOTS_DARK =
  process.env.SEN_SHOTS_DARK ?? join(homedir(), 'projects/sen/shots/runs/20261017-175629/png');
const CLIPS = process.env.SEN_CLIPS ?? join(homedir(), 'sen-pickup/device/motion-clips');
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const OUT = join(ROOT, 'docs/media');

// The phone's status bar shows notification icons, so every capture loses its top 130 px (of 1220 x 2712).
const STATUS_BAR_PX = 130;
const SCREEN_WIDTH = 540;
// out: file written to docs/media/screens/<out>-<theme>.png. src: gallery state <src>-<theme>.png,
// read from SHOTS (light) or SHOTS_DARK (dark).
const SCREENS = [
  { out: 'lock-idle', src: 'auth-lock-idle', themes: ['light', 'dark'] },
  { out: 'history-masked', src: 'history-masked', themes: ['light', 'dark'] },
  { out: 'history-shown', src: 'history-shown', themes: ['light', 'dark'] },
  { out: 'privacy', src: 'settings-privacy', themes: ['light'] },
  { out: 'add-amount', src: 'add-amount-max', themes: ['light'] },
  { out: 'add-date', src: 'add-details-picked', themes: ['light'] },
  { out: 'detail-timeline', src: 'detail-settled', themes: ['light'] },
  { out: 'error-offline', src: 'history-failed', themes: ['light'] },
];

// 720 x 1600 recordings: crop the 72 px status bar, then scale to 340 px wide at 12 fps.
const GIFS = ['launch', 'unlock', 'reveal', 'remask'];
const GIF_FILTER =
  'crop=720:1528:0:72,fps=12,scale=340:-1:flags=lanczos,split[a][b];' +
  '[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4';

await mkdir(join(OUT, 'screens'), { recursive: true });
await mkdir(join(OUT, 'gifs'), { recursive: true });

for (const { out, src: state, themes } of SCREENS) {
  for (const theme of themes) {
    const dark = join(SHOTS_DARK, `${state}-${theme}.png`);
    const src = theme === 'dark' && existsSync(dark) ? dark : join(SHOTS, `${state}-${theme}.png`);
    const { width, height } = await sharp(src).metadata();
    await sharp(src)
      .extract({ left: 0, top: STATUS_BAR_PX, width, height: height - STATUS_BAR_PX })
      .resize(SCREEN_WIDTH)
      .png({ palette: true, quality: 90, effort: 10 })
      .toFile(join(OUT, 'screens', `${out}-${theme}.png`));
  }
}

for (const name of GIFS) {
  execFileSync(
    FFMPEG,
    [
      '-y',
      '-v',
      'error',
      '-i',
      join(CLIPS, `${name}-full.mp4`),
      '-vf',
      GIF_FILTER,
      '-loop',
      '0',
      join(OUT, 'gifs', `${name}.gif`),
    ],
    { stdio: 'inherit' },
  );
}
