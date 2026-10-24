# Editor V1

Editor V1 is a self-hosted video editor that does post-production on its own. You upload raw footage. The engine scans every frame and listens to the audio. Then it writes an edit plan (an edit decision list, or EDL): sound effects, camera moves, transitions, contextual B-roll, a cinematic colour grade, animated titles and word-by-word captions. You can preview that plan live in the browser, change anything on the timeline, and render a finished MP4.

```
raw footage ─► frame scan ──┐
             ► audio scan ──┼─► planner ─► EDL ─► live preview / timeline edits ─► ffmpeg render ─► MP4
             ► speech (Whisper) ─► context ─► stock search (server-side keys) ─┘
```

## Quick start

```bash
cd editor-v1
npm install
cp .env.example .env        # add PEXELS_API_KEY and/or PIXABAY_API_KEY (optional)
npm start                   # → http://127.0.0.1:4317
```

You need:

| Tool | Why | Install |
|---|---|---|
| Node 22+ | server | nodejs.org |
| ffmpeg + ffprobe, built with libass and libx264 | analysis and render | `brew install ffmpeg` / `apt-get install ffmpeg` |
| Python 3.9+ with `faster-whisper` (optional) | word-level speech: drives B-roll, captions and emphasis | `python3 -m venv .venv && .venv/bin/pip install faster-whisper` |

Without Whisper, Editor V1 still grades the footage, adds camera moves on cuts, places whooshes on motion peaks and adds transitions. Captions and contextual B-roll need speech. The server finds a venv at `editor-v1/.venv` or `~/.engaging-carousel/venv` automatically. Otherwise set `WHISPER_PYTHON`.

Wikimedia Commons works with no key. Pexels and Pixabay are free keys and give much better stock results. Without a key, those providers are skipped.

## What the engine does

**1 · Frame-by-frame analysis** (`server/analysis/frames.js`). One ffmpeg pass over a 192 px proxy records four values for every frame:
- scene-change score;
- motion (`YDIF`, the luma change from the previous frame);
- exposure (`YAVG`);
- saturation (`SATAVG`).

Hard cuts come from an adaptive threshold (mean + 4σ, at least 0.28). Motion peaks are local maxima above mean + 1.5σ.

**2 · Audio analysis** (`server/analysis/audio.js`). A 20 ms RMS envelope gives three things: silences (natural pause points), onsets (sudden energy rises, which suit hits) and a waveform for the timeline.

**3 · Contextual analysis of speech** (`server/engine/keywords.js`). Whisper word timings are grouped into phrases. Each content word is scored for specificity (IDF across the clip), for being a proper noun, and for being concrete rather than abstract. That gives a stock query such as "playing cards" or "Kyoto". Idioms are mapped to a picture that fits ("give us a ring" → *phone call*, not jewellery). Emphasis words get picked from numbers, superlatives, a short list of strong words, and words spoken noticeably louder than the words around them.

**4 · Planning** (`server/engine/planner.js`). The Subtle, Balanced and Hype presets control density:
- **B-roll** goes on the most specific phrases, spaced apart and capped at 18 / 32 / 48 % of the runtime. Each insert gets an entrance (flash, pop card, slide, fade) and motion (push in, pull out, pan).
- **Camera moves:** eased punch-ins on emphasis words, alternating jump zooms and slow pushes on long phrases, and slow pushes between cuts when there's no speech.
- **Transitions** sit on the footage's own cuts: light flash, whip blur, zoom reveal.
- **Sound design** follows the picture: a whoosh into each transition, a photo click on each B-roll change, an impact under big punch-ins, and a pop or impact under titles. Effects are kept a minimum distance apart. They're synthesised locally (`server/engine/sfx.js`), so no licence is needed.
- **Animated titles:** the strongest emphasis words become big pop or slam callouts.
- **Captions:** word-by-word pop, karaoke or minimal styles, with emphasis words in red.

**5 · Automated colour grading** (`server/engine/grading.js`). Step one corrects exposure and saturation toward neutral, based on the frame scan. Step two applies a look: Teal & Orange, Hard Noir, Amber Archive, Bleach Bypass, Neon Noir or Natural. Strength runs from 0 to 1. On **Auto**, the look is picked from the footage: near-monochrome footage gets noir, dark footage gets neon, everything else gets teal & orange.

**6 · Render** (`server/engine/render.js`). The whole EDL becomes one ffmpeg `filter_complex`, in this order:
1. cover-crop to the output format (Source, 9:16, 4:5, 1:1 or 16:9);
2. grade;
3. `zoompan` camera curve;
4. flash and whip transitions;
5. graded B-roll overlays with motion and entrance animations;
6. libass captions and titles.

