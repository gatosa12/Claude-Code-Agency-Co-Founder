"""prep.py — her own interview as the narration: voice + word timings cut from the clips, graded footage kept in lip
sync, treated stills. Run from this folder:  <skill>/scripts/py prep.py

This carousel swaps Kokoro for the real speaker (she IS the subject), so voice.py is not used: audio/vo/NN.wav and
data/NN.words.json come straight from the interview audio and its Whisper word timings (data/transcripts.json).
Every graded clip of a slide starts `lead` s before her first word, so broll(..., media_start=t) stays in sync.
"""
import json, os, subprocess, sys
SK = os.path.abspath('../../.claude/skills/engaging-carousel')
sys.path.insert(0, f'{SK}/scripts')
from treat import treat
from voice import snap_onsets
import soundfile as sf
from faster_whisper import WhisperModel
WM = WhisperModel('small.en', device='cpu', compute_type='int8')

S = json.load(open('story.json')); T = json.load(open('data/transcripts.json'))
LEAD = S['lead']; R, U, C = 'media/raw', 'media/use', 'media/clips'
os.makedirs(U, exist_ok=True); os.makedirs(C, exist_ok=True); os.makedirs('audio/vo', exist_ok=True)
run = lambda *a: subprocess.run([str(x) for x in a], check=True)

# 1 · her voice + word timings per slide
for sid, (src, t0, t1) in S['source_voice'].items():
    run('ffmpeg', '-nostdin', '-v', 'error', '-y', '-ss', t0, '-t', t1 - t0, '-i', f'{R}/{src}.mp4',
        '-af', f'adelay={int(LEAD * 1000)}:all=1,afade=t=in:d=0.02,afade=t=out:st={t1 - t0 + LEAD - 0.05:.3f}:d=0.05,highpass=f=80',
        '-ac', '2', '-ar', '48000', f'audio/vo/{sid}.wav')
    # Whisper on the SHORT cut hears her better than on the whole interview (it caught "three that kind of come",
    # which the long pass wrote as "the three that come"): the captions are what she really says
    segs, _ = WM.transcribe(f'audio/vo/{sid}.wav', language='en', word_timestamps=True, beam_size=5, condition_on_previous_text=False)
    words = [{'w': w.word.strip(), 's': round(max(LEAD, w.start), 3), 'e': round(w.end, 3)} for s in segs for w in s.words if w.word.strip()]
    y, sr = sf.read(f'audio/vo/{sid}.wav'); words = snap_onsets(words, y.mean(1), sr=sr)   # captions land on the voice
    S['slides'][[s['id'] for s in S['slides']].index(sid)]['say'] = ' '.join(w['w'] for w in words)
    json.dump(words, open(f'data/{sid}.words.json', 'w'), indent=0)
json.dump(S, open('story.json', 'w'), indent=1, ensure_ascii=False)

# 2 · graded footage, one file per (slide, look): name = <slide>_<look>, each used in ONE beat
#     (slide, look, focus y): the 4:5 crop of the 9:16 phone frame, face in the upper third
CLIPS = [('01', 'natural', 0.30), ('01', 'teal', 0.30), ('01', 'warm', 0.30),
         ('02', 'natural', 0.30), ('02', 'teal', 0.30), ('02', 'mono', 0.30),
         ('03', 'natural', 0.30), ('03', 'mono', 0.30), ('03', 'teal', 0.30),
         ('04', 'natural', 0.30), ('04', 'mono', 0.30), ('04', 'warm', 0.30),
         ('05', 'natural', 0.62), ('05', 'teal', 0.62), ('05', 'warm', 0.62)]
for sid, look, fy in CLIPS:
    src, t0, t1 = S['source_voice'][sid]
    ss = max(0.0, t0 - LEAD)
    run(f'{SK}/scripts/py', f'{SK}/scripts/clip.py', f'{R}/{src}.mp4', f'{C}/s{sid}_{look}.mp4', '--ss', ss,
        '--dur', round(t1 - ss + 0.2, 2), '--look', look, '--focus', f'0.5,{fy}')

# 3 · stills: a frame at a source time → treated (freeze frames for the tails, the leaflet, the uniform logo)
def frame(src, t, name, vf=None):
    run('ffmpeg', '-nostdin', '-v', 'error', '-y', '-ss', t, '-i', f'{R}/{src}.mp4', '-vframes', '1', *(['-vf', vf] if vf else []), f'{R}/{name}.png')
STILLS = {  # name: (src, source time, look, focus, crop)
    'tail01': ('v_three_things', 7.5, 'natural', (0.5, 0.30)),     # her laugh after "more than three."
    'tail02': ('v_three_things', 14.6, 'warm', (0.5, 0.30)),
    'tail03': ('v_three_things', 21.6, 'natural', (0.5, 0.30)),
    'tail04': ('v_three_things', 26.6, 'teal', (0.5, 0.30)),
    'end05': ('v_leaflet', 19.2, 'mono', (0.5, 0.62)),
}
for name, (src, t, look, focus) in STILLS.items():
    frame(src, t, name); treat(f'{R}/{name}.png', f'{U}/{name}.jpg', look, (1188, 1485), focus, None, 0.0, 0.66)
# (the leaflet and the uniform logo are ~60-90 px wide in the phone footage: too soft as stills, so slide 05 zooms
#  the moving footage onto the leaflet instead. A logo file + the phone number would make a sharp end card.)
print('prep done:', len(os.listdir(U)), 'stills,', len(os.listdir(C)), 'clips')
