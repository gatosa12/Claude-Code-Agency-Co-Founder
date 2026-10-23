"""Slide 03 — two. "listening to people properly, but properly listening, and understanding what they want and what they need,"
A natural close → hard B&W tighter on the stressed phrase "but properly listening," (serif) → teal wide for
"and understanding…" → freeze · swipe."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import *

V = Words('../../data/03.words.json')
c = Comp(10.0)
t_but, t_and, t_end = V.t('but'), V.t('and'), V.end + 0.15

footage(c, '03', 'natural', 0, t_but, scale=1.15)
footage(c, '03', 'mono', t_but, t_and, scale=1.38, punches=[(V.t('properly', n=2), 1.46)])
footage(c, '03', 'teal', t_and, t_end)
tail(c, '03', t_end, 'tail03')

finish(c, 0, 10.0, z=50, grid=False)
captions(c, [(V.span('Listening', 'properly,'), t_but),
             (V.span('but', 'listening'), t_and, 'serif'),
             (V.span('and', 'need.'), 10.0)], y='80%')
swipe_cue(c, 9.05, 10.0)
c.write('index.html', title='03 two')
c.write_cues('cues.json')
print('03 built', len(c.cues), 'cues')
