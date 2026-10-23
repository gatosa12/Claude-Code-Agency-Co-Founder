"""Slide 05 — payoff + CTA. "if you're not sure what we do give us a ring, ask us, we'd be really happy to answer any
questions you might have."
Natural (her holding the leaflet) → teal push onto the leaflet (its phone number) on "give us a ring, ask us," →
natural wide → the end card: a B&W freeze of her, the last line held. No swipe: the last slide."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import *

V = Words('../../data/05.words.json')
c = Comp(10.0)
t_give, t_wed, t_end = V.t('give'), V.t("we'd"), V.end + 0.2

footage(c, '05', 'natural', 0, t_give, scale=1.1)
footage(c, '05', 'teal', t_give, t_wed, scale=2.3, origin='8% 40%', rate=0.06)
footage(c, '05', 'warm', t_wed, t_end)
still(c, t_end, 10.0, f'{U}/end05.jpg', z=1, push=1.05)
c.cue(t_end, 'click')

finish(c, 0, 10.0, z=50, grid=False)
captions(c, [(V.span('if', 'do'), t_give),
             (V.span('give', 'us,'), t_wed, 'big'),
             (V.span("we'd", 'have.'), 10.0)], y='80%')
c.write('index.html', title='05 payoff')
c.write_cues('cues.json')
print('05 built', len(c.cues), 'cues')
