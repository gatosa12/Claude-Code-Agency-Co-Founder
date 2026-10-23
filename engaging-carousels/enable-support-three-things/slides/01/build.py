"""Slide 01 — hook. Interviewer: "Can you give me three things that matter in good support?"
Her: "Gosh, I'm sure there's loads more than three."
Frame 0 = her listening + SOUND ON · a big "3" on "three" · a tight warm close-up on her reaction, a punch on "loads"
· freeze on her laugh · swipe."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import *

V = Words('../../data/01.words.json')
c = Comp(10.0)
t_three, t_gosh, t_end = V.t('three'), V.t('Gosh,'), V.end + 0.15

footage(c, '01', 'natural', 0, t_three)
footage(c, '01', 'teal', t_three, t_gosh, scale=1.18)
keyword(c, t_three, t_gosh, '3', z=20, kind='key', size=300, y=250)
footage(c, '01', 'warm', t_gosh, t_end, scale=1.32, punches=[(V.t('loads'), 1.42)])
tail(c, '01', t_end, 'tail01')
sound_on(c, 0, t_gosh)

finish(c, 0, 10.0, z=50, grid=False)
captions(c, [(V.span('Can', 'support?'), t_gosh),
             (V.span('Gosh,', 'three.'), 10.0)], y='80%')
swipe_cue(c, 9.05, 10.0)
c.write('index.html', title='01 hook')
c.write_cues('cues.json')
print('01 built', len(c.cues), 'cues')
