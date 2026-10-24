"""A 10 s window of the background track per slide → story.json music.windows {"01": start_s, ...}.

  scripts/py scripts/music_windows.py <project> [--print]

Slide 1: the track's biggest DROP (the largest jump in loudness) lands on the first word of slide 1's second sentence,
so the hook's turn hits with the beat. Slides 2+: the most even, energetic stretches left, each window used once
(no two slides share a second of the track when it is long enough), so every swipe starts on music that is
already moving. Adjust any window by hand in story.json if a slide needs the break or the drop elsewhere.
"""
import argparse, json, re, subprocess
from pathlib import Path
import numpy as np

SR = 8000


def load(path):
    raw = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(path), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('project'); ap.add_argument('--print', action='store_true')
    a = ap.parse_args(); P = Path(a.project)
    S = json.loads((P / 'story.json').read_text()); mu = S['music']
    y = load(P / mu['file']); total = len(y) / SR
    dur = float(S.get('slide_dur', 10.0)); ids = [s['id'] for s in S['slides']]
    hop = SR // 10                                                   # 100 ms
    rms = np.array([np.sqrt(np.mean(y[i:i + hop] ** 2) + 1e-12) for i in range(0, len(y) - hop, hop)])
    db = 20 * np.log10(rms + 1e-9)
    if total < dur + 0.5:
        raise SystemExit(f'the track is only {total:.1f}s: it needs at least {dur:.0f}s')
    # the drop: loudness after (1 s) minus before (1 s), biggest jump
    k = 10; gain = np.array([db[i:i + k].mean() - db[max(0, i - k):i].mean() if i >= k else -99 for i in range(len(db) - k)])
    drop = float(np.argmax(gain)) * 0.1
    # where slide 1's second sentence starts
    hit = 2.0
    wj = P / 'data' / f'{ids[0]}.words.json'
    if wj.exists():
        W = json.loads(wj.read_text())
        for i, w in enumerate(W[:-1]):
            if re.search(r'[.!?]$', w['w']): hit = W[i + 1]['s']; break
    win = {ids[0]: round(float(np.clip(drop - hit, 0, total - dur)), 2)}
    used = [(win[ids[0]], win[ids[0]] + dur)]
    # the rest: energetic + even windows, not overlapping what is used (when the track is long enough)
    starts = np.arange(0, total - dur, 0.5)
    def score(s):
        seg = db[int(s * 10):int((s + dur) * 10)]
        return seg.mean() - 0.5 * seg.std()
    ranked = sorted(starts, key=score, reverse=True)
    for sid in ids[1:]:
        pick = next((s for s in ranked if all(s + dur <= u0 or s >= u1 for u0, u1 in used)), None)
        if pick is None:                                            # short track: allow reuse, but not the same start
            pick = next(s for s in ranked if all(abs(s - u0) > 1.0 for u0, _ in used)) if len(ranked) > len(used) else ranked[0]
        win[sid] = round(float(pick), 2); used.append((pick, pick + dur))
    mu['windows'] = win
    (P / 'story.json').write_text(json.dumps(S, indent=1, ensure_ascii=False))
    print(f'track {total:.1f}s · drop at {drop:.2f}s → slide {ids[0]} hits it at {hit:.2f}s')
    for sid in ids: print(f'  {sid}: {win[sid]:6.2f}s → {win[sid] + dur:6.2f}s')


if __name__ == '__main__':
    main()
