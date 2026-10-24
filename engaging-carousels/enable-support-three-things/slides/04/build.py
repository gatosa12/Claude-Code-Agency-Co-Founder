"""Slide 04 — three. "and always promoting independence and choice. There are the three that come immediately to mind,"
Natural → hard B&W close: INDEPENDENCE then CHOICE. as she says them → warm wide for "There are the three…" →
freeze · swipe."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import *

V = Words('../../data/04.words.json')
c = Comp(10.0)
t_ind, t_cho, t_there, t_end = V.t('independence'), V.t('choice.'), V.t('There'), V.end + 0.15

footage(c, '04', 'natural', 0, t_ind, scale=1.12)
footage(c, '04', 'mono', t_ind, t_there, scale=1.32)
keyword(c, t_ind, t_cho, 'INDEPENDENCE', z=20, kind='key', size=104, y=260)
keyword(c, t_cho, t_there, 'CHOICE.', z=20, kind='key', y=260)
footage(c, '04', 'warm', t_there, t_end)
tail(c, '04', t_end, 'tail04')

finish(c, 0, 10.0, z=50, grid=False)
captions(c, [(V.span('and', 'promoting'), t_there),
             (V.span('There', 'mind,'), 10.0)], y='80%')
swipe_cue(c, 9.05, 10.0)
c.write('index.html', title='04 three')
c.write_cues('cues.json')
print('04 built', len(c.cues), 'cues')
