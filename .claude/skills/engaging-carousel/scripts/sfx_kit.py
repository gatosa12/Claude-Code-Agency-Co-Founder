"""The sound kit: one file per ROLE (ec_devices.ROLES), its pre-roll (file start → transient) and its level against
the voice. mix.py reads ~/.engaging-carousel/sfx/<kit>/kit.json:  {role: {"file", "preroll", "rel_db"}}.

  scripts/py scripts/sfx_kit.py                 build the kits (once; setup.sh runs it)
  scripts/py scripts/sfx_kit.py --force         rebuild
  scripts/py scripts/sfx_kit.py --list          show the roles, pre-rolls and levels

Every sound is SYNTHESISED on this computer (seeded noise + sines, no samples), so there is nothing to license or
credit. The levels follow Editor V1's measurements of the references: photo clicks sit only 2-7 dB under the voice and
land a few ms after the picture; weight comes from the bed, not from booms. The default "clicks" profile in mix.py
only ever plays click / click_soft (tick is played as click).
Kits: "open" (the default) and "ev1" (same family, a touch brighter and harder).
"""
import argparse, json, os
from pathlib import Path
import numpy as np
import soundfile as sf

HOME = Path(os.environ.get('EC_HOME', Path.home() / '.engaging-carousel'))
SR = 48000

# role: (rel_db against the voice's speech level, seconds)
LEVELS = {'tick': (-6.0, 0.05), 'click': (-4.0, 0.12), 'click_soft': (-7.0, 0.09), 'swish': (-12.0, 0.45),
          'glitch': (-10.0, 0.16), 'riser': (-14.0, 1.6), 'subtone': (-16.0, 1.4), 'subboom': (-10.0, 1.2),
          'impact': (-8.0, 0.7), 'hit': (-8.0, 0.3), 'outro': (-14.0, 1.2)}


def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def smooth(x, n):
    """moving average (a cheap low-pass); n samples"""
    n = max(1, int(n))
    return np.convolve(x, np.ones(n) / n, mode='same')


def burst(rng, dur, decay, bright):
    """a filtered noise transient: bright = 0..1 (1 = all highs)"""
    t = t_axis(dur)
    nz = rng.standard_normal(len(t))
    low = smooth(nz, 6 + 30 * (1 - bright))
    sig = bright * (nz - low) + (1 - bright) * low * 3
    return sig * np.exp(-t / decay)


def shutter(rng, bright, second=0.035, body=1.0):
    """a camera shutter: the blade (bright tick), the mirror slap a moment later, a little mechanical body"""
    y = np.zeros(int(0.12 * SR))
    a = burst(rng, 0.03, 0.0035, bright); y[:len(a)] += a
    i = int(second * SR); b = burst(rng, 0.03, 0.005, bright * 0.8) * 0.6; y[i:i + len(b)] += b[:len(y) - i]
    t = t_axis(0.06); y[:len(t)] += body * 0.35 * np.sin(2 * np.pi * 180 * t) * np.exp(-t / 0.012)
    return y


def make(role, rng, hard=False):
    br = 0.85 if hard else 0.7
    if role == 'tick':
        y = burst(rng, 0.05, 0.0018, 0.95)
    elif role == 'click':
        y = shutter(rng, br)
    elif role == 'click_soft':
        y = shutter(rng, br * 0.7, second=0.03, body=0.6)[:int(0.09 * SR)] * 0.8
    elif role == 'swish':
        t = t_axis(0.45); nz = rng.standard_normal(len(t))
        env = np.sin(np.pi * t / t[-1]) ** 2
        y = np.zeros_like(nz)
        for k, w in enumerate(np.linspace(40, 4, 9)):           # the band sweeps up
            seg = slice(k * len(t) // 9, (k + 1) * len(t) // 9)
            y[seg] = (nz - smooth(nz, w))[seg]
        y = smooth(y, 3) * env
    elif role == 'glitch':
        t = t_axis(0.16); sq = np.sign(np.sin(2 * np.pi * 1600 * t + 40 * np.sin(2 * np.pi * 37 * t)))
        gate = (rng.random(len(t) // 400 + 1) > 0.35).repeat(400)[:len(t)]
        y = (0.6 * sq + 0.4 * np.round(rng.standard_normal(len(t)) * 2) / 2) * gate * np.exp(-t / 0.08)
    elif role == 'riser':
        t = t_axis(1.6); f = 200 + 1400 * (t / t[-1]) ** 2
        y = 0.5 * np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.5 * (rng.standard_normal(len(t)) - smooth(rng.standard_normal(len(t)), 8))
        y *= (t / t[-1]) ** 2
    elif role == 'subtone':
        t = t_axis(1.4); y = np.sin(2 * np.pi * 45 * t) * np.minimum(1, t / 0.05) * np.exp(-t / 0.6)
    elif role == 'subboom':
        t = t_axis(1.2); f = 35 + 30 * np.exp(-t / 0.15)
        y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.35)
    elif role == 'impact':
        t = t_axis(0.7); y = 0.7 * np.sin(2 * np.pi * 55 * t) * np.exp(-t / 0.18)
        b = burst(rng, 0.7, 0.03, 0.5); y += 0.6 * b
    elif role == 'hit':
        t = t_axis(0.3); y = 0.6 * np.sin(2 * np.pi * 90 * t) * np.exp(-t / 0.06) + 0.5 * burst(rng, 0.3, 0.012, 0.75)
    elif role == 'outro':
        t = t_axis(1.2); f = 520 * np.exp(-t / 0.9)
        y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.45) * np.minimum(1, t / 0.01)
    else:
        raise KeyError(role)
    y = y / (np.abs(y).max() + 1e-9) * 0.9
    f = int(0.002 * SR); y[-f:] *= np.linspace(1, 0, f)
    return y.astype(np.float32)


def preroll(role, y):
    if role == 'riser':
        return round(len(y) / SR, 4)                 # a riser lands on its END
    m = np.abs(y); h = int(0.001 * SR)
    env = np.array([m[i:i + h].max() for i in range(0, len(m) - h, h)])
    return round(int(np.argmax(env > env.max() * 0.5)) * h / SR, 4)


def build(kit, force=False):
    d = HOME / 'sfx' / kit; d.mkdir(parents=True, exist_ok=True)
    if (d / 'kit.json').exists() and not force:
        return json.loads((d / 'kit.json').read_text())
    out = {}
    for k, role in enumerate(LEVELS):
        rng = np.random.default_rng(1000 + k + (500 if kit == 'ev1' else 0))
        y = make(role, rng, hard=(kit == 'ev1'))
        sf.write(d / f'{role}.wav', np.stack([y, y], 1), SR, subtype='PCM_24')
        out[role] = {'file': f'{role}.wav', 'preroll': preroll(role, y), 'rel_db': LEVELS[role][0]}
    out['_about'] = 'synthesised locally by scripts/sfx_kit.py (no samples, nothing to credit)'
    (d / 'kit.json').write_text(json.dumps(out, indent=1))
    return out


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--force', action='store_true'); ap.add_argument('--list', action='store_true')
    a = ap.parse_args()
    for kit in ('open', 'ev1'):
        k = build(kit, a.force)
        if a.list:
            print(kit)
            for role, v in k.items():
                if not role.startswith('_'): print(f'  {role:11s} preroll {v["preroll"]:.3f}s  {v["rel_db"]:+.0f} dB vs voice')
    print('sound kits ready:', HOME / 'sfx')
