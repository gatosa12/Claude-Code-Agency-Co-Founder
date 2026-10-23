"""Find real pictures and clips, LOOK at them, fetch the pick (credited automatically).

  scripts/py scripts/find_media.py "film splicer" <project> [--kind image|video] [--src commons|nasa|mixkit|all] [--n 24]
      → <project>/media/search/<slug>.json (the results) + <slug>.jpg (a numbered contact sheet: Read it, pick by eye)
  scripts/py scripts/find_media.py --get <project>/media/search/<slug>.json <index> <name> <project>
      → <project>/media/raw/<name>.<ext> + a row in <project>/SOURCES.md

Sources (all free to use, never an AI picture):
  commons  Wikimedia Commons: public domain, CC0, CC BY, CC BY-SA only (CC BY/BY-SA need the caption credit)
  nasa     images.nasa.gov: public domain
  mixkit   mixkit.co stock video (Mixkit Stock Video Free License), 720p
Defaults: --kind image searches commons + nasa; --kind video searches mixkit (+ commons video with --src all).
Wikimedia throttles bursts (HTTP 429) and big originals: --get fetches a 2400 px rendition, and backs off on 429.
"""
import argparse, html, io, json, os, re, sys, time, urllib.parse, urllib.request
from pathlib import Path

UA = 'EngagingCarousel/1.0 (local carousel tool; contact: none) python-urllib'
FREE = re.compile(r'(public domain|^pd|cc0|cc[- ]by|cc[- ]by-sa|no restrictions)', re.I)
NONFREE = re.compile(r'(\bnc\b|\bnd\b|fair use|non-free)', re.I)


def get(url, binary=False, tries=4):
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA if 'wikimedia' in url or 'wikipedia' in url else 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            return data if binary else data.decode('utf-8', 'replace')
        except urllib.error.HTTPError as e:
            if e.code == 429 and k < tries - 1:
                wait = 15 * (k + 1); print(f'  429 (rate limited), waiting {wait}s…', file=sys.stderr); time.sleep(wait); continue
            raise


def strip(s):
    return html.unescape(re.sub(r'<[^>]+>', '', s or '')).strip()


def slugify(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')[:60] or 'search'


# ------------------------------------------------------------------ sources
def commons(q, n, kind):
    ft = 'filetype:bitmap' if kind == 'image' else 'filetype:video'
    url = ('https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({
        'action': 'query', 'format': 'json', 'generator': 'search', 'gsrsearch': f'{q} {ft}', 'gsrnamespace': 6,
        'gsrlimit': min(50, n * 2), 'prop': 'imageinfo', 'iiprop': 'url|extmetadata|size|mime', 'iiurlwidth': 360}))
    pages = json.loads(get(url)).get('query', {}).get('pages', {})
    out = []
    for p in sorted(pages.values(), key=lambda p: p.get('index', 0)):
        ii = (p.get('imageinfo') or [{}])[0]; md = ii.get('extmetadata', {})
        lic = strip(md.get('LicenseShortName', {}).get('value', ''))
        if not lic or not FREE.search(lic) or NONFREE.search(lic):
            continue
        out.append({'src': 'commons', 'kind': kind, 'title': p['title'].replace('File:', ''), 'file': p['title'],
                    'author': strip(md.get('Artist', {}).get('value', ''))[:120], 'licence': lic,
                    'page': ii.get('descriptionurl', ''), 'thumb': ii.get('thumburl') or ii.get('url'),
                    'url': ii.get('url'), 'w': ii.get('width'), 'h': ii.get('height')})
        if len(out) >= n: break
    return out


def nasa(q, n):
    url = 'https://images-api.nasa.gov/search?' + urllib.parse.urlencode({'q': q, 'media_type': 'image'})
    items = json.loads(get(url)).get('collection', {}).get('items', [])[:n]
    out = []
    for it in items:
        d = (it.get('data') or [{}])[0]; nid = d.get('nasa_id', '')
        out.append({'src': 'nasa', 'kind': 'image', 'title': d.get('title', nid), 'author': d.get('photographer') or d.get('center') or 'NASA',
                    'licence': 'Public domain (NASA)', 'page': f'https://images.nasa.gov/details/{urllib.parse.quote(nid)}',
                    'thumb': (it.get('links') or [{}])[0].get('href'),
                    'url': f'https://images-assets.nasa.gov/image/{urllib.parse.quote(nid)}/{urllib.parse.quote(nid)}~orig.jpg',
                    'alt_url': f'https://images-assets.nasa.gov/image/{urllib.parse.quote(nid)}/{urllib.parse.quote(nid)}~large.jpg'})
    return out


def mixkit(q, n):
    page = get(f'https://mixkit.co/free-stock-video/discover/{slugify(q)}/')
    seen, out = set(), []
    for slug, vid in re.findall(r'/free-stock-video/([a-z0-9-]+)-(\d+)/', page):
        if vid in seen: continue
        seen.add(vid)
        out.append({'src': 'mixkit', 'kind': 'video', 'title': slug.replace('-', ' '), 'author': 'Mixkit',
                    'licence': 'Mixkit Stock Video Free License', 'page': f'https://mixkit.co/free-stock-video/{slug}-{vid}/',
                    'thumb': f'https://assets.mixkit.co/videos/{vid}/{vid}-thumb-360-0.jpg',
                    'url': f'https://assets.mixkit.co/videos/{vid}/{vid}-720.mp4'})
        if len(out) >= n: break
    return out


