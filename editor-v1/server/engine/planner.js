// The autonomous edit engine. Reads the frame/audio analysis and the transcript and writes
// an edit decision list (EDL): B-roll slots with stock queries, camera moves, transitions,
// sound effects, animated titles, captions and a colour grade. The EDL is plain JSON so
// the UI can show, tweak and re-render it.
import { buildPhrases, findEmphasis, scorePhrases } from './keywords.js';
import { autoPreset } from './grading.js';

export const INTENSITY = {
  subtle:   { brollCoverage: 0.18, brollGap: 6,   zoomsPerMin: 4,  titlesPerMin: 1, sfxGap: 1.2, maxBroll: 3.0 },
  balanced: { brollCoverage: 0.32, brollGap: 3.5, zoomsPerMin: 8,  titlesPerMin: 2, sfxGap: 0.6, maxBroll: 3.2 },
  hype:     { brollCoverage: 0.48, brollGap: 2.2, zoomsPerMin: 14, titlesPerMin: 4, sfxGap: 0.35, maxBroll: 2.6 },
};

const TRANSITIONS = ['flash', 'whip', 'zoom'];
const BROLL_IN = ['flash', 'pop', 'fade', 'flash', 'slide'];
const MOTIONS = ['push-in', 'pan-right', 'pull-out', 'pan-left'];

const r2 = (x) => Math.round(x * 100) / 100;
const overlaps = (a, b, pad = 0) => a.start < b.end + pad && b.start < a.end + pad;

