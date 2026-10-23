"""ec_devices.py — the Engaging Carousel device library (Editor V1's devices on a 1080x1350 slide).

Every beat of a slide is one of these devices. They come from Editor V1, which measured them
frame by frame in three Metro Media House founder-story edits (reference/devices.md has the
frame counts). Each device writes its HTML, its GSAP lines and its own SOUND CUES, so a click
lands on the frame the picture changes and the cue sheet can never drift from the cut.

    import sys; sys.path.insert(0, '<skill>/components'); from ec_devices import *
    c = Comp(dur=10.0)
    still(c, 0, 1.2, 'img/mic.jpg', z=1); tile_reveal(c, 0, 'img/mic.jpg', z=2)
    captions(c, [([('Wait.', .10)], 0.6)])
    c.write('index.html')            # + c.write_cues('cues.json')

Cues are written as ROLES at the frame of the VISUAL ("tick" at 1.233s), not as files: the mixer
(scripts/mix.py) turns a role into a sound from the active kit with that kit's pre-roll and its
level relative to the voice, so a kit can be swapped without touching a build.

Rules baked in (each one bit an earlier build):
- every time is snapped to a whole frame; clip durations are FLOORED to 4 decimals
- every clip gets an explicit z-index (track index is not paint order)
- videos are top-level clips, never inside a timed wrapper
- initial transforms go in a gsap.set preamble OUTSIDE the timeline; fromTo carries immediateRender:false
- nothing tweens visibility/autoAlpha on a .clip; inner nodes carry opacity
"""
import json, math, random, html as _html

FPS = 30
W, H = 1080, 1350
CX, CY = W // 2, H // 2
F1 = 1 / FPS


def fr(t):            # snap seconds to the frame grid
    return round(t * FPS) / FPS


def dstr(t0, t1):     # clip duration floored so the renderer's ceil gives exactly the frame count
    n = round(t1 * FPS) - round(t0 * FPS)
    return f'{math.floor(n / FPS * 1e4) / 1e4:.4f}'


def esc(s):
    return _html.escape(s, quote=True)


class Comp:
    def __init__(self, dur, cid='main'):
        self.dur, self.cid = fr(dur), cid
        self.els, self.js, self.pre, self.css, self.cues = [], [], [], [], []
        self.beds = []
        self.n = 0

    def uid(self, p='e'):
        self.n += 1
        return f'{p}{self.n}'

    def clip(self, t0, t1, inner, z, cls='ev1-layer', style='', cid=None):
        cid = cid or self.uid('c')
        t0, t1 = fr(t0), fr(min(t1, self.dur))
        if t1 <= t0:
            return cid
        self.els.append(f'<div id="{cid}" class="clip {cls}" data-start="{t0:.4f}" data-duration="{dstr(t0, t1)}" '
                        f'style="z-index:{z};{style}">{inner}</div>')
        return cid

    def video(self, t0, t1, src, media_start, z, style='', vid=None):
        vid = vid or self.uid('v')
        t0, t1 = fr(t0), fr(min(t1, self.dur))
        self.els.append(f'<video id="{vid}" class="clip ev1-fill" src="{src}" muted playsinline '
                        f'data-start="{t0:.4f}" data-duration="{dstr(t0, t1)}" data-media-start="{media_start:.4f}" '
                        f'style="z-index:{z};{style}"></video>')
        return vid

    def at(self, line):
        self.js.append(line)

    def cue(self, t, role, gain=1.0):
        if 0 <= t < self.dur + 0.5:
            self.cues.append({'t': round(fr(t), 4), 'role': role, 'gain': round(gain, 3)})

    def write(self, path, tokens_href='assets/tokens.css', gsap_src='assets/vendor/gsap.min.js', title='Engaging Carousel'):
        doc = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width={W}, height={H}">