# ------------------------------------------------------------------ contact sheet
def sheet(results, path):
    from PIL import Image, ImageDraw
    cols, tw, th = 6, 240, 240
    rows = (len(results) + cols - 1) // cols or 1
    S = Image.new('RGB', (cols * tw, rows * (th + 34)), (18, 18, 18)); d = ImageDraw.Draw(S)
    for i, r in enumerate(results):
        x, y = (i % cols) * tw, (i // cols) * (th + 34)
        try:
            im = Image.open(io.BytesIO(get(r['thumb'], binary=True))).convert('RGB'); im.thumbnail((tw - 8, th - 8))
            S.paste(im, (x + (tw - im.width) // 2, y + (th - im.height) // 2))
        except Exception:
            d.text((x + 10, y + 100), '(no preview)', fill=(160, 160, 160))
        d.rectangle([x, y, x + 34, y + 20], fill=(255, 220, 0)); d.text((x + 4, y + 4), str(i), fill=(0, 0, 0))
        lab = f"{r['src']} · {r['licence'][:22]}"
        d.text((x + 4, y + th + 2), r['title'][:38], fill=(230, 230, 230)); d.text((x + 4, y + th + 17), lab, fill=(150, 150, 150))
    S.save(path, quality=85)


# ------------------------------------------------------------------ fetch + credit
def credit_row(P, name, r):
    f = P / 'SOURCES.md'
    if not f.exists():
        f.write_text('# Sources\n\nEvery real picture and clip in this carousel, with its licence. CC BY / CC BY-SA need the credit in '
                     'the post caption (or a comment).\n\n| file | title | author | licence | page | fetched |\n|---|---|---|---|---|---|\n')
    rows = [l for l in f.read_text().splitlines() if not l.startswith(f'| {name} |')]
    esc = lambda s: str(s or '').replace('|', '/').replace('\n', ' ')
    rows.append(f"| {name} | {esc(r['title'])} | {esc(r['author'])} | {esc(r['licence'])} | {r['page']} | {time.strftime('%Y-%m-%d')} |")
    f.write_text('\n'.join(rows) + '\n')


def fetch(js, idx, name, P):
    r = json.loads(Path(js).read_text())['results'][int(idx)]
    url = r['url']
    if r['src'] == 'commons' and r.get('kind') == 'image' and (r.get('w') or 0) > 2400:
        q = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({'action': 'query', 'format': 'json', 'titles': r['file'],
                                                                                 'prop': 'imageinfo', 'iiprop': 'url', 'iiurlwidth': 2400})
        p = next(iter(json.loads(get(q))['query']['pages'].values()))
        url = p['imageinfo'][0].get('thumburl') or url
    ext = os.path.splitext(urllib.parse.urlparse(url).path)[1].lower() or ('.mp4' if r['kind'] == 'video' else '.jpg')
    if r['kind'] == 'video' and r['src'] == 'mixkit':
        ext = '.mp4'
    try:
        data = get(url, binary=True)
    except urllib.error.HTTPError:
        if not r.get('alt_url'): raise
        data = get(r['alt_url'], binary=True)
    raw = P / 'media' / 'raw'; raw.mkdir(parents=True, exist_ok=True)
    for old in raw.glob(f'{name}.*'): old.unlink()
    out = raw / f'{name}{ext}'; out.write_bytes(data)
    credit_row(P, name, r)
    print(f'saved {out} ({len(data) // 1024} KB) · {r["licence"]} · credited in SOURCES.md')


def main():
    if len(sys.argv) > 1 and sys.argv[1] == '--get':
        if len(sys.argv) != 6: sys.exit('usage: find_media.py --get <search.json> <index> <name> <project>')
        return fetch(sys.argv[2], sys.argv[3], sys.argv[4], Path(sys.argv[5]))
    ap = argparse.ArgumentParser(); ap.add_argument('query'); ap.add_argument('project')
    ap.add_argument('--kind', default='image', choices=['image', 'video']); ap.add_argument('--src', default=None)
    ap.add_argument('--n', type=int, default=24)
    a = ap.parse_args(); P = Path(a.project)
    src = a.src or ('mixkit' if a.kind == 'video' else 'commons+nasa')
    res = []
    if 'commons' in src or src == 'all': res += commons(a.query, a.n, a.kind)
    if a.kind == 'image' and ('nasa' in src or src == 'all'): res += nasa(a.query, max(6, a.n // 3))
    if a.kind == 'video' and ('mixkit' in src or src == 'all'): res += mixkit(a.query, a.n)
    d = P / 'media' / 'search'; d.mkdir(parents=True, exist_ok=True)
    slug = slugify(f'{a.query}-{a.kind}')
    (d / f'{slug}.json').write_text(json.dumps({'query': a.query, 'kind': a.kind, 'results': res}, indent=1))
    if res: sheet(res, d / f'{slug}.jpg')
    for i, r in enumerate(res):
        print(f"{i:2d}  {r['src']:7s} {r['licence'][:26]:26s} {r['title'][:70]}")
    print(f'\n{len(res)} results → {d / (slug + ".json")}\nLOOK at the sheet: {d / (slug + ".jpg")}')


if __name__ == '__main__':
    main()
