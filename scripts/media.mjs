// Builds the README media: status-bar-cropped screenshots and small GIFs from phone captures.
// Usage: node scripts/media.mjs
// Env: SEN_SHOTS (folder of PNG phone captures), SEN_CLIPS (folder of 720 px mp4 screen recordings),
// FFMPEG (path to ffmpeg, default `ffmpeg` on PATH, or run `npx ffmpeg-static` to fetch one).
import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.env.SEN_SHOTS ?? join(homedir(), 'sen-pickup/device/settled');
const CLIPS = process.env.SEN_CLIPS ?? join(homedir(), 'sen-pickup/device/motion-clips');
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const OUT = join(ROOT, 'docs/media');

// The phone's status bar shows notification icons, so every capture loses its top 130 px (of 1220 x 2712).
const STATUS_BAR_PX = 130;
const SCREEN_WIDTH = 540;
const SCREENS = ['lock-idle', 'history-masked', 'history-shown', 'lock-mismatch', 'lock-lockout'];
const THEMES = ['light', 'dark'];

// 720 x 1600 recordings: crop the 72 px status bar, then scale to 340 px wide at 12 fps.
const GIFS = ['launch', 'unlock', 'reveal', 'remask', 'lockout'];
const GIF_FILTER =
  'crop=720:1528:0:72,fps=12,scale=340:-1:flags=lanczos,split[a][b];' +
  '[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4';

await mkdir(join(OUT, 'screens'), { recursive: true });
await mkdir(join(OUT, 'gifs'), { recursive: true });

for (const name of SCREENS) {
  for (const theme of THEMES) {
    const src = join(SHOTS, `app-${name}-${theme}.png`);
    const { width, height } = await sharp(src).metadata();
    await sharp(src)
      .extract({ left: 0, top: STATUS_BAR_PX, width, height: height - STATUS_BAR_PX })
      .resize(SCREEN_WIDTH)
      .png({ palette: true, quality: 90, effort: 10 })
      .toFile(join(OUT, 'screens', `${name}-${theme}.png`));
  }
}

for (const name of GIFS) {
  execFileSync(
    FFMPEG,
    ['-y', '-v', 'error', '-i', join(CLIPS, `${name}-full.mp4`), '-vf', GIF_FILTER, '-loop', '0', join(OUT, 'gifs', `${name}.gif`)],
    { stdio: 'inherit' },
  );
}
