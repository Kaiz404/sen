"""Print every CSS animation on a design board as a millisecond timeline.

Usage: python3 -I scripts/board-keyframes.py design/MAX-Moments.dc.html [more boards]
       python3 -I scripts/board-keyframes.py --ts design/*.dc.html > src/features/sen/board.gen.ts

Each block names the selector, keyframes, duration and delay, then one line per stop:
the time in ms, the easing that runs from that stop to the next, and the declarations.
Easings with a token in src/motion/tokens.ts print by that token's name.

`--ts` writes the same keyframes as TypeScript data, one track per animated value, keyed by
board, moment selector (`.M-unlock`) and `<part>.<value>` (`lk.y`). Each step is an arrival,
`[ms, value, easing]`, where the easing shapes the segment that ends at that step. Rig parts use
the rig's channel names, so `.mo-grin` opacity is `mo.grin` and the `.sp` scaleX becomes the spin
angle `sp.th`.
"""
import json
import math
import re
import sys

EASE_NAMES = {
    '.2,.8,.2,1': 'out',
    '.37,0,.63,1': 'sine',
    '.55,.085,.68,.53': 'inQ',
    '.25,.46,.45,.94': 'outQ',
    '.12,0,.39,0': 'inS',
    '.61,1,.88,1': 'outS',
    '.34,1.56,.64,1': 'malSpring',
    '.3,1.25,.5,1': 'handoff',
    '.2,.7,.4,1': 'hopOut',
    '.6,0,.8,.3': 'hopIn',
}
TIME = r'-?[\d.]+m?s'


def ms(token):
    return float(token[:-2]) if token.endswith('ms') else float(token[:-1]) * 1000


def ease(text):
    m = re.search(r'cubic-bezier\(([^)]*)\)', text or '')
    if m:
        key = re.sub(r'(?<![\d.])0(?=\.)', '', m.group(1).replace(' ', ''))
        return EASE_NAMES.get(key, 'bez(' + key + ')')
    m = re.search(r'\b(linear|ease-in-out|ease-in|ease-out|ease)\b', text or '')
    return m.group(1) if m else ''


def keyframes(style):
    out = {}
    for m in re.finditer(r'@keyframes\s+([\w-]+)\s*\{', style):
        i, depth = m.end(), 1
        while depth:
            depth += {'{': 1, '}': -1}.get(style[i], 0)
            i += 1
        out[m.group(1)] = style[m.end():i - 1]
    return out


def rules(style):
    flat = re.sub(r'@keyframes\s+[\w-]+\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}', '', style)
    flat = re.sub(r'@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}', '', flat)
    for sel, body in re.findall(r'([^{}]+)\{([^{}]*)\}', flat):
        decl = dict(
            (k.strip(), v.strip())
            for k, v in (d.split(':', 1) for d in body.split(';') if ':' in d)
        )
        yield sel.strip(), decl


def animations(style):
    """Yield (selector, name, duration ms, delay ms, default easing).

    A board such as MAL2 sets `animation-name` per element and one shared duration and easing
    on a class every animated element carries. Those fall back to the stylesheet's only value.
    """
    shared = {'animation-duration': set(), 'animation-timing-function': set()}
    named = []
    for sel, decl in rules(style):
        if 'animation' in decl:
            parts = decl['animation'].split()
            times = [p for p in parts if re.fullmatch(TIME, p)]
            yield sel, parts[0], ms(times[0]), ms(times[1]) if len(times) > 1 else 0, ease(decl['animation'])
            continue
        for key in shared:
            if key in decl:
                shared[key].add(decl[key])
        if 'animation-name' in decl:
            named.append((sel, decl))
    only = {k: next(iter(v)) for k, v in shared.items() if len(v) == 1}
    for sel, decl in named:
        dur = decl.get('animation-duration', only.get('animation-duration'))
        if dur is None:
            print('%s -> %s (no single duration)' % (sel, decl['animation-name']))
            continue
        timing = decl.get('animation-timing-function', only.get('animation-timing-function'))
        yield sel, decl['animation-name'], ms(dur), ms(decl.get('animation-delay', '0s')), ease(timing)


def delays(style):
    """Selectors that set only animation-delay, such as MAL2's staggered sparkles."""
    out = {}
    for sel, decl in rules(style):
        if set(decl) == {'animation-delay'}:
            out[sel] = ms(decl['animation-delay'])
    return out


def stops(body, dur):
    """Yield (ms, easing or None, {property: value}) for each keyframe stop, in source order."""
    for st in re.finditer(r'([\d.%,\s]+|from|to)\{([^}]*)\}', body):
        decl = dict(
            (k.strip(), v.strip())
            for k, v in (d.split(':', 1) for d in st.group(2).split(';') if ':' in d)
        )
        e = decl.pop('animation-timing-function', None)
        for p in (p.strip() for p in st.group(1).split(',') if p.strip()):
            pct = 0 if p == 'from' else 100 if p == 'to' else float(p.rstrip('%'))
            yield pct * dur / 100, ease(e) if e else None, decl


