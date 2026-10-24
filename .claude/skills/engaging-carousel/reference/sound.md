# Sound

**Sound = voice + music + photo clicks.** Nothing else by default.

## Voice (voice.py)
Kokoro-82M, `am_michael` by default (`voice.py --list` for others: `af_heart` warm female, `bm_george` UK
documentary). Sentences are spoken one by one and joined with `gap` s of silence (a one-word sentence or a question
gets 0.1 s more), first word at `lead`. Never compressed or EQ'd. Whisper (small.en) times every word, onsets are
snapped to where the voice really starts. Foreign names: `story.json → pronounce`.

## Music (the bed)
The creator's own track (`--music` once, remembered in `~/.engaging-carousel/config.json`). `music_windows.py` picks a
10 s window per slide: the track's drop lands on the first word of slide 1's second sentence; the other slides get the
most even, energetic stretches, each used once.
- Levelled ~5 LU under the voice (`below_voice_lu`), in from frame 0 (no fade-in: a swipe lands mid-music).
- **CUT, not ducked**: `c.bed(t0, t1, -70)` drops it under the punchline (voice alone), the beat slams back on the
  next line; `-6` pulls it under black/UI cards.
- Out over the last 0.30 s so each slide's loop restarts clean.

## Clicks
`sfx_profile: "clicks"` (default): ONE soft photo click per picture change (a tile reveal is one change, not nine;
clicks closer than 0.18 s are merged), from the device cues. Clicks sit 4–7 dB under the voice and land ~8 ms after
the picture (the references' clicks lag the cut).
`sfx_profile: "full"` restores Editor V1's whole grammar (swish, glitch, riser, subboom, impact, hit, outro) — only
on request.

The kit (`sfx_kit.py`) is synthesised locally: shutter-style clicks built from seeded noise, nothing to license.
`--kit ev1` is a brighter, harder variant.

## Master (mix.py)
−14 LUFS integrated, peaks under −1 dBFS (soft limiter), 48 kHz stereo, AAC 256k in the MP4.
Then `check_audio.py`: Whisper must hear every scripted word over the bed and clicks. A miss → pull the bed down under
that phrase (`c.bed(t0, t1, -4)`) and re-render that slide.
