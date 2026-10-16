"""Shared kit for the Sen final boards (X1P screens + MAX Sen).

Usage from a board script:
    import sys; sys.path.insert(0, KIT_DIR); from kit import *
    sen('masked', 84, 'Sen, eyes closed while amounts are hidden', style='position:absolute;right:16px;top:-40px')

Every Sen is a static SVG drawn from the MAX rig (face r 222, rim r 262, 600-unit viewBox).
Colours never change between light and dark: lemon face, deep-mint rim and features.
Ambient CSS loops are opt-in with anim='blink' | 'peek' | 'bob' | 'breathe'.
"""
import itertools

LEMON = '#F2DC72'; DEEP = '#236B47'; INK = '#17181A'; PAPER = '#FFFDF8'
_uid = itertools.count(1)
_prefix = ['sk']
def set_prefix(p):
    """Call once per board with a short unique prefix so clipPath ids never collide."""
    _prefix[0] = p

# ---------- eyes ----------
def _eye_open(x, sx=1, sy=1):
    e = '<g class="eb"><ellipse cx="%s" cy="-38" rx="14" ry="20" fill="%s"/></g>' % (x, DEEP)
    if (sx, sy) == (1, 1): return e
    return '<g transform="translate(%s -38) scale(%s %s) translate(%s 38)">%s</g>' % (x, sx, sy, -x, e)
def _eye_closed(x):
    return '<path d="M%s -40 Q%s -16 %s -40" fill="none" stroke="%s" stroke-width="13" stroke-linecap="round"/>' % (x-20, x, x+20, DEEP)
def _eye_happy(x):  # upward arc, happy squint
    return '<path d="M%s -30 Q%s -58 %s -30" fill="none" stroke="%s" stroke-width="13" stroke-linecap="round"/>' % (x-20, x, x+20, DEEP)
def _eye_worried(x, d):  # open eye, slightly smaller, nudged toward centre
    return '<g transform="translate(%s 8)"><ellipse cx="%s" cy="-38" rx="12" ry="17" fill="%s"/></g>' % (d, x, DEEP)

MOUTH = {
    'smile': '<path d="M-16 20 Q0 34 16 20" fill="none" stroke="%s" stroke-width="12" stroke-linecap="round"/>' % DEEP,
    'small': '<path d="M-10 30 Q0 36 10 30" fill="none" stroke="%s" stroke-width="12" stroke-linecap="round"/>' % DEEP,
    'grin':  '<path d="M-30 14 Q0 52 30 14" fill="none" stroke="%s" stroke-width="14" stroke-linecap="round"/>' % DEEP,
    'frown': '<path d="M-16 34 Q0 22 16 34" fill="none" stroke="%s" stroke-width="12" stroke-linecap="round"/>' % DEEP,
    'flat':  '<path d="M-14 29 Q0 29 14 29" fill="none" stroke="%s" stroke-width="12" stroke-linecap="round"/>' % DEEP,
    'o':     '<ellipse cx="0" cy="30" rx="11" ry="14" fill="%s"/>' % DEEP,
    'none':  '',
}

PROPS = {
    'magnifier': '<g><circle cx="150" cy="70" r="52" fill="none" stroke="%s" stroke-width="20"/><circle cx="150" cy="70" r="40" fill="%s" opacity=".55"/><rect x="96" y="104" width="24" height="70" rx="12" fill="%s" transform="rotate(38 108 139)"/></g>' % (INK, PAPER, INK),
    'plug': '<g><path d="M170 120 Q240 150 236 230" fill="none" stroke="%s" stroke-width="14" stroke-linecap="round"/><rect x="128" y="70" width="84" height="62" rx="20" fill="%s"/><rect x="142" y="38" width="16" height="40" rx="8" fill="%s"/><rect x="182" y="38" width="16" height="40" rx="8" fill="%s"/></g>' % (INK, INK, INK, INK),
    'nightcap': '<g><path d="M-170 -150 Q-40 -330 150 -250 Q230 -200 250 -120 Q120 -230 -170 -150Z" fill="%s"/><circle cx="262" cy="-104" r="34" fill="%s"/><circle cx="262" cy="-104" r="34" fill="none" stroke="%s" stroke-width="10"/></g>' % (DEEP, LEMON, DEEP),
    'shades': '<g><rect x="-118" y="-74" width="96" height="66" rx="30" fill="%s"/><rect x="22" y="-74" width="96" height="66" rx="30" fill="%s"/><rect x="-30" y="-56" width="60" height="16" rx="8" fill="%s"/></g>' % (INK, INK, INK),
}
# props held by paw-r are drawn just under the right paw; nightcap/shades sit on the face layer
_PAW_PROPS = {'magnifier', 'plug'}