def main(path):
    html = open(path).read()
    style = '\n'.join(re.findall(r'<style>(.*?)</style>', html, flags=re.S))
    kfs = keyframes(style)
    print('# %s' % path)
    for sel, name, dur, delay, default in animations(style):
        if name == 'none':
            continue
        if name not in kfs:
            print('%s -> %s (no keyframes)' % (sel, name))
            continue
        print('\n## %s  [%s %gms%s%s]' % (
            sel, name, dur, ' delay %gms' % delay if delay else '', ' default ' + default if default else ''))
        for st in re.finditer(r'([\d.%,\s]+|from|to)\{([^}]*)\}', kfs[name]):
            body = st.group(2)
            e = re.search(r'animation-timing-function:([^;]+)', body)
            props = re.sub(r';?animation-timing-function:[^;]+', '', body).strip(' ;')
            for p in (p.strip() for p in st.group(1).split(',') if p.strip()):
                pct = 0 if p == 'from' else 100 if p == 'to' else float(p.rstrip('%'))
                print('  %7.0fms  %-9s %s' % (pct * dur / 100, ease(e.group(1)) if e else '', props))
    extra = delays(style)
    if extra:
        print('\n## delays')
        for sel, delay in extra.items():
            print('  %s  %gms' % (sel, delay))


# Parts whose `scale(s)` is one uniform channel `<part>.s`. Every other part splits sx and sy.
UNIFORM = {'pl', 'pr', 'plf', 'prf', 's1', 's2', 's3', 't1', 't2', 't3', 'ss', 'sp1', 'sp2', 'sp3'}
# Drawn from the spin angle in the rig, so their board opacities are not tracks.
DERIVED = {'hd', 'tl', 'edge'}
# Screen furniture on the MAX boards, such as the list and the digits, which other features own.
SCREEN = {'list', 'pill', 'dots', 'digits', 'btn', 'toast', 'cbtn', 'hi', 'arc', 'wm'}
# Superseded by MAL2 (DESIGN.md › App moments).
SUPERSEDED = {'.M-launch'}
TRANSFORM = {
    'translate': ('x', 'y'),
    'translateX': ('x',),
    'translateY': ('y',),
    'rotate': ('r',),
    'skewX': ('k',),
    'scale': ('sx', 'sy'),
    'scaleX': ('sx',),
    'scaleY': ('sy',),
}
IDENTITY = {'x': 0, 'y': 0, 'r': 0, 'k': 0, 'sx': 1, 'sy': 1}
BEZ = re.compile(r'bez\(([^)]*)\)')
CSS_EASE = {
    'ease-in-out': [0.42, 0, 0.58, 1],
    'ease-in': [0.42, 0, 1, 1],
    'ease-out': [0, 0, 0.58, 1],
    'ease': [0.25, 0.1, 0.25, 1],
}


def number(text):
    return float(re.sub(r'(px|deg)$', '', text.strip()))


def transform_values(text):
    """`translate(0px,-18px) scale(1.05)` as {x: 0, y: -18, sx: 1.05, sy: 1.05}."""
    out = {}
    if text.strip() == 'none':
        return out
    for fn, args in re.findall(r'(\w+)\(([^)]*)\)', text):
        vals = [number(a) for a in args.split(',')]
        keys = TRANSFORM[fn]
        if fn == 'scale' and len(vals) == 1:
            vals = vals * 2
        if fn == 'translate' and len(vals) == 1:
            vals = vals + [0]
        out.update(zip(keys, vals))
    return out


def inset_values(text):
    """`inset(0px 0px 406px 0px round 0px 0px 40px 40px)` as its bottom inset and bottom radius."""
    nums = [number(n) for n in re.findall(r'-?[\d.]+(?:px)?', text)]
    return {'inset': nums[2], 'round': nums[6] if len(nums) > 6 else 0}


def ease_ts(name):
    if name in (None, '', 'linear'):
        return None
    if name in EASE_NAMES.values():
        return name
    m = BEZ.fullmatch(name)
    if m:
        return [float(v) for v in m.group(1).split(',')]
    return CSS_EASE[name]


def parts_of(selector):
    """`.M-face.ph-fail .elb,.M-face.ph-fail .erb` as ('.M-face.ph-fail', ['elb', 'erb'])."""
    moment, names = '', []
    for one in selector.split(','):
        words = one.strip().split(' ')
        last = max(i for i, w in enumerate(words) if w.startswith('.'))
        moment = ' '.join(words[:last])
        names.append(re.match(r'\.([\w-]+)', words[last]).group(1))
    return moment, names


