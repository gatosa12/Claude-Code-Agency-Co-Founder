"""Slide 03 — turn. "In the sixties, Hiroshi Yamauchi tried everything. A taxi company. Instant rice. All failed. Then came toys."

Beats (out/contact-03.jpg): Nintendo's all-plastic cards (amber), "In the sixties," in serif · his real infobox racking
into focus, "3rd President of Nintendo" marked on "tried" (the Commons photo under his name is someone else) · night
taxis (teal) · falling rice · a black card, "All failed." in serif, the bed cut (voice alone) · tile reveal onto the
Ultra Machine, "Then came toys." big as the beat slams back · swipe.
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../../components'))
from ec_devices import *

V = Words('../../data/03.words.json')
U, K = 'media/use', 'media/clips'
c = Comp(10.0)

t_hir, t_a, t_ins, t_all, t_then = V.t('Hiroshi'), V.t('A'), V.t('Instant'), V.t('All'), V.t('Then')

still(c, 0, t_hir, f'{U}/plastic_cards.jpg', z=1)

focus_card(c, t_hir, t_a, f'{U}/wp_hiroshi.png', z=2, card_w=620, y=600, mark=(30, 556, 560, 34, V.t('tried')), light=True)

broll(c, t_a, t_ins, f'{K}/taxi.mp4', z=2, rate=0.06, punches=[(V.t('company.'), 1.10)])
c.cue(t_a, 'click')
broll(c, t_ins, t_all, f'{K}/rice_fall.mp4', z=2, rate=0.05)
c.cue(t_ins, 'click')

# "All failed.": nothing on screen, nothing under the voice
black(c, t_all, t_then, z=1)
c.bed(t_all, t_then, -70)

# "Then came toys.": the beat comes back with the picture
still(c, t_then, 10.0, f'{U}/ultra_machine.jpg', z=1)
tile_reveal(c, t_then, f'{U}/ultra_machine.jpg', z=2)

finish(c, 0, t_hir, z=50); finish(c, t_then, 10.0, z=50)
captions(c, [(V.span('In', 'sixties,'), t_hir, 'serif')])
captions(c, [(V.span('Hiroshi', 'everything.'), t_a)], y='86%')
captions(c, [(V.span('A', 'company.'), t_ins), (V.span('Instant', 'rice.'), t_all),
             (V.span('All', 'failed.'), t_then, 'serif')])
captions(c, [(V.span('Then', 'toys.'), 10.0, 'big')], y='62%')
swipe_cue(c, 9.05, 10.0)
c.write('index.html', title='03 turn')
c.write_cues('cues.json')
print('03 built', len(c.cues), 'cues')