ACCENTS = ('<g aria-hidden="true">'
  '<path transform="translate(-292 -236)" d="M0 -46 Q7 -7 46 0 Q7 7 0 46 Q-7 7 -46 0 Q-7 -7 0 -46Z" fill="{c}"/>'
  '<path transform="translate(308 -150) scale(.62)" d="M0 -46 Q7 -7 46 0 Q7 7 0 46 Q-7 7 -46 0 Q-7 -7 0 -46Z" fill="{c}"/>'
  '<path transform="translate(262 238) scale(.45)" d="M0 -46 Q7 -7 46 0 Q7 7 0 46 Q-7 7 -46 0 Q-7 -7 0 -46Z" fill="{c}"/>'
  '<path d="M228 -262 L262 -300 M270 -222 L318 -240 M196 -296 L208 -340" fill="none" stroke="{c}" stroke-width="18" stroke-linecap="round"/>'
  '</g>')

# pose: (lk translate, eyes, mouth, cheeks, body rotate, paw-l offset, paw-r offset)
# eyes: open | closed | peek (left closed, right crack) | happy | worried | squint
POSES = {
    'idle':     dict(lk=(0, 0),   eyes='open',    mouth='smile', ck=0,  rot=0,    pl=(0, 0),       pr=(0, 0)),
    'masked':   dict(lk=(0, 34),  eyes='closed',  mouth='small', ck=0,  rot=0,    pl=(0, 0),       pr=(0, 0)),
    'peek':     dict(lk=(22, 24), eyes='peek',    mouth='small', ck=0,  rot=-2.4, pl=(0, 0),       pr=(0, 0)),
    'happy':    dict(lk=(0, -8),  eyes='happy',   mouth='grin',  ck=.3, rot=0,    pl=(-128, -180), pr=(128, -180)),
    'revealed': dict(lk=(0, -8),  eyes='open',    mouth='grin',  ck=.3, rot=0,    pl=(0, 0),       pr=(0, 0)),
    'look':     dict(lk=(64, -44),eyes='open',    mouth='smile', ck=0,  rot=2.6,  pl=(0, 0),       pr=(0, 0)),
    'lookdown': dict(lk=(-64, 70),eyes='open',    mouth='smile', ck=0,  rot=-3,   pl=(0, 0),       pr=(0, 0)),
    'worried':  dict(lk=(0, 0),   eyes='worried', mouth='frown', ck=0,  rot=-4,   pl=(66, -56),    pr=(-66, -56)),
    'asleep':   dict(lk=(0, 48),  eyes='closed',  mouth='small', ck=0,  rot=0,    pl=(36, -6),     pr=(-36, -6)),
    'shrug':    dict(lk=(-16, -14),eyes='open',   mouth='flat',  ck=0,  rot=0,    pl=(-70, -80),   pr=(20, -70)),
    'squint':   dict(lk=(0, 0),   eyes='squint',  mouth='flat',  ck=0,  rot=0,    pl=(0, 0),       pr=(0, 0)),
    'cool':     dict(lk=(0, 0),   eyes='open',    mouth='smile', ck=0,  rot=0,    pl=(0, 0),       pr=(0, 0)),
}

