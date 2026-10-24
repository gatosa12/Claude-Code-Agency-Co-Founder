"""Build, render, mix and check every slide → out/NN.mp4 (1080x1350, 30 fps, H.264 + AAC), ready to post as one carousel.

  scripts/py scripts/render.py <project>                 every slide: build → kit → lint → render → mix → mux → check
  scripts/py scripts/render.py <project> --only 03       one slide
  scripts/py scripts/render.py <project> --no-render     rebuild + remix only (re-muxes the last silent render)
  scripts/py scripts/render.py <project> --sheets        contact sheets + preview.html only

Each slide is its own HyperFrames project in slides/NN/ (build.py writes index.html + cues.json there), so one
broken slide never blocks the rest. Files the page references (media/..., assets/...) are hard-linked in from the
project and the skill, so a slide folder renders on its own.
Writes: out/NN.mp4 · out/contact-NN.jpg (a frame every 0.5 s) · out/sheet.jpg (frame 0 of every slide = what
people see after a swipe) · out/seams.jpg (last frame | first frame) · preview.html (swipe it, with sound).
"""
import argparse, json, os, re, shutil, subprocess, sys, time
from pathlib import Path

SK = Path(__file__).resolve().parent.parent
HF = os.environ.get('EC_HYPERFRAMES', 'hyperframes@0.8.185')
NODE_PATH = [str(Path.home() / '.nvm/versions/node/v24.18.0/bin'), str(Path.home() / '.local/bin')]
ENV = {**os.environ, 'PATH': ':'.join(NODE_PATH + [os.environ.get('PATH', '')])}
PY = str(SK / 'scripts/py')


def run(cmd, **kw):
    return subprocess.run(cmd, env=ENV, **kw)


def link(src, dst):
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        if dst.stat().st_mtime >= src.stat().st_mtime and dst.stat().st_size == src.stat().st_size:
            return
        dst.unlink()
    try: os.link(src, dst)
    except OSError: shutil.copy2(src, dst)


def kit_slide(P, sd):
    """copy the skill's assets and every media file index.html references into the slide folder"""
    for f in (SK / 'assets').rglob('*'):
        if f.is_file(): link(f, sd / 'assets' / f.relative_to(SK / 'assets'))
    html = (sd / 'index.html').read_text()
    missing = []
    for ref in sorted(set(re.findall(r'(?:src|href)="((?:media|img|clips)/[^"]+)"', html))):
        src = P / ref
        if src.exists(): link(src, sd / ref)
        else: missing.append(ref)
    if missing:
        sys.exit(f'{sd.name}: missing files referenced by index.html: {missing}')


def probe(path):
    o = run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,nb_frames:format=duration',
             '-of', 'json', str(path)], capture_output=True, text=True).stdout
    j = json.loads(o); s = j['streams'][0]
    return int(s['width']), int(s['height']), s['r_frame_rate'], float(j['format']['duration']), int(s.get('nb_frames') or 0)