Effects are mixed in with `adelay` and `amix` under a limiter. "Preview render" is 960 px and ultrafast. "Render final" is up to 1920 px at CRF 19. B-roll credits are listed next to each render.

## The interface

A dark dashboard in modules:
- **Media bay:** upload footage, list of projects.
- **Autonomous engine:** intensity, module switches, output format, caption style, grade swatches and strength.
- **Stage:** a *Live plan* view that previews zooms, B-roll, flashes, titles, captions and SFX in real time without rendering. You can also switch to *Source* or *Render*.
- **Inspector:** edit any event. For B-roll, search stock media or upload your own file. There's also an Analysis tab with stats and the "contextual read" of each phrase, and a Renders tab.
- **Glass timeline:** frame-scan graph (scene score bars with the motion line on top), film strip, B-roll, camera, titles, SFX, caption words and the audio waveform.

Drag blocks to move them and drag their edges to trim. Changes save automatically.

Keys: `space` play/pause · `,` `.` step one frame · `Delete` disable/enable the selected event · `Esc` deselect.

## Security

- **API keys live only on the server.** They're read from the environment in `server/config.js` and used only in `server/media/providers.js`. The browser gets `{pexels: true}`-style flags and never a key. Integration tests check that a set key never appears in any response.
- The browser picks B-roll by an opaque **result id**. It never sends a URL. Downloads only go to an allowlist of provider CDN hosts over HTTPS, with a size cap. This prevents SSRF and keeps any keyed URL off the client.
- EDLs sent from the browser pass through `sanitiseEdl`: event types and fields are whitelisted, numbers are clamped to the clip, and text lengths are capped. ASS control characters are stripped before text reaches libass.
- ffmpeg and Python are always spawned with argument arrays, never through a shell.
- Project files are served only from `source.*`, `thumbs/`, `media/` and `renders/`. Ids are UUIDs and paths are resolved inside the project folder.
- Strict CSP (`script-src 'self'`), `nosniff`, `frame-ancestors 'none'`. The server binds to `127.0.0.1` by default. If you expose it beyond localhost, put it behind authentication. There are no user accounts yet.

## API

| Method | Path | |
|---|---|---|
| GET | `/api/capabilities` | providers available (booleans), presets, formats, SFX kinds |
| GET/POST | `/api/projects` | list / upload (`multipart`, field `video`) |
| GET/DELETE | `/api/projects/:id` | project, including EDL and media |
| PATCH | `/api/projects/:id/settings` | format, grade, intensity, modules… |
| POST | `/api/projects/:id/auto-edit` | job: analyse → plan → fetch B-roll (`{force}` re-analyses) |
| GET | `/api/projects/:id/analysis` | frame series, cuts, motion peaks, waveform, transcript |
| PUT | `/api/projects/:id/edl` | save an edited EDL (sanitised) |
| POST | `/api/projects/:id/media/search` · `/fetch` · `/upload` | stock search by query, assign a result by id, upload your own |
| POST | `/api/projects/:id/render` | job: `{quality: "preview" \| "final"}` |
| GET | `/api/jobs/:id/events` | progress over Server-Sent Events |

## Tests

```bash
npm test
```

The unit tests cover:
- frame-metadata parsing and cut detection;
- silences and onsets;
- keyword scoring and idioms;
- emphasis;
- planner limits (no overlaps, coverage cap, SFX spacing, module switches, footage with no speech);
- grade strength;
- ASS timing and escaping;
- EDL sanitising;
- render helpers.

The integration test builds a synthetic 6 s clip (three hard cuts, a tone with gaps). It uploads the clip, runs the whole auto-edit, edits the EDL, renders a 9:16 preview and checks the size, duration and audio. It also checks key handling, security headers and the path and SSRF guards.

## Layout

```
server/
  index.js            REST API + static UI
  config.js           env (secrets stay here)
  pipeline.js         auto-edit and render jobs
  jobs.js             job runner + SSE
  store.js            on-disk projects (data/projects/<uuid>/)
  analysis/           frames.js · audio.js · transcribe.{js,py}
  engine/             keywords · planner · grading · captions (ASS) · sfx · render · edl (sanitiser)
  media/providers.js  Pexels · Pixabay · Wikimedia Commons
public/               index.html · styles.css · js/{main,timeline,inspector,plan,api}.js
test/                 engine.test.js · integration.test.js
```
