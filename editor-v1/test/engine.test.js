import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectOnsets, detectSilences } from '../server/analysis/audio.js';
import { detectCuts, parseFrameMetadata } from '../server/analysis/frames.js';
import { assTime, buildAss, escapeAss } from '../server/engine/captions.js';
import { sanitiseEdl } from '../server/engine/edl.js';
import { autoPreset, correction, gradeFilter } from '../server/engine/grading.js';
import { buildPhrases, findEmphasis, scorePhrases } from '../server/engine/keywords.js';
import { planEdit } from '../server/engine/planner.js';
import { escFilterPath, outputSize, zoomExpression } from '../server/engine/render.js';

const words = (text, start = 0, step = 0.3) => text.split(' ').map((w, i) => ({ word: w, start: start + i * step, end: start + i * step + 0.25 }));

test('parses ffmpeg frame metadata', () => {
  const frames = parseFrameMetadata([
    'frame:0    pts:0       pts_time:0',
    'lavfi.scene_score=0.000000', 'lavfi.signalstats.YAVG=100.5', 'lavfi.signalstats.SATAVG=30', 'lavfi.signalstats.YDIF=0',
    'frame:1    pts:512     pts_time:0.0333',
    'lavfi.scene_score=0.62', 'lavfi.signalstats.YAVG=90', 'lavfi.signalstats.SATAVG=20', 'lavfi.signalstats.YDIF=12.5',
  ].join('\n'));
  assert.equal(frames.length, 2);
  assert.deepEqual(frames[1], { t: 0.0333, scene: 0.62, motion: 12.5, luma: 90, sat: 20 });
});

test('detects hard cuts above the adaptive threshold, merging near-duplicates', () => {
  const frames = Array.from({ length: 300 }, (_, i) => ({ t: i / 30, scene: 0.01 }));
  frames[90].scene = 0.8;
  frames[92].scene = 0.9; // same cut, 2 frames later
  frames[200].scene = 0.5;
  const { cuts } = detectCuts(frames);
  assert.equal(cuts.length, 2);
  assert.equal(cuts[0].score, 0.9);
  assert.ok(Math.abs(cuts[1].t - 200 / 30) < 0.01);
});

test('finds silences and onsets in an envelope', () => {
  const env = new Float32Array(200).fill(0.2);
  for (let i = 50; i < 80; i++) env[i] = 0.0001; // 0.6 s pause
  env[120] = 0.9; // a hit
  const { silences } = detectSilences(env);
  assert.equal(silences.length, 1);
  assert.ok(Math.abs(silences[0].start - 1.0) < 0.05 && Math.abs(silences[0].end - 1.6) < 0.05);
  const onsets = detectOnsets(env);
  assert.ok(onsets.some((o) => Math.abs(o.t - 2.4) < 0.05));
});

test('contextual analysis: specific nouns beat abstract ones, idioms map to visuals', () => {
  const ph = scorePhrases(buildPhrases([
    ...words('Nintendo started with playing cards in Kyoto.'),
    ...words('If you have questions just give us a ring today.', 4),
  ]));
  assert.equal(ph.length, 2);
  assert.match(ph[0].query, /nintendo|kyoto|cards/);
  assert.equal(ph[1].query, 'phone call');
  assert.equal(ph[1].anchor.word, 'give');
});

test('emphasis picks numbers, lexicon words and loud words, never stopwords', () => {
  const ws = words('we made one million dollars and it was the biggest launch ever');
  const loud = (s) => (s >= 2.95 && s < 3.05 ? 3 : 1); // "launch" (starts at 3.0 s) shouted
  const em = findEmphasis(ws, loud).map((e) => e.word);
  assert.ok(em.includes('million'));
  assert.ok(em.includes('biggest'));
  assert.ok(em.includes('launch'));
  assert.ok(!em.includes('and') && !em.includes('the'));
});

function fakePlanInput(overrides = {}) {
  const text = 'Nintendo started in Kyoto selling playing cards. Then they made the biggest console in history. Millions of kids played Mario every single day. Today the company is worth billions.';
  return {
    probe: { duration: 20, width: 1920, height: 1080, fps: 30, hasAudio: true },
    analysis: { cuts: [{ t: 7, score: 0.6 }, { t: 14, score: 0.7 }], motionPeaks: [], stats: { frames: 600, lumaMean: 110, satMean: 40 } },
    audio: null,
    transcript: { words: words(text, 0.5, 0.55) },
    settings: { intensity: 'balanced', grade: 'auto', gradeStrength: 0.8, captionStyle: 'pop', modules: { sfx: true, transitions: true, broll: true, zooms: true, titles: true, captions: true } },
    ...overrides,
  };
}

test('planner: B-roll never overlaps, respects coverage, sfx are spaced', () => {
  const edl = planEdit(fakePlanInput());
  const broll = edl.events.filter((e) => e.type === 'broll');
  assert.ok(broll.length >= 1);
  for (let i = 1; i < broll.length; i++) assert.ok(broll[i].start >= broll[i - 1].end, 'B-roll overlaps');
  const covered = broll.reduce((s, b) => s + (b.end - b.start), 0);
  assert.ok(covered <= 20 * 0.32 + 1e-6, `coverage ${covered}`);
  const sfx = edl.events.filter((e) => e.type === 'sfx').map((e) => e.t);
  for (let i = 1; i < sfx.length; i++) assert.ok(sfx[i] - sfx[i - 1] >= 0.6 - 1e-6);
  // zooms never start inside a B-roll insert
  for (const z of edl.events.filter((e) => e.type === 'zoom')) assert.ok(!broll.some((b) => z.start >= b.start && z.start <= b.end));
  assert.equal(edl.grade.preset, 'teal-orange');
  assert.ok(edl.captions.enabled && edl.captions.words.length > 10);
});

