import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '../../../.maestro');

function flowFiles(dir = ROOT): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? flowFiles(join(dir, e.name)) : e.name.endsWith('.yaml') ? [join(dir, e.name)] : [],
  );
}

const FLOWS = flowFiles().map((path) => ({
  name: path.slice(ROOT.length + 1),
  path,
  text: readFileSync(path, 'utf8'),
}));

/** Variables a flow's own header gives a default. A header default beats the env a parent passes to runFlow. */
function headerDefaults(text: string): string[] {
  const header = text.split(/^---$/m)[0] ?? '';
  const block = /^env:\n((?:[ ]+\S.*\n)+)/m.exec(header)?.[1] ?? '';
  return [...block.matchAll(/^\s+(\w+):/gm)].map((m) => m[1]!);
}

/** Variables each runFlow call passes in its env, keyed by the file it opens. */
function passedVariables(text: string): Map<string, Set<string>> {
  const passed = new Map<string, Set<string>>();
  for (const m of text.matchAll(/file:\s*(\S+)\n\s+env:\n((?:\s{6,}\w+:.*\n?)+)/g)) {
    const file = m[1]!.split('/').pop()!;
    const names = [...m[2]!.matchAll(/^\s+(\w+):/gm)].map((v) => v[1]!);
    passed.set(file, new Set([...(passed.get(file) ?? []), ...names]));
  }
  return passed;
}

test('no flow calls launchApp, which spends about 34 s before it launches on the phone', () => {
  expect(FLOWS.filter((f) => /^\s*-\s*launchApp\b/m.test(f.text)).map((f) => f.name)).toEqual([]);
});

test('a child flow sets no header default for a variable its parents pass, since the default would win', () => {
  const clashes = FLOWS.flatMap((parent) =>
    [...passedVariables(parent.text)].flatMap(([file, names]) => {
      const child = FLOWS.find((f) => f.name.endsWith(file));
      return headerDefaults(child?.text ?? '')
        .filter((v) => names.has(v))
        .map((v) => `${parent.name} passes ${v} to ${child!.name}, which defaults it`);
    }),
  );
  expect(clashes).toEqual([]);
});

test('no flow asserts one exact second of a countdown, since tapOn waits for the screen to settle first', () => {
  const exact = FLOWS.flatMap((f) =>
    f.text.split('\n').filter((l) => /visible:\s*"?\d:\d/.test(l)).map((l) => `${f.name}: ${l.trim()}`),
  );
  expect(exact).toEqual([]);
});
