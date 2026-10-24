"""Editor V1's grades for moving footage: a raw clip → 1080x1350, 30 fps CFR, graded, silent, ready for broll().

  scripts/py scripts/clip.py <raw.mp4> <out.mp4> [--ss 1.0] [--dur 2.0] [--look teal] [--focus 0.5,0.5] [--vignette 0.7]

look   teal · mono · warm · invert · natural (the same family as treat.py, done in ffmpeg)
focus  where the 4:5 crop centres, as fractions of the frame (0.5,0.5 = the middle)
Keep clips short (1-2.5 s): a beat is a phrase. Look at it with clipsheet.py.
"""
import argparse, json, subprocess, sys

GRADES = {
    'natural': 'eq=contrast=1.06:saturation=1.05:gamma=0.98',
    'teal': 'eq=saturation=0.8:contrast=1.12,colorbalance=rs=-0.12:gs=0.0:bs=0.10:rm=-0.04:bm=0.03:rh=0.08:gh=0.03:bh=-0.06',
    'mono': 'hue=s=0,eq=contrast=1.4:brightness=-0.02',
    'warm': 'colorchannelmixer=.55:.42:.13:0:.40:.42:.11:0:.24:.30:.10,eq=contrast=1.12:gamma=0.97',
    'invert': 'eq=contrast=1.08,negate',
}


def probe(path):
    o = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration',
                        '-of', 'json', str(path)], capture_output=True, text=True, check=True).stdout
    j = json.loads(o); s = j['streams'][0]
    return int(s['width']), int(s['height']), float(j['format'].get('duration', 0) or 0)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('out')
    ap.add_argument('--ss', type=float, default=0.0); ap.add_argument('--dur', type=float, default=2.0)
    ap.add_argument('--look', default='natural', choices=list(GRADES)); ap.add_argument('--focus', default='0.5,0.5')
    ap.add_argument('--vignette', type=float, default=0.7)
    a = ap.parse_args()
    W, H, D = probe(a.src)
    if D and a.ss + a.dur > D + 0.05:
        sys.exit(f'{a.src} is only {D:.2f}s long: --ss {a.ss} --dur {a.dur} runs past its end')
    fx, fy = (float(v) for v in a.focus.split(','))
    cw, ch = (W, round(W * 1.25)) if W * 1.25 <= H else (round(H * 0.8), H)
    cw -= cw % 2; ch -= ch % 2
    x = int(min(max(fx * W - cw / 2, 0), W - cw)); y = int(min(max(fy * H - ch / 2, 0), H - ch))
    vf = [f'crop={cw}:{ch}:{x}:{y}', 'scale=1080:1350:flags=lanczos', 'fps=30', GRADES[a.look]]
    if a.vignette and a.vignette < 1:
        vf.append(f'vignette=angle={(1 - a.vignette) * 1.6:.3f}')
    vf.append('format=yuv420p')
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-ss', f'{a.ss}', '-i', a.src, '-t', f'{a.dur}', '-an',
                    '-vf', ','.join(vf), '-r', '30', '-fps_mode', 'cfr', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16',
                    '-g', '15', '-movflags', '+faststart', a.out], check=True)
    print('clip', a.out, f'{a.dur:.2f}s', a.look)


if __name__ == '__main__':
    main()
