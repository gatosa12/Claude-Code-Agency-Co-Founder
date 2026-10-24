"""Honest timing: if the story says how long the carousel took, that number must be true.

  scripts/py scripts/timer.py <project>               minutes since new_carousel.py started the timer
  scripts/py scripts/timer.py <project> --claim 25    record what the story will SAY (before voicing that slide)
  scripts/py scripts/timer.py <project> --final       stop the clock; exit 1 if the real time went past the claim
                                                      (then re-voice that slide with the real number)
"""
import argparse, json, sys, time
from pathlib import Path


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('project'); ap.add_argument('--claim', type=float); ap.add_argument('--final', action='store_true')
    a = ap.parse_args(); f = Path(a.project) / 'timer.json'
    if not f.exists(): sys.exit(f'no timer in {a.project} (new_carousel.py starts it)')
    T = json.loads(f.read_text()); now = time.time()
    mins = (now - T['started']) / 60
    if a.claim is not None:
        T['claim_min'] = a.claim; f.write_text(json.dumps(T, indent=1))
        print(f'claim recorded: {a.claim:g} minutes (so far: {mins:.1f})'); return
    if a.final:
        T['finished'] = now; T['finished_iso'] = time.strftime('%Y-%m-%d %H:%M:%S'); T['took_min'] = round(mins, 1)
        f.write_text(json.dumps(T, indent=1))
        c = T.get('claim_min')
        print(f'took {mins:.1f} minutes' + (f' (claimed {c:g})' if c is not None else ''))
        if c is not None and mins > c:
            print(f'OVER THE CLAIM: re-voice the slide that says {c:g} with the real number ({int(mins + 0.999)})'); sys.exit(1)
        return
    print(f'{mins:.1f} minutes since {T.get("started_iso", "?")}' + (f' · claim {T["claim_min"]:g}' if 'claim_min' in T else ''))


if __name__ == '__main__':
    main()
