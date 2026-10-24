"""Editor V1's grades for stills: nothing ships as it came.

  from treat import treat
  treat(src, out, look, size=(1188, 1485), focus=(0.5, 0.5), crop=None, halftone=0.0, vignette=0.7)

  scripts/py scripts/treat.py <src> <out.jpg> --look teal [--size 1188x1485] [--focus 0.5,0.5] [--crop x0,y0,x1,y1]
                              [--halftone 0.15] [--vignette 0.7] [--glitch 4]

look      teal (split tone: teal shadows, warm highlights) · mono (hard B&W) · warm (amber) · invert (a negative)
          · natural (cleaned up: contrast, a little warmth)
size      the output, cover-cropped. Full-frame stills are 1188x1485 (10 % over 1080x1350, so a push never shows an
          edge); 4:5 cards for collages/walls are 600x750
focus     where the crop centres, as fractions of the (cropped) picture
crop      a box in SOURCE pixels taken first (leave out a stranger at the edge, a watermark)
halftone  0..1: how much of a dot-screen to mix in (0.15-0.2 is the reference's newsprint touch)
vignette  edge brightness (0.6 = dark edges, 1 or None = none)
--glitch N  also writes N datamosh frames next to the output (<out>_g1.jpg …) for ec_devices.frames()
"""
import argparse, os
import cv2
import numpy as np

LOOKS = ('teal', 'mono', 'warm', 'invert', 'natural')


def _cover(im, size, focus):
    w, h = size; H, W = im.shape[:2]
    s = max(w / W, h / H)
    im = cv2.resize(im, (max(w, round(W * s)), max(h, round(H * s))), interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC)
    H, W = im.shape[:2]
    x = int(np.clip(focus[0] * W - w / 2, 0, W - w)); y = int(np.clip(focus[1] * H - h / 2, 0, H - h))
    return im[y:y + h, x:x + w]


def _curve(x, k):
    """an S-curve around 0.5 of strength k (x in 0..1)"""
    s = lambda v: 1 / (1 + np.exp(-k * (v - 0.5)))
    return (s(x) - s(0.0)) / (s(1.0) - s(0.0))


def grade(im, look):
    f = im.astype(np.float32) / 255.0                       # BGR
    lum = (0.114 * f[..., 0] + 0.587 * f[..., 1] + 0.299 * f[..., 2])[..., None]
    if look == 'natural':
        f = np.clip(_curve(f, 5.0), 0, 1)
        f = lum + (f - lum) * 1.06
        f[..., 2] *= 1.02; f[..., 0] *= 0.985
    elif look == 'teal':
        f = lum + (f - lum) * 0.78
        f = np.clip(_curve(f, 6.0), 0, 1)
        sh = np.clip(1 - lum * 1.8, 0, 1); hi = np.clip((lum - 0.55) * 2.2, 0, 1)
        teal = np.array([0x60, 0x55, 0x0E], np.float32) / 255; cream = np.array([0xC8, 0xE0, 0xF4], np.float32) / 255
        f = f * (1 - 0.42 * sh) + teal * 0.42 * sh
        f = f * (1 - 0.18 * hi) + cream * 0.18 * hi
    elif look == 'mono':
        g = np.clip(_curve(lum, 9.0), 0, 1)
        f = np.repeat(g, 3, axis=2)
    elif look == 'warm':
        g = np.clip(_curve(lum, 6.5), 0, 1)
        lo = np.array([0x10, 0x18, 0x2A], np.float32) / 255; mid = np.array([0x2B, 0x82, 0xD9], np.float32) / 255
        top = np.array([0xD8, 0xEE, 0xFA], np.float32) / 255
        a = np.clip(g * 2, 0, 1); b = np.clip(g * 2 - 1, 0, 1)
        tone = lo * (1 - a) + mid * a; tone = tone * (1 - b) + top * b
        f = tone * 0.82 + f * 0.18
    elif look == 'invert':
        f = 1 - np.clip(_curve(f, 5.0), 0, 1)
    else:
        raise ValueError(f'look must be one of {LOOKS}')
    return np.clip(f, 0, 1)


