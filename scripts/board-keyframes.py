"""Print every CSS animation on a design board as a millisecond timeline.

Usage: python3 -I scripts/board-keyframes.py design/MAX-Moments.dc.html [more boards]

Each block names the selector, keyframes, duration and delay, then one line per stop:
the time in ms, the easing that runs from that stop to the next, and the declarations.
Easings with a token in src/motion/tokens.ts print by that token's name.
"""
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


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    for board in sys.argv[1:]:
        main(board)