def sheets(P, ids):
    from PIL import Image, ImageDraw
    out = P / 'out'; tops, seams = [], []
    for sid in ids:
        mp4 = out / f'{sid}.mp4'
        if not mp4.exists(): continue
        dur = probe(mp4)[3]; n = int(dur / 0.5)
        frames = []
        for k in range(n + 1):
            t = min(k * 0.5, dur - 0.04)
            r = run(['ffmpeg', '-nostdin', '-v', 'error', '-ss', f'{t}', '-i', str(mp4), '-vframes', '1', '-vf', 'scale=216:270', '-f', 'image2pipe', '-vcodec', 'png', '-'], capture_output=True)
            from io import BytesIO
            try: frames.append((t, Image.open(BytesIO(r.stdout)).convert('RGB')))
            except Exception: pass
        cols = 7; rows = (len(frames) + cols - 1) // cols
        S = Image.new('RGB', (cols * 216, rows * 290), (18, 18, 18)); d = ImageDraw.Draw(S)
        for i, (t, im) in enumerate(frames):
            x, y = (i % cols) * 216, (i // cols) * 290; S.paste(im, (x, y + 20)); d.text((x + 4, y + 4), f'{sid}  {t:.1f}s', fill=(255, 220, 0))
        S.save(out / f'contact-{sid}.jpg', quality=82)
        if frames:
            tops.append(frames[0][1])
            r = run(['ffmpeg', '-nostdin', '-v', 'error', '-sseof', '-0.05', '-i', str(mp4), '-vframes', '1', '-vf', 'scale=216:270', '-f', 'image2pipe', '-vcodec', 'png', '-'], capture_output=True)
            try: seams.append((Image.open(BytesIO(r.stdout)).convert('RGB'), frames[0][1]))
            except Exception: pass
    if tops:
        S = Image.new('RGB', (len(tops) * 226, 280), (18, 18, 18))
        for i, im in enumerate(tops): S.paste(im, (i * 226 + 5, 5))
        S.save(out / 'sheet.jpg', quality=85)
    if seams:
        S = Image.new('RGB', (len(seams) * 446, 280), (18, 18, 18))
        for i, (a, b) in enumerate(seams): S.paste(a, (i * 446 + 5, 5)); S.paste(b, (i * 446 + 225, 5))
        S.save(out / 'seams.jpg', quality=85)
    preview(P, ids)


def reuse_check(P, ids):
    """Each real picture once: a picture (its treated name, card_/_gN variants folded in) may appear in ONE beat of ONE
    slide. The creator noticed reused pictures in the first carousel; this makes it a check, not a hope."""
    seen = {}
    for sid in ids:
        f = P / 'slides' / sid / 'index.html'
        if not f.exists(): continue
        for line in f.read_text().splitlines():          # Comp.write puts every clip on its own line
            m = re.search(r'class="clip[^"]*"[^>]*data-start="([\d.]+)"', line) or re.search(r'data-start="([\d.]+)"[^>]*class="clip', line)
            if not m: continue
            for src in set(re.findall(r'src="media/(?:use|clips)/([^"]+)\.(?:jpg|png|mp4)"', line)):
                base = re.sub(r'^card_|_g\d$', '', src)
                seen.setdefault(base, []).append((sid, float(m.group(1))))
    bad = []
    for base, uses in seen.items():
        slides = {u[0] for u in uses}; ts = [u[1] for u in uses]
        if len(slides) > 1 or max(ts) - min(ts) > 0.5:
            bad.append(base); print(f'REUSED picture "{base}": ' + ', '.join(f'{a} @{t:.2f}s' for a, t in sorted(set(uses))))
    return not bad


def preview(P, ids):
    cfg = json.loads((P / 'story.json').read_text())
    vids = ''.join(f'<div class="s"><video src="out/{sid}.mp4" playsinline loop preload="auto"></video></div>' for sid in ids if (P / 'out' / f'{sid}.mp4').exists())
    (P / 'preview.html').write_text(f'''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{cfg.get("title", "carousel")} — preview</title>
<style>body{{margin:0;background:#111;color:#eee;font:15px system-ui;display:flex;flex-direction:column;align-items:center;gap:14px;padding:24px}}
.row{{width:min(432px,92vw);aspect-ratio:4/5;overflow-x:auto;scroll-snap-type:x mandatory;display:flex;border-radius:6px;background:#000}}
.s{{flex:0 0 100%;scroll-snap-align:start}} video{{width:100%;height:100%;display:block}} .dots{{display:flex;gap:6px}} .dots i{{width:6px;height:6px;border-radius:50%;background:#555}} .dots i.on{{background:#3897f0}}
button{{background:#3897f0;color:#fff;border:0;border-radius:8px;padding:8px 14px;font-weight:600}}</style></head><body>
<div>{cfg.get("title", "")} — swipe; tap play once to allow sound</div>
<div class="row" id="row">{vids}</div><div class="dots" id="dots"></div><button id="go">play with sound</button>
<script>const row=document.getElementById('row'),vs=[...row.querySelectorAll('video')],dots=document.getElementById('dots');
vs.forEach(()=>dots.appendChild(document.createElement('i')));let cur=-1,armed=false;
function show(i){{if(i===cur)return;cur=i;vs.forEach((v,k)=>{{if(k===i){{v.currentTime=0;v.muted=!armed;v.play().catch(()=>{{}})}}else v.pause()}});
[...dots.children].forEach((d,k)=>d.className=k===i?'on':'')}}
row.addEventListener('scroll',()=>show(Math.round(row.scrollLeft/row.clientWidth)));
document.getElementById('go').onclick=()=>{{armed=true;cur=-1;show(Math.round(row.scrollLeft/row.clientWidth))}};show(0);</script></body></html>''')


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('project'); ap.add_argument('--only', nargs='*')
    ap.add_argument('--no-render', action='store_true'); ap.add_argument('--sheets', action='store_true')
    ap.add_argument('--kit', default=None); ap.add_argument('--workers', default='2')
    a = ap.parse_args(); P = Path(a.project).resolve()
    cfg = json.loads((P / 'story.json').read_text())
    ids = [s['id'] for s in cfg['slides']]
    todo = a.only or ids
    if a.sheets:
        sheets(P, ids); return
    (P / 'out').mkdir(exist_ok=True)
    for sid in todo:
        sd = P / 'slides' / sid; t0 = time.time()
        r = run([PY, str(sd / 'build.py')], cwd=sd, capture_output=True, text=True)
        if r.returncode:
            print(r.stdout[-2000:], r.stderr[-3000:]); sys.exit(f'{sid}: build.py failed')
        kit_slide(P, sd)
        silent = P / 'out' / f'.{sid}_silent.mp4'
        if not a.no_render or not silent.exists():
            lint = run(['npx', '--yes', HF, 'lint', str(sd)], capture_output=True, text=True)
            errs = re.findall(r'(\d+) error', lint.stdout + lint.stderr)
            if errs and int(errs[0]) > 0:
                print(lint.stdout[-3000:], lint.stderr[-2000:]); sys.exit(f'{sid}: lint errors')
            r = run(['npx', '--yes', HF, 'render', str(sd), '-o', str(silent), '-f', '30', '-q', 'delivery', '--workers', a.workers, '--quiet'],
                    capture_output=True, text=True)
            if r.returncode or not silent.exists():
                print(r.stdout[-3000:], r.stderr[-3000:]); sys.exit(f'{sid}: render failed')
        mx = run([PY, str(SK / 'scripts/mix.py'), str(P), sid] + (['--kit', a.kit] if a.kit else []), capture_output=True, text=True)
        if mx.returncode:
            print(mx.stdout, mx.stderr[-3000:]); sys.exit(f'{sid}: mix failed')
        print(mx.stdout.strip().splitlines()[-1])
        dst = P / 'out' / f'{sid}.mp4'
        run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', str(silent), '-i', str(P / 'audio/mix' / f'{sid}.wav'),
             '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
             '-r', '30', '-g', '30', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
             '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest', '-movflags', '+faststart', str(dst)], check=True)
        w, h, fps, dur, nf = probe(dst)
        want = float(json.loads((sd / 'cues.json').read_text())['dur'])
        ok = (w, h) == (1080, 1350) and fps in ('30/1',) and abs(dur - want) < 0.07
        print(f'{sid}: {w}x{h} {fps} {dur:.2f}s ({nf} frames) {"OK" if ok else "<-- CHECK"}  {time.time() - t0:.0f}s')
    sheets(P, ids)
    if reuse_check(P, ids): print('reuse check: every picture appears once')
    print(f'preview: {P / "preview.html"}')


if __name__ == '__main__':
    main()
