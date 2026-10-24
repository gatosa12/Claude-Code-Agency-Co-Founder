# The engaging carousel

A carousel that talks. Five 10-second 4:5 video slides that tell one story out loud: an open-source voice
(Kokoro) narrates, your own track runs under it, and every phrase is proven on screen by real photos and clips found
online, colour-graded and cut every second, with a click on every cut. It's the Editor V1 documentary edit, rebuilt
for Instagram carousels.

**One prompt:** `/engaging-carousel a carousel about <your topic>` → `out/01.mp4 … 05.mp4` + a swipe preview +
the caption credits. $0: everything runs on your computer (Claude Code + HyperFrames + Kokoro + ffmpeg).

**First time:** `bash .claude/skills/engaging-carousel/scripts/setup.sh` from the project folder (until it prints
"All set"). You'll be asked once for a background track you own the rights to.

What's inside: `SKILL.md` (the workflow Claude follows), `components/ec_devices.py` (the device library),
`scripts/` (voice, sourcing, treatments, sound kit, mixer, renderer, checks), `examples/nintendo-origin/`
(the reference carousel), `reference/` (story, devices, sourcing, sound).
