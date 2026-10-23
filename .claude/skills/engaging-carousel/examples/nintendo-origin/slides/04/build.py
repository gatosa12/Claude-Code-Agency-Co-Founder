"""Slide 04 — how. "Engineer Gunpei Yokoi built the Ultra Hand toy. In nineteen eighty, his Game and Watch put games in your pocket."

Beats (out/sheet.jpg shows its frame 0): his real infobox, sharp from frame 0 (rack=False) · the Ultra Hand infobox,
"Invented by Gunpei Yokoi" marked · his Game & Watch patent drawing on paper, the words in ink · the first Game &
Watch (Ball) · four Game & Watch cards pop in for "put games in your" · "pocket." big over Mario on a Game & Watch ·
tail: the whole series in B&W · swipe.
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../../components'))
from ec_devices import *

V = Words('../../data/04.words.json')
U = 'media/use'
c = Comp(10.0)

t_built, t_in, t_his, t_put, t_pocket = V.t('built'), V.t('In'), V.t('his'), V.t('put'), V.t('pocket.')
t_tail = V.end + 0.6

# frame 0 = the person, sharp (the first thing seen after the swipe must read)
focus_card(c, 0, t_built, f'{U}/wp_yokoi.png', z=1, card_w=600, y=560, rack=False)
focus_card(c, t_built, t_in, f'{U}/wp_ultrahand.png', z=2, card_w=640, y=560, mark=(20, 470, 600, 34, V.t('Ultra')), light=True)

# "In nineteen eighty,": the patent drawing on paper, the spoken words in ink above it
paper_card(c, t_in, t_his, f'{U}/gw_patent.jpg', z=2, card_w=640, above=V.span('In', 'eighty,'))

still(c, t_his, t_put, f'{U}/gw_ball.jpg', z=1)
tile_reveal(c, t_his, f'{U}/gw_ball.jpg', z=2)

cards = [(f'{U}/card_gw_chef.jpg', 400, 600, 320, -5, t_put + 0.03), (f'{U}/card_gw_boxing.jpg', 680, 590, 320, 4, V.t('games')),
         (f'{U}/card_gw_dk2.jpg', 440, 780, 320, 3, V.t('in')), (f'{U}/card_gw_dk.jpg', 650, 790, 320, -3, V.t('your'))]
pop_collage(c, t_put, t_pocket, cards, z=3)

still(c, t_pocket, t_tail, f'{U}/gw_mario_hand.jpg', z=1, push=1.08)
c.cue(t_pocket, 'click')
still(c, t_tail, 10.0, f'{U}/gw_serie.jpg', z=1, push=1.04)
c.cue(t_tail, 'click')

finish(c, t_his, t_put, z=50); finish(c, t_pocket, 10.0, z=50)
captions(c, [(V.span('Engineer', 'Yokoi'), t_built), (V.span('built', 'toy.'), t_in)], y='88%')
captions(c, [(V.span('his', 'Watch'), t_put), (V.span('put', 'your'), t_pocket)], y='72%')
captions(c, [(V.span('pocket.', 'pocket.'), 10.0, 'big')])
swipe_cue(c, 9.05, 10.0)
c.write('index.html', title='04 how')
c.write_cues('cues.json')
print('04 built', len(c.cues), 'cues')