<title>{esc(title)}</title>
<link rel="stylesheet" href="{tokens_href}">
<script src="{gsap_src}"></script>
<style>
html,body{{margin:0;background:#000;width:{W}px;height:{H}px}}
#root{{position:relative;width:{W}px;height:{H}px;overflow:hidden;background:var(--ev1-black)}}
{chr(10).join(self.css)}
</style></head>
<body>
<div id="root" class="ev1-frame" data-composition-id="{self.cid}" data-start="0" data-width="{W}" data-height="{H}" data-duration="{self.dur:.4f}">
{chr(10).join(self.els)}
</div>
<script>
window.__timelines = window.__timelines || {{}};
{chr(10).join(self.pre)}
const tl = gsap.timeline({{ paused: true }});
{chr(10).join(self.js)}
tl.set({{}}, {{}}, {self.dur:.4f});
window.__timelines["{self.cid}"] = tl;
</script>
</body></html>
'''
        open(path, 'w').write(doc)

    def bed(self, t0, t1, db, fade=0.015):
        """Bed automation: CUT, don't duck. db=-70 is a full drop (a punchline, voice alone), -6 pulls it under
        a black or UI card. The ramps sit OUTSIDE [t0, t1], so put t0 on the word."""
        self.beds.append({'t0': round(fr(t0), 4), 't1': round(fr(t1), 4), 'db': db, 'fade': fade})

    def write_cues(self, path):
        json.dump({'dur': self.dur, 'sfx': sorted(self.cues, key=lambda c: c['t']), 'bed': self.beds}, open(path, 'w'), indent=0)


# ------------------------------------------------------------------ sound roles
# A device cues a ROLE on the frame of its visual. scripts/sfx_kit.py maps each role to a file of the
# active kit (its pre-roll = file start -> transient) and a level relative to the voice. The levels
# come from Editor V1's measurements of the references: clicks sit only 2-7 dB under the voice and
# land 4-14 ms after the picture; no whoosh on moves; weight comes from the bed, not from booms.
ROLES = ('tick', 'click', 'click_soft', 'swish', 'glitch', 'riser', 'subtone', 'subboom', 'impact', 'hit', 'outro')


def sfx(c, t, role, gain=1.0):
    assert role in ROLES, role
    c.cue(t, role, gain)


# ------------------------------------------------------------------ STILL
def still(c, t0, t1, src, z, push=1.06, origin='50% 50%', size=(1188, 1485), push_from=1.0):
    """A held real image, edge to edge, on a slow linear push (every still breathes)."""
    iid = c.uid('img')
    w, h = size
    inner = (f'<img id="{iid}" src="{src}" style="position:absolute;left:{(W - w) // 2}px;top:{(H - h) // 2}px;'
             f'width:{w}px;height:{h}px;object-fit:cover;transform-origin:{origin}">')
    cid = c.clip(t0, t1, inner, z)
    c.at(f'tl.fromTo("#{iid}",{{scale:{push_from}}},{{scale:{push},duration:{fr(t1) - fr(t0):.4f},ease:"none",immediateRender:false}},{fr(t0):.4f});')
    return cid, iid


# ------------------------------------------------------------------ FRAMES (glitch / datamosh)
def frames(c, t0, srcs, z, per=1, sound='glitch'):
    """A list of pre-rendered frames one (or `per`) frame each: the 3-4 frame datamosh."""
    t = fr(t0)
    for s in srcs:
        c.clip(t, t + per * F1, f'<img src="{s}" class="ev1-fill">', z)
        t += per * F1
    if sound:
        sfx(c, t0, sound)
    return t


# ------------------------------------------------------------------ TILE-FLASH REVEAL
def tile_reveal(c, t, src, z, cols=3, rows=3, seed=1, size=(1188, 1485), click=True):
    """Editor V1's opening move: the thirds grid; each pane flashes white for one frame and then shows
    the new picture, one pane per frame in a shuffled order, ONE CLICK PER PANE. The layer ends when the
    last pane lands; put the full still underneath from `t` (still(c, t, ...))."""
    t = fr(t)
    rnd = random.Random(seed)
    order = list(range(cols * rows)); rnd.shuffle(order)
    w, h = size; ox, oy = (W - w) // 2, (H - h) // 2
    pw, ph = W / cols, H / rows
    inner, end = [], t
    for k, p in enumerate(order):
        cx, cy = p % cols, p // cols
        x0, y0 = round(cx * pw), round(cy * ph); x1, y1 = round((cx + 1) * pw), round((cy + 1) * ph)
        pid, fid = c.uid('pane'), c.uid('pf')
        inner.append(f'<div id="{pid}" style="position:absolute;left:{x0}px;top:{y0}px;width:{x1 - x0}px;height:{y1 - y0}px;overflow:hidden;opacity:0">'
                     f'<img src="{src}" style="position:absolute;left:{ox - x0}px;top:{oy - y0}px;width:{w}px;height:{h}px;object-fit:cover"></div>'
                     f'<div id="{fid}" style="position:absolute;left:{x0}px;top:{y0}px;width:{x1 - x0}px;height:{y1 - y0}px;background:#fff;opacity:0"></div>')
        tf = t + k * F1
        c.at(f'tl.set("#{fid}",{{opacity:1}},{tf:.4f});tl.set("#{fid}",{{opacity:0}},{tf + F1:.4f});tl.set("#{pid}",{{opacity:1}},{tf + F1:.4f});')
        if click:
            sfx(c, tf, 'tick', 0.9 + 0.2 * rnd.random())
        end = max(end, tf + 2 * F1)
    c.clip(t, end, ''.join(inner), z)
    return end


# ------------------------------------------------------------------ CAPTIONS
def captions(c, groups, z=60, y=None, on_paper=False):
    """Small white words, centred, each appearing on its own spoken onset (+-1 frame), laid out in
    their final slots so nothing re-centres. groups = [(words, t_end[, mode])], words = [(text, onset)].
    mode: None | 'serif' (stressed phrase, italic serif) | 'big' (the key word, 2.1x bold)."""
    for g in groups:
        words, t_end = g[0], g[1]
        mode = g[2] if len(g) > 2 else None
        if not words:
            continue
        t0 = fr(words[0][1])
        spans = []
        for wtxt, on in words:
            wid = c.uid('w')
            spans.append(f'<span id="{wid}" class="w">{esc(wtxt)}</span>')
            c.at(f'tl.set("#{wid}",{{opacity:1}},{max(t0, fr(on)):.4f});')
        style = f'top:calc({y} - 0.6 * var(--ev1-cap-size));' if y else ''
        if mode == 'serif':
            style += 'font:italic 600 calc(var(--ev1-cap-size) * 1.3)/1.15 var(--ev1-serif);letter-spacing:0;'
        elif mode == 'big':
            ty = y or '50%'
            style += f'font:700 calc(var(--ev1-cap-size) * 2.1)/1.05 var(--ev1-grotesk);letter-spacing:-0.03em;top:calc({ty} - 0.65 * var(--ev1-cap-size) * 2.1);'
        cls = 'ev1-cap on-paper' if on_paper else 'ev1-cap'
        c.clip(t0, t_end, f'<div class="{cls}" style="{style}">{"".join(spans)}</div>', z, cls='',
               style=f'position:absolute;left:0;top:0;width:{W}px;height:{H}px')


def caption_groups(words, breaks, ends=None, modes=None):
    """Split a slide's words.json into caption groups. words = [{'w','s','e'}]; breaks = indices where a
    new group starts (0 implied); a group ends where the next starts (or at ends[i] if given)."""
    idx = sorted(set([0] + list(breaks)))
    out = []
    for k, i0 in enumerate(idx):
        i1 = idx[k + 1] if k + 1 < len(idx) else len(words)
        ws = [(w['w'], w['s']) for w in words[i0:i1]]
        t_end = (ends or {}).get(k) or (words[i1]['s'] if i1 < len(words) else words[-1]['e'] + 0.6)
        g = (ws, t_end) if not modes or k not in modes else (ws, t_end, modes[k])
        out.append(g)
    return out


# ------------------------------------------------------------------ DISPLAY TYPE
def keyword(c, t0, t1, text, z, x=CX, y=CY, kind='key', blur_in=True, sound=None, size=None, align='center'):
    """The big word. kind = key (white sans) | title (chrome serif italic) | shock (red Didone caps) |
    mega (huge red black-weight). Blur-in over 6 frames; shock and mega cut on hard.
    text may be a list: one display line each, stacked."""
    kid = c.uid('k')
    cls = {'key': 'ev1-key', 'shock': 'ev1-shock', 'title': 'ev1-title', 'mega': 'ev1-mega'}[kind]
    fs = f'font-size:{size}px;' if size else ''
    ta = f'text-align:{align};'
    if isinstance(text, (list, tuple)):
        inner = f'<div id="{kid}" style="{ta}">' + ''.join(f'<div class="{cls}" style="{fs}line-height:1.0">{esc(t)}</div>' for t in text) + '</div>'
    else:
        inner = f'<div id="{kid}" class="{cls}" style="{fs}{ta}">{esc(text)}</div>'
    if kind == 'title':
        inner = f'<div class="ev1-title-wrap">{inner}</div>'
    box = (f'<div style="position:absolute;left:0;top:{y}px;width:{W}px;height:0;display:flex;justify-content:center;'
           f'align-items:center;transform:translateX({x - CX}px)">{inner}</div>')
    c.clip(t0, t1, box, z, cls='', style=f'position:absolute;left:0;top:0;width:{W}px;height:{H}px')
    if blur_in and kind not in ('shock', 'mega'):
        c.at(f'tl.fromTo("#{kid}",{{opacity:0,filter:"blur(18px)",scale:1.06}},{{opacity:1,filter:"blur(0px)",scale:1,duration:0.2,ease:"power2.out",immediateRender:false}},{fr(t0):.4f});')
        c.pre.append(f'gsap.set("#{kid}",{{opacity:0}});')
    if sound:
        sfx(c, t0, sound)
    return kid


def svg_mark(c, t0, t1, svg_markup, z, width=560, x=CX, y=CY, color='#fff', blur_in=True, keep_colors=False):
    """A real brand mark (the company's own SVG), white (or its own colours), blurred in like a keyword."""
    mid = c.uid('mark')
    fill = '' if keep_colors else f'fill:{color};'
    svg = svg_markup.replace('<svg', f'<svg style="width:100%;height:auto;display:block;{fill}"', 1)
    inner = (f'<div style="position:absolute;left:{x - width // 2}px;top:{y}px;width:{width}px;transform:translateY(-50%)">'
             f'<div id="{mid}" style="filter:drop-shadow(0 8px 30px rgba(0,0,0,.45))">{svg}</div></div>')
    c.clip(t0, t1, inner, z, cls='', style=f'position:absolute;left:0;top:0;width:{W}px;height:{H}px')
    if blur_in:
        c.pre.append(f'gsap.set("#{mid}",{{opacity:0}});')
        c.at(f'tl.fromTo("#{mid}",{{opacity:0,filter:"blur(22px) drop-shadow(0 8px 30px rgba(0,0,0,.45))",scale:1.08}},{{opacity:1,filter:"blur(0px) drop-shadow(0 8px 30px rgba(0,0,0,.45))",scale:1,duration:0.2,ease:"power2.out",immediateRender:false}},{fr(t0):.4f});')
    return mid


def img_mark(c, t0, t1, src, z, width=560, x=CX, y=CY, blur_in=True):
    """A real logo as an image (PNG with alpha), blurred in like a keyword."""
    mid = c.uid('mark')
    inner = (f'<div style="position:absolute;left:{x - width // 2}px;top:{y}px;width:{width}px;transform:translateY(-50%)">'
             f'<img id="{mid}" src="{src}" style="display:block;width:100%;filter:drop-shadow(0 8px 30px rgba(0,0,0,.45))"></div>')
    c.clip(t0, t1, inner, z, cls='', style=f'position:absolute;left:0;top:0;width:{W}px;height:{H}px')
    if blur_in:
        c.pre.append(f'gsap.set("#{mid}",{{opacity:0}});')
        c.at(f'tl.fromTo("#{mid}",{{opacity:0,scale:1.08}},{{opacity:1,scale:1,duration:0.2,ease:"power2.out",immediateRender:false}},{fr(t0):.4f});')
    return mid


# ------------------------------------------------------------------ POP COLLAGE
def pop_collage(c, t0, t1, cards, z, ground='black', drift=0.05):
    """Real cards land one by one on a dark ground, each preceded by a one-frame white box of its own
    size, ONE CLICK EACH. cards = [(src, x, y, w, rot, t_pop)] (x, y = card centre). The stack drifts."""
    gid = c.uid('col')
    inner = [f'<div class="ev1-layer ev1-{ground}"></div><div id="{gid}" class="ev1-layer" style="transform-origin:50% 50%">']
    for src, x, y, w, rot, tp in cards:
        cid, bid, kid = c.uid('cd'), c.uid('cb'), c.uid('ck')
        r = max(8, w // 40)
        inner.append(f'<div id="{kid}" style="position:absolute;left:{x - w // 2}px;top:{y}px;width:{w}px;transform:translateY(-50%) rotate({rot}deg)">'
                     f'<img id="{cid}" src="{src}" style="display:block;width:100%;border-radius:{r}px;box-shadow:0 18px 50px rgba(0,0,0,.55);opacity:0">'
                     f'<div id="{bid}" style="position:absolute;inset:0;background:#fff;border-radius:{r}px;opacity:0"></div></div>')
        tp = fr(tp)
        c.at(f'tl.set("#{bid}",{{opacity:1}},{tp - F1:.4f});tl.set("#{bid}",{{opacity:0}},{tp:.4f});tl.set("#{cid}",{{opacity:1}},{tp:.4f});')
        sfx(c, tp - F1, 'click')
    inner.append('</div>')
    c.clip(t0, t1, ''.join(inner), z)
    c.at(f'tl.fromTo("#{gid}",{{scale:1}},{{scale:{1 + drift},duration:{fr(t1) - fr(t0):.4f},ease:"none",immediateRender:false}},{fr(t0):.4f});')
    return gid


# ------------------------------------------------------------------ 3D WALL
def wall3d(c, t0, t1, tiles, z, cols=3, tile_w=470, gap=28, rot=(52, 0, -22), travel=(-760, 520)):
    """A perspective plane covered in real cards, the camera sweeping across it with motion blur.
    SILENT (the references' wall sweep has no whoosh; the bed carries it)."""
    pid = c.uid('wall')
    th = round(tile_w * 1.25)                        # 4:5 cards on a 4:5 slide
    rows = max(4, math.ceil(len(tiles) * 2 / cols))
    cells = []
    for r in range(rows):
        for k in range(cols + 1):
            src = tiles[(r * cols + k + r) % len(tiles)]
            x = k * (tile_w + gap) + (r % 2) * tile_w * 0.4; y = r * (th + gap)
            cells.append(f'<img src="{src}" style="position:absolute;left:{x:.0f}px;top:{y:.0f}px;width:{tile_w}px;height:{th}px;object-fit:cover;object-position:50% 30%;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.6)">')
    pw = (cols + 1) * (tile_w + gap) + tile_w; ph = rows * (th + gap)
    inner = (f'<div class="ev1-layer ev1-black" style="perspective:1400px;perspective-origin:50% 40%">'
             f'<div id="{pid}" style="position:absolute;left:{(W - pw) / 2:.0f}px;top:{(H - ph) / 2:.0f}px;width:{pw:.0f}px;height:{ph:.0f}px;transform-style:preserve-3d">{"".join(cells)}</div></div>')
    c.clip(t0, t1, inner, z)
    c.pre.append(f'gsap.set("#{pid}",{{rotationX:{rot[0]},rotationY:{rot[1]},rotationZ:{rot[2]},x:{-travel[0] / 2},y:{-travel[1] / 2}}});')
    d = fr(t1) - fr(t0)
    c.at(f'tl.fromTo("#{pid}",{{x:{-travel[0] / 2},y:{-travel[1] / 2},filter:"blur(6px)"}},{{x:{travel[0] / 2},y:{travel[1] / 2},filter:"blur(0px)",duration:{d:.4f},ease:"power3.out",immediateRender:false}},{fr(t0):.4f});')
    return pid


# ------------------------------------------------------------------ PAPER CARD
def paper_card(c, t0, t1, src, z, card_w=700, above=(), below=(), invert_in=2):
    """A small real card on the grey-vignetted paper ground, the spoken words above and below it in ink
    (on a 16:9 frame they flank it left/right; a 4:5 slide stacks them), the card creeping larger.
    Opens on an invert flash (the paper reads black for `invert_in` frames)."""
    wid, kid = c.uid('pw'), c.uid('pk')
    rows = []
    for side, ws in (('a', above), ('b', below)):
        spans = []
        for wtxt, on in ws:
            sid = c.uid('pwd')
            spans.append(f'<span id="{sid}" style="opacity:0;margin:0 .2em">{esc(wtxt)}</span>')
            c.at(f'tl.set("#{sid}",{{opacity:1}},{max(fr(t0), fr(on)):.4f});')
        rows.append(''.join(spans))
    capstyle = (f'position:absolute;left:{86}px;width:{W - 172}px;text-align:center;'
                f'font:600 var(--ev1-cap-size)/1.15 var(--ev1-sans);color:var(--ev1-ink)')
    inner = (f'<div id="{wid}" class="ev1-layer ev1-paper">'
             f'<div id="{kid}" style="position:absolute;left:{(W - card_w) // 2}px;top:{CY}px;width:{card_w}px;transform:translateY(-50%)">'
             f'<img src="{src}" style="display:block;width:100%;border-radius:10px;box-shadow:0 24px 60px rgba(0,0,0,.28)"></div>'
             f'<div style="{capstyle};top:190px">{rows[0]}</div>'
             f'<div style="{capstyle};bottom:200px">{rows[1]}</div></div>')
    c.clip(t0, t1, inner, z)
    c.at(f'tl.fromTo("#{kid}",{{scale:0.94}},{{scale:1.04,duration:{fr(t1) - fr(t0):.4f},ease:"none",immediateRender:false}},{fr(t0):.4f});')
    if invert_in:
        c.pre.append(f'gsap.set("#{wid}",{{filter:"invert(1)"}});')
        c.at(f'tl.set("#{wid}",{{filter:"invert(1)"}},{fr(t0):.4f});tl.set("#{wid}",{{filter:"none"}},{fr(t0) + invert_in * F1:.4f});')
        sfx(c, t0, 'click')
    return wid


# ------------------------------------------------------------------ STROBE MONTAGE
def strobe(c, t0, t1, srcs, z, step_frames=3, tracker=True, seed=4):
    """One word carried by a burst of SHAPE-MATCHED images (all clocks, all circles), 2-3 frames each,
    a small white square hopping between them. ONE CLICK PER IMAGE."""
    t0, t1 = fr(t0), fr(t1)
    rnd = random.Random(seed)
    n = max(1, round((t1 - t0) * FPS / step_frames))
    ids, inner = [], []
    for k in range(n):
        iid = c.uid('st'); ids.append(iid)
        inner.append(f'<img id="{iid}" src="{srcs[k % len(srcs)]}" class="ev1-fill" style="opacity:0">')
    sq = c.uid('sq')
    if tracker:
        inner.append(f'<div id="{sq}" style="position:absolute;left:0;top:0;width:56px;height:56px;background:#fff;mix-blend-mode:difference"></div>')
    c.clip(t0, t1, ''.join(inner), z)
    for k, iid in enumerate(ids):
        tk = t0 + k * step_frames * F1
        c.at(f'tl.set("#{iid}",{{opacity:1}},{tk:.4f});')
        if k:
            c.at(f'tl.set("#{ids[k - 1]}",{{opacity:0}},{tk:.4f});')
        if tracker:
            c.at(f'tl.set("#{sq}",{{x:{rnd.randint(140, 880)},y:{rnd.randint(220, 1100)}}},{tk:.4f});')
        sfx(c, tk, 'tick', 0.85 + 0.3 * rnd.random())


# ------------------------------------------------------------------ RACK FOCUS on a real card
def focus_card(c, t0, t1, src, z, card_w=900, frames_n=12, mark=None, ground='black', y=CY, light=False, rack=True):
    """A real card filling most of the frame, opening defocused and racking sharp over 12 frames.
    mark = (x, y, w, h, t): a highlighter on the card, in CARD px. light=True for a white page (a yellow marker
    multiplied over the text; the dark-card marker washes white pages out). rack=False when the card is frame 0
    of a slide: the first frame after a swipe must be sharp."""
    kid = c.uid('fc')
    mk = ''
    if mark:
        mx, my, mw, mh, mt = mark
        mid = c.uid('fm')
        mk = f'<div id="{mid}" class="ev1-mark{"" if light else " on-dark"}" style="left:{mx}px;top:{my}px;width:{mw}px;height:{mh}px"></div>'
    inner = (f'<div class="ev1-layer ev1-{ground}"><div id="{kid}" style="position:absolute;left:{(W - card_w) // 2}px;top:{y}px;width:{card_w}px;transform:translateY(-50%)">'
             f'<img src="{src}" style="display:block;width:100%;border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.6)">{mk}</div></div>')
    c.clip(t0, t1, inner, z)
    if rack:
        c.pre.append(f'gsap.set("#{kid}",{{filter:"blur(16px)"}});')
        c.at(f'tl.fromTo("#{kid}",{{filter:"blur(16px)"}},{{filter:"blur(0px)",duration:{frames_n / FPS:.4f},ease:"power2.out",immediateRender:false}},{fr(t0):.4f});')
    c.at(f'tl.fromTo("#{kid}",{{scale:1.0}},{{scale:1.05,duration:{fr(t1) - fr(t0):.4f},ease:"none",immediateRender:false}},{fr(t0):.4f});')
    sfx(c, t0, 'click_soft')
    if mark:
        c.pre.append(f'gsap.set("#{mid}",{{scaleX:0}});')
        c.at(f'tl.fromTo("#{mid}",{{scaleX:0}},{{scaleX:1,duration:0.2,ease:"power2.out",immediateRender:false}},{fr(mark[4]):.4f});')
        sfx(c, mark[4], 'click_soft')
    return kid


# ------------------------------------------------------------------ TYPEWRITER (block cursor)
def typewriter(c, t0, t1, lines, z, font=46, top=520, left=100, width=None, ground='black'):
    """Text typing on black behind a white block cursor, broken scanlines flickering across.
    lines = [(text, t_start, frames_per_char, css_class)]. A click per line (the refs have NO typing sound)."""
    rows = []
    cur = c.uid('cur')
    last_t = fr(t0)
    wcss = f'width:{width}px;white-space:pre-wrap;' if width else ''
    for txt, ts, fpc, cls in lines:
        spans = []
        for j, ch in enumerate(txt):
            sid = c.uid('tw')
            spans.append(f'<span id="{sid}" style="opacity:0">{esc(ch)}</span>')
            tt = fr(ts) + (j * fpc) / FPS
            c.at(f'tl.set("#{sid}",{{opacity:1}},{tt:.4f});')
            last_t = max(last_t, tt)
        rows.append(f'<div class="{cls}" style="min-height:{round(font * 1.45)}px">{"".join(spans)}</div>')
        sfx(c, ts, 'click_soft')
    scan = ''.join(f'<div class="ev1-scan" style="top:{y}px;height:{h}px;left:{x}px;width:{w}px"></div>'
                   for x, y, w, h in [(120, 380, 640, 2), (520, 860, 460, 3), (60, 960, 300, 2), (700, 300, 300, 2)])
    inner = (f'<div class="ev1-layer ev1-{ground}"><div class="ev1-term" style="left:{left}px;top:{top}px;font-size:{font}px;line-height:1.45;{wcss}">{"".join(rows)}'
             f'<span id="{cur}" class="ev1-cursor"></span></div>{scan}</div>')
    if '.ev1-scan{' not in ''.join(c.css):
        c.css.append('.ev1-scan{position:absolute;background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.55),rgba(120,200,255,.4),rgba(255,255,255,0));opacity:0}')
    c.clip(t0, t1, inner, z)
    t = fr(t0); on = True
    while t < fr(t1):
        c.at(f'tl.set("#{cur}",{{opacity:{1 if on else 0}}},{t:.4f});'); t += 8 / FPS; on = not on
    c.at(f'tl.set(".ev1-scan",{{opacity:.7}},{fr(t0) + 2 * F1:.4f});tl.set(".ev1-scan",{{opacity:0}},{fr(t0) + 4 * F1:.4f});'
         f'tl.set(".ev1-scan",{{opacity:.6}},{last_t:.4f});tl.set(".ev1-scan",{{opacity:0}},{last_t + 2 * F1:.4f});')
    return last_t


# ------------------------------------------------------------------ PROMPT BOX (a rebuilt terminal prompt)
def prompt_box(c, t0, t1, text, z, t_type=None, cps=38, title='claude', font=36, y=CY, label=None, lines=(), blur_in=True):
    """A rebuilt terminal window with the REAL prompt typing into it ("> make me a carousel about ...").
    Real data only: the words are the prompt that was actually sent. cps = characters per second."""
    t0 = fr(t0); ta = fr(t_type if t_type is not None else t0 + 0.1)
    bid, cur = c.uid('pb'), c.uid('pc')
    spans = []
    last = ta
    for j, ch in enumerate(text):
        sid = c.uid('pt')
        spans.append(f'<span id="{sid}" style="opacity:0">{esc(ch)}</span>')
        tt = fr(ta + j / cps)
        c.at(f'tl.set("#{sid}",{{opacity:1}},{tt:.4f});')
        last = tt
    out_rows = []
    for txt, tl_ in lines:                      # what actually happens next, one row per step (real steps only)
        oid = c.uid('po')
        out_rows.append(f'<div id="{oid}" style="opacity:0"><span style="color:#D97757">&#9679;</span> {esc(txt)}</div>')
        c.at(f'tl.set("#{oid}",{{opacity:1}},{fr(tl_):.4f});')
        sfx(c, tl_, 'click_soft')
    out_html = (f'<div class="ev1-term wrap" style="position:relative;margin-top:26px;font-size:{round(font * 0.8)}px;line-height:1.55;color:#9AA3AE">'
                f'{"".join(out_rows)}</div>') if out_rows else ''
    bw = W - 2 * 70
    lab = f'<div style="font:600 24px/1 var(--ev1-mono);color:#7C8591;margin-bottom:22px">{esc(label)}</div>' if label else ''
    inner = (f'<div class="ev1-layer ev1-black"><div id="{bid}" style="position:absolute;left:70px;top:{y}px;width:{bw}px;transform:translateY(-50%);'
             f'background:#14161A;border:1px solid #2A2E35;border-radius:20px;box-shadow:0 40px 120px rgba(0,0,0,.7);overflow:hidden">'
             f'<div style="height:56px;background:#1C1F24;display:flex;align-items:center;gap:12px;padding:0 24px;border-bottom:1px solid #2A2E35">'
             f'<i style="width:16px;height:16px;border-radius:50%;background:#FF5F57"></i><i style="width:16px;height:16px;border-radius:50%;background:#FEBC2E"></i>'
             f'<i style="width:16px;height:16px;border-radius:50%;background:#28C840"></i>'
             f'<span style="margin-left:16px;font:500 22px/1 var(--ev1-mono);color:#7C8591">{esc(title)}</span></div>'
             f'<div style="padding:40px 44px 48px">{lab}<div class="ev1-term wrap" style="position:relative;font-size:{font}px;line-height:1.45">'
             f'<span style="color:#D97757">&gt; </span>{"".join(spans)}<span id="{cur}" class="ev1-cursor" style="width:0.55em"></span></div>{out_html}</div></div></div>')
    c.clip(t0, t1, inner, z)
    if blur_in:      # off when the box is frame 0 of a slide (the first thing seen after a swipe must read)
        c.pre.append(f'gsap.set("#{bid}",{{scale:0.96,filter:"blur(10px)"}});')
        c.at(f'tl.fromTo("#{bid}",{{scale:0.96,filter:"blur(10px)"}},{{scale:1,filter:"blur(0px)",duration:{10 * F1:.4f},ease:"power2.out",immediateRender:false}},{t0:.4f});')
    t = t0; on = True
    while t < fr(t1):
        c.at(f'tl.set("#{cur}",{{opacity:{1 if on else 0}}},{t:.4f});'); t += 8 / FPS; on = not on
    sfx(c, t0, 'click')
    return last


# ------------------------------------------------------------------ BROLL (moving footage)
def broll(c, t0, t1, src, z, rate=0.055, direction='in', focus_in=0, start_scale=None, origin='50% 50%', media_start=0.0,
          punches=(), style=''):
    """A real moving clip, edge to edge, never still: a steady digital zoom of 4-7.5%/s (in on objects,
    out on composites); new cuts can open defocused and sharpen over ~9 frames (focus_in=9);
    punches = [(t, scale)] hard punch-ins on a word."""
    vid = c.uid('br')
    t0, t1 = fr(t0), fr(min(t1, c.dur))
    d = t1 - t0
    s0 = start_scale or (1.0 if direction == 'in' else 1.0 + rate * d)
    s1 = s0 + rate * d if direction == 'in' else s0 - rate * d
    c.els.append(f'<video id="{vid}" class="clip ev1-fill" src="{src}" muted playsinline data-start="{t0:.4f}" '
                 f'data-duration="{dstr(t0, t1)}" data-media-start="{media_start:.4f}" '
                 f'style="z-index:{z};transform-origin:{origin};{style}"></video>')
    c.pre.append(f'gsap.set("#{vid}",{{scale:{s0:.4f}}});')
    c.at(f'tl.fromTo("#{vid}",{{scale:{s0:.4f}}},{{scale:{s1:.4f},duration:{d:.4f},ease:"none",immediateRender:false}},{t0:.4f});')
    if focus_in:
        c.at(f'tl.fromTo("#{vid}",{{filter:"blur(14px)"}},{{filter:"blur(0px)",duration:{focus_in / FPS:.4f},ease:"power2.out",immediateRender:false}},{t0:.4f});')
    for tp, sc in punches:
        c.at(f'tl.set("#{vid}",{{scale:{sc:.4f}}},{fr(tp):.4f});'
             f'tl.fromTo("#{vid}",{{scale:{sc:.4f}}},{{scale:{sc + rate * (t1 - fr(tp)):.4f},duration:{t1 - fr(tp):.4f},ease:"none",immediateRender:false}},{fr(tp):.4f});')
    return vid


def overlay(c, t0, t1, src, z, blend='screen', opacity=1.0, media_start=0.0):
    """A texture clip over everything: light leak (screen), glitch noise (normal, 2-4 frames)."""
    vid = c.uid('ov')
    t0, t1 = fr(t0), fr(min(t1, c.dur))
    c.els.append(f'<video id="{vid}" class="clip ev1-fill" src="{src}" muted playsinline data-start="{t0:.4f}" '
                 f'data-duration="{dstr(t0, t1)}" data-media-start="{media_start:.4f}" '
                 f'style="z-index:{z};mix-blend-mode:{blend};opacity:{opacity}"></video>')
    return vid


def neg_flash(c, t, ids, sound='click'):
    """The invert: ONE negative frame, then ONE overexposed bloom frame, then the shot.
    ids = the elements on screen at t (videos included: filters reach the renderer)."""
    t = fr(t)
    for i in ids:
        c.at(f'tl.set("#{i}",{{filter:"invert(1)"}},{t:.4f});'
             f'tl.set("#{i}",{{filter:"brightness(2.4) contrast(0.8) blur(3px)"}},{t + F1:.4f});'
             f'tl.set("#{i}",{{filter:"none"}},{t + 2 * F1:.4f});')
    if sound:
        sfx(c, t, sound)


def white_flash(c, t, z=90, frames_n=1, sound='click'):
    c.clip(t, fr(t) + frames_n * F1, '<div class="ev1-layer" style="background:#fff"></div>', z)
    if sound:
        sfx(c, t, sound)


def black(c, t0, t1, z=0):
    """The black ground ("nothing", "no one", a beat of silence). Pull the bed down under it (mix.py)."""
    return c.clip(t0, t1, '<div class="ev1-layer ev1-black"></div>', z)


def finish(c, t0, t1, z=80, grid=True, vignette=True):
    """The overlays every image beat sits under: thirds grid and the vignette."""
    inner = ('<div class="ev1-grid"></div>' if grid else '') + ('<div class="ev1-vignette"></div>' if vignette else '')
    c.clip(t0, t1, inner, z, cls='', style=f'position:absolute;left:0;top:0;width:{W}px;height:{H}px;pointer-events:none')


# ------------------------------------------------------------------ COUNT-UP (numbers on footage)
def count_up(c, t0, t1, v0, v1, z, t_run=None, run=0.8, fmt='{}', x=CX, y=CY, cls='ec-count', size=None, tick_every=1):
    """A number counting from v0 to v1 over `run` seconds, then held (REF-3's "EUR 20,000!" over a cash
    counter). Every value is its own span switched on at its frame (seek-safe). A tick per step."""
    t0 = fr(t0); ta = fr(t_run if t_run is not None else t0)
    vals = list(range(v0, v1 + 1)) if v1 >= v0 else list(range(v0, v1 - 1, -1))
    n = len(vals)
    ids = []
    fs = f'font-size:{size}px;' if size else ''
    spans = []
    for k, v in enumerate(vals):
        sid = c.uid('cu'); ids.append(sid)
        spans.append(f'<div id="{sid}" class="{cls}" style="position:absolute;left:50%;top:0;transform:translate(-50%,-50%);{fs}opacity:0">{esc(fmt.format(v))}</div>')
    inner = f'<div style="position:absolute;left:{x}px;top:{y}px;width:0;height:0">{"".join(spans)}</div>'
    c.clip(t0, t1, inner, z, cls='', style=f'position:absolute;left:0;top:0;width:{W}px;height:{H}px')
    prev = None
    c.at(f'tl.set("#{ids[0]}",{{opacity:1}},{t0:.4f});')
    for k, sid in enumerate(ids):
        tk = fr(ta + run * (k / max(1, n - 1)) ** 1.6)   # eases into the final value
        if k:
            c.at(f'tl.set("#{sid}",{{opacity:1}},{tk:.4f});tl.set("#{ids[k - 1]}",{{opacity:0}},{tk:.4f});')
            if k % tick_every == 0:
                sfx(c, tk, 'tick', 0.8)
    return fr(ta + run)


# ------------------------------------------------------------------ WAVEFORM (the real voice, drawn)
def waveform(c, t0, t1, peaks, z, t_audio0=0.0, audio_dur=None, label=None, y=CY, height=360, color='#FFFFFF', played='#F2030A'):
    """The REAL waveform of the narration (peaks = list of 0..1 levels from the slide's own voice file),
    with a playhead that runs in sync with the voice. t_audio0 = the slide time the waveform's first bar
    corresponds to; audio_dur = seconds the bars cover."""
    t0, t1 = fr(t0), fr(t1)
    n = len(peaks); bw = (W - 2 * 86) / n
    audio_dur = audio_dur or (t1 - t0)
    bars = ''.join(f'<rect x="{86 + i * bw + bw * 0.18:.1f}" y="{-height / 2 * max(0.04, p):.1f}" width="{bw * 0.64:.1f}" height="{height * max(0.04, p):.1f}" rx="{bw * 0.3:.1f}"/>'
                   for i, p in enumerate(peaks))
    gid, mid, phid = c.uid('wv'), c.uid('wm'), c.uid('wp')
    lab = (f'<div style="position:absolute;left:86px;top:{y - height / 2 - 90}px;font:600 30px/1 var(--ev1-mono);color:#9AA3AE;letter-spacing:.04em">{esc(label)}</div>'
           if label else '')
    inner = (f'<div class="ev1-layer ev1-black">{lab}'
             f'<svg width="{W}" height="{height}" viewBox="0 {-height / 2} {W} {height}" style="position:absolute;left:0;top:{y - height / 2}px">'
             f'<defs><clipPath id="{mid}"><rect id="{mid}r" x="86" y="{-height / 2}" width="{W - 172}" height="{height}"/></clipPath></defs>'
             f'<g fill="{color}" opacity="0.35">{bars}</g><g fill="{played}" clip-path="url(#{mid})">{bars}</g></svg>'
             f'<div id="{phid}" style="position:absolute;left:86px;top:{y - height / 2 - 20}px;width:3px;height:{height + 40}px;background:#fff;box-shadow:0 0 18px rgba(255,255,255,.6)"></div></div>')
    c.clip(t0, t1, inner, z)
    # the played part grows with the voice: clip rect scaleX from the left edge, the playhead travels
    span = W - 172
    c.pre.append(f'gsap.set("#{mid}r",{{attr:{{width:0}}}});')
    c.at(f'tl.fromTo("#{mid}r",{{attr:{{width:0}}}},{{attr:{{width:{span}}},duration:{audio_dur:.4f},ease:"none",immediateRender:false}},{fr(t_audio0):.4f});')
    c.at(f'tl.fromTo("#{phid}",{{x:0}},{{x:{span},duration:{audio_dur:.4f},ease:"none",immediateRender:false}},{fr(t_audio0):.4f});')
    return gid


# ------------------------------------------------------------------ CAROUSEL CHROME
def sound_on(c, t0, t1, z=70, text='Sound on'):
    """A small pill, top-left (clear of Instagram's counter, top-right): carousels autoplay MUTED in the
    feed, and this one talks. Slide 1 only."""
    sid = c.uid('snd')
    icon = ('<svg width="30" height="26" viewBox="0 0 30 26" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">'
            '<path d="M3 9h5l7-6v20l-7-6H3z" fill="#fff"/><path d="M20 8.5a6 6 0 0 1 0 9"/><path d="M23.5 5a11 11 0 0 1 0 16"/></svg>')
    inner = f'<div id="{sid}" class="ec-sound">{icon}<span>{esc(text)}</span></div>'
    c.clip(t0, t1, inner, z, cls='', style=f'position:absolute;left:0;top:0;width:{W}px;height:{H}px')
    return sid


def swipe_cue(c, t0, t1, z=70, text='Swipe', sound=True):
    """The end of every slide but the last: a bar draws, the chevron nudges right twice. Lives in the
    tail after the voice, so it is the last thing on screen before the loop and the swipe."""
    t0 = fr(t0)
    sid, bid, cid = c.uid('sw'), c.uid('swb'), c.uid('swc')
    inner = (f'<div id="{sid}" class="ec-swipe"><span>{esc(text)}</span><span id="{bid}" class="bar"></span>'
             f'<span id="{cid}" class="chev"></span></div>')
    c.clip(t0, t1, inner, z, cls='', style=f'position:absolute;left:0;top:0;width:{W}px;height:{H}px')
    c.pre.append(f'gsap.set("#{sid}",{{opacity:0}});gsap.set("#{bid}",{{scaleX:0}});')
    c.at(f'tl.fromTo("#{sid}",{{opacity:0,y:16}},{{opacity:1,y:0,duration:0.18,ease:"power2.out",immediateRender:false}},{t0:.4f});')
    c.at(f'tl.fromTo("#{bid}",{{scaleX:0}},{{scaleX:1,duration:0.28,ease:"power3.out",immediateRender:false}},{t0 + 0.06:.4f});')
    for k in range(2):
        tk = t0 + 0.35 + k * 0.42
        c.at(f'tl.fromTo("#{cid}",{{x:0}},{{x:16,duration:0.14,ease:"power2.out",yoyo:true,repeat:1,immediateRender:false}},{tk:.4f});')
    if sound:
        sfx(c, t0, 'click_soft')


# ------------------------------------------------------------------ WORDS (timing comes from the voice)
class Words:
    """A slide's data/NN.words.json. Every time in a build comes from here, never typed by hand.
        V = Words('../../data/01.words.json'); V.t('cut'); V.t('every', n=2); V.span('All', 'prompt.'); V.end"""
    def __init__(self, path):
        self.w = json.load(open(path))
        self.end = self.w[-1]['e']

    @staticmethod
    def norm(s):
        return ''.join(ch for ch in s.lower() if ch.isalnum() or ch == "'")

    def i(self, word, n=1, after=0.0):
        # exact spelling first ("one." is the sentence end, not the first "one"), then letters only
        for same in (lambda a, b: a == b, lambda a, b: self.norm(a) == self.norm(b)):
            k = 0
            for j, w in enumerate(self.w):
                if same(w['w'], word) and w['s'] >= after - 1e-6:
                    k += 1
                    if k == n: return j
        raise KeyError(f'{word!r} (#{n}) not in {[w["w"] for w in self.w]}')

    def t(self, word, n=1, after=0.0):
        return self.w[self.i(word, n, after)]['s']

    def e(self, word, n=1, after=0.0):
        return self.w[self.i(word, n, after)]['e']

    def span(self, first, last, n=1, after=0.0):
        a = self.i(first, n, after); b = self.i(last, 1, self.w[a]['s'])
        return [(w['w'], w['s']) for w in self.w[a:b + 1]]
