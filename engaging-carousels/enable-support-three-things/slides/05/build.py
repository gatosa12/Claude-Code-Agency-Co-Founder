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

# the end card: their real logo (from enableandsupport.com; it has a white ground, so the card is white) and the
# phone + email the owner gave, in the logo's own navy and teal. Lands with a click as her last word ends.
NAVY, TEAL = '#394875', '#3AADAC'
eid = c.uid('end')
card = (f'<div class="ev1-layer" style="background:#fff"></div>'
        f'<div id="{eid}" style="position:absolute;left:0;top:0;width:1080px;height:1350px;display:flex;flex-direction:column;'
        f'align-items:center;justify-content:center">'
        f'<img src="media/logos/logo_trim.png" style="width:860px;display:block">'
        f'<div style="width:120px;height:5px;background:{TEAL};border-radius:3px;margin:64px 0 54px"></div>'
        f'<div style="font:700 68px/1 var(--ev1-sans);color:{NAVY};letter-spacing:.01em">01273 751555</div>'
        f'<div style="font:600 42px/1 var(--ev1-sans);color:{TEAL};margin-top:30px">info@enableandsupport.com</div></div>')
c.clip(t_end, 10.0, card, z=55, cls='', style='position:absolute;left:0;top:0;width:1080px;height:1350px')
c.pre.append(f'gsap.set("#{eid}",{{opacity:0}});')
c.at(f'tl.fromTo("#{eid}",{{opacity:0,scale:1.04,filter:"blur(12px)"}},{{opacity:1,scale:1,filter:"blur(0px)",duration:0.25,'
     f'ease:"power2.out",immediateRender:false}},{fr(t_end):.4f});')
c.cue(t_end, 'click')

finish(c, 0, t_end, z=50, grid=False)
captions(c, [(V.span('if', 'do'), t_give),
             (V.span('give', 'us,'), t_wed, 'big'),
             (V.span("we'd", 'have.'), t_end)], y='80%')
c.write('index.html', title='05 payoff')
c.write_cues('cues.json')
print('05 built', len(c.cues), 'cues')