def values_at(decl, used):
    """The stop's values. A transform names only some functions, so the rest of `used` are identity."""
    out = {}
    if 'transform' in decl:
        t = transform_values(decl['transform'])
        out.update({k: t.get(k, IDENTITY[k]) for k in used})
    if 'opacity' in decl:
        out['op'] = float(decl['opacity'])
    if 'stroke-dashoffset' in decl:
        out['off'] = float(decl['stroke-dashoffset'])
    if 'clip-path' in decl:
        out.update(inset_values(decl['clip-path']))
    return out


def channel(part, key):
    if part.startswith('mo-') and key == 'op':
        return 'mo.' + part[3:]
    if part in UNIFORM and key in ('sx', 'sy'):
        return part + '.s' if key == 'sx' else None
    if part == 'sp' and key == 'sy':
        return None
    return part + '.' + key


def spin(steps):
    """The board fakes the edge spin with scaleX keyframes: cos of a steady angle is drawn as
    quarter turns eased inS toward edge-on and outS away from it. The rig spins the angle itself,
    so scaleX becomes the angle nearest the last one (forward on a tie) and those quarters run linear.
    """
    out, theta = [], 0.0
    for at, v, e in steps:
        a = math.acos(max(-1.0, min(1.0, v)))
        k = round((theta - a) / (2 * math.pi))
        cands = [2 * math.pi * j + s * a for j in (k - 1, k, k + 1) for s in (1, -1)]
        best = min(cands, key=lambda c: (round(abs(c - theta), 6), -c))
        theta = best
        out.append((at, round(theta, 6), None if e in ('inS', 'outS') else e))
    return out


def tracks(path):
    html = open(path).read()
    style = '\n'.join(re.findall(r'<style>(.*?)</style>', html, flags=re.S))
    kfs = keyframes(style)
    later = delays(style)
    out = {}
    for sel, name, dur, delay, default in animations(style):
        if name == 'none' or name not in kfs:
            continue
        moment, parts = parts_of(sel)
        staggered = [d for d in later if d != sel and re.sub(r'\d+$', '', d) == '.' + parts[0]]
        if staggered:
            runs = [([d.lstrip('.')], delay + later[d]) for d in staggered]
        else:
            runs = [(parts, delay + later.get(sel, 0))]
        per = {}
        frames = list(stops(kfs[name], dur))
        used = {k for _, _, d in frames if 'transform' in d for k in transform_values(d['transform'])}
        for at, e, decl in frames:
            vals = values_at(decl, used)
            for k, v in vals.items():
                per.setdefault(k, []).append((at, v, e if e is not None else default))
        for names, shift in runs:
            for part in names:
                if part in DERIVED or moment in SUPERSEDED or (moment and part in SCREEN):
                    continue
                for k, seq in per.items():
                    ch = channel(part, k)
                    if ch is None:
                        continue
                    steps, prev = [], None
                    # `0%,100%{}` lists its times out of order. The sort is stable, so ties keep source order.
                    for at, v, e in sorted(seq, key=lambda stop: stop[0]):
                        steps.append((round(at + shift), round(v, 6), prev))
                        prev = e
                    if ch == 'sp.sx':
                        ch = 'sp.th'
                        steps = spin(steps)
                    out.setdefault(moment, {})[ch] = steps
    return out


def ts_value(v):
    return json.dumps(int(v) if float(v).is_integer() else v)


def emit(boards):
    print('// Generated by `python3 -I scripts/board-keyframes.py --ts design/*.dc.html`. Do not edit.')
    print('// Each step is an arrival: [ms, value, the easing of the segment that ends there].')
    print("import type { BoardData } from './board';")
    print()
    print('export const BOARDS = {')
    for path in boards:
        name = re.sub(r'\.dc\.html$', '', path.split('/')[-1])
        print('  %s: {' % json.dumps(name))
        for moment, chans in tracks(path).items():
            print('    %s: {' % json.dumps(moment))
            for ch, steps in sorted(chans.items()):
                cells = []
                for at, v, e in steps:
                    e = ease_ts(e)
                    cell = [ts_value(at), ts_value(v)] + ([json.dumps(e).replace(' ', '')] if e is not None else [])
                    cells.append('[' + ', '.join(cell) + ']')
                print('      %s: [%s],' % (json.dumps(ch), ', '.join(cells)))
            print('    },')
        print('  },')
    print('} as const satisfies BoardData;')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    if sys.argv[1] == '--ts':
        emit([b for b in sys.argv[2:] if 'MAX-Spec' not in b and 'MAL-Timelines' not in b])
    else:
        for board in sys.argv[1:]:
            main(board)
