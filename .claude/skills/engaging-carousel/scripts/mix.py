"""One slide's sound: the narrator, a window of the bed, and every cue the devices wrote, mastered for a phone.

  scripts/py scripts/mix.py <project> 01 [02 ...] [--kit open|ev1]     → audio/mix/NN.wav

Reads audio/vo/NN.wav (voice.py), slides/NN/cues.json (the build: {'dur', 'sfx': [{t, role, gain}], 'bed': [...]}),
story.json → music {file, windows: {NN: start_s}, below_voice_lu}, and the kit (sfx_kit.py).
- voice: as made, never compressed or EQ'd
- bed:   the slide's window of the track, levelled to `below_voice_lu` (default 5) under the voice by a fixed
         trim (no loudnorm: it flattens the build), in on the beat from frame 0, CUT (not ducked) where the build
         asked (c.bed), out over the last 0.30 s so the loop restarts clean
- sfx:   each role from the kit, started `preroll` before its frame + 8 ms (the references' clicks LAG the picture
         by 4-14 ms), at its kit level against the voice's speech level x the cue's gain
- master: -14 LUFS integrated, peaks under -1 dBFS (a soft limiter), 48 kHz stereo
"""
import argparse, json, os, re, subprocess, sys
from pathlib import Path
import numpy as np

HOME = Path(os.environ.get('EC_HOME', Path.home() / '.engaging-carousel'))
SR = 48000


def load(path, ss=None, t=None):
    cmd = ['ffmpeg', '-nostdin', '-v', 'error']
    if ss is not None: cmd += ['-ss', f'{ss}']
    if t is not None: cmd += ['-t', f'{t}']
    cmd += ['-i', str(path), '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-']
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float32).reshape(-1, 2).copy()


def lufs(y):
    p = subprocess.run(['ffmpeg', '-nostdin', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'],
                       input=y.astype(np.float32).tobytes(), capture_output=True)
    m = re.findall(r'I:\s+(-?[\d.]+) LUFS', p.stderr.decode())
    return float(m[-1]) if m else -70.0


def speech_db(v):
    m = np.abs(v).max(1); h = SR // 20
    r = np.array([np.sqrt(np.mean(m[i:i + h] ** 2) + 1e-12) for i in range(0, len(m) - h, h)])
    db = 20 * np.log10(r); return float(np.median(db[db > db.max() - 30]))


def env20_peak(y):
    m = np.abs(y).max(1); h = SR // 50
    return 20 * np.log10(max(np.sqrt(np.mean(m[i:i + h] ** 2)) for i in range(0, max(1, len(m) - h), SR // 1000)) + 1e-12)


def limiter(y, ceil=0.891, release=0.08):
    """a look-ahead-free soft limiter: gain follows the peak envelope down instantly, back up over `release`."""
    pk = np.abs(y).max(1); g = np.ones(len(y), np.float32); cur = 1.0; rel = np.exp(-1 / (release * SR))
    need = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
    for i in range(len(y)):
        cur = need[i] if need[i] < cur else need[i] + (cur - need[i]) * rel
        g[i] = cur
    return y * g[:, None]


def mix_slide(P, sid, kit_name):
    cfg = json.loads((P / 'story.json').read_text())
    cues = json.loads((P / 'slides' / sid / 'cues.json').read_text())
    dur = float(cues['dur']); n = int(round(dur * SR))
    vo = load(P / 'audio/vo' / f'{sid}.wav'); vo = np.pad(vo, ((0, max(0, n - len(vo))), (0, 0)))[:n]
    sp = speech_db(vo); L_vo = lufs(vo)
    out = vo.copy()

    mu = cfg.get('music') or {}
    if mu.get('file'):
        start = float(mu.get('windows', {}).get(sid, 0.0))
        bed = load(P / mu['file'], ss=start, t=dur + 0.1)[:n]
        bed = np.pad(bed, ((0, n - len(bed)), (0, 0)))
        L_bed = lufs(bed)
        g = 10 ** ((L_vo - float(mu.get('below_voice_lu', 5.0)) - L_bed) / 20)
        t = np.arange(n) / SR; env = np.ones(n)
        for b in cues.get('bed', []):
            a, c, db, f = b['t0'], b['t1'], b['db'], max(0.004, b.get('fade', 0.015))
            m = np.clip(np.minimum((t - a) / f + 1, (c - t) / f + 1), 0, 1)
            env *= 10 ** (db * m / 20)
        env *= np.clip(t / 0.01, 0, 1) * np.clip((dur - t) / 0.30, 0, 1)
        out += bed * (g * env)[:, None]

    kit = json.loads((HOME / 'sfx' / kit_name / 'kit.json').read_text())
    cache = {}
    sfx_cues = cues.get('sfx', [])
    if cfg.get('sfx_profile', 'clicks') == 'clicks':
        # the creator's taste (2026-10-23): "I like the clicks of the photography" and "too much" for everything
        # else. Only the photo clicks stay, thinned to one per picture change (a tile reveal is ONE change, not 9).
        kept, last = [], -9.0
        for q in sorted(sfx_cues, key=lambda q: q['t']):
            if q['role'] in ('tick', 'click', 'click_soft') and q['t'] - last >= 0.18:
                kept.append({**q, 'role': 'click' if q['role'] == 'tick' else q['role'], 'gain': min(1.0, q.get('gain', 1.0))}); last = q['t']
        sfx_cues = kept
    for c in sfx_cues:
        k = kit[c['role']]
        if c['role'] not in cache:
            y = load(HOME / 'sfx' / kit_name / k['file']); cache[c['role']] = (y, env20_peak(y))
        y, pk = cache[c['role']]
        gain = 10 ** ((sp + k['rel_db'] - pk) / 20) * c.get('gain', 1.0)
        i0 = int(round((c['t'] - k['preroll'] + 0.008) * SR))
        a, b = max(0, i0), min(n, i0 + len(y))
        if b > a:
            out[a:b] += y[a - i0:b - i0] * gain

    out *= 10 ** ((-14.0 - lufs(out)) / 20)
    out = limiter(out)
    f = int(0.004 * SR); out[:f] *= np.linspace(0, 1, f)[:, None]; out[-f:] *= np.linspace(1, 0, f)[:, None]
    dst = P / 'audio/mix' / f'{sid}.wav'; dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_s24le', str(dst)],
                   input=out.astype(np.float32).tobytes(), check=True)
    print(f'{sid}: voice {L_vo:.1f} LUFS (speech {sp:.1f} dB), {len(sfx_cues)}/{len(cues.get("sfx", []))} cues ({cfg.get("sfx_profile", "clicks")}), kit {kit_name} → {dst.name} at {lufs(out):.1f} LUFS, peak {20 * np.log10(np.abs(out).max()):.1f} dBFS')


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('project'); ap.add_argument('slides', nargs='*')
    ap.add_argument('--kit', default=None)
    a = ap.parse_args(); P = Path(a.project)
    cfg = json.loads((P / 'story.json').read_text())
    kit = a.kit or cfg.get('sfx_kit', 'open')
    for sid in (a.slides or [s['id'] for s in cfg['slides']]):
        mix_slide(P, sid, kit)
