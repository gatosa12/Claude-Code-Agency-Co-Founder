"""Word-level transcription for Editor V1 (faster-whisper, runs locally on CPU).

usage: transcribe.py <audio-or-video> <model> <out.json>
Prints PROGRESS <0..1> lines to stderr while it works.
"""
import json
import sys


def main():
    src, model_name, out = sys.argv[1], sys.argv[2], sys.argv[3]
    from faster_whisper import WhisperModel

    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    segments, info = model.transcribe(src, word_timestamps=True, vad_filter=True, beam_size=5)
    duration = info.duration or 1.0
    words, segs = [], []
    for seg in segments:
        segs.append({"start": round(seg.start, 3), "end": round(seg.end, 3), "text": seg.text.strip()})
        for w in seg.words or []:
            words.append({
                "start": round(w.start, 3),
                "end": round(w.end, 3),
                "word": w.word.strip(),
                "p": round(w.probability, 3),
            })
        print(f"PROGRESS {min(1.0, seg.end / duration):.3f}", file=sys.stderr, flush=True)
    with open(out, "w") as f:
        json.dump({"language": info.language, "segments": segs, "words": words}, f)


if __name__ == "__main__":
    main()
