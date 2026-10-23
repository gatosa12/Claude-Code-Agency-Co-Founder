"""Slide 01 — hook. "Nintendo is one hundred and thirty seven years old. For most of that time, it never made a video game."

Beats (out/contact-01.jpg): the cover = today's HQ + the real logo + SOUND ON · the 1930 HQ while the age counts up in
red · tile reveal onto the old HQ on "old." · the 1953 card poster for "For most of that time," · a console strobe
carries "it never made" (the carousel's ONE strobe) · Switch 2 for "a video game." with the bed dropped · swipe.
In a project the path below is the skill's components folder (new_carousel.py writes it for you).
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../../components'))
from ec_devices import *

V = Words('../../data/01.words.json')
U = 'media/use'
c = Comp(10.0)
NIN = open('../../media/logos/nintendo.svg').read()        # simple-icons "nintendo"

t_one, t_old, t_for, t_it, t_a = V.t('one'), V.t('old.'), V.t('For'), V.t('it'), V.t('a')

# 0 → "one": the cover. Frame 0 must read: a real picture, the real mark, the pill, the first word.
still(c, 0, t_one, f'{U}/hq_modern.jpg', z=1)
svg_mark(c, 0, t_one, NIN, z=20, width=470, y=470, blur_in=False)
sound_on(c, 0, t_old)

# "one hundred and thirty seven years": the age counts up over the 1930 building, landing on "seven"
still(c, t_one, t_old, f'{U}/hq_1930.jpg', z=1, push=1.08)
count_up(c, t_one, t_old, 1, 137, z=20, t_run=t_one, run=V.t('seven') - t_one, y=470, size=200)

# "old.": the old HQ, tile-flash reveal
still(c, t_old, t_for, f'{U}/hq_old.jpg', z=1)
tile_reveal(c, t_old, f'{U}/hq_old.jpg', z=2)

# "For most of that time,": the card poster (playing cards were the business)
still(c, t_for, t_it, f'{U}/cards_poster.jpg', z=1)
c.cue(t_for, 'click')

# "it never made": a strobe of consoles, one word carried by shape-matched pictures
strobe(c, t_it, t_a, [f'{U}/{n}.jpg' for n in ('nes', 'gameboy', 'famicom', 'gba', 'switch')], z=3, step_frames=3)

# "a video game." + tail: Switch 2; the bed drops under the punchline and slams back after it
still(c, t_a, 10.0, f'{U}/switch2.jpg', z=1, push=1.05)
c.cue(t_a, 'click')
c.bed(t_a, V.end + 0.15, -70)

finish(c, 0, 10.0, z=50)
captions(c, [(V.span('Nintendo', 'is'), t_one),
             (V.span('one', 'old.'), t_for),
             (V.span('For', 'time,'), t_it),
             (V.span('it', 'made'), t_a),
             (V.span('a', 'game.'), 10.0, 'big')])
swipe_cue(c, 9.05, 10.0)
c.write('index.html', title='01 hook')
c.write_cues('cues.json')
print('01 built', len(c.cues), 'cues')
