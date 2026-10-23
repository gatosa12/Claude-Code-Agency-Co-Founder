"""Start a new engaging carousel project.

  scripts/py scripts/new_carousel.py <dir> --title "This carousel talks" [--music track.mp3] [--slides 5] [--dur 10]
                                     [--voice am_michael] [--prompt "the user's prompt, word for word"]

Writes <dir>/story.json (fill in each slide's "say"), audio/music.wav (the background track, converted once),
slides/NN/build.py (a skeleton per slide: copy moves from examples/nintendo-origin/slides/*), prep.py (from the
example: the treatments), and records the start time (timer.json) so the finished carousel can say how long it took.
The background track: --music, else ~/.engaging-carousel/config.json "music", else ask the user for one.
"""
import argparse, json, os, shutil, subprocess, sys, time
from pathlib import Path

SK = Path(__file__).resolve().parent.parent
HOME = Path(os.environ.get('EC_HOME', Path.home() / '.engaging-carousel'))
BEATS = ['hook', 'problem', 'turn', 'how', 'payoff + CTA']

SKELETON = '''"""Slide {sid} — {beat}. "{say}"
Every time below comes from the voice (data/{sid}.words.json). Moves to copy: {sk}/examples/nintendo-origin/slides/"""
import json, os, sys
sys.path.insert(0, {skc!r})
from ec_devices import *

V = Words('../../data/{sid}.words.json')
S = json.load(open('../../story.json'))
U, K = 'media/use', 'media/clips'
c = Comp({dur})

# one beat per phrase: a device on the word it illustrates, the picture changing every 0.6-1.5 s, a sound on every change
# e.g.  still(c, 0, fr(V.t('This')), f'{{U}}/x.jpg', z=1); tile_reveal(c, fr(V.t('This')), f'{{U}}/y.jpg', z=2)
#       captions(c, [(V.span('This', 'you.'), fr(V.t('Every')))])

{tail}
c.write('index.html', title='{sid} {beat}')
c.write_cues('cues.json')
print('{sid} built', len(c.cues), 'cues')
'''


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('dir'); ap.add_argument('--title', required=True)
    ap.add_argument('--music'); ap.add_argument('--slides', type=int, default=5); ap.add_argument('--dur', type=float, default=10.0)
    ap.add_argument('--voice', default=None); ap.add_argument('--prompt', default='')
    a = ap.parse_args(); P = Path(a.dir).resolve()
    if (P / 'story.json').exists():
        sys.exit(f'{P} already has a story.json — pick a new folder (never overwrite a project)')
    cfg = json.loads((HOME / 'config.json').read_text()) if (HOME / 'config.json').exists() else {}
    music = a.music or cfg.get('music')
    if not music or not Path(os.path.expanduser(music)).exists():
        sys.exit('No background track. Ask the user for one (an mp3/wav they have the rights to) and pass --music <file>; '
                 'it will be remembered in ~/.engaging-carousel/config.json.')
    music = os.path.expanduser(music)
    if a.music:
        cfg['music'] = music; (HOME / 'config.json').write_text(json.dumps(cfg, indent=1))
    for d in ('audio', 'data', 'media/raw', 'media/use', 'media/clips', 'media/captures', 'media/logos', 'slides', 'out'):
        (P / d).mkdir(parents=True, exist_ok=True)
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', music, '-ac', '2', '-ar', '48000', str(P / 'audio/music.wav')], check=True)
    ids = [f'{k + 1:02d}' for k in range(a.slides)]
    beats = (BEATS + ['value'] * a.slides)[:a.slides - 1] + ['payoff + CTA'] if a.slides >= 2 else ['hook']
    story = {'title': a.title, 'prompt': a.prompt, 'voice': a.voice or cfg.get('voice', 'am_michael'), 'speed': 1.0,
             'slide_dur': a.dur, 'lead': 0.10, 'gap': 0.22, 'sfx_kit': 'open', 'sfx_profile': 'clicks', 'pronounce': {}, 'facts': {},
             'music': {'file': 'audio/music.wav', 'source': music, 'below_voice_lu': 5.0, 'windows': {}},
             'slides': [{'id': sid, 'beat': b, 'say': ''} for sid, b in zip(ids, beats)]}
    (P / 'story.json').write_text(json.dumps(story, indent=1))
    for sid, b in zip(ids, beats):
        (P / 'slides' / sid).mkdir(exist_ok=True)
        tail = 'swipe_cue(c, {:.2f}, {})'.format(a.dur - 0.95, a.dur) if sid != ids[-1] else '# last slide: no swipe cue; end on the CTA'
        (P / 'slides' / sid / 'build.py').write_text(SKELETON.format(sid=sid, beat=b, say='', dur=a.dur, tail=tail,
                                                                     sk=SK, skc=str(SK / 'components')))
    # the skill may live in the project (.claude/skills) or in ~/.claude/skills: point the template at where it is
    ex = (SK / 'examples/nintendo-origin/prep.py').read_text().replace(
        "os.path.expanduser('~/.claude/skills/engaging-carousel')", repr(str(SK)))
    (P / 'prep.py').write_text('# TEMPLATE from the reference carousel: replace STILLS / CLIPS / the card list with THIS carousel\'s media\n' + ex)
    (P / 'timer.json').write_text(json.dumps({'started': time.time(), 'started_iso': time.strftime('%Y-%m-%d %H:%M:%S')}))
    print(f'new carousel: {P}\n  story.json  ← write the {a.slides} lines\n  music: {music}\n  timer started {time.strftime("%H:%M:%S")}')


if __name__ == '__main__':
    main()
