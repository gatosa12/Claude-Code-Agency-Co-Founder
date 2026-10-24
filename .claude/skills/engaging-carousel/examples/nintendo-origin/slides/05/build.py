"""Slide 05 — payoff + CTA. "A year later, Donkey Kong gave us Mario. And Nintendo still makes playing cards. Follow for more brand stories."

Beats (out/contact-05.jpg): the Donkey Kong circuit board (teal + halftone), "A year later," in serif · the real
cabinet, and "MARIO." cut on hard in red Didone (the carousel's ONE red word) · a koi-koi game for "And Nintendo still
makes" · Nintendo's own hanafuda page today, the Mario deck marked on "cards." · the end card: the Nintendo Museum in
B&W, the CTA big, two rules under it. No swipe cue: it is the last slide.
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../../components'))
from ec_devices import *

V = Words('../../data/05.words.json')
U = 'media/use'
c = Comp(10.0)

t_dk, t_mario, t_and, t_play, t_fol = V.t('Donkey'), V.t('Mario.'), V.t('And'), V.t('playing'), V.t('Follow')

still(c, 0, t_dk, f'{U}/dk_pcb.jpg', z=1)

still(c, t_dk, t_and, f'{U}/dk_cabinet.jpg', z=1, push=1.07)
c.cue(t_dk, 'click')
keyword(c, t_mario, t_and, 'MARIO.', z=20, kind='shock', y=760)
c.bed(t_mario, V.e('Mario.') + 0.1, -70)

still(c, t_and, t_play, f'{U}/koikoi.jpg', z=1)
tile_reveal(c, t_and, f'{U}/koikoi.jpg', z=2)

focus_card(c, t_play, t_fol, f'{U}/nin_hanafuda.png', z=2, card_w=940, y=520, mark=(30, 300, 140, 40, V.t('cards.')), light=True)

# the end card: the museum, the CTA, two rules (white, then the red accent)
still(c, t_fol, 10.0, f'{U}/museum.jpg', z=1, push=1.04)
c.cue(t_fol, 'click')
c.clip(V.e('stories.'), 10.0, '<div style="position:absolute;left:390px;top:965px;width:140px;height:5px;background:#fff"></div>'
                             '<div style="position:absolute;left:550px;top:965px;width:140px;height:5px;background:var(--ev1-red)"></div>', z=65)

finish(c, 0, t_play, z=50); finish(c, t_fol, 10.0, z=50, grid=False)
captions(c, [(V.span('A', 'later,'), t_dk, 'serif')])
captions(c, [(V.span('Donkey', 'us'), t_and), (V.span('And', 'makes'), t_play)], y='80%')
captions(c, [(V.span('playing', 'cards.'), t_fol)], y='86%')
captions(c, [(V.span('Follow', 'stories.'), 10.0, 'big')], y='56%')
c.write('index.html', title='05 payoff')
c.write_cues('cues.json')
print('05 built', len(c.cues), 'cues')