def _eyes(kind):
    if kind == 'open':    return _eye_open(-72) + _eye_open(72)
    if kind == 'closed':  return _eye_closed(-72) + _eye_closed(72)
    if kind == 'peek':    return _eye_closed(-72) + _eye_open(72, 1.05, .45)
    if kind == 'happy':   return _eye_happy(-72) + _eye_happy(72)
    if kind == 'worried': return _eye_worried(-72, 10) + _eye_worried(72, -10)
    if kind == 'squint':  return _eye_open(-72, 1.15, .35) + _eye_open(72, 1.15, .35)
    raise ValueError(kind)

def sen(pose='idle', size=84, label='Sen', style='', prop=None, accents=False, accent_color=DEEP,
        anim=None, mouth=None, eyes=None, lk=None, rot=None, face_only=None, hidden=False):
    """Return a static <svg> of Sen. size in px. face_only defaults to True under 48 px (size tier)."""
    p = dict(POSES[pose])
    if mouth: p['mouth'] = mouth
    if eyes: p['eyes'] = eyes
    if lk: p['lk'] = lk
    if rot is not None: p['rot'] = rot
    if face_only is None: face_only = size < 48
    u = '%s%d' % (_prefix[0], next(_uid))
    lkx, lky = p['lk']
    cheeks = '' if not p['ck'] else '<g opacity="%s"><ellipse cx="-128" cy="34" rx="28" ry="17" fill="%s"/><ellipse cx="128" cy="34" rx="28" ry="17" fill="%s"/></g>' % (p['ck'], DEEP, DEEP)
    mouth_svg = '' if face_only else MOUTH[p['mouth']]
    face = '<g clip-path="url(#%s)"><g class="lk" transform="translate(%s %s)">%s%s</g></g>' % (u, lkx, lky, _eyes(p['eyes']), mouth_svg)
    over = PROPS[prop] if prop in ('nightcap', 'shades') else ''
    if pose == 'cool' and not prop: over = PROPS['shades']
    paws = ''
    if not face_only:
        held = PROPS[prop] if prop in _PAW_PROPS else ''
        paws = ('<g class="pl" transform="translate(%s %s)"><ellipse cx="-106" cy="152" rx="46" ry="36" fill="%s"/></g>' % (p['pl'][0], p['pl'][1], DEEP) +
                '<g class="pr" transform="translate(%s %s)">%s<ellipse cx="106" cy="152" rx="46" ry="36" fill="%s"/></g>' % (p['pr'][0], p['pr'][1], held, DEEP))
    body = ('<g class="sq" transform="rotate(%s 10 278)">' % p['rot'] +
            '<circle cx="10" cy="16" r="262" fill="%s"/><circle cx="0" cy="0" r="222" fill="%s"/>' % (DEEP, LEMON) +
            cheeks + face + over + paws + '</g>')
    acc = ACCENTS.format(c=accent_color) if accents else ''
    cls = 'sen' + (' sen-%s' % anim if anim else '')
    aria = 'aria-hidden="true"' if hidden else 'role="img" aria-label="%s"' % label
    return ('<svg class="%s" %s width="%s" height="%s" viewBox="-300 -300 600 600" style="display: block; overflow: visible; flex: none%s">'
            '<defs><clipPath id="%s"><circle cx="0" cy="0" r="222"/></clipPath></defs>%s%s</svg>') % (
            cls, aria, size, size, ('; ' + style) if style else '', u, body, acc)

# Ambient loops. Add SEN_CSS to the board's <helmet><style>.
SEN_CSS = (
  '.sen .eb{transform-box:fill-box;transform-origin:center}'
  '.sen-blink .eb{animation:senblink 5.2s infinite}'
  '@keyframes senblink{0%,92%,100%{transform:scaleY(1)}94%{transform:scaleY(.1)}96%{transform:scaleY(1)}}'
  '.sen-bob{animation:senbob 3.6s cubic-bezier(.37,0,.63,1) infinite}'
  '@keyframes senbob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}'
  '.sen-breathe .sq{transform-box:view-box;transform-origin:10px 278px;animation:senbreathe 4s cubic-bezier(.37,0,.63,1) infinite}'
  '@keyframes senbreathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.01,1.02)}}'
  '.sen-peek .lk{animation:senpeek 7s cubic-bezier(.2,.8,.2,1) infinite}'
  '@keyframes senpeek{0%,60%,100%{transform:translate(0px,34px)}68%,86%{transform:translate(22px,24px)}}'
  '@media (prefers-reduced-motion: reduce){.sen,.sen *{animation:none !important}}'
)