def _halftone(f, amt, cell=9):
    if not amt: return f
    h, w = f.shape[:2]
    lum = (0.114 * f[..., 0] + 0.587 * f[..., 1] + 0.299 * f[..., 2])
    small = cv2.resize(lum, (w // cell + 1, h // cell + 1), interpolation=cv2.INTER_AREA)
    yy, xx = np.mgrid[0:h, 0:w]
    cy, cx = yy // cell, xx // cell
    d = np.hypot((yy % cell) - cell / 2 + 0.5, (xx % cell) - cell / 2 + 0.5) / (cell / 2)
    r = np.sqrt(np.clip(1 - small[cy, cx], 0, 1)) * 1.15         # dark = big dot
    dots = np.clip((r - d) * 3, 0, 1)
    screen = (1 - dots)[..., None] * f.max(axis=2, keepdims=True).clip(0.85, 1)
    return f * (1 - amt) + np.minimum(f, screen) * amt


def _vignette(f, edge):
    if edge is None or edge >= 1: return f
    h, w = f.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.hypot((xx - w / 2) / (w / 2), (yy - h / 2) / (h / 2)) / np.sqrt(2)
    m = 1 - (1 - edge) * np.clip((r - 0.35) / 0.65, 0, 1) ** 1.6
    return f * m[..., None]


def treat(src, out, look='natural', size=(1188, 1485), focus=(0.5, 0.5), crop=None, halftone=0.0, vignette=0.7):
    im = cv2.imread(str(src), cv2.IMREAD_COLOR)
    if im is None:
        raise FileNotFoundError(f'cannot read {src} (an SVG? convert it first, or use svg_mark)')
    if crop:
        x0, y0, x1, y1 = crop; im = im[y0:y1, x0:x1]
    im = _cover(im, size, focus)
    f = grade(im, look)
    f = _halftone(f, halftone)
    f = _vignette(f, vignette)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    o = (f * 255 + 0.5).astype(np.uint8)
    cv2.imwrite(str(out), o, [cv2.IMWRITE_JPEG_QUALITY, 92] if str(out).lower().endswith(('.jpg', '.jpeg')) else [])
    return out


def glitch_frames(src, n=4, seed=3):
    """N datamosh frames from a treated still: block displacement, RGB split, a smeared band. → [<src>_g1.jpg …]"""
    rng = np.random.default_rng(seed)
    im = cv2.imread(str(src)); h, w = im.shape[:2]; base, ext = os.path.splitext(str(src)); outs = []
    for k in range(1, n + 1):
        g = im.copy()
        for _ in range(6 + 3 * k):
            bh = int(rng.integers(8, 90)); y = int(rng.integers(0, h - bh)); dx = int(rng.integers(-120, 120))
            g[y:y + bh] = np.roll(g[y:y + bh], dx, axis=1)
        s = 6 + 4 * k
        g[..., 2] = np.roll(g[..., 2], s, axis=1); g[..., 0] = np.roll(g[..., 0], -s, axis=1)
        y = int(rng.integers(0, h - 60)); g[y:y + 60] = g[y:y + 1].repeat(60, axis=0)
        p = f'{base}_g{k}{ext}'; cv2.imwrite(p, g); outs.append(p)
    return outs


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('out')
    ap.add_argument('--look', default='natural', choices=LOOKS); ap.add_argument('--size', default='1188x1485')
    ap.add_argument('--focus', default='0.5,0.5'); ap.add_argument('--crop'); ap.add_argument('--halftone', type=float, default=0.0)
    ap.add_argument('--vignette', type=float, default=0.7); ap.add_argument('--glitch', type=int, default=0)
    a = ap.parse_args()
    treat(a.src, a.out, a.look, tuple(int(v) for v in a.size.split('x')), tuple(float(v) for v in a.focus.split(',')),
          tuple(int(v) for v in a.crop.split(',')) if a.crop else None, a.halftone, a.vignette)
    if a.glitch: glitch_frames(a.out, a.glitch)
    print('treated', a.out)
