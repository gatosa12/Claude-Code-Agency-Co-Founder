// Validation for EDLs coming back from the browser: whitelist event types and fields,
// clamp every number to the clip, cap text lengths. The render step only ever sees
// output of sanitiseEdl().
import { PRESETS } from './grading.js';
import { SFX_KINDS } from './sfx.js';

const num = (v, lo, hi, d = 0) => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.round(Math.max(lo, Math.min(hi, x)) * 1000) / 1000 : d;
};
const str = (v, max = 120) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').slice(0, max);
const oneOf = (v, list, d) => (list.includes(v) ? v : d);
const ASSET_RE = /^[a-z0-9-]{1,64}$/;

export function sanitiseEdl(input, duration, media = {}) {
  if (!input || typeof input !== 'object') throw Object.assign(new Error('EDL must be an object'), { status: 400 });
  const D = Number(duration) || 0;
  const span = (e) => {
    const start = num(e.start, 0, D);
    const end = num(e.end, start + 0.1, D, Math.min(D, start + 1));
    return { start, end: Math.max(end, Math.min(D, start + 0.1)) };
  };
  const events = (Array.isArray(input.events) ? input.events : []).slice(0, 2000).map((e, k) => {
    const base = { id: str(e.id || `ev-${k}`, 40).replace(/[^\w-]/g, '') || `ev-${k}`, enabled: e.enabled !== false };
    switch (e.type) {
      case 'broll':
        return {
          ...base, type: 'broll', ...span(e),
          query: str(e.query, 100), keywords: (Array.isArray(e.keywords) ? e.keywords : []).slice(0, 6).map((x) => str(x, 40)),
          phrase: str(e.phrase, 300),
          transitionIn: oneOf(e.transitionIn, ['flash', 'pop', 'fade', 'slide', 'cut'], 'flash'),
          motion: oneOf(e.motion, ['push-in', 'pull-out', 'pan-right', 'pan-left', 'none'], 'push-in'),
          assetId: typeof e.assetId === 'string' && ASSET_RE.test(e.assetId) && media[e.assetId] ? e.assetId : null,
          candidates: (Array.isArray(e.candidates) ? e.candidates : []).slice(0, 12).map((c) => ({
            id: str(c.id, 40), thumb: /^https:\/\//.test(c.thumb) ? str(c.thumb, 500) : '', provider: str(c.provider, 20), credit: str(c.credit, 140), kind: c.kind === 'video' ? 'video' : 'image',
          })),
        };
      case 'zoom':
        return { ...base, type: 'zoom', ...span(e), kind: oneOf(e.kind, ['punch', 'jump', 'push'], 'punch'), scale: num(e.scale, 1, 1.6, 1.12), word: str(e.word, 40) };
      case 'transition':
        return { ...base, type: 'transition', t: num(e.t, 0, D), kind: oneOf(e.kind, ['flash', 'whip', 'zoom'], 'flash'), duration: num(e.duration, 0.1, 1, 0.25) };
      case 'title':
        return { ...base, type: 'title', ...span(e), text: str(e.text, 60), style: oneOf(e.style, ['pop', 'slam'], 'pop') };
      case 'sfx':
        return { ...base, type: 'sfx', t: num(e.t, 0, D), kind: oneOf(e.kind, Object.keys(SFX_KINDS), 'whoosh'), gain: num(e.gain, 0, 2, 1), ref: str(e.ref, 40) };
      default:
        return null;
    }
  }).filter(Boolean);

  const cap = input.captions || {};
  return {
    version: 1,
    duration: D,
    grade: {
      preset: oneOf(input.grade?.preset, Object.keys(PRESETS), 'natural'),
      strength: num(input.grade?.strength, 0, 1, 0.8),
    },
    captions: {
      enabled: Boolean(cap.enabled),
      style: oneOf(cap.style, ['pop', 'karaoke', 'minimal'], 'pop'),
      words: (Array.isArray(cap.words) ? cap.words : []).slice(0, 20000).map((w) => {
        const start = num(w.start, 0, D);
        return { start, end: num(w.end, start, D, start), word: str(w.word, 40), emphasis: Boolean(w.emphasis) };
      }),
    },
    events: events.sort((a, b) => (a.start ?? a.t) - (b.start ?? b.t)),
    context: input.context && typeof input.context === 'object' ? {
      phrases: (input.context.phrases || []).slice(0, 2000).map((p) => ({ start: num(p.start, 0, D), end: num(p.end, 0, D), text: str(p.text, 300), query: str(p.query, 100), score: num(p.score, 0, 100) })),
      emphasis: (input.context.emphasis || []).slice(0, 100).map((e) => ({ t: num(e.t, 0, D), word: str(e.word, 40), score: num(e.score, 0, 100) })),
    } : { phrases: [], emphasis: [] },
  };
}