FONTS = '<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400..800&amp;family=IBM+Plex+Mono:wght@500;600&amp;display=swap" rel="stylesheet">'

# X1P base CSS (light). Dark boards override colours inline.
BASE_CSS = (
  "body{margin:0}\n"
  "a{color:inherit;text-decoration:none}a:hover{color:inherit}\n"
  "button{font-family:inherit;border:0;cursor:pointer;color:inherit;background:transparent;padding:0}\n"
  "input{font-family:inherit}\n"
  "@font-face{font-family:'MDI';src:url(/_blob/b2ada0772d2d3984695404d165c6eda2) format('truetype');font-display:block}\n"
  ".mdi{font-family:'MDI';font-style:normal;font-weight:400;line-height:1}\n"
  ".sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}\n"
  ".grain{position:absolute;inset:0;pointer-events:none;background-image:url(/_blob/3e40d1508dcd948a65c299d1f892ffbe);background-size:512px;mix-blend-mode:multiply;opacity:0.06}\n"
  ".d{font-family:'Bricolage Grotesque','Avenir Next Condensed','Arial Narrow',system-ui,sans-serif;font-weight:800;font-optical-sizing:auto}\n"
  ".cond{font-stretch:75%;text-transform:uppercase;letter-spacing:-0.005em}\n"
  ".n{font-variant-numeric:tabular-nums lining-nums;letter-spacing:-0.035em}\n"
  ".mono{font-family:'IBM Plex Mono',ui-monospace,Menlo,monospace}\n"
  ".cap{font-family:'IBM Plex Mono',ui-monospace,Menlo,monospace;font-size:11px;font-weight:600;letter-spacing:0.12em;color:#5F5A50}\n"
  ".key{border:2px solid #17181A;box-shadow:0 4px 0 #17181A;box-sizing:border-box;color:#17181A}\n"
  ".coin{display:block;border-radius:9999px;background:#F2DC72;border:1.5px solid #17181A;box-sizing:border-box;flex:none}\n"
  ".perf{height:8px;display:block;background-color:#FFFDF8;background-image:radial-gradient(circle at 7px 0,#F6F2E9 4px,transparent 4.5px);background-size:14px 8px;background-repeat:repeat-x}\n"
  ".zig{height:8px;display:block;background:linear-gradient(135deg,#FFFDF8 5.5px,transparent 0) 0 0/11px 8px repeat-x,linear-gradient(225deg,#FFFDF8 5.5px,transparent 0) 0 0/11px 8px repeat-x}\n"
  ".lead{flex:1 1 auto;border-bottom:2px dotted #C9BFAA;margin:0 8px;transform:translateY(-4px);min-width:12px}\n"
)

def page(title, w, h, body, extra_css='', interactive=False, vals='return {};'):
    """Wrap a board body in the .dc.html skeleton. body is the root element markup."""
    return ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>%s</title>\n'
            '<script src="./support.js"></script>\n</head>\n<body>\n<x-dc>\n<helmet>\n%s\n<style>\n%s%s\n%s\n</style>\n</helmet>\n%s\n</x-dc>\n'
            '<script type="text/x-dc" data-dc-script data-props=\'{"$preview":{"width":%d,"height":%d}}\'>\n'
            'class Component extends DCLogic {\n  renderVals() {\n    %s\n  }\n}\n</script>\n</body>\n</html>\n') % (
            title, FONTS, BASE_CSS, SEN_CSS, extra_css, body, w, h, vals)