export function planEdit({ probe, analysis, audio, transcript, settings }) {
  const duration = probe.duration;
  const P = INTENSITY[settings.intensity] || INTENSITY.balanced;
  const mods = settings.modules;
  const words = transcript?.words || [];
  const loudnessOf = audio?.env?.length
    ? (s, e) => relLoud(audio, s, e)
    : null;

  const phrases = scorePhrases(buildPhrases(words));
  const emphasis = findEmphasis(words, loudnessOf).sort((a, b) => b.score - a.score);
  const events = [];
  let n = 0;
  const id = (type) => `${type}-${++n}`;

  // 1 · B-roll: the most specific, visual phrases, spaced out, capped by coverage.
  const broll = [];
  if (mods.broll) {
    const budget = duration * P.brollCoverage;
    let used = 0;
    // Weak (abstract-only) phrases get no B-roll: a wrong picture is worse than none.
    const candidates = phrases.filter((p) => p.query && p.anchor && p.score >= 0.6).sort((a, b) => b.score - a.score);
    for (const p of candidates) {
      const start = Math.max(1.2, p.anchor.start - 0.08);
      const len = Math.min(P.maxBroll, Math.max(1.4, p.end - start));
      const slot = { start: r2(start), end: r2(Math.min(duration - 0.3, start + len)) };
      if (slot.end - slot.start < 1 || used + (slot.end - slot.start) > budget) continue;
      if (broll.some((b) => overlaps(b, slot, P.brollGap))) continue;
      broll.push({ ...slot, query: p.query, keywords: p.keywords, phrase: p.text });
      used += slot.end - slot.start;
    }
    broll.sort((a, b) => a.start - b.start).forEach((b, k) => {
      events.push({
        id: id('broll'), type: 'broll', enabled: true, start: b.start, end: b.end,
        query: b.query, keywords: b.keywords, phrase: b.phrase,
        transitionIn: BROLL_IN[k % BROLL_IN.length], motion: MOTIONS[k % MOTIONS.length],
        assetId: null,
      });
    });
  }
  const brollEvents = events.filter((e) => e.type === 'broll');
  const onBroll = (t) => brollEvents.some((b) => t >= b.start && t <= b.end);

  // 2 · Camera moves: punch-ins on emphasis, slow pushes on long talking stretches.
  if (mods.zooms) {
    const maxZooms = Math.max(1, Math.round((duration / 60) * P.zoomsPerMin));
    const zooms = [];
    for (const e of emphasis) {
      if (zooms.length >= maxZooms) break;
      const z = { start: r2(Math.max(0, e.t - 0.05)), end: r2(Math.min(duration, e.t + 1.4)) };
      if (onBroll(z.start) || zooms.some((o) => overlaps(o, z, 0.8))) continue;
      zooms.push({ ...z, kind: 'punch', scale: e.score > 2 ? 1.24 : 1.14, word: e.word });
    }
    // Fill quiet stretches with alternating jump-cut zooms per phrase (classic talking-head edit).
    for (const p of phrases) {
      if (zooms.length >= maxZooms) break;
      if (p.end - p.start < 2.2) continue;
      const z = { start: r2(p.start), end: r2(p.end) };
      if (onBroll(z.start) || onBroll(z.end) || zooms.some((o) => overlaps(o, z, 0.3))) continue;
      zooms.push({ ...z, kind: zooms.length % 2 ? 'jump' : 'push', scale: zooms.length % 2 ? 1.12 : 1.07 });
    }
    // No speech at all: slow pushes between cuts so static footage still breathes.
    if (!words.length) {
      const bounds = [0, ...analysis.cuts.map((c) => c.t), duration];
      for (let k = 0; k < bounds.length - 1 && zooms.length < maxZooms; k++) {
        if (bounds[k + 1] - bounds[k] < 2) continue;
        zooms.push({ start: r2(bounds[k]), end: r2(bounds[k + 1]), kind: 'push', scale: 1.08 });
      }
    }
    for (const z of zooms.sort((a, b) => a.start - b.start)) {
      events.push({ id: id('zoom'), type: 'zoom', enabled: true, ...z });
    }
  }

  // 3 · Transitions on the footage's own hard cuts.
  if (mods.transitions) {
    analysis.cuts.forEach((c, k) => {
      if (c.t < 0.3 || c.t > duration - 0.3 || onBroll(c.t)) return;
      events.push({ id: id('transition'), type: 'transition', enabled: true, t: c.t, kind: TRANSITIONS[k % TRANSITIONS.length], duration: 0.25 });
    });
  }

  // 4 · Animated titles: the strongest emphasis words become big on-screen callouts.
  if (mods.titles) {
    const maxTitles = Math.max(1, Math.round((duration / 60) * P.titlesPerMin));
    const titles = [];
    for (const e of emphasis) {
      if (titles.length >= maxTitles) break;
      if (e.word.length < 2) continue;
      const t = { start: r2(e.t), end: r2(Math.min(duration, e.t + 1.1)) };
      if (titles.some((o) => overlaps(o, t, 4))) continue;
      titles.push({ ...t, text: e.word.toUpperCase(), style: titles.length % 2 ? 'slam' : 'pop' });
    }
    for (const t of titles.sort((a, b) => a.start - b.start)) events.push({ id: id('title'), type: 'title', enabled: true, ...t });
  }

  // 5 · Sound design follows the picture: whoosh into transitions, a photo click on each
  //     B-roll change, an impact under big punch-ins, a pop under titles.
  if (mods.sfx) {
    const sfx = [];
    const add = (t, kind, gain = 1, ref) => {
      if (t < 0 || t > duration) return;
      if (sfx.some((s) => Math.abs(s.t - t) < P.sfxGap)) return;
      sfx.push({ t: r2(t), kind, gain, ref });
    };
    for (const e of events) {
      if (e.type === 'transition') add(e.t - 0.18, e.kind === 'zoom' ? 'riser' : 'whoosh', 0.8, e.id);
      if (e.type === 'broll') add(e.start, e.transitionIn === 'slide' ? 'whoosh' : 'click', 0.9, e.id);
      if (e.type === 'title') add(e.start, e.style === 'slam' ? 'impact' : 'pop', 0.9, e.id);
    }
    for (const e of events) if (e.type === 'zoom' && e.kind === 'punch' && e.scale > 1.2) add(e.start, 'impact', 0.7, e.id);
    if (!words.length) for (const m of analysis.motionPeaks.slice(0, 12)) add(m.t - 0.1, 'whoosh', 0.6);
    for (const s of sfx.sort((a, b) => a.t - b.t)) events.push({ id: id('sfx'), type: 'sfx', enabled: true, ...s });
  }

  const emphIdx = new Set(emphasis.filter((e) => e.score >= 1.4).map((e) => e.i));
  return {
    version: 1,
    duration: r2(duration),
    grade: {
      preset: settings.grade === 'auto' ? autoPreset(analysis.stats) : settings.grade,
      strength: settings.gradeStrength,
    },
    captions: {
      enabled: Boolean(mods.captions && words.length),
      style: settings.captionStyle,
      words: words.map((w, i) => ({ start: w.start, end: w.end, word: w.word, emphasis: emphIdx.has(i) })),
    },
    events: events.sort((a, b) => (a.start ?? a.t) - (b.start ?? b.t)),
    context: {
      phrases: phrases.map((p) => ({ start: r2(p.start), end: r2(p.end), text: p.text, query: p.query, score: p.score })),
      emphasis: emphasis.slice(0, 40),
    },
  };
}

function relLoud(audio, s, e) {
  const a = Math.max(0, Math.floor(s / audio.hop));
  const b = Math.min(audio.env.length, Math.max(a + 1, Math.ceil(e / audio.hop)));
  let sum = 0;
  for (let i = a; i < b; i++) sum += audio.env[i];
  return sum / Math.max(1, b - a) / Math.max(audio.median, 1e-4);
}
