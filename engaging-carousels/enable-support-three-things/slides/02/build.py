"""Slide 02 — one. "Things that spring to mind would be treating people with kindness and with respect,"
Wide → teal close on "treating people with" → hard B&W close with KINDNESS cut on in red Didone (the carousel's ONE
red word) → RESPECT in white, held over the freeze frame · swipe."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import *

V = Words('../../data/02.words.json')
c = Comp(10.0)
t_treat, t_kind, t_resp, t_end = V.t('treating'), V.t('kindness'), V.t('respect,'), V.end + 0.15

footage(c, '02', 'natural', 0, t_treat)
footage(c, '02', 'teal', t_treat, t_kind, scale=1.2)
footage(c, '02', 'mono', t_kind, t_end, scale=1.34)
tail(c, '02', t_end, 'tail02')
keyword(c, t_kind, t_resp, 'KINDNESS', z=20, kind='shock', y=260)
keyword(c, t_resp, 10.0, 'RESPECT', z=20, kind='key', y=260)

finish(c, 0, 10.0, z=50, grid=False)
captions(c, [(V.span('Things', 'be'), t_treat),
             (V.span('treating', 'respect,'), 10.0)], y='80%')
swipe_cue(c, 9.05, 10.0)
c.write('index.html', title='02 one')
c.write_cues('cues.json')
print('02 built', len(c.cues), 'cues')
