"""A contact sheet of a clip (raw or graded) or of a folder of treated stills, to LOOK before using them.

  scripts/py scripts/clipsheet.py <video.mp4> [out.jpg] [--every 0.5]     a frame every 0.5 s
  scripts/py scripts/clipsheet.py <folder> [out.jpg]                       every .jpg/.png in a folder (e.g. media/use)
Default out: next to the input, <name>.sheet.jpg.
"""
import argparse, io, json, subprocess
from pathlib import Path
from PIL import Image, ImageDraw


def frames_of(video, every):
    d = float(json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', str(video)],
                                        capture_output=True, text=True).stdout)['format']['duration'])
    t, out = 0.0, []
    while t < d - 0.02:
        r = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-ss', f'{t}', '-i', str(video), '-vframes', '1', '-vf', 'scale=240:-2',
                            '-f', 'image2pipe', '-vcodec', 'png', '-'], capture_output=True)
        try: out.append((f'{t:.1f}s', Image.open(io.BytesIO(r.stdout)).convert('RGB')))
        except Exception: pass
        t += every
    return out


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('out', nargs='?'); ap.add_argument('--every', type=float, default=0.5)
    a = ap.parse_args(); src = Path(a.src)
    if src.is_dir():
        items = []
        for f in sorted(p for p in src.iterdir() if p.suffix.lower() in ('.jpg', '.jpeg', '.png')):
            im = Image.open(f).convert('RGB'); im.thumbnail((240, 300)); items.append((f.stem, im))
        out = Path(a.out or src / '_sheet.jpg')
    else:
        items = frames_of(src, a.every); out = Path(a.out or src.with_suffix('.sheet.jpg'))
    cols = 6; tw, th = 240, 300
    rows = (len(items) + cols - 1) // cols or 1
    S = Image.new('RGB', (cols * tw, rows * (th + 18)), (18, 18, 18)); d = ImageDraw.Draw(S)
    for i, (lab, im) in enumerate(items):
        x, y = (i % cols) * tw, (i // cols) * (th + 18)
        S.paste(im, (x + (tw - im.width) // 2, y + 18 + (th - im.height) // 2)); d.text((x + 4, y + 3), lab[:36], fill=(255, 220, 0))
    S.save(out, quality=85); print('sheet', out, f'({len(items)} frames)')


if __name__ == '__main__':
    main()
