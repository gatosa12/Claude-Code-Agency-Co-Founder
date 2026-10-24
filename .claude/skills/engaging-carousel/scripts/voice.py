"""The narrator: Kokoro-82M (Apache-2.0, open source, runs on this computer) speaks each slide's line,
then faster-whisper times every word so the captions and the cuts land on the voice.

  scripts/py scripts/voice.py <project>              every slide → audio/vo/NN.wav + data/NN.words.json
  scripts/py scripts/voice.py <project> --only 05    one slide (e.g. after the timed run fills in the minutes)
  scripts/py scripts/voice.py --list                 voices that narrate well

Reads <project>/story.json:
  {"voice": "am_michael", "speed": 1.04, "slide_dur": 10.0, "lead": 0.10, "gap": 0.16,
   "slides": [{"id": "01", "say": "Wait. This carousel is talking to you. ..."}, ...]}
One slide = one line of the story. Sentences are spoken one by one and joined with `gap` seconds of
silence (a "?" or a one-word sentence gets a little more), the first word starts at `lead`.
data/NN.words.json = [{"w": "Wait.", "s": 0.10, "e": 0.42}, ...] in the SCRIPT's spelling.
Write numbers the way they are SAID ("twenty three minutes"); the screen text is the build's job.
"""
import argparse, json, os, re, subprocess, sys
from difflib import SequenceMatcher
from pathlib import Path
import numpy as np

HOME = Path(os.environ.get('EC_HOME', Path.home() / '.engaging-carousel'))
KDIR = HOME / 'kokoro'
FILES = {
    'kokoro-v1.0.onnx': 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx',
    'voices-v1.0.bin': 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin',
}
GOOD = {
    'am_michael': 'US male, steady documentary narrator (default)', 'am_fenrir': 'US male, deeper',
    'am_onyx': 'US male, low and close', 'am_puck': 'US male, lively', 'bm_george': 'UK male, documentary',
    'bm_fable': 'UK male, storyteller', 'af_heart': 'US female, warm, the best overall', 'af_bella': 'US female, bright',
    'af_nicole': 'US female, soft/close', 'bf_emma': 'UK female, calm',
}
SR = 24000
norm = lambda w: re.sub(r'[^a-z0-9]+', '', w.lower())


def ensure_models():
    KDIR.mkdir(parents=True, exist_ok=True)
    for name, url in FILES.items():
        p = KDIR / name
        if p.exists() and p.stat().st_size > 1_000_000:
            continue
        for sib in ('.faceless-videos', '.vox-style-video'):          # a sibling skill already downloaded it
            other = Path.home() / sib / 'kokoro' / name
            if other.exists() and other.stat().st_size > 1_000_000 and not p.exists():
                try: p.symlink_to(other)
                except OSError: pass
        if p.exists():
            continue
        import urllib.request
        print(f'downloading {name} (once)…', flush=True)
        tmp = p.with_suffix('.part'); urllib.request.urlretrieve(url, tmp); tmp.rename(p)


def trim(a):
    nz = np.where(np.abs(a) > 0.01)[0]
    return a[max(0, nz[0] - int(0.02 * SR)): nz[-1] + int(0.06 * SR)] if len(nz) else a


def sentences(text):
    return [s for s in (p.strip() for p in re.split(r'(?<=[.!?…])\s+', ' '.join(text.split()))) if s]


def respell(text, pron):
    """story.json "pronounce": {"Yokoi": "Yoh-koy"} — the narrator says the respelling, the captions keep the real
    spelling. Kokoro is an English voice: foreign names come out anglicised until respelled (test one with
    check_audio.py: Whisper hearing the right name back is the test). Keep each respelling ONE word (hyphens, no spaces)."""
    for real, said in (pron or {}).items():
        text = re.sub(rf'(?<![\w-]){re.escape(real)}(?![\w-])', said, text)
    return text


def speak(k, text, voice, speed, lead, gap, pron=None):
    out = [np.zeros(int(lead * SR), np.float32)]
    for s in sentences(respell(text, pron)):
        a, _ = k.create(s, voice=voice, speed=speed, lang='en-gb' if voice[:1] == 'b' else 'en-us')
        out.append(trim(np.asarray(a, np.float32)))
        g = gap + (0.10 if s.endswith('?') or len(s.split()) == 1 else 0.0)
        out.append(np.zeros(int(g * SR), np.float32))
    y = np.concatenate(out[:-1])                       # no gap after the last sentence
    return y / max(1e-6, np.abs(y).max()) * 0.89


def write_wav(path, y):
    path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-',
                    '-ar', '48000', '-ac', '2', str(path)], input=(y * 32767).astype('<i2').tobytes(), check=True)


