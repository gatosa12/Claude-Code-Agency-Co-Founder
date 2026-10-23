"""setup.sh's self test: one 3-second slide through the whole pipeline (scaffold → voice → music window → build →
lint → render → mix → mux → sheets). Uses a synthesised test beat; your saved background track is left untouched.

  scripts/py scripts/selftest.py <empty folder>
"""
import json, os, subprocess, sys
from pathlib import Path
import numpy as np

SK = Path(__file__).resolve().parent.parent
HOME = Path(os.environ.get('EC_HOME', Path.home() / '.engaging-carousel'))
PY = sys.executable


def run(*cmd, **kw):
    r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True, **kw)
    if r.returncode:
        print(r.stdout[-3000:], r.stderr[-3000:]); sys.exit(f'self test step failed: {" ".join(str(c) for c in cmd[:3])}')
    return r.stdout


def beat(path, secs=24, sr=48000):
    t = np.arange(int(secs * sr)) / sr; y = np.zeros_like(t)
    for k in np.arange(0, secs, 0.5):                              # a kick every half second
        i = int(k * sr); n = int(0.25 * sr); tt = t[:n]
        y[i:i + n] += 0.8 * np.sin(2 * np.pi * (50 + 60 * np.exp(-tt / 0.03)) * tt) * np.exp(-tt / 0.12)
    y += 0.08 * np.sin(2 * np.pi * 220 * t) * (t > secs / 2)     # a pad comes in halfway (the "drop")
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(sr), '-ac', '1', '-i', '-', str(path)],
                   input=(y / np.abs(y).max() * 0.7).astype(np.float32).tobytes(), check=True)


def main():
    T = Path(sys.argv[1]); T.mkdir(parents=True, exist_ok=True); P = T / 'proj'
    beat(T / 'beat.wav')
    cfgf = HOME / 'config.json'; saved = cfgf.read_text() if cfgf.exists() else None
    try:
        run(PY, SK / 'scripts/new_carousel.py', P, '--title', 'Self test', '--slides', '1', '--dur', '3', '--music', T / 'beat.wav')
    finally:                                                       # never replace the user's own track
        if saved is None: cfgf.unlink(missing_ok=True)
        else: cfgf.write_text(saved)
    S = json.loads((P / 'story.json').read_text())
    S['slides'][0]['say'] = 'This carousel talks.'
    (P / 'story.json').write_text(json.dumps(S, indent=1))
    print(run(PY, SK / 'scripts/voice.py', P).strip())
    run(PY, SK / 'scripts/music_windows.py', P)
    (P / 'slides/01/build.py').write_text(f'''import sys
sys.path.insert(0, {str(SK / 'components')!r})
from ec_devices import *
V = Words('../../data/01.words.json')
c = Comp(3.0)
black(c, 0, 3.0, z=0)
keyword(c, fr(V.t('carousel')), 3.0, 'TALKS', z=10, kind='shock', y=520)
captions(c, [(V.span('This', 'talks.'), 3.0)], y='70%')
c.cue(fr(V.t('carousel')), 'click')
c.write('index.html', title='selftest')
c.write_cues('cues.json')
''')
    print(run(PY, SK / 'scripts/render.py', P, '--workers', '1').strip().splitlines()[-3])
    mp4 = P / 'out/01.mp4'
    if not mp4.exists(): sys.exit('self test: no out/01.mp4')
    print('self test ok:', mp4)


if __name__ == '__main__':
    main()
