// Verifies that every local link, image and backticked repo path in README.md resolves.
// Usage: node scripts/check-readme.mjs
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
const missing = [];

const headings = new Set(
  readFileSync(join(ROOT, 'ARCHITECTURE.md'), 'utf8')
    .split('\n')
    .filter((line) => /^#{2,3} /.test(line))
    .map((line) =>
      line
        .replace(/^#+ /, '')
        .toLowerCase()
        .replace(/[^a-z0-9 -]/g, '')
        .replace(/ /g, '-'),
    ),
);

const refs = [...readme.matchAll(/(?:href|src)="([^"]+)"|\]\(([^)]+)\)/g)].map((m) => m[1] ?? m[2]);
for (const ref of refs) {
  if (/^(https?:|mailto:)/.test(ref)) continue;
  const [path, anchor] = ref.split('#');
  if (path && !existsSync(join(ROOT, path))) missing.push(ref);
  else if (anchor && path === 'ARCHITECTURE.md' && !headings.has(anchor)) missing.push(ref);
}

const paths = [
  ...readme.matchAll(
    /`((?:src|scripts|assets|docs|design|\.maestro)\/[^`\s]*|[A-Z]+\.md|app\.config\.ts)`/g,
  ),
].map((m) => m[1]);
for (const path of paths) {
  if (!existsSync(join(ROOT, path.replace(/\/$/, '')))) missing.push(path);
}

if (missing.length > 0) {
  console.error(`README references that do not resolve:\n${[...new Set(missing)].join('\n')}`);
  process.exit(1);
}
console.log(`README ok: ${refs.length} links and ${paths.length} paths resolve.`);