def align(model, wav, script_text, dur):
    segs, _ = model.transcribe(str(wav), language='en', word_timestamps=True, beam_size=5, vad_filter=False,
                               condition_on_previous_text=False)
    heard = [{'w': w.word.strip(), 's': round(w.start, 3), 'e': round(w.end, 3)} for s in segs for w in (s.words or []) if norm(w.word)]
    sw = [w for w in script_text.split() if norm(w)]
    A, B = [norm(w) for w in sw], [norm(w['w']) for w in heard]
    times = [None] * len(sw)
    ops = SequenceMatcher(None, A, B, autojunk=False).get_opcodes()
    for tag, i1, i2, j1, j2 in ops:
        if tag == 'equal':
            for k in range(i2 - i1): times[i1 + k] = (heard[j1 + k]['s'], heard[j1 + k]['e'])
        elif tag == 'replace':                          # "20" vs "twenty": share the heard span by length
            t0, t1 = heard[j1]['s'], heard[j2 - 1]['e']
            L = [max(1, len(A[i])) for i in range(i1, i2)]; tot = sum(L); c = 0
            for k, n in enumerate(L):
                times[i1 + k] = (round(t0 + (t1 - t0) * c / tot, 3), round(t0 + (t1 - t0) * (c + n) / tot, 3)); c += n
    i = 0
    while i < len(sw):                                  # words Whisper missed share the gap between neighbours
        if times[i] is None:
            j = i
            while j < len(sw) and times[j] is None: j += 1
            t0 = times[i - 1][1] if i > 0 else 0.0
            t1 = times[j][0] if j < len(sw) else dur
            for k in range(j - i):
                times[i + k] = (round(t0 + (t1 - t0) * k / (j - i), 3), round(t0 + (t1 - t0) * (k + 1) / (j - i), 3))
            i = j
        else:
            i += 1
    exact = sum(i2 - i1 for tag, i1, i2, *_ in ops if tag == 'equal')
    return [{'w': w, 's': s, 'e': e} for w, (s, e) in zip(sw, times)], exact, len(sw)


def snap_onsets(words, y, sr=SR, thr_db=-38.0):
    """Whisper stamps a word that follows a pause too early (the first word at 0.00, "Hours" on top of
    the word before it). Move every onset that sits in silence forward to where the voice starts again,
    within 0.25 s, and keep onsets strictly increasing. Captions must land on the voice, +-1 frame."""
    hop = sr // 200                                   # 5 ms
    env = np.array([np.sqrt(np.mean(y[i:i + hop] ** 2) + 1e-12) for i in range(0, len(y) - hop, hop)])
    db = 20 * np.log10(env / (env.max() + 1e-9))
    loud = db > thr_db
    out, prev = [], -1.0
    for w in words:
        s = w['s']; i = int(s * 200)
        if i < len(loud) and not loud[i]:
            j = i
            while j < len(loud) and not loud[j] and (j - i) < 50: j += 1
            if j < len(loud) and loud[j]: s = j / 200
        s = max(s, prev + 0.04)
        out.append({**w, 's': round(s, 3), 'e': round(max(w['e'], s + 0.05), 3)}); prev = s
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project', nargs='?')
    ap.add_argument('--only', nargs='*', help='slide ids to (re)make')
    ap.add_argument('--list', action='store_true')
    a = ap.parse_args()
    if a.list:
        for v, d in GOOD.items(): print(f'{v:12s} {d}')
        print('(all 50+ voices: https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md)'); return
    if not a.project:
        sys.exit('usage: voice.py <project> [--only 01 02]')
    P = Path(a.project); cfg = json.loads((P / 'story.json').read_text())
    ensure_models()
    from kokoro_onnx import Kokoro
    from faster_whisper import WhisperModel
    k = Kokoro(str(KDIR / 'kokoro-v1.0.onnx'), str(KDIR / 'voices-v1.0.bin'))
    wm = WhisperModel(cfg.get('whisper', 'small.en'), device='cpu', compute_type='int8')
    voice, speed = cfg.get('voice', 'am_michael'), float(cfg.get('speed', 1.04))
    lead, gap, sdur = float(cfg.get('lead', 0.10)), float(cfg.get('gap', 0.16)), float(cfg.get('slide_dur', 10.0))
    tail_min = float(cfg.get('tail', 1.2))
    for s in cfg['slides']:
        if a.only and s['id'] not in a.only:
            continue
        y = speak(k, s['say'], s.get('voice', voice), float(s.get('speed', speed)), lead, gap, cfg.get('pronounce'))
        wav = P / 'audio/vo' / f"{s['id']}.wav"; write_wav(wav, y)
        dur = len(y) / SR
        words, exact, n = align(wm, wav, s['say'], dur)
        words = snap_onsets(words, y)
        (P / 'data').mkdir(exist_ok=True)
        (P / 'data' / f"{s['id']}.words.json").write_text(json.dumps(words, indent=0))
        room = s.get('dur', sdur) - dur
        flag = '' if room >= tail_min else f'   <-- TOO LONG: only {room:.2f}s left for the tail (want >= {tail_min}s); cut words or raise "dur"'
        print(f"{s['id']}  voice {dur:5.2f}s  in a {s.get('dur', sdur):.1f}s slide  words {exact}/{n} exact{flag}", flush=True)


if __name__ == '__main__':
    main()
