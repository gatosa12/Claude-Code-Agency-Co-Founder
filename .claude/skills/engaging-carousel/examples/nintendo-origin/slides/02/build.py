"""Slide 02 — origin. "It began in eighteen eighty-nine in Kyoto. Fusajiro Yamauchi made hanafuda, Japanese playing cards."

Beats (out/contact-02.jpg): the 1889 shop in hard B&W with "1889" set as a chrome title · a moving Kyoto temple
(amber) for "in Kyoto." · his real Wikipedia infobox, the founding date highlighted on his name · four hanafuda cards
pop in for "made hanafuda," · tile reveal onto early Nintendo cards, the phrase in serif · tail: the old HQ plate
"THE NINTENDO PLAYING CARD CO." · swipe.
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../../components'))
from ec_devices import *

V = Words('../../data/02.words.json')
U, K = 'media/use', 'media/clips'
c = Comp(10.0)

t_in2, t_fus, t_made, t_jap = V.t('in', n=2), V.t('Fusajiro'), V.t('made'), V.t('Japanese')
t_tail = V.end + 0.35

# "It began in eighteen eighty-nine": the shop, and the year as a chrome title (a word they say, shown as digits)
still(c, 0, t_in2, f'{U}/store_1889.jpg', z=1)
keyword(c, V.t('eighteen'), t_in2, '1889', z=20, kind='title', y=960)

# "in Kyoto.": moving footage
broll(c, t_in2, t_fus, f'{K}/kyoto.mp4', z=2, rate=0.05, focus_in=6)
c.cue(t_in2, 'click')

# "Fusajiro Yamauchi": his real infobox; the highlighter marks "September 23, 1889 – 1929" as his name lands
focus_card(c, t_fus, t_made, f'{U}/wp_fusajiro.png', z=3, card_w=760, y=560,
           mark=(170, 196, 420, 30, V.t('Yamauchi')), light=True)

# "made hanafuda,": real cards land one by one
cards = [(f'{U}/card_hf1.jpg', 420, 620, 330, -6, t_made + 0.05), (f'{U}/card_hf2.jpg', 660, 600, 330, 5, t_made + 0.25),
         (f'{U}/card_hf3.jpg', 470, 760, 330, 3, V.t('hanafuda,')), (f'{U}/card_hf4.jpg', 650, 780, 330, -4, V.t('hanafuda,') + 0.2)]
pop_collage(c, t_made, t_jap, cards, z=4)

# "Japanese playing cards.": tile reveal onto Nintendo's own early cards
still(c, t_jap, t_tail, f'{U}/mushibana.jpg', z=1)
tile_reveal(c, t_jap, f'{U}/mushibana.jpg', z=2)

# tail: the old headquarters' plate
still(c, t_tail, 10.0, f'{U}/plate.jpg', z=1, push=1.04)
c.cue(t_tail, 'click')

finish(c, 0, t_fus, z=50); finish(c, t_jap, 10.0, z=50)
captions(c, [(V.span('It', 'began'), V.t('eighteen'), None),
             (V.span('in', 'Kyoto.', n=2), t_fus),
             (V.span('Fusajiro', 'Yamauchi'), t_made),
             (V.span('made', 'hanafuda,'), t_jap),
             (V.span('Japanese', 'cards.'), 10.0, 'serif')], y='72%')
swipe_cue(c, 9.05, 10.0)
c.write('index.html', title='02 origin')
c.write_cues('cues.json')
print('02 built', len(c.cues), 'cues')
