# What is original and what was rebuilt

Only part of the NextPhase kit arrived for this install (single-file uploads; the subfolders never came through).
The missing pieces were rebuilt to match how the original files call them. If you get the full kit later, the
original files can replace these one for one (same names, same command-line interfaces).

**Original NextPhase files** (unchanged unless noted):
`SKILL.md`, `README.md` (setup path updated), `LICENSES.md` (sound line updated), `components/ec_devices.py`,
`assets/tokens.css`, `assets/vendor/gsap.min.js`, `assets/fonts/{Inter-600,Inter-700,Arimo-700,BodoniModa-700}.woff2`,
`scripts/{new_carousel,voice,render,mix,check_audio}.py` (`new_carousel.py`: now points new projects at wherever this
skill is installed, instead of assuming `~/.claude/skills/`),
`examples/nintendo-origin/{story.json,prep.py,SOURCES.md}`, `examples/nintendo-origin/out/` (the reference contact sheets;
slide 04's full sheet was never sent).

**Rebuilt for this install:**
- `scripts/setup.sh`, `scripts/py`, `scripts/selftest.py`
- `scripts/treat.py`, `scripts/clip.py`, `scripts/clipsheet.py` (the five looks: teal / mono / warm / invert / natural)
- `scripts/find_media.py`, `scripts/capture.mjs` (Wikimedia Commons, NASA, Mixkit; real page captures)
- `scripts/sfx_kit.py`: the clicks are **synthesised locally** (no Mixkit downloads), so there is nothing to license
- `scripts/music_windows.py`, `scripts/timer.py`, `scripts/credits.py`
- `reference/{story,devices,sourcing,sound}.md`
- `examples/nintendo-origin/slides/01-05/build.py` (rebuilt beat by beat from the reference contact sheets)
- the four open fonts setup.sh downloads (`Inter-900`, `PlayfairDisplay-Italic-Var-latin/-latinext`, `JetBrainsMono-400`, SIL OFL)
