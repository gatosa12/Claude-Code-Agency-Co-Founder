"""prep.py — every real picture and clip for the Nintendo carousel, treated ONCE (one treated file per raw picture,
named like the raw, so no picture can show up in two beats). Run from this folder:
  ~/.claude/skills/engaging-carousel/scripts/py prep.py
"""
import os, sys, subprocess
SK = os.path.expanduser('~/.claude/skills/engaging-carousel')
sys.path.insert(0, f'{SK}/scripts')
import cv2
from treat import treat

R, U, C, CAP = 'media/raw', 'media/use', 'media/clips', 'media/captures'
os.makedirs(U, exist_ok=True); os.makedirs(C, exist_ok=True)
FULL, CARD = (1188, 1485), (600, 750)

# full-frame stills: name (= raw file name): (look, focus, halftone, vignette)
STILLS = {
    'hq_modern':  ('teal', (0.55, 0.5), 0.15, 0.7),     # 01 "Nintendo is"
    'hq_1930':    ('mono', (0.5, 0.45), 0.0, 0.6),      # 01 "137 years old" (darkened under the count)
    'hq_old':     ('warm', (0.5, 0.5), 0.0, 0.65),      # 01 the pause after "old."
    'cards_poster': ('natural', (0.5, 0.5), 0.0, 0.7),  # 01 "For most of that time"
    'switch2':    ('teal', (0.5, 0.5), 0.0, 0.7),       # 01 "a video game." + tail
    'store_1889': ('mono', (0.5, 0.5), 0.0, 0.62),      # 02 "It began in 1889"
    'mushibana':  ('warm', (0.5, 0.5), 0.0, 0.68),      # 02 "Japanese playing cards."
    'plate':      ('teal', (0.5, 0.5), 0.0, 0.7),       # 02 tail: THE NINTENDO PLAYING CARD CO.
    'plastic_cards': ('warm', (0.5, 0.45), 0.0, 0.65), # 03 "In the sixties," (Nintendo's all-plastic cards)
    'rice':       ('natural', (0.5, 0.5), 0.0, 0.65),   # 03 "Instant rice."
    'ultra_machine': ('natural', (0.5, 0.5), 0.0, 0.68), # 03 "Then came toys." (Nintendo Ultra Machine)
    'gw_patent':  ('natural', (0.5, 0.35), 0.0, None),  # 04 "In 1980" (paper card)
    'gw_ball':    ('natural', (0.5, 0.5), 0.0, 0.7),    # 04 "his Game and Watch"
    'gw_mario_hand': ('teal', (0.5, 0.5), 0.0, 0.7),    # 04 "pocket." + tail
    'gw_serie':   ('mono', (0.5, 0.45), 0.0, 0.65),     # 04 tail
    'dk_pcb':     ('teal', (0.5, 0.5), 0.2, 0.7),       # 05 "A year later,"
    'dk_cabinet': ('natural', (0.66, 0.45), 0.0, 0.68),  # 05 "Donkey Kong"
    'gw_mario_screen': ('natural', (0.32, 0.5), 0.0, 0.7),  # 05 "Mario."
    'koikoi':     ('natural', (0.5, 0.5), 0.0, 0.68),   # 05 "And Nintendo still makes"
    'museum':     ('mono', (0.5, 0.5), 0.0, 0.6),       # 05 end card
}
# tighter crops: dk_cabinet leaves out the man standing in the dark at its left edge
CROP = {'dk_cabinet': (260, 0, 960, 875)}
# a shape-matched strobe (01 "it never made"): consoles, each a different grade
STROBE = {'switch': 'teal', 'gameboy': 'mono', 'nes': 'warm', 'gba': 'natural', 'famicom': 'invert'}
# 4:5 cards that land one by one (pop collages)
CARDS = {'hf1': 'natural', 'hf2': 'natural', 'hf3': 'natural', 'hf4': 'natural',            # 02 "made hanafuda,"
         'gw_chef': 'natural', 'gw_boxing': 'natural', 'gw_dk2': 'natural', 'gw_dk': 'natural'}  # 04 "games in your pocket"

for name, (lk, focus, ht, vig) in {**STILLS, **{k: (v, (0.5, 0.5), 0.0, 0.7 if v != 'invert' else None) for k, v in STROBE.items()}}.items():
    src = next(f'{R}/{f}' for f in os.listdir(R) if os.path.splitext(f)[0] == name)
    treat(src, f'{U}/{name}.jpg', lk, FULL, focus, CROP.get(name), ht, vig)
for name, lk in CARDS.items():
    src = next(f'{R}/{f}' for f in os.listdir(R) if os.path.splitext(f)[0] == name)
    treat(src, f'{U}/card_{name}.jpg', lk, CARD, (0.5, 0.5), None, 0.0, None)

# real pages: crops of what is said (Wikipedia infoboxes, Nintendo's own hanafuda page)
def crop(src, out, box=None):
    im = cv2.imread(f'{CAP}/{src}.png')
    if box: x0, y0, x1, y1 = box; im = im[y0:y1, x0:x1]
    cv2.imwrite(f'{U}/{out}.png', im)
crop('wp_fusajiro', 'wp_fusajiro')                     # name, "1st President of Nintendo", "September 23, 1889 – 1929", "Founder of Nintendo"
crop('wp_hiroshi', 'wp_hiroshi', (0, 0, 644, 1010))      # name + portrait + "3rd President of Nintendo"
crop('wp_yokoi', 'wp_yokoi', (0, 0, 644, 1060))          # name + portrait ("Yokoi in 1994")
crop('wp_ultrahand', 'wp_ultrahand')                   # Ultra Hand: photo, "Invented by Gunpei Yokoi", "Company Nintendo"
crop('nin_hanafuda', 'nin_hanafuda', (0, 0, 2000, 1640)) # nintendo.com/jp: 花札・株札 HANAFUDA / KABUFUDA, Mario hanafuda

# moving footage: 1080x1350, 30 fps CFR, graded
CLIPS = {'kyoto': ('v_kyoto.mp4', 1.0, 2.0, 'warm', (0.5, 0.5)),
         'taxi': ('v_taxi.mp4', 1.0, 1.8, 'teal', (0.5, 0.5)),
         'rice_fall': ('v_rice.mp4', 0.5, 1.4, 'natural', (0.5, 0.5))}
for name, (raw, ss, dur, lk, focus) in CLIPS.items():
    subprocess.run([f'{SK}/scripts/py', f'{SK}/scripts/clip.py', f'{R}/{raw}', f'{C}/{name}.mp4', '--ss', str(ss), '--dur', str(dur),
                    '--look', lk, '--focus', f'{focus[0]},{focus[1]}'], check=True)
print('prep done:', len(os.listdir(U)), 'stills,', len(os.listdir(C)), 'clips')
