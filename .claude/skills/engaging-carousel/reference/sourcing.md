# Finding the real material

For every phrase ask: **what real thing is this line about, and where does its own picture live?**

| need | where | how |
|---|---|---|
| a place, a building, an object, an old photo | Wikimedia Commons | `find_media.py "<thing>" <project>` (PD / CC0 / CC BY / CC BY-SA only) |
| space, rockets, Earth | NASA | `find_media.py "<thing>" <project> --src nasa` |
| motion (a city at night, falling rice, hands, traffic) | Mixkit | `find_media.py "<thing>" <project> --kind video` |
| a person or product missing from Commons | their real Wikipedia infobox | `capture.mjs` job with `"selector": "table.infobox"` → `focus_card` with the line marked |
| what a company still does today | the company's own page | `capture.mjs` job (`width`/`height` or `clip`) → `focus_card(light=True)` |
| a named company or product | its REAL logo | `curl -o media/logos/<slug>.svg https://cdn.jsdelivr.net/npm/simple-icons@13.21.0/icons/<slug>.svg` → `svg_mark` (or its press kit PNG → `img_mark`) |

## The loop
1. Search, then **LOOK at the contact sheet** (`media/search/<slug>.jpg`). Pick by eye, never by title.
2. `find_media.py --get <json> <index> <name> <project>`: the file lands in `media/raw/<name>.*` and its credit row
   in `SOURCES.md`. Name it for what it proves (`store_1889`, `dk_cabinet`), clips with a `v_` prefix.
3. Captures: add a `(capture)` row to SOURCES.md by hand, and note "portrait is a NON-FREE image (fair use)" when the
   infobox has one.

## Rules
- **Each picture once in the whole carousel.** Plan ~8 different pictures a slide, ~35–40 for five. render.py fails
  the reuse check otherwise.
- **The right name may be the wrong person.** A Commons photo titled "Hiroshi Yamauchi" is a diplomat. Check the
  description; when in doubt use the infobox capture.
- **Shape-matched sets for a strobe**: all the same kind of thing, similar framing (five consoles, all front-on).
- **One moving clip per slide or more.** Mixkit clips are 720p: crop to 4:5 with `clip.py --focus`.
- **No AI pictures, no random humans** (a person only when they ARE the subject of the line), no film stills or posters.
- Wikimedia throttles bursts (HTTP 429): fetch only what you will use; find_media backs off and fetches 2400 px
  renditions instead of huge originals.
- Look at the treated set (`clipsheet.py media/use`) before building.
