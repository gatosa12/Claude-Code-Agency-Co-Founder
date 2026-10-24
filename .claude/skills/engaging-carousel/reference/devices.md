# The devices (components/ec_devices.py)

Every beat is one device. Every time comes from the voice: `V = Words('../../data/NN.words.json')`, then
`V.t('word')` (onset), `V.e('word')` (end), `V.t('in', n=2)` (the second "in"), `V.span('First', 'last.')` (the words
for a caption group), `V.end` (the voice's last word ends). Never type a time. `fr(t)` snaps to the frame grid.

Layers (z): picture 1–10 · overlay / collage 10–30 · finish (grid + vignette) 50 · captions 60 · chrome 70 · flash 90.

| device | use it for | frames / feel | sound cue |
|---|---|---|---|
| `still(c, t0, t1, src, z)` | a held real photo, edge to edge | linear push 1.00 → 1.06 over the hold | none |
| `tile_reveal(c, t, src, z)` | the opening move onto a new picture: the thirds grid, each pane flashes white for 1 frame then shows the picture | 9 panes, 1 per frame (~0.33 s); put `still()` of the same picture under it from `t` | one tick per pane (the mixer plays ONE click) |
| `broll(c, t0, t1, src, z, rate=0.055)` | a real moving clip (clip.py output) | a steady 4–7.5 %/s zoom; `focus_in=9` opens defocused; `punches=[(t, 1.12)]` on a stressed word | none |
| `focus_card(c, t0, t1, src, z, card_w, mark=(x, y, w, h, t), light=)` | a real page / infobox / screenshot on black | 12-frame rack focus, 5 % creep, a highlighter wipes over `mark` (card px) at `t`; `rack=False` when it is frame 0 | soft click (+ one on the mark) |
| `paper_card(c, t0, t1, src, z, above=, below=)` | a small card (patent drawing, document) on grey paper with the spoken words in ink above/below | opens on a 2-frame invert | click |
| `pop_collage(c, t0, t1, cards, z)` | 3–5 real 4:5 cards landing one by one ("made hanafuda,") | each card preceded by a one-frame white box; the stack drifts 5 % | one click per card |
| `wall3d(c, t0, t1, tiles, z)` | a perspective wall of cards, camera sweeping | motion blur, power3.out | silent (the bed carries it) |
| `strobe(c, t0, t1, srcs, z)` | ONE word carried by shape-matched pictures (all consoles, all clocks) | 2–3 frames each, a white square hopping; **max one per carousel** | tick per image |
| `frames(c, t0, srcs, z)` | a 3–4 frame datamosh (`treat.py --glitch`) | only when the line is about something breaking | glitch |
| `keyword(c, t0, t1, text, z, kind=)` | the big word: `key` white grotesk · `title` chrome serif italic ("1889") · `shock` red Didone caps (**one per carousel**: "MARIO.") · `mega` | 6-frame blur-in (shock/mega cut on hard) | optional |
| `count_up(c, t0, t1, v0, v1, z, t_run, run)` | a number counting while it is said ("one hundred and thirty seven") | eases into the final value; red Didone by default | tick per step (thinned) |
| `svg_mark` / `img_mark` | the REAL logo (simple-icons SVG, press kit PNG) | blurred in like a keyword; `blur_in=False` on frame 0 | none |
| `captions(c, groups, y=, z=60)` | the spoken words, each on its onset (±1 frame), laid out in final slots | `mode='serif'` stressed phrase · `'big'` the key line | none |
| `typewriter`, `prompt_box`, `waveform` | rebuilt UI fed REAL data | block cursor, scanlines | click per line |
| `black(c, t0, t1)` | "nothing", "All failed." | pull the bed down: `c.bed(t0, t1, -70)` | none |
| `neg_flash`, `white_flash` | a 1–2 frame accent on a cut | | click |
| `finish(c, t0, t1, z=50)` | the thirds grid + vignette over picture beats | | |
| `sound_on(c, 0, t)` | slide 1 only: the SOUND ON pill (feeds autoplay muted) | top left, clear of the 1/5 counter | |
| `swipe_cue(c, t0, t1)` | slides 1–4: the tail ends on SWIPE ——> | bar draws, chevron nudges twice | soft click |

## Pace (the creator: "it's too much")
- A new picture every ~1–1.5 s: one phrase, one picture. Hold longer on the punchline and the tail.
- Every hold moves (push, zoom, creep); punch-ins only on the stressed word.
- Frame 0 of every slide must READ (no blur, no white flash, no empty black): it is what people see after a swipe.
- Captions: 86 px from the sides, clear of the counter (top right, 120 px) and the sound icon (bottom right, 120 px),
  never colliding with the swipe cue (bottom 150 px). Default y is the middle; move them (y='70%') off a face or a
  focus card.

## Bed automation (cues.json → mix.py)
`c.bed(t0, t1, db)`: CUT, don't duck. `-70` = a full drop (voice alone under the punchline), `-6` pulls it under a
black or UI card. The ramps sit outside [t0, t1], so put t0 on the word.

See `examples/nintendo-origin/slides/*/build.py` for every device in use, beat by beat.
