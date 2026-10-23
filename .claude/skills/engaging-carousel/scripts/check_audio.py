"""Can people still hear every word? Re-transcribe each finished slide (voice + bed + clicks) and compare with the script.

  scripts/py scripts/check_audio.py <project>

Editor V1 learned this the hard way: a dense bed turned "a leak" into "illegal". A slide passes when every scripted
word is heard; spelling variants Whisper prefers (color/colour, 20/twenty, everyone/every one) are listed, not failed.
A real miss → pull the bed down under that phrase (c.bed(t0, t1, -3..-6) in its build.py) and re-render.
"""
import json, re, subprocess, sys, tempfile
from pathlib import Path

NUMBER_WORDS = set('zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million billion sixties seventies eighties nineties and'.split())
VARIANTS = {'colour': 'color', 'twenty': '20', 'every': 'everyone', 'one': 'everyone', 'okay': 'ok'}


def main():
    P = Path(sys.argv[1])
    from faster_whisper import WhisperModel
    m = WhisperModel('small.en', device='cpu', compute_type='int8')
    S = json.loads((P / 'story.json').read_text())
    norm = lambda s: re.sub(r"[^a-z0-9' ]", ' ', s.lower().replace('-', ' ')).split()
    bad = 0
    for s in S['slides']:
        mp4 = P / 'out' / f"{s['id']}.mp4"
        with tempfile.NamedTemporaryFile(suffix='.wav') as tmp:
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(mp4), '-ac', '1', '-ar', '16000', tmp.name], check=True)
            heard = ' '.join(x.text.strip() for x in m.transcribe(tmp.name, language='en', beam_size=5)[0])
        b = set(norm(heard)); digits = any(any(ch.isdigit() for ch in w) for w in b)
        from difflib import SequenceMatcher
        def heard_ok(w):
            if w in b or VARIANTS.get(w) in b: return True
            if w in NUMBER_WORDS and digits: return True        # "eighteen eighty-nine" is heard as "1889"
            return len(w) >= 5 and any(SequenceMatcher(None, w, h).ratio() >= 0.7 for h in b)   # names: "Yamachi"
        miss = [w for w in norm(s['say']) if not heard_ok(w)]
        bad += bool(miss)
        print(f"{s['id']}  {'OK  ' if not miss else 'MISS ' + str(miss)}  | heard: {heard}")
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