test('planner: modules off means no events of that kind', () => {
  const input = fakePlanInput();
  input.settings.modules = { sfx: false, transitions: false, broll: false, zooms: true, titles: false, captions: false };
  const edl = planEdit(input);
  assert.deepEqual([...new Set(edl.events.map((e) => e.type))], ['zoom']);
  assert.equal(edl.captions.enabled, false);
});

test('planner: silent footage still gets camera moves and transitions', () => {
  const edl = planEdit(fakePlanInput({ transcript: null }));
  assert.ok(edl.events.some((e) => e.type === 'zoom'));
  assert.ok(edl.events.some((e) => e.type === 'transition'));
  assert.ok(!edl.events.some((e) => e.type === 'broll'));
});

test('grading: correction targets neutral and strength scales the look', () => {
  const dark = correction({ frames: 10, lumaMean: 60, satMean: 20 });
  assert.ok(dark.brightness > 0 && dark.gamma > 1 && dark.saturation > 1);
  const off = gradeFilter('teal-orange', 0, null);
  assert.match(off, /^eq=brightness=0:gamma=1:contrast=1:saturation=1/);
  assert.ok(!off.includes('colorbalance'));
  const full = gradeFilter('noir', 1, null);
  assert.match(full, /hue=s=0/);
  assert.match(full, /vignette/);
  assert.ok(!gradeFilter('noir', 1, null, { forOverlay: true }).includes('vignette'));
  assert.equal(autoPreset({ satMean: 3, lumaMean: 120 }), 'noir');
});

test('captions: ASS times, escaping, no overlapping caption events', () => {
  assert.equal(assTime(3725.5), '1:02:05.50');
  assert.equal(escapeAss('hi {\\b1}there'), 'hi b1there');
  const ws = words('one two three four five six seven', 0, 0.2).map((w) => ({ ...w, emphasis: w.word === 'four' }));
  const ass = buildAss({ width: 1080, height: 1920, captions: { enabled: true, style: 'pop', words: ws }, titles: [{ start: 1, end: 2, text: 'BIG', style: 'slam' }], font: 'Inter' });
  const toS = (s) => { const [h, m, sec] = s.split(':'); return Number(h) * 3600 + Number(m) * 60 + Number(sec); };
  const caps = ass.split('\n').filter((l) => l.startsWith('Dialogue: 1')).map((l) => l.split(',').slice(1, 3).map(toS));
  for (let i = 1; i < caps.length; i++) assert.ok(caps[i][0] >= caps[i - 1][1] - 1e-9, `caption ${i} overlaps`);
  assert.match(ass, /\\c&H003C3CFF&\}.*four/);
  assert.match(ass, /Dialogue: 2,.*Title.*BIG/);
});

test('EDL sanitiser clamps, whitelists and drops unknown events', () => {
  const edl = sanitiseEdl({
    grade: { preset: 'nope', strength: 7 },
    captions: { enabled: 1, style: 'x', words: [{ start: -3, end: 99, word: 'a'.repeat(100) }] },
    events: [
      { type: 'broll', id: '../../x', start: -5, end: 500, transitionIn: 'evil', assetId: 'missing' },
      { type: 'sfx', t: 3, kind: '; rm -rf /', gain: 50 },
      { type: 'shell', cmd: 'x' },
      { type: 'title', start: 1, end: 2, text: '{\\pos(0,0)}hi' },
    ],
  }, 10, {});
  assert.equal(edl.grade.preset, 'natural');
  assert.equal(edl.grade.strength, 1);
  assert.equal(edl.events.length, 3);
  const b = edl.events.find((e) => e.type === 'broll');
  assert.deepEqual([b.start, b.end, b.transitionIn, b.assetId, b.id], [0, 10, 'flash', null, 'x']);
  const s = edl.events.find((e) => e.type === 'sfx');
  assert.deepEqual([s.kind, s.gain], ['whoosh', 2]);
  assert.equal(edl.captions.words[0].word.length, 40);
  assert.throws(() => sanitiseEdl(null, 10, {}));
});

test('render helpers: output sizes, filter path escaping, zoom curve', () => {
  assert.deepEqual(outputSize('9:16', { width: 1920, height: 1080 }), [1080, 1920]);
  assert.deepEqual(outputSize('source', { width: 3840, height: 2160 }), [1920, 1080]);
  assert.deepEqual(outputSize('9:16', { width: 1, height: 1 }, 'preview'), [540, 960]);
  assert.equal(escFilterPath("/data/a:b/it's[1].ass"), "/data/a\\:b/it\\'s\\[1\\].ass");
  assert.equal(zoomExpression([], []), '1');
  const z = zoomExpression([{ kind: 'jump', start: 1, end: 2, scale: 1.2 }], [{ kind: 'zoom', t: 5, duration: 0.3 }]);
  assert.match(z, /^1\+between\(it,1,2\)\*0\.2\+between\(it,5,5\.3\)/);
});
