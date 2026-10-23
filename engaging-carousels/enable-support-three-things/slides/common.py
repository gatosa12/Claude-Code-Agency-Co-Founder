"""Shared by every slide: the device library, her word timings, and footage() — a graded interview clip kept in
lip sync with her voice (slide time t = source time src_t0 + t - lead)."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../../.claude/skills/engaging-carousel/components'))
from ec_devices import *          # noqa: F401,F403  (re-exported to the builds)

S = json.load(open(os.path.join(HERE, '../story.json')))
LEAD = S['lead']
U, K = 'media/use', 'media/clips'


def footage(c, sid, look, t0, t1, z=1, scale=1.0, origin='50% 38%', rate=0.05, punches=()):
    """her clip for this slide in one grade, from t0 to t1 (slide time), synced to her voice, on a slow push"""
    src, s0, _ = S['source_voice'][sid]
    ss = max(0.0, s0 - LEAD)
    ms = max(0.0, t0 - LEAD + s0 - ss)
    c.cue(t0, 'click')
    return broll(c, t0, t1, f'{K}/s{sid}_{look}.mp4', z, rate=rate, start_scale=scale, origin=origin,
                 media_start=ms, punches=punches)


def tail(c, sid, t0, name, z=1):
    """after her last word: a freeze frame (no silent moving lips), pushing in"""
    still(c, t0, 10.0, f'{U}/{name}.jpg', z, push=1.06)
    c.cue(t0, 'click')
