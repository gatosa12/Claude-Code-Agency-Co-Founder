---
name: engaging-carousel
description: >-
  "The engaging carousel" (also "engaging carousel style", "talking carousel", "carousel that talks", "Editor V1
  carousel") — an Instagram carousel (also LinkedIn / TikTok photo mode) where every slide is a 10-second 4:5 video
  that TELLS A STORY OUT LOUD: an open-source voice (Kokoro, running locally) narrates one beat per slide, the
  creator's own background track runs under it, and the picture is Editor V1's documentary edit — real photos and
  clips found online (Wikimedia Commons, NASA, Mixkit, archive.org, the real web page or logo), every one colour-graded
  (teal split, hard B&W, amber, halftone) and used ONCE, cut every 1–1.5 s with tile-flash reveals, pop collages, real
  pages with a highlighter, word-by-word captions and one red Didone word, with a soft photo click on every picture
  change and nothing else. Best for brand origin stories ("Nintendo started with playing cards"), company/history
  stories, a business's own story. Use when someone wants a carousel that talks, narrates, has a voiceover, tells a
  story with sound, "the engaging carousel style", or an Editor V1–style carousel, from a single prompt or topic.
  $0: everything runs on this computer. Not for silent/static carousels (use carousel) or abstract motion-graphics
  carousels with no voice (use live-carousel).
---

# The engaging carousel

Five slides, ten seconds each, one story ABOUT A SUBJECT — a brand's origin, a company, a moment in history, a
business's own story — never about the tool that made it (the creator's note on the first demo: "talking about
Claude that way doesn't make any sense, it has to be a use case"). Reference: `examples/nintendo-origin/`. Every slide is a looping 1080×1350 MP4 with its own sound: the narrator
says one beat of the story, the picture is a fast stream of REAL material proving each phrase, and the slide ends on
a swipe cue so the next beat is one swipe away. People hear a carousel talk to them, which they have never heard.

The look is **Editor V1** (Jade's documentary edit, measured frame by frame off three Metro Media House founder-story
reels) re-set for a 4:5 phone frame. The story, the voice and the swipe structure are new.

`SK` = this folder. Run Python with `SK/scripts/py` (the skill's private env). Every script prints its usage with `--help`
or in its docstring.

## 0 · First time on a machine
`bash SK/scripts/setup.sh` until it prints **All set** (private Python env, Kokoro voice, sound kit, renderer).

## 1 · From one prompt to a carousel (the whole run, ~20–30 min)
The user should be able to give ONE prompt ("/engaging-carousel a carousel about X") and get the finished MP4s.
Don't interview. Only ask if there is no topic at all, or no background track (step 1a). Defaults: 5 slides × 10 s,
narrator `am_michael` (Kokoro), the creator's track, faceless, the "open" sound kit, CTA "Link in bio".

**1a · Scaffold** (starts the timer):
```
SK/scripts/py SK/scripts/new_carousel.py ./engaging-carousels/<slug> --title "<title>" --prompt "<the user's prompt, verbatim>"
```
It uses the track in `~/.engaging-carousel/config.json` ("music"). If there is none, ask the user once for a track
they own the rights to and pass `--music <file>` (remembered from then on).

**1b · Write the story** into `story.json` → `slides[].say`. Read `reference/story.md` first. The short version:
one beat per slide: hook (the surprising fact) → origin → the struggle/turn → the breakthrough → payoff + CTA
("Follow for more brand stories"). **14–20 words per slide** (≈ 6.5–7.5 s at speed
1.0, leaving a 2.5–3 s tail). Every sentence a cut point. Written for the ear: numbers as said ("twenty minutes").
**Everything said must be true**, including any number about the carousel itself (see 1h).

**1c · Voice + word timings:** `SK/scripts/py SK/scripts/voice.py <project>` → `audio/vo/NN.wav`, `data/NN.words.json`.
It flags a slide whose voice leaves less than 1.2 s of tail: cut words, never speed up the voice.
Kokoro is an English voice: **foreign names come out anglicised** ("Yokoi" heard as "Yacue"). Respell them in
`story.json → "pronounce": {"Yokoi": "Yoh-koy", "Yamauchi": "Yahmah-oochee"}` (one word each; the captions keep the
real spelling) and let `check_audio.py` confirm Whisper hears the real name back.

**1d · Find the real material** for every phrase (`reference/sourcing.md`). For each beat, ask: *what real thing is
this line about, and where does its own picture live?* Search, LOOK at the sheet, fetch the pick:
```
SK/scripts/py SK/scripts/find_media.py "film splicer" <project> --kind image          # Wikimedia Commons + NASA
SK/scripts/py SK/scripts/find_media.py "hourglass" <project> --kind video --src mixkit
SK/scripts/py SK/scripts/find_media.py --get <project>/media/search/<slug>.json <index> <name> <project>
node SK/scripts/capture.mjs jobs.json <project>/media/captures                          # a real web page
```
Every fetch is credited in `SOURCES.md` automatically. **Each picture is used once in the whole carousel**
(the creator spotted reused pictures in the first demo): plan ~8 DIFFERENT pictures per slide, ~35–40 for five.
**A person on Commons with the right name may be someone else** (the "Hiroshi Yamauchi" photo there is a diplomat):
check who it is. People and products missing from Commons: capture their real Wikipedia infobox
(`capture.mjs` job with `"selector": "table.infobox"`) and show it as a `focus_card` with the line marked — and note
in SOURCES.md that a portrait inside it may be a fair-use image. A named product or company gets its REAL logo
(`curl https://cdn.jsdelivr.net/npm/simple-icons@13.21.0/icons/<slug>.svg`, or its press kit). Plan ~8–10
pictures per slide: shape-matched sets for strobes (all clocks, all round speakers), one moving clip per slide or
more. Wikimedia throttles bursts: fetch only what you will use.

**1e · Treat everything** — copy the example's `prep.py` pattern (`new_carousel.py` put one in the project): ONE
treated file per raw picture, named like the raw (so it can't sneak into two beats); each still → `treat.py` look (teal / mono / warm / invert / natural, halftone, vignette) at 1188×1485, 4:5 cards for
collages and walls, glitch frames for datamoshes, clips → `clip.py` (1080×1350, 30 fps CFR, graded). Look at a
sheet of the results.

**1f · Build each slide** in `slides/NN/build.py` with the device library (`components/ec_devices.py`,
`reference/devices.md`). Every time comes from `Words('../../data/NN.words.json')` — never type a time. Study
`examples/nintendo-origin/slides/*/build.py` first: it is the reference carousel, beat by beat.

**1g · Music windows:** `SK/scripts/py SK/scripts/music_windows.py <project>` picks a 10 s window of the track per
slide (the drop lands on slide 1's second sentence). Adjust by hand if a slide needs the break or the drop elsewhere.

**1h · Render, look, fix:**
```
SK/scripts/py SK/scripts/render.py <project>            # build → lint → render → mix → mux → check, ~20 s a slide
SK/scripts/py SK/scripts/check_audio.py <project>       # every scripted word still heard over the bed and clicks
```
`render.py` also runs the reuse check ("REUSED picture …" = give that beat its own picture). Then LOOK at `out/contact-NN.jpg` (a frame every 0.5 s), `out/sheet.jpg` (frame 0 of every slide = the first thing
seen after a swipe) and `out/seams.jpg` (last frame | first frame). Check: the picture says what the voice says at
that moment; captions never collide with each other or the swipe cue; text stays 86 px from the sides and clear of
Instagram's counter (top right) and sound icon (bottom right); frame 0 of every slide reads. Fix → re-render only
that slide (`--only NN`, ~20 s). If the story states how long it took: `timer.py --claim N` before voicing that
slide, `timer.py --final` at the end, and re-voice if the real time went past the claim.

**1i · Deliver.** Open `preview.html` (swipe it, with sound). Give the user: the five `out/NN.mp4` paths in order, a
caption with the credit line (`SK/scripts/py SK/scripts/credits.py <project>`) and the time it took. **Never post or
upload**: the creator does that.

## 2 · The rules (they are the look)
0. **Each picture once.** One beat, one picture, never repeated anywhere in the carousel (render.py checks).
1. **Real material on every beat.** A real photo, clip, page, logo or a rebuilt UI fed real data. Typeset-only
   beats are rare: the black card, the typewriter, the end card.
2. **Every image is treated.** Nothing ships as it came (teal / mono / warm / invert / halftone + vignette).
3. **Every word on screen is the narrator's.** Captions are the spoken words at their onsets (±1 frame); a display
   word is a word they say; a title is the thing they name. No slogans, no invented numbers or UI.
4. **Calm, not frantic.** A new picture every ~1–1.5 s (a phrase each), a 4–8 %/s push on every hold, punch-ins on
   the stressed word, a rack focus on pages. At most one strobe per carousel; no datamosh unless the line is about
   something breaking; one red Didone word per carousel. (The creator on the first demo: "it's too much.")
5. **Sound = voice + music + photo clicks.** The default `sfx_profile: "clicks"` keeps ONE soft photo click per
   picture change (a tile reveal is one change, not nine) and nothing else: no swishes, impacts, glitches, risers or
   booms ("I like the clicks of the photography"). `"full"` restores Editor V1's whole sound grammar on request.
6. **The bed carries the cuts.** It runs from frame 0 ~5 LU under the voice and is CUT, not ducked: a full drop
   under the punchline (voice alone), the beat slamming back on the next line, pulled down under black cards.
7. **No emojis, no random humans** (a person only when they ARE the subject of the line), no AI-generated pictures.
8. **Carousel chrome:** slide 1 carries the SOUND ON pill (feeds autoplay muted) and its frame 0 is the cover;
   slides 1–4 end on the swipe cue in the tail; the last slide ends on the CTA end card. Every slide 1080×1350, 30 fps,
   same length; text inside the 3:4 grid crop.
9. **Rights:** pictures are PD / CC0 / CC BY(-SA) (credited in the caption) / Mixkit; the track is the creator's;
   the voice is Kokoro (Apache-2.0); the sounds are synthesised on each machine by `sfx_kit.py` (nothing to credit).

## 3 · Files
| file | what it does |
|---|---|
| `components/ec_devices.py` | the device library (Editor V1's devices on 1080×1350) + `Words`; writes HTML, GSAP and sound cues |
| `assets/tokens.css`, `assets/fonts/`, `assets/vendor/gsap.min.js` | the look (Editor V1 tokens re-solved for 4:5) |
| `scripts/new_carousel.py` | scaffold a project, convert the track, start the timer |
| `scripts/voice.py` | Kokoro narration per slide + word timings (faster-whisper), onsets snapped to the voice |
| `scripts/find_media.py`, `scripts/capture.mjs` | search + fetch real pictures/clips (credited), capture real pages |
| `scripts/treat.py`, `scripts/clip.py`, `scripts/clipsheet.py` | Editor V1's grades for stills and clips; clip sheets |
| `scripts/sfx_kit.py` | the sound kit: one file per role, its pre-roll and its level against the voice |
| `scripts/music_windows.py` | a window of the track per slide (the drop on the hook) |
| `scripts/mix.py` | voice + bed (automation) + cues → −14 LUFS, peaks < −1 dBFS |
| `scripts/render.py` | build → lint → HyperFrames render → mix → mux → check → contact sheets + preview.html |
| `scripts/check_audio.py`, `scripts/timer.py`, `scripts/credits.py` | intelligibility, honest timing, caption credits |
| `examples/nintendo-origin/` | the reference carousel (story, prep, five builds, sources, contact sheets) |
| `reference/` | `story.md` · `devices.md` · `sourcing.md` · `sound.md` |
